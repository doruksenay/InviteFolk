import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  AdminStats,
  EventRow,
  EventSummary,
  InvitationWithContact,
  Profile,
  PublicInvitation,
  RsvpStatus,
  MyPlan,
  SeatingItem,
  Side,
} from '@/core/types';

import { currentLang, dict, type Lang, makeT } from '@/i18n';

import { demoInvitation, demoRespond, isDemoToken } from './demo';
import { supabase } from './supabase';

export { supabase };

type DbError = { message: string; details?: string | null; code?: string | null; hint?: string | null };

/**
 * Veritabanı/API hatasını kullanıcının dilinde, iç ayrıntı sızdırmayan bir mesaja çevirir.
 * Ham hata yalnızca geliştirme sırasında konsola yazılır.
 */
export function friendlyError(err: DbError | Error | unknown): Error {
  const t = makeT(currentLang());
  const e = (err ?? {}) as DbError;
  const msg = String(e.message ?? '');
  if (__DEV__) console.warn('[api]', err);
  if (msg.includes('quota_exceeded')) {
    const what = (e.details ?? '') as keyof ReturnType<typeof dict>['errors']['quotaWhat'];
    const label = dict(currentLang()).errors.quotaWhat[what] ?? '';
    return new Error(t('errors.quota', { what: label }));
  }
  if (msg.includes('plan_feature')) {
    const what = (e.details ?? '') as keyof ReturnType<typeof dict>['errors']['planFeatureWhat'];
    return new Error(t('errors.planFeature', { what: dict(currentLang()).errors.planFeatureWhat[what] ?? '' }));
  }
  if (msg.includes('rate_limited')) return new Error(t('errors.rateLimited'));
  if (msg.includes('forbidden') || e.code === '42501' || e.code === 'PGRST301') return new Error(t('errors.forbidden'));
  if (msg.includes('not_found') || e.code === 'P0002') return new Error(t('errors.notFound'));
  if (e.code === '23505') return new Error(t('errors.duplicate'));
  if (e.code === '23514' || e.code === '22023' || e.code === '22P02') return new Error(t('errors.invalidInput'));
  if (/fetch|network|Failed to fetch|Network request failed/i.test(msg)) return new Error(t('errors.network'));
  return new Error(t('errors.generic'));
}

/** Supabase yanıtını açar; hatayı kullanıcının dilinde fırlatır. Diğer api-* modülleri de kullanır. */
export function must<T>(res: { data: T | null; error: DbError | null }): T {
  if (res.error) throw friendlyError(res.error);
  return res.data as T;
}

// ---------------------------------------------------------------------------
// Organizatör
// ---------------------------------------------------------------------------
export type EventWithSummary = EventRow & { summary: EventSummary | null };

export async function listMyEvents(): Promise<EventWithSummary[]> {
  const events = must(await supabase.from('events').select('*').neq('status', 'archived').order('starts_at', { ascending: true, nullsFirst: false }));
  const ids = (events as EventRow[]).map((e) => e.id);
  const summaries = ids.length ? (must(await supabase.from('event_summaries').select('*').in('event_id', ids)) as EventSummary[]) : [];
  return (events as EventRow[]).map((e) => ({ ...e, summary: summaries.find((s) => s.event_id === e.id) ?? null }));
}

export type NewEventInput = {
  type: string;
  theme: string;
  title: string;
  host_names?: string | null;
  starts_at?: string | null;
  venue_name?: string | null;
  venue_address?: string | null;
  rsvp_deadline?: string | null;
  settings?: Record<string, unknown>;
};

export async function createEvent(input: NewEventInput): Promise<EventRow> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error(makeT(currentLang())('errors.noSession'));
  return must(await supabase.from('events').insert({ ...input, owner_id: auth.user.id }).select('*').single()) as EventRow;
}

export async function getEvent(id: string): Promise<{ event: EventRow; summary: EventSummary | null; invitations: InvitationWithContact[] }> {
  const event = must(await supabase.from('events').select('*').eq('id', id).single()) as EventRow;
  const summary = (await supabase.from('event_summaries').select('*').eq('event_id', id).maybeSingle()).data as EventSummary | null;
  const invitations = must(
    await supabase.from('invitations').select('*, contacts!inner(name, phone, email, side, group_label, max_party, skill, position)').eq('event_id', id).order('created_at', { ascending: true }),
  ) as InvitationWithContact[];
  return { event, summary, invitations };
}

