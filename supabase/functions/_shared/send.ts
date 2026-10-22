// send-invitations ve send-email için ortak istek işleme:
// girdi doğrulama, kullanıcı kimliği, etkinlik sahipliği (RLS) ve hedef davetlilerin yüklenmesi.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

import type { DeliveryEvent, DeliveryKind, DeliveryTarget } from './delivery.ts';
import { readBody, userClient, UUID } from './supabase.ts';

export const MAX_IDS = 1000;

export type SendRequest = {
  asUser: SupabaseClient;
  userId: string;
  event: DeliveryEvent & { status: string };
  kind: DeliveryKind;
  targets: DeliveryTarget[];
  hostName: string | null;
};

export type SendError = { status: number; error: string };

export async function parseSendRequest(req: Request): Promise<SendRequest | SendError> {
  const raw = await readBody(req);
  if (raw === null) return { status: 413, error: 'payload_too_large' };
  let body: { event_id?: unknown; invitation_ids?: unknown; kind?: unknown };
  try {
    body = JSON.parse(raw || '{}');
  } catch {
    return { status: 400, error: 'invalid_json' };
  }

  const eventId = typeof body.event_id === 'string' && UUID.test(body.event_id) ? body.event_id : null;
  const kind: DeliveryKind | null =
    body.kind === undefined || body.kind === 'invite' ? 'invite' : body.kind === 'reminder' ? 'reminder' : body.kind === 'table' ? 'table' : null;
  const ids = Array.isArray(body.invitation_ids) ? body.invitation_ids : null;
  if (!eventId || !kind) return { status: 400, error: 'invalid_input' };
  if (ids && (ids.length > MAX_IDS || !ids.every((x) => typeof x === 'string' && UUID.test(x)))) return { status: 400, error: 'invalid_input' };

  // Kimlik ve yetki: kullanıcının kendi yetkisiyle (RLS sahipliği denetler).
  const asUser = userClient(req);
  const { data: auth } = await asUser.auth.getUser();
  if (!auth?.user) return { status: 401, error: 'unauthorized' };

  const { data: event } = await asUser
    .from('events')
    .select('id, title, theme, starts_at, venue_name, venue_address, rsvp_deadline, host_names, status, settings')
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
  const { data: rows, error } = await q.limit(MAX_IDS);
  if (error) {
    console.error('invitations', error);
    return { status: 500, error: 'server_error' };
  }

  const { data: profile } = await asUser.from('profiles').select('full_name, suspended_at').eq('id', auth.user.id).maybeSingle();
  // Askıya alınmış hesap mesaj gönderemez (veritabanı da kotayı 0 döndürür).
  if (!profile || profile.suspended_at) return { status: 403, error: 'forbidden' };

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
    event: event as DeliveryEvent & { status: string },
    kind,
    targets,
    hostName: (event.host_names as string | null) ?? (profile?.full_name as string | null) ?? null,
  };
}
