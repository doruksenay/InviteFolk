// Davetiye tasarımı: özel "designs" kovasına yükleme, etkinlik ayarlarına yerleşimi kaydetme,
// organizatöre kısa süreli imzalı link, davetliye anahtarla doğrulanan sunucu fonksiyonu.
import type { DesignOverlay, EventDesign, EventRow, EventSettings } from '@/core/types';

import { friendlyError, must, supabase } from './api';

const BUCKET = 'designs';
const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

export type DesignEvent = Pick<EventRow, 'id' | 'owner_id' | 'title' | 'type' | 'theme' | 'settings' | 'starts_at' | 'venue_name' | 'rsvp_deadline' | 'host_names'>;

export async function getDesignEvent(eventId: string): Promise<DesignEvent> {
  return must(
    await supabase.from('events').select('id, owner_id, title, type, theme, settings, starts_at, venue_name, rsvp_deadline, host_names').eq('id', eventId).single(),
  ) as DesignEvent;
}

function randomName() {
  const b = new Uint8Array(12);
  globalThis.crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

/** Ayarları okuyup yalnızca `design` anahtarını değiştirir (diğer ayarlar korunur). */
async function writeDesign(eventId: string, design: EventDesign | null) {
  const { settings } = must(await supabase.from('events').select('settings').eq('id', eventId).single()) as { settings: EventSettings };
  const next: EventSettings = { ...(settings ?? {}) };
  if (design) next.design = design;
  else delete next.design;
  must(await supabase.from('events').update({ settings: next }).eq('id', eventId).select('id'));
  return settings?.design ?? null;
}

async function removeFile(path: string | undefined | null) {
  if (!path) return;
  // Yalnızca kendi klasöründeki dosya silinebilir (depolama politikası da zorlar).
  await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
}

/**
 * Görseli yükler ve etkinliğe bağlar. Önceki görsel varsa silinir, yerleşim (overlay) korunur.
 * Yol her zaman <kullanıcı id>/<etkinlik id>/<rastgele>.<uzantı>.
 */
export async function uploadDesign(
  eventId: string,
  file: { data: Blob | ArrayBuffer; mime: string; width: number; height: number },
  overlay: DesignOverlay,
): Promise<EventDesign> {
  const ext = EXT[file.mime];
  if (!ext) throw friendlyError({ message: 'invalid', code: '22023' });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw friendlyError({ message: 'forbidden', code: '42501' });
  const path = `${auth.user.id}/${eventId}/${randomName()}.${ext}`;
  const up = await supabase.storage.from(BUCKET).upload(path, file.data, { contentType: file.mime, upsert: false, cacheControl: '3600' });
  if (up.error) throw friendlyError(up.error);
  const design: EventDesign = { path, width: Math.round(file.width), height: Math.round(file.height), overlay };
  try {
    const previous = await writeDesign(eventId, design);
    if (previous?.path && previous.path !== path) await removeFile(previous.path);
  } catch (e) {
    await removeFile(path); // ayar kaydedilemediyse yetim dosya bırakma
    throw e;
  }
  return design;
}

export async function saveOverlay(eventId: string, design: EventDesign, overlay: DesignOverlay) {
  await writeDesign(eventId, { ...design, overlay });
}

export async function removeDesign(eventId: string) {
  const previous = await writeDesign(eventId, null);
  await removeFile(previous?.path);
}

/** Organizatörün kendi görselini görmesi için 10 dakikalık imzalı link. */
export async function signedDesignUrl(path: string): Promise<string> {
  const r = await supabase.storage.from(BUCKET).createSignedUrl(path, 600);
  if (r.error || !r.data?.signedUrl) throw friendlyError(r.error ?? { message: 'not_found' });
  return r.data.signedUrl;
}

export type PublicDesign = { url: string; width: number; height: number; overlay: DesignOverlay };

/** Davetli: davet anahtarıyla tasarımın kısa süreli linkini alır (sunucu anahtarı ve etkinliği doğrular). */
export async function getPublicDesign(token: string): Promise<PublicDesign> {
  const { data, error } = await supabase.functions.invoke('invitation-design', { body: { token } });
  if (error || !data?.url) throw friendlyError(error ?? { message: 'not_found' });
  return data as PublicDesign;
}
