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

/** Etkinliği siler (yalnızca sahibi): önce tasarım, medya ve albüm dosyalarını özel kovalardan kaldırır, sonra satırı. */
export async function deleteEvent(id: string) {
  const { data: ev } = await supabase.from('events').select('owner_id').eq('id', id).maybeSingle();
  const owner = (ev as { owner_id?: string } | null)?.owner_id;
  if (owner) {
    const folder = `${owner}/${id}`;
    const clear = async (bucket: string, dir: string) => {
      try {
        for (let round = 0; round < 20; round++) {
          const { data: files } = await supabase.storage.from(bucket).list(dir, { limit: 100 });
          const names = (files ?? []).filter((f) => f.id).map((f) => `${dir}/${f.name}`);
          if (!names.length) break;
          await supabase.storage.from(bucket).remove(names);
        }
      } catch {
        // Dosya temizliği başarısız olsa da etkinlik silinir; kalan dosyalar yalnızca yöneticilere görünür.
      }
    };
    await Promise.all([clear('designs', folder), clear('media', folder), clear('album', `${folder}/album`)]);
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

/** Bir etkinliğe davet edilmiş kişilerin kimlikleri (başka etkinlikten listeyi aktarmak için). */
export async function contactIdsOfEvent(eventId: string): Promise<Set<string>> {
  const rows = must(await supabase.from('invitations').select('contact_id').eq('event_id', eventId).limit(5000)) as { contact_id: string }[];
  return new Set(rows.map((r) => r.contact_id));
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

export type ContactPatch = Partial<Pick<Contact, 'name' | 'phone' | 'email' | 'side' | 'group_label' | 'max_party' | 'notes' | 'skill' | 'position'>>;

export async function updateContact(id: string, patch: ContactPatch) {
  must(await supabase.from('contacts').update(patch).eq('id', id).select('id'));
}

/** Kişiyi rehberden siler (tüm etkinliklerdeki davetleri de silinir). */
export async function deleteContact(id: string) {
  must(await supabase.from('contacts').delete().eq('id', id).select('id'));
}

export type InvitationPatch = Partial<
  Pick<
    Invitation,
    'status' | 'party_size' | 'menu' | 'note' | 'paid' | 'paid_at' | 'responded_at' | 'children' | 'companions' | 'team' | 'paid_claimed_at' | 'checked_in_at' | 'checked_in_people'
  >
>;

export async function updateInvitation(id: string, patch: InvitationPatch) {
  must(await supabase.from('invitations').update(patch).eq('id', id).select('id'));
}

export async function setPaid(id: string, paid: boolean) {
  // Onaylanınca oyuncunun "ödedim" bildirimi kapanır.
  await updateInvitation(id, { paid, paid_at: paid ? new Date().toISOString() : null, ...(paid ? { paid_claimed_at: null } : {}) });
}

export async function setStatus(id: string, status: RsvpStatus, partySize: number | null) {
  await updateInvitation(id, { status, party_size: partySize, responded_at: new Date().toISOString() });
}

// ---------------------------------------------------------------------------
// Gönderim kanalları
// ---------------------------------------------------------------------------
export type Channel = 'whatsapp' | 'email' | 'sms';

/** Etkinliğin bu kanalda bugün kalan hakkı (etkinlik sahibinin paketinden; ortak yönetici için de). */
export async function quotaLeft(eventId: string, channel: Channel): Promise<number> {
  return Number(must(await supabase.rpc('event_quota_left', { p_event: eventId, p_channel: channel })) ?? 0);
}

export async function whatsappQuotaLeft(eventId: string): Promise<number> {
  return quotaLeft(eventId, 'whatsapp');
}

export async function emailQuotaLeft(eventId: string): Promise<number> {
  return quotaLeft(eventId, 'email');
}

export type SendResult = { sent: number; failed: number; skipped: number; quota_left?: number; via_sms?: number };
export type SendKind = 'invite' | 'reminder' | 'table' | 'announcement';
export type SendOptions = { invitationIds?: string[]; announcementId?: string; audience?: 'all' | 'yes' };

async function invokeSend(fn: 'send-invitations' | 'send-email' | 'send-sms', body: Record<string, unknown>, quotaDetail: string): Promise<SendResult> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const payload = ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) : null;
    if (payload?.error === 'quota_exceeded') throw friendlyError({ message: 'quota_exceeded', details: payload.detail ?? quotaDetail });
    throw friendlyError(payload?.error ? { message: String(payload.error) } : error);
  }
  return data as SendResult;
}

function sendBody(eventId: string, kind: SendKind, opts: SendOptions | string[] | undefined) {
  const o: SendOptions = Array.isArray(opts) ? { invitationIds: opts } : (opts ?? {});
  return {
    event_id: eventId,
    kind,
    ...(o.invitationIds?.length ? { invitation_ids: o.invitationIds } : {}),
    ...(o.announcementId ? { announcement_id: o.announcementId } : {}),
    ...(o.audience ? { audience: o.audience } : {}),
  };
}

export function sendWhatsApp(eventId: string, kind: SendKind, opts?: SendOptions | string[]) {
  return invokeSend('send-invitations', sendBody(eventId, kind, opts), 'whatsapp');
}

export function sendEmail(eventId: string, kind: SendKind, opts?: SendOptions | string[]) {
  return invokeSend('send-email', sendBody(eventId, kind, opts), 'email');
}

export function sendSms(eventId: string, kind: SendKind, opts?: SendOptions | string[]) {
  return invokeSend('send-sms', sendBody(eventId, kind, opts), 'sms');
}
