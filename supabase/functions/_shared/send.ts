// send-invitations, send-email ve send-sms için ortak istek işleme:
// girdi doğrulama, kullanıcı kimliği, etkinliği yönetme yetkisi (RLS: sahip ya da ortak yönetici),
// hedef davetlilerin yüklenmesi ve günlük kota (her zaman etkinlik sahibinin paketinden).

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

import type { Channel, DeliveryEvent, DeliveryKind, DeliveryTarget } from './delivery.ts';
import { adminClient, readBody, userClient, UUID } from './supabase.ts';

export const MAX_IDS = 1000;

export type SendRequest = {
  asUser: SupabaseClient;
  userId: string;
  event: DeliveryEvent & { status: string; owner_id: string };
  kind: DeliveryKind;
  targets: DeliveryTarget[];
  hostName: string | null;
  /** Duyuru metni (kind = 'announcement'). */
  message: string | null;
};

export type SendError = { status: number; error: string };

export async function parseSendRequest(req: Request, channel: Channel): Promise<SendRequest | SendError> {
  const raw = await readBody(req);
  if (raw === null) return { status: 413, error: 'payload_too_large' };
  let body: { event_id?: unknown; invitation_ids?: unknown; kind?: unknown; announcement_id?: unknown; audience?: unknown };
  try {
    body = JSON.parse(raw || '{}');
  } catch {
    return { status: 400, error: 'invalid_json' };
  }

  const eventId = typeof body.event_id === 'string' && UUID.test(body.event_id) ? body.event_id : null;
  const kind: DeliveryKind | null =
    body.kind === undefined || body.kind === 'invite'
      ? 'invite'
      : body.kind === 'reminder' || body.kind === 'table' || body.kind === 'announcement'
        ? body.kind
        : null;
  const ids = Array.isArray(body.invitation_ids) ? body.invitation_ids : null;
  if (!eventId || !kind) return { status: 400, error: 'invalid_input' };
  if (ids && (ids.length > MAX_IDS || !ids.every((x) => typeof x === 'string' && UUID.test(x)))) return { status: 400, error: 'invalid_input' };
  // Duyuru metni istemciden alınmaz: daha önce kaydedilmiş (günlük sınırı olan) duyurunun kimliği gelir, metin sunucuda okunur.
  const announcementId = kind === 'announcement' && typeof body.announcement_id === 'string' && UUID.test(body.announcement_id) ? body.announcement_id : null;
  if (kind === 'announcement' && !announcementId) return { status: 400, error: 'invalid_input' };
  const audience = body.audience === 'yes' ? 'yes' : 'all';

  // Kimlik ve yetki: kullanıcının kendi yetkisiyle (RLS sahiplik ya da ortak yöneticiliği denetler).
  const asUser = userClient(req);
  const { data: auth } = await asUser.auth.getUser();
  if (!auth?.user) return { status: 401, error: 'unauthorized' };

  const { data: event } = await asUser
    .from('events')
    .select('id, owner_id, title, theme, starts_at, venue_name, venue_address, rsvp_deadline, host_names, status, settings')
    .eq('id', eventId)
    .maybeSingle();
  if (!event) return { status: 404, error: 'not_found' };

  let q = asUser
    .from('invitations')
    .select('id, token, status, table_id, contacts!inner(name, phone, email), seating_tables(label)')
    .eq('event_id', eventId);
  if (ids?.length) q = q.in('id', ids);
  if (kind === 'reminder') q = q.eq('status', 'pending');
  if (kind === 'table') q = q.eq('status', 'yes').not('table_id', 'is', null);
  if (kind === 'announcement') q = audience === 'yes' ? q.eq('status', 'yes') : q.neq('status', 'no');
  const { data: rows, error } = await q.limit(MAX_IDS);
  if (error) {
    console.error('invitations', error);
    return { status: 500, error: 'server_error' };
  }

  const { data: profile } = await asUser.from('profiles').select('full_name, suspended_at').eq('id', auth.user.id).maybeSingle();
  // Askıya alınmış hesap mesaj gönderemez (veritabanı da sahibin askıdaki kotasını 0 döndürür).
  if (!profile || profile.suspended_at) return { status: 403, error: 'forbidden' };

  // Duyuru: kayıt kullanıcının yetkisiyle okunur (yalnızca yönettiği etkinliğin duyurusu), son 24 saatte yazılmış olmalı
  // ve her kanaldan yalnızca bir kez gönderilir (aynı duyuruyla tekrar tekrar mesaj atılamaz).
  let message: string | null = null;
  if (kind === 'announcement') {
    const { data: ann } = await asUser
      .from('event_announcements')
      .select('id, body, created_at')
      .eq('id', announcementId!)
      .eq('event_id', eventId)
      .maybeSingle();
    if (!ann || Date.now() - new Date(ann.created_at as string).getTime() > 24 * 3600 * 1000) return { status: 404, error: 'not_found' };
    const { data: claimed, error: claimErr } = await adminClient().rpc('claim_announcement_channel', { p_id: ann.id, p_channel: channel });
    if (claimErr) {
      console.error('claim_announcement_channel', claimErr);
      return { status: 500, error: 'server_error' };
    }
    if (!claimed) return { status: 409, error: 'already_sent' };
    message = String(ann.body).trim().slice(0, 500);
  }

  const targets: DeliveryTarget[] = (rows ?? []).map((r) => {
    // deno-lint-ignore no-explicit-any
    const x = r as any;
    return {
      invitation_id: x.id,
      token: x.token,
      name: String(x.contacts?.name ?? ''),
      phone: x.contacts?.phone ?? null,
      email: x.contacts?.email ?? null,
      table_label: x.seating_tables?.label ?? null,
    };
  });

  return {
    asUser,
    userId: auth.user.id,
    event: event as DeliveryEvent & { status: string; owner_id: string },
    kind,
    targets,
    hostName: (event.host_names as string | null) ?? (profile?.full_name as string | null) ?? null,
    message,
  };
}

/** Etkinlik sahibinin bu kanaldaki kalan günlük hakkı (ortak yönetici gönderse de sahibin paketinden düşer). */
export async function quotaLeft(r: SendRequest, channel: Channel): Promise<number> {
  const { data, error } = await r.asUser.rpc('event_quota_left', { p_event: r.event.id, p_channel: channel });
  if (error) {
    console.error('event_quota_left', error);
    return 0;
  }
  return Number(data ?? 0);
}
