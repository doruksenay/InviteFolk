// POST { token }  →  { available: false } | { available: true, date, code, tmax, tmin, rain, place }
// Davetli sayfası için etkinlik gününün hava tahmini (Open-Meteo; anahtar gerektirmez).
// Yalnızca etkinlik 14 gün içindeyse; sonuç etkinlik başına 3 saat önbellekte tutulur (dış servisi yormamak için).
//
// Güvenlik: girişsiz (verify_jwt = false); tek yetki davet anahtarıdır. Yanıtta yalnızca hava bilgisi ve
// şehir adı vardır. Dış servise giden sorgu yalnızca etkinliğin adres metnidir (kişisel veri yok).

import { adminClient, corsHeaders, json, readBody, TOKEN } from '../_shared/supabase.ts';

const CACHE_MS = 3 * 3600_000;
const HORIZON_DAYS = 14;

type Forecast = { available: true; date: string; code: number; tmax: number; tmin: number; rain: number | null; place: string };

function istanbulDate(d: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

async function geocode(queries: string[], lang: string): Promise<{ lat: number; lon: number; name: string } | null> {
  for (const q of queries) {
    const name = q.trim().slice(0, 80);
    if (name.length < 2) continue;
    const url = `https://geocoding-api.open-meteo.com/v1/search?count=1&format=json&language=${lang}&name=${encodeURIComponent(name)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) }).catch(() => null);
    if (!res?.ok) continue;
    const body = await res.json().catch(() => null);
    const hit = body?.results?.[0];
    if (hit && typeof hit.latitude === 'number' && typeof hit.longitude === 'number') return { lat: hit.latitude, lon: hit.longitude, name: String(hit.name ?? name) };
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405);
  const raw = await readBody(req, 2 * 1024);
  if (raw === null) return json(req, { error: 'payload_too_large' }, 413);
  let token: unknown;
  try {
    token = (JSON.parse(raw || '{}') as { token?: unknown }).token;
  } catch {
    return json(req, { error: 'invalid_json' }, 400);
  }
  if (typeof token !== 'string' || !TOKEN.test(token)) return json(req, { available: false });

  const db = adminClient();
  const { data: inv } = await db
    .from('invitations')
    .select('events!inner(id, status, starts_at, venue_name, venue_address, settings)')
    .eq('token', token)
    .maybeSingle();
  // deno-lint-ignore no-explicit-any
  const ev = (inv as any)?.events as { id: string; status: string; starts_at: string | null; venue_name: string | null; venue_address: string | null; settings: { lang?: string } } | undefined;
  if (!ev || ev.status === 'archived' || !ev.starts_at) return json(req, { available: false });

  const start = new Date(ev.starts_at);
  const days = (start.getTime() - Date.now()) / 86400_000;
  if (!(days > -0.5 && days <= HORIZON_DAYS)) return json(req, { available: false });

  const { data: cached } = await db.from('weather_cache').select('fetched_at, data').eq('event_id', ev.id).maybeSingle();
  const date = istanbulDate(start);
  // "Bulunamadı" sonucu da önbelleğe alınır: aynı adres için dış servise tekrar tekrar gidilmez.
  if (cached && Date.now() - new Date(cached.fetched_at).getTime() < CACHE_MS && cached.data?.date === date) {
    return json(req, cached.data?.available ? cached.data : { available: false });
  }
  const unavailable = async () => {
    await db.from('weather_cache').upsert({ event_id: ev.id, fetched_at: new Date().toISOString(), data: { available: false, date } });
    return json(req, { available: false });
  };

  // Adres "Mahalle, İlçe, İl" biçiminde yazılır: önce sondan (il/ilçe), sonra mekân adı denenir.
  const parts = (ev.venue_address ?? '').split(',').map((p) => p.trim()).filter(Boolean).reverse();
  const lang = ev.settings?.lang === 'en' ? 'en' : 'tr';
  // En fazla 3 deneme (adresin son iki parçası ve mekân adı).
  const loc = await geocode([...parts.slice(0, 2), ev.venue_name ?? ''], lang);
  if (!loc) return unavailable();

  const fc = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Europe%2FIstanbul&start_date=${date}&end_date=${date}`,
    { signal: AbortSignal.timeout(6000) },
  ).catch(() => null);
  const body = fc?.ok ? await fc.json().catch(() => null) : null;
  const d = body?.daily;
  if (!d?.time?.length) return unavailable();

  const data: Forecast = {
    available: true,
    date,
    code: Number(d.weather_code?.[0] ?? 0),
    tmax: Math.round(Number(d.temperature_2m_max?.[0] ?? 0)),
    tmin: Math.round(Number(d.temperature_2m_min?.[0] ?? 0)),
    rain: d.precipitation_probability_max?.[0] == null ? null : Math.round(Number(d.precipitation_probability_max[0])),
    place: loc.name.slice(0, 60),
  };
  await db.from('weather_cache').upsert({ event_id: ev.id, fetched_at: new Date().toISOString(), data });
  return json(req, data);
});
