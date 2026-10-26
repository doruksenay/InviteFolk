// POST { token } (ya da GET ?token=)
//   → { design?: { url, width, height, overlay }, music?: { url, title }, gallery?: [{ url, width, height }],
//       video?: { url, width, height, overlay }, cover?: { url, width, height },
//       url?, width?, height?, overlay? (eski istemciler için tasarım) }
// Davetlinin sayfası, organizatörün yüklediği medyayı bu fonksiyonla alır.
// Dosyalar özel kovalarda durur; burada davet anahtarı doğrulanır ve 15 dakikalık imzalı linkler üretilir.
//
// Güvenlik:
// - Girişsiz çağrılır (verify_jwt = false); tek yetki 128 bitlik davet anahtarıdır.
// - Arşivlenmiş etkinlik ya da medyası olmayan etkinlik için 404 (var/yok bilgisi sızmaz).
// - Her dosya yolu, etkinlik sahibinin o etkinliğe ait klasöründe ve izinli uzantıdaysa imzalanır
//   (ayarlara elle yazılmış yabancı yol imzalanmaz; veritabanı da aynı biçimi yazarken zorlar).
// - Hata ayrıntısı dönmez; yanıt önbelleğe alınmaz.

import { adminClient, corsHeaders, json, readBody, TOKEN } from '../_shared/supabase.ts';

const SIGNED_SECONDS = 900;
const MAX_GALLERY = 24;

type Overlay = Record<string, unknown> | null;

function notFound(req: Request) {
  return json(req, { error: 'not_found' }, 404);
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

  const prefix = escapeRe(`${ev.owner_id}/${ev.id}/`);
  const safe = (path: unknown, ext: string): path is string =>
    typeof path === 'string' && path.length <= 200 && new RegExp(`^${prefix}[0-9a-f]{8,64}\\.(${ext})$`).test(path);

  const sign = async (bucket: string, path: string) => {
    const r = await db.storage.from(bucket).createSignedUrl(path, SIGNED_SECONDS);
    if (r.error || !r.data?.signedUrl) {
      console.error('invitation-design sign', bucket, r.error);
      return null;
    }
    return r.data.signedUrl;
  };

  const s = ev.settings ?? {};
  const out: Record<string, unknown> = {};
  // Ücretli medya yalnızca sahibin paketi hâlâ içeriyorsa verilir (paket süresi bitince müzik/video/fazla galeri kapanır).
  const { data: ent } = await db.rpc('media_entitlements', { p_event: ev.id });
  const can = (ent ?? { music: false, video: false, max_gallery: 0 }) as { music: boolean; video: boolean; max_gallery: number };

  const design = s.design as { path?: unknown; width?: unknown; height?: unknown; overlay?: Overlay } | undefined;
  if (design && safe(design.path, 'png|jpe?g|webp')) {
    const url = await sign('designs', design.path);
    if (url) {
      const d = { url, width: Number(design.width) || 0, height: Number(design.height) || 0, overlay: design.overlay ?? null };
      out.design = d;
      Object.assign(out, d); // eski istemciler: üst düzeyde tasarım
    }
  }

  const music = s.music as { path?: unknown; title?: unknown } | undefined;
  if (can.music && music && safe(music.path, 'mp3|m4a|aac')) {
    const url = await sign('media', music.path);
    if (url) out.music = { url, title: typeof music.title === 'string' ? music.title.slice(0, 80) : null };
  }

  const video = s.video as { path?: unknown; width?: unknown; height?: unknown; overlay?: Overlay } | undefined;
  if (can.video && video && safe(video.path, 'mp4|mov|webm')) {
    const url = await sign('media', video.path);
    if (url) out.video = { url, width: Number(video.width) || 0, height: Number(video.height) || 0, overlay: video.overlay ?? null };
  }

  const gallery = Array.isArray(s.gallery) ? (s.gallery as { path?: unknown; width?: unknown; height?: unknown }[]).slice(0, Math.min(MAX_GALLERY, Math.max(0, Number(can.max_gallery) || 0))) : [];
  const photos = gallery.filter((g) => safe(g?.path, 'png|jpe?g|webp')) as { path: string; width?: unknown; height?: unknown }[];
  if (photos.length) {
    const r = await db.storage.from('media').createSignedUrls(photos.map((p) => p.path), SIGNED_SECONDS);
    if (r.error) console.error('invitation-design gallery', r.error);
    const urls = new Map((r.data ?? []).filter((x) => x.signedUrl && x.path).map((x) => [x.path as string, x.signedUrl as string]));
    out.gallery = photos
      .map((p) => ({ url: urls.get(p.path), width: Number(p.width) || 0, height: Number(p.height) || 0 }))
      .filter((p) => p.url);
  }

  // Kapak fotoğrafı (her pakette): kartta tema deseninin yerine geçer.
  const cover = s.cover as { path?: unknown; width?: unknown; height?: unknown } | undefined;
  if (cover && safe(cover.path, 'png|jpe?g|webp')) {
    const url = await sign('media', cover.path);
    if (url) out.cover = { url, width: Number(cover.width) || 0, height: Number(cover.height) || 0 };
  }

  if (!Object.keys(out).length) return notFound(req);
  return json(req, out);
});