export async function addGuest(eventId: string, guest: { name: string; phone: string | null; side: Side | null; max_party: number }) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error(makeT(currentLang())('errors.noSession'));
  const contact = must(await supabase.from('contacts').insert({ ...guest, owner_id: auth.user.id }).select('id').single()) as { id: string };
  must(await supabase.from('invitations').insert({ event_id: eventId, contact_id: contact.id }).select('id').single());
}

/** Organizatörün elle düzenlemesi (telefonla teyit edilen davetliler için). */
export async function setInvitationStatus(id: string, status: RsvpStatus, partySize: number | null) {
  must(await supabase.from('invitations').update({ status, party_size: partySize, responded_at: new Date().toISOString() }).eq('id', id).select('id'));
}

export async function removeInvitation(id: string) {
  must(await supabase.from('invitations').delete().eq('id', id).select('id'));
}

export async function sendInvitations(eventId: string, kind: 'invite' | 'reminder' = 'invite') {
  const { data, error } = await supabase.functions.invoke('send-invitations', { body: { event_id: eventId, kind } });
  if (error) {
    // Fonksiyon hata gövdesini { error, detail } olarak döner; kotayı anlaşılır mesaja çevir.
    const ctx = (error as { context?: Response }).context;
    const payload = ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) : null;
    if (payload?.error === 'quota_exceeded') throw friendlyError({ message: 'quota_exceeded', details: payload.detail ?? 'whatsapp' });
    throw friendlyError(payload?.error ? { message: String(payload.error) } : error);
  }
  return data as { sent: number; failed: number; skipped: number; quota_left?: number };
}

// ---------------------------------------------------------------------------
// Oturma planı
// ---------------------------------------------------------------------------
const SEATING_COLS = 'id, event_id, kind, label, shape, capacity, x, y, rotation, width, height';

export async function getSeating(eventId: string): Promise<{ event: EventRow; items: SeatingItem[]; invitations: InvitationWithContact[] }> {
  const [event, items, invitations] = await Promise.all([
    supabase.from('events').select('*').eq('id', eventId).single(),
    supabase.from('seating_tables').select(SEATING_COLS).eq('event_id', eventId).order('created_at', { ascending: true }),
    supabase.from('invitations').select('*, contacts!inner(name, phone, email, side, group_label, max_party)').eq('event_id', eventId).order('created_at', { ascending: true }),
  ]);
  return { event: must(event) as EventRow, items: must(items) as SeatingItem[], invitations: must(invitations) as InvitationWithContact[] };
}

export async function addSeatingItems(eventId: string, items: Omit<SeatingItem, 'id' | 'event_id'>[]): Promise<SeatingItem[]> {
  if (!items.length) return [];
  return must(await supabase.from('seating_tables').insert(items.map((i) => ({ ...i, event_id: eventId }))).select(SEATING_COLS)) as SeatingItem[];
}

export async function updateSeatingItem(id: string, patch: Partial<Omit<SeatingItem, 'id' | 'event_id'>>) {
  must(await supabase.from('seating_tables').update(patch).eq('id', id).select('id'));
}

export async function deleteSeatingItems(ids: string[]) {
  if (!ids.length) return;
  must(await supabase.from('seating_tables').delete().in('id', ids).select('id'));
}

/** Davetleri masalara topluca atar (table_id null → masadan kaldır). */
export async function assignTables(pairs: { id: string; table_id: string | null }[]) {
  if (!pairs.length) return 0;
  return must(await supabase.rpc('assign_tables', { p_pairs: pairs })) as number;
}

// ---------------------------------------------------------------------------
// Davetli (girişsiz)
// ---------------------------------------------------------------------------
export async function getPublicInvitation(token: string): Promise<PublicInvitation | null> {
  if (isDemoToken(token)) return demoInvitation(token);
  return must(await supabase.rpc('get_invitation', { p_token: token })) as PublicInvitation | null;
}

