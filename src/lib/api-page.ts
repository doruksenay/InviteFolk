// Davetiye sayfası içeriği: müzik, video, galeri dosyaları (özel "media" kovası) ve ayarlar.
// Dosya yolu her zaman <etkinlik sahibi>/<etkinlik>/<rastgele>.<uzantı>; ortak yönetici de sahibin klasörüne yükler
// (depolama politikası etkinliği yönetme yetkisini, veritabanı yolun biçimini denetler).
import type { EventSettings, EventVideo, GalleryPhoto, GuestSettings, DesignOverlay } from '@/core/types';

import { friendlyError, must, supabase } from './api';
import type { PickedFile, PickedPhoto } from './media-types';

const BUCKET = 'media';

function randomName() {
  const b = new Uint8Array(12);
  globalThis.crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

async function eventOwner(eventId: string): Promise<string> {
  const r = must(await supabase.from('events').select('owner_id').eq('id', eventId).single()) as { owner_id: string };
  return r.owner_id;
}

async function upload(eventId: string, data: Blob | ArrayBuffer, mime: string, ext: string): Promise<string> {
  const owner = await eventOwner(eventId);
  const path = `${owner}/${eventId}/${randomName()}.${ext}`;
  const up = await supabase.storage.from(BUCKET).upload(path, data, { contentType: mime, upsert: false, cacheControl: '3600' });
  if (up.error) throw friendlyError(up.error);
  return path;
}

async function remove(paths: (string | null | undefined)[]) {
  const list = paths.filter((p): p is string => !!p);
  if (list.length) await supabase.storage.from(BUCKET).remove(list).catch(() => {});
}

/** Ayarları okuyup verilen anahtarları değiştirir (diğer ayarlar korunur). Önceki ayarları döndürür. */
export async function patchSettings(eventId: string, patch: Partial<EventSettings>, drop: (keyof EventSettings)[] = []): Promise<EventSettings> {
  const { settings } = must(await supabase.from('events').select('settings').eq('id', eventId).single()) as { settings: EventSettings };
  const next: EventSettings = { ...(settings ?? {}), ...patch };
  for (const k of drop) delete next[k];
  must(await supabase.from('events').update({ settings: next }).eq('id', eventId).select('id'));
  return settings ?? {};
}

const ext = (m: string) => (m === 'image/png' ? 'png' : m === 'image/webp' ? 'webp' : 'jpg');

/** Galeriye fotoğraf ekler (paket sınırını veritabanı zorlar); yüklenip kaydedilemeyen dosyalar silinir. */
export async function addGalleryPhotos(eventId: string, current: GalleryPhoto[], photos: PickedPhoto[]): Promise<GalleryPhoto[]> {
  const added: GalleryPhoto[] = [];
  try {
    for (const p of photos) {
      const path = await upload(eventId, p.data, p.mime, ext(p.mime));
      added.push({ path, width: Math.round(p.width), height: Math.round(p.height) });
    }
    const gallery = [...current, ...added];
    await patchSettings(eventId, { gallery });
    return gallery;
  } catch (e) {
    await remove(added.map((a) => a.path));
    throw e;
  }
}

export async function setGallery(eventId: string, gallery: GalleryPhoto[], removed: GalleryPhoto[] = []) {
  if (gallery.length) await patchSettings(eventId, { gallery });
  else await patchSettings(eventId, {}, ['gallery']);
  await remove(removed.map((r) => r.path));
}

export async function setMusic(eventId: string, file: PickedFile, title: string | null) {
  const path = await upload(eventId, file.data, file.mime, file.ext);
  try {
    const prev = await patchSettings(eventId, { music: { path, ...(title ? { title: title.slice(0, 80) } : {}) } });
    if (prev.music?.path && prev.music.path !== path) await remove([prev.music.path]);
  } catch (e) {
    await remove([path]);
    throw e;
  }
}

export async function removeMusic(eventId: string) {
  const prev = await patchSettings(eventId, {}, ['music']);
  await remove([prev.music?.path]);
}

export async function setVideo(eventId: string, file: PickedFile & { width: number; height: number }, overlay?: DesignOverlay) {
  const path = await upload(eventId, file.data, file.mime, file.ext);
  const video: EventVideo = { path, width: Math.round(file.width), height: Math.round(file.height), ...(overlay ? { overlay } : {}) };
  try {
    const prev = await patchSettings(eventId, { video });
    if (prev.video?.path && prev.video.path !== path) await remove([prev.video.path]);
  } catch (e) {
    await remove([path]);
    throw e;
  }
}

export async function removeVideo(eventId: string) {
  const prev = await patchSettings(eventId, {}, ['video']);
  await remove([prev.video?.path]);
}

/** Organizatör önizlemesi için imzalı linkler (10 dakika). */
export async function signedMediaUrls(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const r = await supabase.storage.from(BUCKET).createSignedUrls(paths, 600);
  if (r.error) throw friendlyError(r.error);
  return Object.fromEntries((r.data ?? []).filter((x) => x.path && x.signedUrl).map((x) => [x.path as string, x.signedUrl as string]));
}

// ---------------------------------------------------------------------------
// Davetli: medya linkleri (davet anahtarıyla, sunucu fonksiyonu imzalar)
// ---------------------------------------------------------------------------
export type GuestMedia = {
  design?: { url: string; width: number; height: number; overlay: DesignOverlay | null };
  music?: { url: string; title: string | null };
  video?: { url: string; width: number; height: number; overlay: DesignOverlay | null };
  gallery?: { url: string; width: number; height: number }[];
};

export function guestNeedsMedia(s: GuestSettings | undefined) {
  return !!(s && (s.has_design || s.music || s.video || (s.gallery_count ?? 0) > 0));
}

export async function getGuestMedia(token: string): Promise<GuestMedia> {
  const { data, error } = await supabase.functions.invoke('invitation-design', { body: { token } });
  if (error || !data) throw friendlyError(error ?? { message: 'not_found' });
  return data as GuestMedia;
}
