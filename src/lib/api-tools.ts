// Etkinlik araçları (organizatör/ortak yönetici): duyurular, bilgi toplama başvuruları, fotoğraf albümü,
// kapıda giriş, halı saha maçları ve takımlar, herkese açık bağlantı. Tümü kullanıcının oturumuyla, RLS altında.
import type { AlbumPhoto, Announcement, GuestbookEntry, GuestRequest, InvitationWithContact, MatchRow } from '@/core/types';

import { friendlyError, must, supabase } from './api';

// --- Duyurular
export async function listAnnouncements(eventId: string): Promise<Announcement[]> {
  return must(await supabase.from('event_announcements').select('id, event_id, body, created_at').eq('event_id', eventId).order('created_at', { ascending: false }).limit(20)) as Announcement[];
}

/** Duyuruyu kaydeder ve kimliğini döndürür; mesajla gönderimde metin sunucuda bu kayıttan okunur. */
export async function addAnnouncement(eventId: string, body: string): Promise<string> {
  const rows = must(await supabase.from('event_announcements').insert({ event_id: eventId, body: body.trim().slice(0, 500) }).select('id')) as { id: string }[];
  return rows[0].id;
}

export async function deleteAnnouncement(id: string) {
  must(await supabase.from('event_announcements').delete().eq('id', id).select('id'));
}

// --- Bilgi toplama başvuruları
export async function listGuestRequests(eventId: string): Promise<GuestRequest[]> {
  return must(await supabase.from('guest_requests').select('*').eq('event_id', eventId).order('created_at', { ascending: false }).limit(1000)) as GuestRequest[];
}

export async function reviewGuestRequests(ids: string[], approve: boolean): Promise<{ added: number; existing: number }> {
  return must(await supabase.rpc('review_guest_requests', { p_ids: ids, p_approve: approve })) as { added: number; existing: number };
}

export async function rotatePublicLink(eventId: string): Promise<string> {
  return must(await supabase.rpc('rotate_public_slug', { p_event: eventId })) as string;
}

// --- Fotoğraf albümü
export type AlbumItem = AlbumPhoto & { url: string | null };

export async function listAlbum(eventId: string): Promise<AlbumItem[]> {
  const rows = must(await supabase.from('album_photos').select('*').eq('event_id', eventId).eq('confirmed', true).order('created_at', { ascending: false }).limit(2000)) as AlbumPhoto[];
  if (!rows.length) return [];
  const signed = await supabase.storage.from('album').createSignedUrls(rows.map((r) => r.path), 3600);
  const urls = new Map((signed.data ?? []).filter((x) => x.path && x.signedUrl).map((x) => [x.path as string, x.signedUrl as string]));
  return rows.map((r) => ({ ...r, url: urls.get(r.path) ?? null }));
}

/** Salon ekranı için: yayındaki (onaylı, gizlenmemiş) son 200 fotoğraf ve video, imzalı adresleriyle. */
export async function listAlbumForScreen(eventId: string): Promise<AlbumItem[]> {
  const rows = must(
    await supabase.from('album_photos').select('*').eq('event_id', eventId).eq('confirmed', true).eq('approved', true).eq('hidden', false).in('kind', ['photo', 'video']).order('created_at', { ascending: false }).limit(200),
  ) as AlbumPhoto[];
  if (!rows.length) return [];
  const signed = await supabase.storage.from('album').createSignedUrls(rows.map((r) => r.path), 3 * 3600);
  const urls = new Map((signed.data ?? []).filter((x) => x.path && x.signedUrl).map((x) => [x.path as string, x.signedUrl as string]));
  return rows.map((r) => ({ ...r, url: urls.get(r.path) ?? null }));
}

export async function setAlbumApproved(ids: string[], approved: boolean) {
  if (!ids.length) return;
  must(await supabase.from('album_photos').update({ approved }).in('id', ids).select('id'));
}

// --- Anı defteri
export async function listGuestbook(eventId: string): Promise<GuestbookEntry[]> {
  return must(await supabase.from('guestbook_entries').select('*').eq('event_id', eventId).order('created_at', { ascending: false }).limit(3000)) as GuestbookEntry[];
}

export async function setGuestbookFlags(ids: string[], patch: Partial<Pick<GuestbookEntry, 'approved' | 'hidden'>>) {
  if (!ids.length) return;
  must(await supabase.from('guestbook_entries').update(patch).in('id', ids).select('id'));
}

export async function deleteGuestbookEntry(id: string) {
  must(await supabase.from('guestbook_entries').delete().eq('id', id).select('id'));
}