export async function respondInvitation(
  token: string,
  status: 'yes' | 'no' | 'maybe',
  partySize?: number,
  menu?: string | null,
  note?: string | null,
  answers?: Record<string, string> | null,
  extra?: { children?: number | null; companions?: string[] | null },
) {
  if (isDemoToken(token)) return demoRespond(token, status, partySize, menu, note, answers, extra);
  return must(
    await supabase.rpc('respond_invitation', {
      p_token: token,
      p_status: status,
      p_party_size: partySize ?? null,
      p_menu: menu ?? null,
      p_note: note ?? null,
      p_answers: answers ?? null,
      p_children: extra?.children ?? null,
      p_companions: extra?.companions ?? null,
    }),
  ) as PublicInvitation;
}

export async function getMyPlan(): Promise<MyPlan> {
  return must(await supabase.rpc('my_plan')) as MyPlan;
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------
export async function adminStats(): Promise<AdminStats> {
  return must(await supabase.rpc('admin_stats')) as AdminStats;
}

/** Admin son kullanıcılar: yalnızca ad, rol, paket ve tarih (telefon/e-posta veritabanından hiç gelmez). */
export type AdminUser = Pick<Profile, 'id' | 'full_name' | 'role' | 'plan' | 'created_at'>;
export async function adminRecentUsers(limit = 20): Promise<AdminUser[]> {
  return must(await supabase.rpc('admin_recent_users', { p_limit: limit })) as AdminUser[];
}

/** Admin son etkinlikler: yalnızca başlık, tür, durum ve sayılar (davetli kişisel verisi yok). */
export type AdminEvent = Pick<EventRow, 'id' | 'title' | 'type' | 'status' | 'created_at'> & {
  summary: Pick<EventSummary, 'households' | 'attending_people'> | null;
};
export async function adminRecentEvents(limit = 20): Promise<AdminEvent[]> {
  const rows = must(await supabase.rpc('admin_recent_events', { p_limit: limit })) as (Omit<AdminEvent, 'summary'> & { households: number; attending_people: number })[];
  return rows.map(({ households, attending_people, ...e }) => ({ ...e, summary: { households: Number(households), attending_people: Number(attending_people) } }));
}

// ---------------------------------------------------------------------------
// Hesap
// ---------------------------------------------------------------------------
export async function setProfileLocale(userId: string, locale: Lang) {
  must(await supabase.from('profiles').update({ locale }).eq('id', userId).select('id'));
}

/** Hesabı ve tüm verisini kalıcı olarak siler (veritabanında zincirleme), ardından oturumu kapatır. */
export async function deleteMyAccount() {
  must(await supabase.rpc('delete_my_account'));
  await supabase.auth.signOut({ scope: 'local' });
}

// ---------------------------------------------------------------------------
// Basit veri kancası
// ---------------------------------------------------------------------------
type QueryState<T> = { data: T | null; error: string | null; loading: boolean };

/**
 * Bir sorguyu bileşen açılınca ve `deps` değişince çalıştırır.
 * `reload` yeniden çeker (eski veri ekranda kalır), `setData` sonucu elle günceller.
 */
export function useQuery<T>(fn: () => Promise<T>, deps: readonly unknown[] = []) {
  const [state, setState] = useState<QueryState<T>>({ data: null, error: null, loading: true });
  const [nonce, setNonce] = useState(0);
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });
  const key = JSON.stringify(deps);

  useEffect(() => {
    let alive = true;
    fnRef.current().then(
      (data) => alive && setState({ data, error: null, loading: false }),
      (e: unknown) => alive && setState((s) => ({ ...s, error: e instanceof Error ? e.message : String(e), loading: false })),
    );
    return () => {
      alive = false;
    };
  }, [key, nonce]);

  const reload = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    setNonce((n) => n + 1);
  }, []);

  const setData = useCallback(
    (next: T | null | ((prev: T | null) => T | null)) =>
      setState((s) => ({ ...s, data: typeof next === 'function' ? (next as (prev: T | null) => T | null)(s.data) : next })),
    [],
  );

  return { data: state.data, error: state.error, loading: state.loading, reload, setData };
}
