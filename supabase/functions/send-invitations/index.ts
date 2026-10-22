// POST { event_id: uuid, invitation_ids?: uuid[], kind?: 'invite' | 'reminder' }
// Organizatörün kendi etkinliğindeki davetlilere WhatsApp şablonu gönderir.
// Ortam: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_INVITE_TEMPLATE,
//        WHATSAPP_TEMPLATE_LANG (tr, varsayılan "tr"), WHATSAPP_TEMPLATE_LANG_EN (varsayılan "en"), ALLOWED_ORIGINS
//
// Güvenlik:
// - Etkinlik ve davetler KULLANICININ yetkisiyle okunur (RLS): başkasının etkinliğine gönderim yapılamaz.
// - Servis rolü yalnızca istemcinin yazamadığı mesaj günlüğü ve teslim durumu için kullanılır.
// - Günlük WhatsApp hakkı veritabanındaki paket kotasından gelir; aşılırsa gönderilmez.
// - Hata ayrıntıları istemciye dönmez, yalnızca sunucu günlüğüne yazılır.

import { LOCALE, langOf, text } from '../_shared/messages.ts';
import { adminClient, corsHeaders, json, readBody, userClient, UUID } from '../_shared/supabase.ts';
import { sendInviteTemplate, toWaNumber } from '../_shared/whatsapp.ts';

const MAX_IDS = 1000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405);

  const raw = await readBody(req);
  if (raw === null) return json(req, { error: 'payload_too_large' }, 413);
  let body: { event_id?: unknown; invitation_ids?: unknown; kind?: unknown };
  try {
    body = JSON.parse(raw || '{}');
  } catch {
    return json(req, { error: 'invalid_json' }, 400);
  }

  const eventId = typeof body.event_id === 'string' && UUID.test(body.event_id) ? body.event_id : null;
  const kind = body.kind === 'reminder' ? 'reminder' : body.kind === undefined || body.kind === 'invite' ? 'invite' : null;
  const ids = Array.isArray(body.invitation_ids) ? body.invitation_ids : null;
  if (!eventId || !kind) return json(req, { error: 'invalid_input' }, 400);
  if (ids && (ids.length > MAX_IDS || !ids.every((x) => typeof x === 'string' && UUID.test(x)))) return json(req, { error: 'invalid_input' }, 400);

  // 1) Kimlik ve yetki: kullanıcının kendi yetkisiyle.
  const asUser = userClient(req);
  const { data: auth } = await asUser.auth.getUser();
  if (!auth?.user) return json(req, { error: 'unauthorized' }, 401);

  const { data: event } = await asUser
    .from('events')
    .select('id, title, starts_at, venue_name, status, settings')
    .eq('id', eventId)
    .maybeSingle();
  if (!event) return json(req, { error: 'not_found' }, 404);

  let q = asUser.from('invitations').select('id, token, status, contacts!inner(name, phone)').eq('event_id', eventId);
  if (ids?.length) q = q.in('id', ids);
  if (kind === 'reminder') q = q.eq('status', 'pending');
  const { data: invites, error: invErr } = await q.limit(MAX_IDS);
  if (invErr) {
    console.error('invitations', invErr);
    return json(req, { error: 'server_error' }, 500);
  }

  // 2) Paket kotası (günlük WhatsApp hakkı).
  const { data: left } = await asUser.rpc('whatsapp_quota_left');
  let quota = Number(left ?? 0);
  if (quota <= 0) return json(req, { error: 'quota_exceeded', detail: 'whatsapp', sent: 0, failed: 0, skipped: invites?.length ?? 0 }, 402);

  const lang = langOf(event.settings);
  const template = Deno.env.get('WHATSAPP_INVITE_TEMPLATE') ?? 'davet_lcv';
  const language = lang === 'en' ? (Deno.env.get('WHATSAPP_TEMPLATE_LANG_EN') ?? 'en') : (Deno.env.get('WHATSAPP_TEMPLATE_LANG') ?? 'tr');
  const fmt = new Intl.DateTimeFormat(LOCALE[lang], { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Istanbul' });
  const whenWhere = [event.starts_at ? fmt.format(new Date(event.starts_at)) : null, event.venue_name].filter(Boolean).join(' · ');

  const db = adminClient();
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const inv of invites ?? []) {
    // deno-lint-ignore no-explicit-any
    const contact = (inv as any).contacts as { name: string; phone: string | null };
    const to = contact?.phone ? toWaNumber(contact.phone) : null;
    if (!to || quota <= 0) {
      skipped++;
      continue;
    }
    quota--;

    const { data: msg } = await db.from('messages').insert({ invitation_id: inv.id, channel: 'whatsapp', kind, status: 'queued' }).select('id').single();

    const result = await sendInviteTemplate({
      to,
      template,
      language,
      guestName: contact.name.slice(0, 60),
      eventTitle: event.title.slice(0, 120),
      whenWhere: whenWhere || text(lang).detailsInInvite,
      token: inv.token,
    });

    if (result.ok) {
      sent++;
      await db.from('messages').update({ status: 'sent', provider_id: result.id }).eq('id', msg!.id);
      await db.from('invitations').update({ delivery: 'sent' }).eq('id', inv.id);
    } else {
      failed++;
      console.error('whatsapp send failed', result.code, result.detail);
      await db.from('messages').update({ status: 'failed', error_code: result.code.slice(0, 20) }).eq('id', msg!.id);
      await db.from('invitations').update({ delivery: 'failed' }).eq('id', inv.id);
    }

    // Meta hız sınırlarına saygı.
    await new Promise((r) => setTimeout(r, 120));
  }

  if (event.status === 'draft' && sent > 0) {
    await asUser.from('events').update({ status: 'active' }).eq('id', eventId);
  }

  return json(req, { sent, failed, skipped, quota_left: quota });
});
