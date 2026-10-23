// POST { event_id: uuid, invitation_ids?: uuid[], kind?: 'invite' | 'reminder' | 'table' | 'announcement', announcement_id?, audience? }
// Etkinliği yönetenin (sahip ya da ortak yönetici), e-posta adresi olan davetlilerine davet / hatırlatma / "masanız" / duyuru e-postası gönderir.
// Yanıt: { sent, failed, skipped, quota_left }  ·  Kota bittiğinde 402 { error: 'quota_exceeded', detail: 'email' }
// Ortam: RESEND_API_KEY, EMAIL_FROM, EMAIL_REPLY_TO (isteğe bağlı), APP_WEB_URL, ALLOWED_ORIGINS
//
// Güvenlik: send-invitations ile aynı (RLS ile okuma, kota, girdi doğrulama, genel hata mesajları).
// E-postadaki her değer escape edilir; link yalnızca APP_WEB_URL + davet anahtarı.

import { deliverEmail } from '../_shared/delivery.ts';
import { appWebUrl } from '../_shared/email.ts';
import { langOf } from '../_shared/messages.ts';
import { parseSendRequest, quotaLeft } from '../_shared/send.ts';
import { adminClient, corsHeaders, json } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405);
  if (!Deno.env.get('RESEND_API_KEY') || !Deno.env.get('EMAIL_FROM') || !appWebUrl()) {
    console.error('send-email: RESEND_API_KEY / EMAIL_FROM / APP_WEB_URL eksik');
    return json(req, { error: 'not_configured' }, 503);
  }

  const r = await parseSendRequest(req, 'email');
  if ('error' in r) return json(req, { error: r.error }, r.status);

  let quota = await quotaLeft(r, 'email');
  if (quota <= 0) return json(req, { error: 'quota_exceeded', detail: 'email', sent: 0, failed: 0, skipped: r.targets.length }, 402);

  const lang = langOf(r.event.settings);
  const db = adminClient();
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const target of r.targets) {
    if (quota <= 0) {
      skipped++;
      continue;
    }
    const outcome = await deliverEmail(db, r.event, target, r.kind, lang, r.hostName, r.message);
    if (outcome === 'sent') sent++;
    else if (outcome === 'failed') failed++;
    else skipped++;
    if (outcome !== 'skipped') quota--;
  }

  if (r.event.status === 'draft' && sent > 0 && r.kind === 'invite') {
    await r.asUser.from('events').update({ status: 'active' }).eq('id', r.event.id);
  }

  return json(req, { sent, failed, skipped, quota_left: quota });
});
