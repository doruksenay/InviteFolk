// Davetli (girişsiz) işlemleri: tümü 128 bitlik davet anahtarıyla, veritabanının tanımlı fonksiyonları üzerinden.
import type { AlbumKind, PollVote, PublicEvent, PublicEventExtra, PublicGuestbookEntry, PublicInvitation } from '@/core/types';

import { friendlyError, must, supabase } from './api';
import { demoClaimPaid, demoClaimSignup, demoGuestbook, demoRespondProgram, demoSignGuestbook, demoVotePoll, isDemoToken } from './demo';

/** Davetli sayfayı açtı (organizatörün önizlemesi sayılmaz; hata davetliye gösterilmez). */
export async function markOpened(token: string) {
  if (isDemoToken(token)) return;
  await supabase.rpc('mark_invitation_opened', { p_token: token }).then(
    () => undefined,
    () => undefined,
  );
}

export async function votePoll(token: string, votes: Record<string, PollVote>) {
  if (isDemoToken(token)) return demoVotePoll(token, votes);
  return must(await supabase.rpc('vote_poll', { p_token: token, p_votes: votes })) as PublicInvitation;
}

export async function claimSignup(token: string, item: string, qty: number) {
  if (isDemoToken(token)) return demoClaimSignup(token, item, qty);
  return must(await supabase.rpc('claim_signup', { p_token: token, p_item: item, p_qty: qty })) as PublicInvitation;
}

export async function voteMvp(token: string, match: string, target: string) {
  if (isDemoToken(token)) throw new Error('demo');
  return must(await supabase.rpc('vote_mvp', { p_token: token, p_match: match, p_target: target })) as PublicInvitation;
}

/** Tören bazında katılım (kına, nikâh, düğün…). */
export async function respondProgram(token: string, votes: Record<string, 'yes' | 'no'>) {
  if (isDemoToken(token)) return demoRespondProgram(token, votes);
  return must(await supabase.rpc('respond_program', { p_token: token, p_votes: votes })) as PublicInvitation;
}

export async function claimPaid(token: string) {
  if (isDemoToken(token)) return demoClaimPaid(token);
  return must(await supabase.rpc('claim_paid', { p_token: token })) as PublicInvitation;
}

// ---------------------------------------------------------------------------
// Anı defteri
// ---------------------------------------------------------------------------
/** Davetli kendi linkinden mesaj bırakır; `pending` true ise organizatör onayından sonra görünür. */
export async function signGuestbook(token: string, message: string): Promise<{ pending: boolean }> {
  if (isDemoToken(token)) return demoSignGuestbook(token, message);
  return must(await supabase.rpc('guestbook_sign', { p_token: token, p_message: message.trim().slice(0, 500) })) as { pending: boolean };
}

export async function signGuestbookPublic(slug: string, name: string, message: string): Promise<{ pending: boolean }> {
  return must(await supabase.rpc('guestbook_sign_slug', { p_slug: slug, p_name: name.trim().slice(0, 80), p_message: message.trim().slice(0, 500) })) as { pending: boolean };
}

export async function guestbookForGuest(token: string): Promise<PublicGuestbookEntry[]> {
  if (isDemoToken(token)) return demoGuestbook(token);
  return (must(await supabase.rpc('guestbook_for_guest', { p_token: token })) as PublicGuestbookEntry[] | null) ?? [];
}

export async function guestbookForSlug(slug: string): Promise<PublicGuestbookEntry[]> {
  return (must(await supabase.rpc('guestbook_for_slug', { p_slug: slug })) as PublicGuestbookEntry[] | null) ?? [];
}

export async function getPublicEventExtra(slug: string): Promise<PublicEventExtra | null> {
  return must(await supabase.rpc('get_public_event_extra', { p_slug: slug })) as PublicEventExtra | null;
}

export type Weather = { available: false } | { available: true; date: string; code: number; tmax: number; tmin: number; rain: number | null; place: string };

export async function getWeather(token: string): Promise<Weather> {
  if (isDemoToken(token)) return { available: false };
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

/**
 * Albüme fotoğraf, video ya da sesli mesaj yükler: sunucudan tek seferlik link alınır, dosya yüklenir, sunucu doğrular.
 * `pending` true ise organizatör onayladıktan sonra albümde görünür.
 */
export async function uploadAlbumItem(slug: string, item: { data: Blob | ArrayBuffer; mime: string }, uploader: string | null): Promise<{ pending: boolean }> {
  const r = await albumCall<{ id: string; path: string; token: string }>({ action: 'reserve', slug, type: item.mime, uploader });
  const up = await supabase.storage.from('album').uploadToSignedUrl(r.path, r.token, item.data, { contentType: item.mime });
  if (up.error) throw friendlyError(up.error);
  const c = await albumCall<{ ok: boolean; pending?: boolean }>({ action: 'confirm', slug, id: r.id });
  return { pending: !!c.pending };
}
export const uploadAlbumPhoto = uploadAlbumItem;

export async function listPublicAlbum(slug: string): Promise<{ url: string; kind: AlbumKind }[]> {
  const r = await albumCall<{ photos: { url: string; kind?: AlbumKind }[] }>({ action: 'list', slug });
  return (r.photos ?? []).map((p) => ({ url: p.url, kind: p.kind ?? 'photo' }));
}
