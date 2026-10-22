// POST { token } (ya da GET ?token=)  →  { url, width, height, overlay }
// Davetlinin sayfası, organizatörün yüklediği davetiye görselini bu fonksiyonla alır.
// Görsel özel kovada durur; burada davet anahtarı doğrulanır ve 15 dakikalık imzalı link üretilir.
//
// Güvenlik:
// - Girişsiz çağrılır (verify_jwt = false); tek yetki 128 bitlik davet anahtarıdır.
// - Arşivlenmiş etkinlik ya da tasarımı olmayan etkinlik için 404 (var/yok bilgisi sızmaz).
// - Dosya yolu, etkinlik sahibinin klasöründe değilse imzalanmaz (ayarlara elle yazılmış yabancı yol).
// - Hata ayrıntısı dönmez; yanıt önbelleğe alınmaz.

import { adminClient, corsHeaders, json, readBody, TOKEN } from '../_shared/supabase.ts';

const SIGNED_SECONDS = 900;

function notFound(req: Request) {
  return json(req, { error: 'not_found' }, 404);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });

  let token: unknown = null;
  if (req.method === 'GET') {
    token = new URL(req.url).searchParams.get('token');
  } else if (req.method === 'POST') {
    const raw = await readBody(req, 4 * 1024);
    if (raw === null) return json(req, { error: 'payload_too_large' }, 413);
    try {
      token = (JSON.parse(raw || '{}') as { token?: unknown }).token;
    } catch {
      return json(req, { error: 'invalid_json' }, 400);
    }
  } else {
    return json(req, { error: 'method_not_allowed' }, 405);
  }
  if (typeof token !== 'string' || !TOKEN.test(token)) return notFound(req);

  const db = adminClient();
  const { data: inv, error } = await db
    .from('invitations')
    .select('event_id, events!inner(id, owner_id, status, settings)')
    .eq('token', token)
    .maybeSingle();
  if (error) {
    console.error('invitation-design lookup', error);
    return json(req, { error: 'server_error' }, 500);
  }
  // deno-lint-ignore no-explicit-any
  const ev = (inv as any)?.events as { id: string; owner_id: string; status: string; settings: Record<string, unknown> } | undefined;
  if (!ev || ev.status === 'archived') return notFound(req);

  const design = ev.settings?.design as { path?: unknown; width?: unknown; height?: unknown; overlay?: unknown } | undefined;
  const path = typeof design?.path === 'string' ? design.path : null;
  const prefix = `${ev.owner_id}/${ev.id}/`;
  // Yol beyaz listeyle doğrulanır (kodlanmış "%2e%2e" gibi kaçışlar dahil hiçbir şey geçemez);
  // veritabanı da aynı biçimi yazarken zorlar (20261026000000_hardening.sql).
  const SAFE = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[0-9a-f]{8,64}\\.(png|jpe?g|webp)$`);
  if (!path || path.length > 200 || !SAFE.test(path)) return notFound(req);

  const signed = await db.storage.from('designs').createSignedUrl(path, SIGNED_SECONDS);
  if (signed.error || !signed.data?.signedUrl) {
    console.error('invitation-design sign', signed.error);
    return notFound(req);
  }

  return json(req, {
    url: signed.data.signedUrl,
    width: Number(design?.width) || 0,
    height: Number(design?.height) || 0,
    overlay: design?.overlay ?? null,
  });
});
