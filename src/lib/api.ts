import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  AdminStats,
  EventRow,
  EventSummary,
  InvitationWithContact,
  Profile,
  PublicInvitation,
  RsvpStatus,
  SeatingItem,
  Side,
} from '@/core/types';

import { supabase } from './supabase';

function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
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
  if (!auth.user) throw new Error('Oturum bulunamadı');
  return must(await supabase.from('events').insert({ ...input, owner_id: auth.user.id }).select('*').single()) as EventRow;
}

export async function getEvent(id: string): Promise<{ event: EventRow; summary: EventSummary | null; invitations: InvitationWithContact[] }> {
  const event = must(await supabase.from('events').select('*').eq('id', id).single()) as EventRow;
  const summary = (await supabase.from('event_summaries').select('*').eq('event_id', id).maybeSingle()).data as EventSummary | null;
  const invitations = must(
    await supabase.from('invitations').select('*, contacts!inner(name, phone, side, max_party)').eq('event_id', id).order('created_at', { ascending: true }),
  ) as InvitationWithContact[];
  return { event, summary, invitations };
}

export async function addGuest(eventId: string, guest: { name: string; phone: string | null; side: Side | null; max_party: number }) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Oturum bulunamadı');
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
  if (error) throw new Error(error.message);
  return data as { sent: number; failed: number; skipped: number };
}

// ---------------------------------------------------------------------------
// Oturma planı
// ---------------------------------------------------------------------------
const SEATING_COLS = 'id, event_id, kind, label, shape, capacity, x, y, rotation, width, height';

export async function getSeating(eventId: string): Promise<{ event: EventRow; items: SeatingItem[]; invitations: InvitationWithContact[] }> {
  const [event, items, invitations] = await Promise.all([
    supabase.from('events').select('*').eq('id', eventId).single(),
    supabase.from('seating_tables').select(SEATING_COLS).eq('event_id', eventId).order('created_at', { ascending: true }),
    supabase.from('invitations').select('*, contacts!inner(name, phone, side, max_party)').eq('event_id', eventId).order('created_at', { ascending: true }),
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
  return must(await supabase.rpc('get_invitation', { p_token: token })) as PublicInvitation | null;
}

export async function respondInvitation(token: string, status: 'yes' | 'no' | 'maybe', partySize?: number, menu?: string | null, note?: string | null) {
  return must(
    await supabase.rpc('respond_invitation', { p_token: token, p_status: status, p_party_size: partySize ?? null, p_menu: menu ?? null, p_note: note ?? null }),
  ) as PublicInvitation;
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------
export async function adminStats(): Promise<AdminStats> {
  return must(await supabase.rpc('admin_stats')) as AdminStats;
}

export async function adminRecentUsers(limit = 20): Promise<Profile[]> {
  return must(await supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(limit)) as Profile[];
}

export async function adminRecentEvents(limit = 20): Promise<EventWithSummary[]> {
  const events = must(await supabase.from('events').select('*').order('created_at', { ascending: false }).limit(limit)) as EventRow[];
  const ids = events.map((e) => e.id);
  const summaries = ids.length ? (must(await supabase.from('event_summaries').select('*').in('event_id', ids)) as EventSummary[]) : [];
  return events.map((e) => ({ ...e, summary: summaries.find((s) => s.event_id === e.id) ?? null }));
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
