// POST { event_id, email, lang? }  →  { id, token, link, emailed }
// Etkinlik sahibi ortak yönetici davet eder; link e-postayla da gönderilir (Resend kuruluysa).
// Link yalnızca davet edilen adresle giriş yapan hesapça ve bir kez kabul edilebilir (veritabanı zorlar).
//
// Güvenlik: davet, kullanıcının kendi yetkisiyle invite_cohost RPC'si üzerinden (sahiplik ve paket sınırı orada).

import { appWebUrl, cleanHeader, renderCohostInvite, sendEmail } from '../_shared/email.ts';
import { corsHeaders, json, readBody, userClient, UUID } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405);
  const raw = await readBody(req, 4 * 1024);
  if (raw === null) return json(req, { error: 'payload_too_large' }, 413);
  let body: { event_id?: unknown; email?: unknown; lang?: unknown };
  try {
    body = JSON.parse(raw || '{}');
  } catch {
    return json(req, { error: 'invalid_json' }, 400);
  }
  const eventId = typeof body.event_id === 'string' && UUID.test(body.event_id) ? body.event_id : null;
  const email = typeof body.email === 'string' ? body.email.trim().slice(0, 254) : '';
  if (!eventId || !email) return json(req, { error: 'invalid_input' }, 400);

  const asUser = userClient(req);
  const { data: auth } = await asUser.auth.getUser();
  if (!auth?.user) return json(req, { error: 'unauthorized' }, 401);

  const { data, error } = await asUser.rpc('invite_cohost', { p_event: eventId, p_email: email });
  if (error) {
    const msg = String(error.message ?? '');
    const code = msg.includes('quota_exceeded') ? 'quota_exceeded' : msg.includes('forbidden') ? 'forbidden' : msg.includes('invalid_input') ? 'invalid_input' : msg.includes('rate_limited') ? 'rate_limited' : 'server_error';
    if (code === 'server_error') console.error('invite_cohost', error);
    const status = code === 'forbidden' ? 403 : code === 'quota_exceeded' ? 402 : code === 'rate_limited' ? 429 : code === 'server_error' ? 500 : 400;
    return json(req, { error: code, detail: code === 'quota_exceeded' ? 'cohosts' : (error.details ?? null) }, status);
  }
  const res = data as { id: string; token: string | null; accepted: boolean; cooldown?: boolean };
  const base = appWebUrl();
  const link = res.token && base ? `${base}/katil/${res.token}` : null;

  let emailed = false;
  // Aynı adrese 10 dakika içinde tekrar davet: e-posta yeniden gönderilmez (link yine döner, elle paylaşılabilir).
  if (link && !res.cooldown && Deno.env.get('RESEND_API_KEY') && Deno.env.get('EMAIL_FROM')) {
    const [{ data: ev }, { data: me }] = await Promise.all([
      asUser.from('events').select('title, settings').eq('id', eventId).maybeSingle(),
      asUser.from('profiles').select('full_name, locale').eq('id', auth.user.id).maybeSingle(),
    ]);
    const lang = body.lang === 'en' || (body.lang !== 'tr' && me?.locale === 'en') ? 'en' : 'tr';
    const mail = renderCohostInvite({ lang, eventTitle: cleanHeader(String(ev?.title ?? ''), 120), inviter: me?.full_name ?? null, link });
    const r = await sendEmail({ to: email, ...mail, idempotencyKey: `cohost-${res.id}-${res.token}` });
    emailed = r.ok;
  }
  return json(req, { id: res.id, token: res.token, link, accepted: res.accepted, emailed });
});
