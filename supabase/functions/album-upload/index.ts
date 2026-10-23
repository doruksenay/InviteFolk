// Davetlilerin fotoğraf albümü (masadaki karekod → /a/<bağlantı>). Girişsiz; yetki herkese açık etkinlik bağlantısıdır.
//   POST { action: 'reserve', slug, type, uploader? }  → { id, path, token }   (tek seferlik imzalı yükleme)
//   POST { action: 'confirm', slug, id }                → { ok: true }         (dosya gerçekten yüklendiyse)
//   POST { action: 'list', slug }                       → { photos: [{ url }] } (organizatör albümü herkese açtıysa)
//
// Güvenlik:
// - Albüm açık mı, paket kotası ve hız sınırı veritabanında (album_reserve) denetlenir.
// - Yükleme yolu sunucuda üretilir (etkinlik klasörü + rastgele ad); istemci yol seçemez.
// - Yalnızca jpeg/png/webp, en fazla 15 MB (kova sınırı da zorlar).
// - Organizatör fotoğrafları görür, gizler, siler; davetliler yalnızca albüm herkese açıksa görür.

import { adminClient, corsHeaders, json, readBody, UUID } from '../_shared/supabase.ts';

const SLUG = /^[0-9a-f]{32}$/;
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405);
  const raw = await readBody(req, 4 * 1024);
  if (raw === null) return json(req, { error: 'payload_too_large' }, 413);
  let body: { action?: unknown; slug?: unknown; type?: unknown; uploader?: unknown; id?: unknown };
  try {
    body = JSON.parse(raw || '{}');
  } catch {
    return json(req, { error: 'invalid_json' }, 400);
  }
  const slug = typeof body.slug === 'string' && SLUG.test(body.slug) ? body.slug : null;
  if (!slug) return json(req, { error: 'not_found' }, 404);
  const db = adminClient();

  if (body.action === 'reserve') {
    const type = typeof body.type === 'string' && TYPES.has(body.type) ? body.type : null;
    if (!type) return json(req, { error: 'invalid_input' }, 400);
    const uploader = typeof body.uploader === 'string' ? body.uploader.slice(0, 60) : null;
    const { data, error } = await db.rpc('album_reserve', { p_slug: slug, p_uploader: uploader, p_type: type });
    if (error) {
      const msg = String(error.message ?? '');
      if (msg.includes('quota_exceeded')) return json(req, { error: 'quota_exceeded' }, 402);
      if (msg.includes('rate_limited')) return json(req, { error: 'rate_limited' }, 429);
      if (msg.includes('not_found')) return json(req, { error: 'not_found' }, 404);
      console.error('album reserve', error);
      return json(req, { error: 'server_error' }, 500);
    }
    const { id, path } = data as { id: string; path: string };
    const signed = await db.storage.from('album').createSignedUploadUrl(path);
    if (signed.error || !signed.data?.token) {
      console.error('album sign upload', signed.error);
      return json(req, { error: 'server_error' }, 500);
    }
    return json(req, { id, path, token: signed.data.token });
  }

  if (body.action === 'confirm') {
    const id = typeof body.id === 'string' && UUID.test(body.id) ? body.id : null;
    if (!id) return json(req, { error: 'invalid_input' }, 400);
    const { data: row } = await db.from('album_photos').select('id, path, confirmed, events!inner(public_slug)').eq('id', id).maybeSingle();
    // deno-lint-ignore no-explicit-any
    if (!row || (row as any).events?.public_slug !== slug) return json(req, { error: 'not_found' }, 404);
    if (!row.confirmed) {
      const folder = row.path.slice(0, row.path.lastIndexOf('/'));
      const name = row.path.slice(row.path.lastIndexOf('/') + 1);
      const { data: files } = await db.storage.from('album').list(folder, { search: name, limit: 1 });
      if (!files?.some((f) => f.name === name)) return json(req, { error: 'not_found' }, 404);
      const { error: cErr } = await db.rpc('album_confirm', { p_id: id });
      if (cErr) {
        // Paralel yüklemelerle kota dolduysa dosya silinir, kayıt temizlikte gider.
        await db.storage.from('album').remove([row.path]).catch(() => {});
        if (String(cErr.message ?? '').includes('quota_exceeded')) return json(req, { error: 'quota_exceeded', detail: 'album' }, 402);
        console.error('album_confirm', cErr);
        return json(req, { error: 'server_error' }, 500);
      }
    }
    return json(req, { ok: true });
  }

  if (body.action === 'list') {
    const { data: paths, error } = await db.rpc('album_public_paths', { p_slug: slug });
    if (error) {
      console.error('album list', error);
      return json(req, { error: 'server_error' }, 500);
    }
    const list = (paths ?? []) as string[];
    if (!list.length) return json(req, { photos: [] });
    const signed = await db.storage.from('album').createSignedUrls(list, 3600);
    return json(req, { photos: (signed.data ?? []).filter((s) => s.signedUrl).map((s) => ({ url: s.signedUrl })) });
  }

  return json(req, { error: 'invalid_input' }, 400);
});
