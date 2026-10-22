// Etkinlik ve davetli yönetimi: içe aktarma, rehber, düzenleme, gönderim kanalları.
// Tümü kullanıcının kendi oturumuyla çalışır; yetki, kolon izinleri ve kotalar veritabanında zorlanır.
import type { Contact, EventRow, EventSettings, EventSummary, Invitation, RsvpStatus, Side } from '@/core/types';

import { type EventWithSummary, friendlyError, must, supabase } from './api';

// ---------------------------------------------------------------------------
// Etkinlikler
// ---------------------------------------------------------------------------
export async function listEvents(includeArchived: boolean): Promise<EventWithSummary[]> {
  let q = supabase.from('events').select('*').order('starts_at', { ascending: true, nullsFirst: false });
  if (!includeArchived) q = q.neq('status', 'archived');
  const events = must(await q) as EventRow[];
  const ids = events.map((e) => e.id);
  const summaries = ids.length ? (must(await supabase.from('event_summaries').select('*').in('event_id', ids)) as EventSummary[]) : [];
  return events.map((e) => ({ ...e, summary: summaries.find((s) => s.event_id === e.id) ?? null }));
}

export async function getEventRow(id: string): Promise<EventRow> {
  return must(await supabase.from('events').select('*').eq('id', id).single()) as EventRow;
}

export type EventPatch = Partial<
  Pick<EventRow, 'type' | 'theme' | 'title' | 'host_names' | 'starts_at' | 'venue_name' | 'venue_address' | 'rsvp_deadline' | 'status'>
> & { settings?: EventSettings };

export async function updateEvent(id: string, patch: EventPatch) {
  must(await supabase.from('events').update(patch).eq('id', id).select('id'));
}

/** Etkinliği siler: önce (varsa) tasarım dosyalarını özel kovadan kaldırır, sonra satırı. */
export async function deleteEvent(id: string) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (uid) {
    try {
      const folder = `${uid}/${id}`;
      const { data: files } = await supabase.storage.from('designs').list(folder, { limit: 100 });
      if (files?.length) await supabase.storage.from('designs').remove(files.map((f) => `${folder}/${f.name}`));
    } catch {
      // Dosya temizliği başarısız olsa da etkinlik silinir; kalan dosyalar yalnızca sahibine görünür.
    }
  }
  must(await supabase.from('events').delete().eq('id', id).select('id'));
}

// ---------------------------------------------------------------------------
// Davetliler
// ---------------------------------------------------------------------------
export type GuestInput = {
  name: string;
  phone: string | null;
  email: string | null;
  side: Side | null;
  group: string | null;
  max_party: number;
};

export type ImportResult = { added: number; existing: number; invalid: number };

/** Toplu ekleme (Excel/CSV, telefon rehberi, elle tek kişi). Aynı telefon rehberde varsa o kişi kullanılır. */
export async function importGuests(eventId: string, rows: GuestInput[], onProgress?: (done: number, total: number) => void): Promise<ImportResult> {
  const total: ImportResult = { added: 0, existing: 0, invalid: 0 };
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const r = must(await supabase.rpc('import_guests', { p_event: eventId, p_rows: chunk })) as ImportResult;
    total.added += r.added;
    total.existing += r.existing;
    total.invalid += r.invalid;
    onProgress?.(Math.min(rows.length, i + chunk.length), rows.length);
  }
  return total;
}

export async function addContactsToEvent(eventId: string, contactIds: string[]): Promise<number> {
  return must(await supabase.rpc('add_contacts_to_event', { p_event: eventId, p_contacts: contactIds })) as number;
}

export async function listMyContacts(): Promise<Contact[]> {
  return must(await supabase.from('contacts').select('*').order('name', { ascending: true }).limit(5000)) as Contact[];
}

/** Bu etkinliğe henüz davet edilmemiş kişiler. */
export async function listContactsNotIn(eventId: string): Promise<Contact[]> {
  const [all, inv] = await Promise.all([
    listMyContacts(),
    supabase.from('invitations').select('contact_id').eq('event_id', eventId),
  ]);
  const taken = new Set(((must(inv) as { contact_id: string }[]) ?? []).map((r) => r.contact_id));
  return all.filter((c) => !taken.has(c.id));
}

export type ContactPatch = Partial<Pick<Contact, 'name' | 'phone' | 'email' | 'side' | 'group_label' | 'max_party' | 'notes'>>;

export async function updateContact(id: string, patch: ContactPatch) {
  must(await supabase.from('contacts').update(patch).eq('id', id).select('id'));
}

/** Kişiyi rehberden siler (tüm etkinliklerdeki davetleri de silinir). */
export async function deleteContact(id: string) {
  must(await supabase.from('contacts').delete().eq('id', id).select('id'));
}

export type InvitationPatch = Partial<Pick<Invitation, 'status' | 'party_size' | 'menu' | 'note' | 'paid' | 'paid_at' | 'responded_at'>>;

export async function updateInvitation(id: string, patch: InvitationPatch) {
  must(await supabase.from('invitations').update(patch).eq('id', id).select('id'));
}

export async function setPaid(id: string, paid: boolean) {
  await updateInvitation(id, { paid, paid_at: paid ? new Date().toISOString() : null });
}

export async function setStatus(id: string, status: RsvpStatus, partySize: number | null) {
  await updateInvitation(id, { status, party_size: partySize, responded_at: new Date().toISOString() });
}

// ---------------------------------------------------------------------------
// Gönderim kanalları
// ---------------------------------------------------------------------------
export async function whatsappQuotaLeft(): Promise<number> {
  return Number(must(await supabase.rpc('whatsapp_quota_left')) ?? 0);
}

export async function emailQuotaLeft(): Promise<number> {
  return Number(must(await supabase.rpc('email_quota_left')) ?? 0);
}

export type SendResult = { sent: number; failed: number; skipped: number; quota_left?: number };

async function invokeSend(fn: 'send-invitations' | 'send-email', body: Record<string, unknown>, quotaDetail: string): Promise<SendResult> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const payload = ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) : null;
    if (payload?.error === 'quota_exceeded') throw friendlyError({ message: 'quota_exceeded', details: payload.detail ?? quotaDetail });
    throw friendlyError(payload?.error ? { message: String(payload.error) } : error);
  }
  return data as SendResult;
}

export function sendWhatsApp(eventId: string, kind: 'invite' | 'reminder', invitationIds?: string[]) {
  return invokeSend('send-invitations', { event_id: eventId, kind, ...(invitationIds?.length ? { invitation_ids: invitationIds } : {}) }, 'whatsapp');
}

export function sendEmail(eventId: string, kind: 'invite' | 'reminder', invitationIds?: string[]) {
  return invokeSend('send-email', { event_id: eventId, kind, ...(invitationIds?.length ? { invitation_ids: invitationIds } : {}) }, 'email');
}