export async function setAlbumHidden(id: string, hidden: boolean) {
  must(await supabase.from('album_photos').update({ hidden }).eq('id', id).select('id'));
}

export async function deleteAlbumPhoto(photo: AlbumPhoto) {
  await supabase.storage.from('album').remove([photo.path]).catch(() => {});
  must(await supabase.from('album_photos').delete().eq('id', photo.id).select('id'));
}

/** Fotoğrafı indirmek için uzun süreli (1 gün) link. */
export async function albumDownloadUrl(path: string): Promise<string> {
  const r = await supabase.storage.from('album').createSignedUrl(path, 86400, { download: true });
  if (r.error || !r.data?.signedUrl) throw friendlyError(r.error ?? { message: 'not_found' });
  return r.data.signedUrl;
}

// --- Kapıda giriş
/** Karekoddaki ya da elle yazılan kodu çözer ("IF1:ABCDEF123456", link ya da çıplak kod). */
export function parseCheckinCode(raw: string): string | null {
  const m = /([0-9A-Fa-f]{12})\s*$/.exec(raw.trim());
  return m ? m[1].toUpperCase() : null;
}

export async function findByCheckinCode(eventId: string, code: string): Promise<InvitationWithContact | null> {
  const rows = must(
    await supabase
      .from('invitations')
      .select('*, contacts!inner(name, phone, email, side, group_label, max_party), seating_tables(label)')
      .eq('event_id', eventId)
      .eq('checkin_code', code)
      .limit(1),
  ) as InvitationWithContact[];
  return rows[0] ?? null;
}

export async function setCheckin(invitationId: string, people: number | null) {
  must(
    await supabase
      .from('invitations')
      .update(people === null ? { checked_in_at: null, checked_in_people: null } : { checked_in_at: new Date().toISOString(), checked_in_people: Math.max(0, Math.min(20, people)) })
      .eq('id', invitationId)
      .select('id'),
  );
}

// --- Halı saha
export async function assignTeams(pairs: { id: string; team: 1 | 2 | null }[]) {
  if (!pairs.length) return 0;
  return must(await supabase.rpc('assign_teams', { p_pairs: pairs.map((p) => ({ id: p.id, team: p.team === null ? null : String(p.team) })) })) as number;
}

export async function listMatches(eventId: string): Promise<MatchRow[]> {
  return must(await supabase.from('matches').select('*').eq('event_id', eventId).order('played_at', { ascending: false }).limit(52)) as MatchRow[];
}

export async function recordMatch(eventId: string): Promise<string | null> {
  return must(await supabase.rpc('record_match', { p_event: eventId })) as string | null;
}

export async function updateMatch(id: string, patch: Partial<Pick<MatchRow, 'goals' | 'score_a' | 'score_b'>>) {
  must(await supabase.from('matches').update(patch).eq('id', id).select('id'));
}

export async function mvpVotes(matchIds: string[]): Promise<{ match_id: string; target_id: string }[]> {
  if (!matchIds.length) return [];
  return must(await supabase.from('mvp_votes').select('match_id, target_id').in('match_id', matchIds)) as { match_id: string; target_id: string }[];
}

export async function getSignupClaims(eventId: string): Promise<{ invitation_id: string; item_id: string; qty: number; name: string }[]> {
  const rows = must(
    await supabase.from('signup_claims').select('invitation_id, item_id, qty, invitations!inner(event_id, contacts!inner(name))').eq('invitations.event_id', eventId),
  ) as unknown as { invitation_id: string; item_id: string; qty: number; invitations: { contacts: { name: string } } }[];
  return rows.map((r) => ({ invitation_id: r.invitation_id, item_id: r.item_id, qty: r.qty, name: r.invitations?.contacts?.name ?? '' }));
}

// --- Paket sınırları (etkinlik sahibinin paketi; ortak yönetici de görür)
export type EventLimits = { plan: string; limits: import('@/core/types').PlanLimits; is_owner: boolean; cohosts: number; album_used: number };

export async function getEventLimits(eventId: string): Promise<EventLimits> {
  return must(await supabase.rpc('event_limits', { p_event: eventId })) as EventLimits;
}

/** Masa adları (dışa aktarma ve kapıda giriş için): kimlik → ad. */
export async function tableLabels(eventId: string): Promise<Record<string, string>> {
  const rows = must(await supabase.from('seating_tables').select('id, label').eq('event_id', eventId).eq('kind', 'table')) as { id: string; label: string }[];
  return Object.fromEntries(rows.map((r) => [r.id, r.label]));
}
