// Yapay zekâ yardımcısı (giriş yapmış organizatör; paket başına günlük hak).
//   POST { action: 'write', lang, type, title?, hosts?, tone?, hint? }        → { text }       davet metni yazar
//   POST { action: 'extract', image: <base64>, media_type }                    → { fields }     basılı davetiyenin
//        fotoğrafından başlık, ev sahipleri, tarih, saat, mekân ve adresi çıkarır
// Ortam: ANTHROPIC_API_KEY, AI_MODEL (varsayılan claude-sonnet-5-5), ANTHROPIC_VERSION (varsayılan 2023-06-01)
//
// Güvenlik ve maliyet:
// - Kullanıcı kimliği doğrulanır; günlük hak veritabanında atomik düşülür (ai_take, yalnızca sunucu).
// - Görsel en fazla ~5 MB; metin alanları kısaltılır. Model çıktısı yalnızca beklenen alanlara süzülür.
// - Görsel saklanmaz; yalnızca bu istek için modele gönderilir.

import { adminClient, corsHeaders, json, readBody, userClient } from '../_shared/supabase.ts';

const MODEL = () => Deno.env.get('AI_MODEL') ?? 'claude-sonnet-5-5';
const VERSION = () => Deno.env.get('ANTHROPIC_VERSION') ?? '2023-06-01';
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const EVENT_TYPES = new Set(['dugun', 'nisan', 'kina', 'sunnet', 'bebek', 'mevlut', 'mezuniyet', 'veda', 'dogum', 'yemek', 'kurumsal', 'saha', 'basket', 'voleybol', 'diger']);

const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '');

async function claude(content: unknown[], system: string, maxTokens: number): Promise<string | null> {
  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) {
    console.error('ANTHROPIC_API_KEY tanımlı değil');
    return null;
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': VERSION(), 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL(), max_tokens: maxTokens, system, messages: [{ role: 'user', content }] }),
    signal: AbortSignal.timeout(45000),
  }).catch((e) => {
    console.error('ai fetch', e);
    return null;
  });
  if (!res?.ok) {
    console.error('ai status', res?.status, await res?.text().catch(() => ''));
    return null;
  }
  const body = await res.json().catch(() => null);
  const text = (body?.content ?? []).filter((c: { type: string }) => c.type === 'text').map((c: { text: string }) => c.text).join('');
  return text || null;
}

function firstJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405);

  const raw = await readBody(req, 7 * 1024 * 1024);
  if (raw === null) return json(req, { error: 'payload_too_large' }, 413);
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw || '{}');
  } catch {
    return json(req, { error: 'invalid_json' }, 400);
  }

  const asUser = userClient(req);
  const { data: auth } = await asUser.auth.getUser();
  if (!auth?.user) return json(req, { error: 'unauthorized' }, 401);

  const action = body.action;
  if (action !== 'write' && action !== 'extract') return json(req, { error: 'invalid_input' }, 400);
  if (action === 'extract') {
    const img = typeof body.image === 'string' ? body.image : '';
    const mt = typeof body.media_type === 'string' ? body.media_type : '';
    if (!TYPES.has(mt) || img.length < 100 || img.length > 5 * 1024 * 1024 * 1.37 || !/^[A-Za-z0-9+/=]+$/.test(img.slice(0, 200))) {
      return json(req, { error: 'invalid_input' }, 400);
    }
  }

  const db = adminClient();
  const { data: allowed, error: takeErr } = await db.rpc('ai_take', { p_user: auth.user.id });
  if (takeErr) {
    console.error('ai_take', takeErr);
    return json(req, { error: 'server_error' }, 500);
  }
  if (!allowed) return json(req, { error: 'quota_exceeded', detail: 'ai' }, 402);

  if (action === 'write') {
    const lang = body.lang === 'en' ? 'en' : 'tr';
    const type = typeof body.type === 'string' && EVENT_TYPES.has(body.type) ? body.type : 'diger';
    const tone = ['warm', 'formal', 'fun', 'short'].includes(String(body.tone)) ? String(body.tone) : 'warm';
    const system =
      lang === 'en'
        ? 'You write the short body text of an event invitation. Reply with the invitation text only: 1–3 sentences, at most 300 characters, no greeting line, no date or address (they are shown separately), no emojis, no quotation marks.'
        : 'Bir etkinlik davetiyesinin kısa metnini yazıyorsun. Yalnızca davet metnini yaz: 1–3 cümle, en fazla 300 karakter, hitap satırı yok, tarih ve adres yok (ayrıca gösteriliyor), emoji yok, tırnak işareti yok. Doğal ve sıcak bir Türkçe kullan.';
    const prompt = [
      `type: ${type}`,
      `title: ${clip(body.title, 120)}`,
      `hosts: ${clip(body.hosts, 160)}`,
      `tone: ${tone}`,
      `note from host: ${clip(body.hint, 300)}`,
    ].join('\n');
    const text = await claude([{ type: 'text', text: prompt }], system, 400);
    if (!text) return json(req, { error: 'ai_unavailable' }, 503);
    return json(req, { text: text.replace(/^["“”']+|["“”']+$/g, '').trim().slice(0, 400) });
  }

  const system =
    'You read a photo of a printed invitation and extract its details. Reply with one JSON object only, no prose, with these keys (use null when absent): ' +
    '{"title": string (e.g. couple names "Ayşe & Mehmet" or the event name), "host_names": string (families or hosts inviting), ' +
    '"date": "YYYY-MM-DD", "time": "HH:MM" (24h), "venue_name": string, "venue_address": string, "message": string (the invitation sentence, max 300 chars), ' +
    '"type": one of dugun|nisan|kina|sunnet|bebek|mevlut|mezuniyet|veda|dogum|yemek|kurumsal|saha|basket|voleybol|diger (saha = football, sunnet = circumcision feast, bebek = baby shower or gender reveal, veda = hen/stag party)}. Keep the original language and spelling.';
  const text = await claude(
    [
      { type: 'image', source: { type: 'base64', media_type: body.media_type, data: body.image } },
      { type: 'text', text: 'Extract the invitation details as JSON.' },
    ],
    system,
    800,
  );
  const parsed = text ? firstJson(text) : null;
  if (!parsed) return json(req, { error: 'ai_unavailable' }, 503);
  const date = typeof parsed.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : null;
  const time = typeof parsed.time === 'string' && /^\d{1,2}:\d{2}$/.test(parsed.time) ? parsed.time.padStart(5, '0') : null;
  const fields = {
    title: clip(parsed.title, 120) || null,
    host_names: clip(parsed.host_names, 160) || null,
    date,
    time,
    venue_name: clip(parsed.venue_name, 160) || null,
    venue_address: clip(parsed.venue_address, 300) || null,
    message: clip(parsed.message, 400) || null,
    type: typeof parsed.type === 'string' && EVENT_TYPES.has(parsed.type) ? parsed.type : null,
  };
  return json(req, { fields });
});
