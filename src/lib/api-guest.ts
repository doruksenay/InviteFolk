// Davetli (girişsiz) işlemleri: tümü 128 bitlik davet anahtarıyla, veritabanının tanımlı fonksiyonları üzerinden.
import type { PollVote, PublicEvent, PublicInvitation } from '@/core/types';

import { friendlyError, must, supabase } from './api';

/** Davetli sayfayı açtı (organizatörün önizlemesi sayılmaz; hata davetliye gösterilmez). */
export async function markOpened(token: string) {
  await supabase.rpc('mark_invitation_opened', { p_token: token }).then(
    () => undefined,
    () => undefined,
  );
}

export async function votePoll(token: string, votes: Record<string, PollVote>) {
  return must(await supabase.rpc('vote_poll', { p_token: token, p_votes: votes })) as PublicInvitation;
}

export async function claimSignup(token: string, item: string, qty: number) {
  return must(await supabase.rpc('claim_signup', { p_token: token, p_item: item, p_qty: qty })) as PublicInvitation;
}

export async function voteMvp(token: string, match: string, target: string) {
  return must(await supabase.rpc('vote_mvp', { p_token: token, p_match: match, p_target: target })) as PublicInvitation;
}

export async function claimPaid(token: string) {
  return must(await supabase.rpc('claim_paid', { p_token: token })) as PublicInvitation;
}

export type Weather = { available: false } | { available: true; date: string; code: number; tmax: number; tmin: number; rain: number | null; place: string };

export async function getWeather(token: string): Promise<Weather> {
  const { data, error } = await supabase.functions.invoke('weather', { body: { token } });
  if (error || !data) return { available: false };
  return data as Weather;
}

/** Takvim aboneliği adresi (webcal ile takvim uygulaması açılır, değişiklikler kendiliğinden gelir). */
export function calendarFeedUrl(token: string, webcal = true) {
  const base = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
  const url = `${base}/functions/v1/calendar?token=${token}`;
  return webcal ? url.replace(/^https?:\/\//, 'webcal://') : url;
}

// ---------------------------------------------------------------------------
// Herkese açık etkinlik sayfası (hediye, bilgi toplama formu, albüm)
// ---------------------------------------------------------------------------
export async function getPublicEvent(slug: string): Promise<PublicEvent | null> {
  return must(await supabase.rpc('get_public_event', { p_slug: slug })) as PublicEvent | null;
}

export async function submitGuestRequest(slug: string, r: { name: string; phone: string | null; email: string | null; party: number; note: string | null }) {
  must(
    await supabase.rpc('submit_guest_request', {
      p_slug: slug,
      p_name: r.name,
      p_phone: r.phone,
      p_email: r.email,
      p_party: r.party,
      p_note: r.note,
    }),
  );
}

async function albumCall<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('album-upload', { body });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const payload = ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) : null;
    if (payload?.error === 'quota_exceeded') throw friendlyError({ message: 'quota_exceeded', details: 'album' });
    throw friendlyError(payload?.error ? { message: String(payload.error) } : error);
  }
  return data as T;
}

/** Albüme tek fotoğraf yükler: sunucudan tek seferlik link alınır, dosya yüklenir, sunucu doğrular. */
export async function uploadAlbumPhoto(slug: string, photo: { data: Blob | ArrayBuffer; mime: string }, uploader: string | null) {
  const r = await albumCall<{ id: string; path: string; token: string }>({ action: 'reserve', slug, type: photo.mime, uploader });
  const up = await supabase.storage.from('album').uploadToSignedUrl(r.path, r.token, photo.data, { contentType: photo.mime });
  if (up.error) throw friendlyError(up.error);
  await albumCall({ action: 'confirm', slug, id: r.id });
}

export async function listPublicAlbum(slug: string): Promise<{ url: string }[]> {
  const r = await albumCall<{ photos: { url: string }[] }>({ action: 'list', slug });
  return r.photos ?? [];
}
