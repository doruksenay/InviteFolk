// POST { event_id: uuid, invitation_ids?: uuid[], kind?: 'invite' | 'reminder' | 'table' | 'announcement', announcement_id?, audience? }
// Etkinliği yönetenin telefonu olan davetlilerine SMS gönderir (WhatsApp kullanmayanlar için).
// Yanıt: { sent, failed, skipped, quota_left }  ·  Hak bittiğinde 402 { error: 'quota_exceeded', detail: 'sms' }
// Ortam: NETGSM_USERCODE, NETGSM_PASSWORD, NETGSM_HEADER, APP_WEB_URL
//
// Güvenlik: send-invitations ile aynı (RLS ile okuma, sahibin paket kotası, genel hata mesajları).

import { deliverSms } from '../_shared/delivery.ts';
import { appWebUrl } from '../_shared/email.ts';
import { langOf } from '../_shared/messages.ts';
import { parseSendRequest, quotaLeft } from '../_shared/send.ts';
import { smsConfigured } from '../_shared/sms.ts';
import { adminClient, corsHeaders, json } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405);
  if (!smsConfigured() || !appWebUrl()) {
    console.error('send-sms: NETGSM_* / APP_WEB_URL eksik');
    return json(req, { error: 'not_configured' }, 503);
  }

  const r = await parseSendRequest(req, 'sms');
  if ('error' in r) return json(req, { error: r.error }, r.status);

  let quota = await quotaLeft(r, 'sms');
  if (quota <= 0) return json(req, { error: 'quota_exceeded', detail: 'sms', sent: 0, failed: 0, skipped: r.targets.length }, 402);

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
    const outcome = await deliverSms(db, r.event, target, r.kind, lang, r.message);
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
