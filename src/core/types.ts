// Veritabanı satır tipleri (supabase/migrations/20261022000000_init.sql ile birebir).
// İleride `supabase gen types typescript` çıktısıyla değiştirilebilir.

export type Role = 'user' | 'admin';
export type Plan = 'free' | 'temel' | 'otomatik' | 'tam' | 'b2b';
export type EventStatus = 'draft' | 'active' | 'archived';
export type RsvpStatus = 'pending' | 'yes' | 'no' | 'maybe' | 'waitlist';
export type Delivery = 'not_sent' | 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
export type Side = 'gelin' | 'damat' | 'ortak';

export type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: Role;
  plan: Plan;
  locale: 'tr' | 'en';
  created_at: string;
};

export type EventRow = {
  id: string;
  owner_id: string;
  group_id: string | null;
  type: string;
  theme: string;
  title: string;
  host_names: string | null;
  starts_at: string | null;
  venue_name: string | null;
  venue_address: string | null;
  rsvp_deadline: string | null;
  status: EventStatus;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type EventSummary = {
  event_id: string;
  households: number;
  yes_households: number;
  no_households: number;
  pending_households: number;
  attending_people: number;
  failed_deliveries: number;
};

export type Contact = {
  id: string;
  owner_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  side: Side | null;
  max_party: number;
  notes: string | null;
  created_at: string;
};

export type Invitation = {
  id: string;
  event_id: string;
  contact_id: string;
  token: string;
  status: RsvpStatus;
  party_size: number | null;
  menu: string | null;
  note: string | null;
  responded_at: string | null;
  delivery: Delivery;
  table_id: string | null;
  seat_index: number | null;
  created_at: string;
};

export type SeatingKind = 'table' | 'stage' | 'dance' | 'bar' | 'dj' | 'entrance' | 'cake' | 'photo';

/** Salondaki bir öğe: masa ya da sahne, dans pisti gibi bir nesne (seating_tables). */
export type SeatingItem = {
  id: string;
  event_id: string;
  kind: SeatingKind;
  label: string;
  shape: 'round' | 'rect';
  capacity: number;
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
};

export type InvitationWithContact = Invitation & { contacts: Pick<Contact, 'name' | 'phone' | 'side' | 'max_party'> };

/** get_invitation(token) fonksiyonunun döndürdüğü, davetliye açık veri. */
export type PublicInvitation = {
  guest_name: string;
  max_party: number;
  status: RsvpStatus;
  party_size: number | null;
  menu: string | null;
  note: string | null;
  /** Yalnızca katılıyorsa ve masası atanmışsa dolu. */
  table_label?: string | null;
  event: Pick<EventRow, 'type' | 'theme' | 'title' | 'host_names' | 'starts_at' | 'venue_name' | 'venue_address' | 'rsvp_deadline' | 'settings'>;
};

export type AdminStats = {
  users: number;
  users_7d: number;
  events: number;
  active_events: number;
  invitations: number;
  responses: number;
  messages_sent: number;
  messages_failed: number;
  revenue_try: number;
  events_by_type: Record<string, number>;
};
