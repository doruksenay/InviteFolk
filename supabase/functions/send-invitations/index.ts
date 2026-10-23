// POST { event_id: uuid, invitation_ids?: uuid[], kind?: 'invite' | 'reminder' | 'table' | 'announcement', announcement_id?, audience? }
// Etkinliği yönetenin (sahip ya da ortak yönetici) davetlilerine WhatsApp şablonu gönderir.
//   invite/reminder → WHATSAPP_INVITE_TEMPLATE (varsayılan davet_lcv): {{1}} ad, {{2}} etkinlik, {{3}} tarih ve yer + iki hızlı yanıt düğmesi
//   table           → WHATSAPP_TABLE_TEMPLATE (varsayılan davet_masa): {{1}} ad, {{2}} etkinlik, {{3}} masa
//   announcement    → WHATSAPP_ANNOUNCE_TEMPLATE (varsayılan davet_duyuru): {{1}} ad, {{2}} etkinlik, {{3}} duyuru, {{4}} link
// Etkinlikte "WhatsApp'a ulaşılamazsa SMS" açıksa ve SMS hakkı varsa, gönderilemeyen davetliye SMS gider.
// Ortam: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_*_TEMPLATE, WHATSAPP_TEMPLATE_LANG(_EN), ALLOWED_ORIGINS
//
// Güvenlik:
// - Etkinlik ve davetler KULLANICININ yetkisiyle okunur (RLS): yönetmediği etkinliğe gönderim yapılamaz.
// - Servis anahtarı yalnızca istemcinin yazamadığı mesaj günlüğü ve teslim durumu için kullanılır.
// - Günlük hak etkinlik sahibinin paketinden gelir; aşılırsa gönderilmez.
// - Hata ayrıntıları istemciye dönmez, yalnızca sunucu günlüğüne yazılır.

import { deliverSms, deliverWhatsApp, smsFallbackOn } from '../_shared/delivery.ts';
import { langOf } from '../_shared/messages.ts';
import { parseSendRequest, quotaLeft } from '../_shared/send.ts';
import { smsConfigured } from '../_shared/sms.ts';
import { adminClient, corsHeaders, json } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405);

  const r = await parseSendRequest(req, 'whatsapp');
  if ('error' in r) return json(req, { error: r.error }, r.status);

  let quota = await quotaLeft(r, 'whatsapp');
  if (quota <= 0) return json(req, { error: 'quota_exceeded', detail: 'whatsapp', sent: 0, failed: 0, skipped: r.targets.length }, 402);
  let smsQuota = smsFallbackOn(r.event) && smsConfigured() ? await quotaLeft(r, 'sms') : 0;

  const lang = langOf(r.event.settings);
  const db = adminClient();
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let viaSms = 0;

  for (const target of r.targets) {
    if (quota <= 0) {
      skipped++;
      continue;
    }
    let outcome = await deliverWhatsApp(db, r.event, target, r.kind, lang, r.message);
    if (outcome !== 'skipped') quota--;
    if (outcome === 'failed' && smsQuota > 0) {
      const s = await deliverSms(db, r.event, target, r.kind, lang, r.message);
      if (s !== 'skipped') smsQuota--;
      if (s === 'sent') {
        outcome = 'sent';
        viaSms++;
      }
    }
    if (outcome === 'sent') sent++;
    else if (outcome === 'failed') failed++;
    else skipped++;
  }

  if (r.event.status === 'draft' && sent > 0 && r.kind === 'invite') {
    await r.asUser.from('events').update({ status: 'active' }).eq('id', r.event.id);
  }

  return json(req, { sent, failed, skipped, quota_left: quota, via_sms: viaSms });
});
