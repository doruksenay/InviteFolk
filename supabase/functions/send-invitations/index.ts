// POST { event_id: uuid, invitation_ids?: uuid[], kind?: 'invite' | 'reminder' | 'table' }
// Organizatörün kendi etkinliğindeki davetlilere WhatsApp şablonu gönderir.
//   invite/reminder → WHATSAPP_INVITE_TEMPLATE (varsayılan davet_lcv): {{1}} ad, {{2}} etkinlik, {{3}} tarih ve yer + iki hızlı yanıt düğmesi
//   table           → WHATSAPP_TABLE_TEMPLATE (varsayılan davet_masa): {{1}} ad, {{2}} etkinlik, {{3}} masa; yalnızca masası atanmış ve gelen davetliler
// Ortam: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_INVITE_TEMPLATE, WHATSAPP_TABLE_TEMPLATE,
//        WHATSAPP_TEMPLATE_LANG ("tr"), WHATSAPP_TEMPLATE_LANG_EN ("en"), ALLOWED_ORIGINS
//
// Güvenlik:
// - Etkinlik ve davetler KULLANICININ yetkisiyle okunur (RLS): başkasının etkinliğine gönderim yapılamaz.
// - Servis anahtarı yalnızca istemcinin yazamadığı mesaj günlüğü ve teslim durumu için kullanılır.
// - Günlük WhatsApp hakkı veritabanındaki paket kotasından gelir; aşılırsa gönderilmez.
// - Hata ayrıntıları istemciye dönmez, yalnızca sunucu günlüğüne yazılır.

import { deliverWhatsApp } from '../_shared/delivery.ts';
import { langOf } from '../_shared/messages.ts';
import { parseSendRequest } from '../_shared/send.ts';
import { adminClient, corsHeaders, json } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405);

  const r = await parseSendRequest(req);
  if ('error' in r) return json(req, { error: r.error }, r.status);

  const { data: left } = await r.asUser.rpc('whatsapp_quota_left');
  let quota = Number(left ?? 0);
  if (quota <= 0) return json(req, { error: 'quota_exceeded', detail: 'whatsapp', sent: 0, failed: 0, skipped: r.targets.length }, 402);

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
    const outcome = await deliverWhatsApp(db, r.event, target, r.kind, lang);
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
