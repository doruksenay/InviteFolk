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
  plan_expires_at: string | null;
  suspended_at: string | null;
  notify_rsvp: boolean;
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
  /** Herkese açık bağlantı (hediye sayfası, bilgi toplama formu, albüm); yalnızca okunur. */
  public_slug: string;
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
  group_label: string | null;
  max_party: number;
  notes: string | null;
  /** Halı saha: takım dengelemek için seviye (1–5) ve mevki; yalnızca organizatör görür. */
  skill?: number | null;
  position?: PlayerPosition | null;
  created_at: string;
};

export type PlayerPosition =
  | 'kaleci' | 'defans' | 'orta' | 'forvet' // futbol
  | 'oyun_kurucu' | 'kanat' | 'pivot' // basketbol
  | 'pasor' | 'smacor' | 'orta_oyuncu' | 'libero'; // voleybol

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
  answers: Record<string, string>;
  paid: boolean;
  paid_at: string | null;
  promoted_at: string | null;
  reminder_count: number;
  last_reminded_at: string | null;
  /** Kişi sayısının içindeki çocuk sayısı ve yanındakilerin adları (etkinlik soruyorsa). */
  children: number;
  companions: string[];
  /** Davetli linki ilk ve son açtığında (organizatörün önizlemesi sayılmaz). */
  opened_at: string | null;
  last_opened_at: string | null;
  open_count: number;
  /** Kapıda karekodla giriş. */
  checkin_code: string;
  checked_in_at: string | null;
  checked_in_people: number | null;
  /** Halı saha: takım (1/2) ve oyuncunun "ödedim" bildirimi. */
  team: 1 | 2 | null;
  paid_claimed_at: string | null;
  /** Tarih anketi oyları: seçenek kimliği → yes/maybe/no. */
  poll: Record<string, PollVote>;
  created_at: string;
};

export type PollVote = 'yes' | 'maybe' | 'no';

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

export type InvitationWithContact = Invitation & {
  contacts: Pick<Contact, 'name' | 'phone' | 'side' | 'max_party'> & Partial<Pick<Contact, 'email' | 'group_label' | 'skill' | 'position'>>;
};

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
  answers?: Record<string, string>;
  /** Kadrolu etkinliklerde (halı saha): kadro büyüklüğü, onaylı sayısı, yedekse sırası. */
  roster?: { size: number; confirmed: number; waitlist_position: number | null } | null;
  children?: number;
  companions?: string[];
  /** Katılıyorsa ve organizatör kapıda girişi açtıysa: girişte gösterilecek kod. */
  checkin_code?: string | null;
  checked_in?: boolean;
  team?: 1 | 2 | null;
  paid?: boolean;
  paid_claimed?: boolean;
  poll?: PublicPoll | null;
  signup?: PublicSignupItem[] | null;
  last_match?: PublicMatch | null;
  leaders?: { name: string; goals: number; mvps: number }[] | null;
  announcement?: { body: string; at: string } | null;
  event: Pick<EventRow, 'type' | 'theme' | 'title' | 'host_names' | 'starts_at' | 'venue_name' | 'venue_address' | 'rsvp_deadline'> & { settings: GuestSettings };
};

export type PublicPoll = { options: PollOption[]; closed: boolean; chosen?: string | null; mine: Record<string, PollVote>; counts: Record<string, number> };
export type PublicSignupItem = { id: string; label: string; qty: number; taken: number; mine: number };
export type PublicMatch = {
  id: string;
  played_at: string;
  score_a: number | null;
  score_b: number | null;
  players: { id: string; name: string; team: 1 | 2 | null }[];
  voting_open: boolean;
  /** Davetlinin kendi oyuncu kimliği (kendine oy veremez). */
  me: string;
  my_vote: string | null;
  mvp: string | null;
};

/** Davetliye açılan ayarlar (get_invitation süzer; dosya yolları yok). */
export type GuestSettings = Omit<EventSettings, 'design' | 'music' | 'video' | 'gallery' | 'gift' | 'album'> & {
  has_design?: boolean;
  design?: Omit<EventDesign, 'path'>;
  music?: { title?: string };
  video?: Omit<EventVideo, 'path'>;
  gallery_count?: number;
  gift?: Omit<GiftInfo, 'public'>;
  album_slug?: string;
};

/** Herkese açık etkinlik sayfası (hediye, bilgi toplama, albüm). */
export type PublicEvent = {
  type: string;
  theme: string;
  title: string;
  host_names: string | null;
  starts_at: string | null;
  venue_name: string | null;
  lang: 'tr' | 'en';
  gift: Omit<GiftInfo, 'public'> | null;
  collector: boolean;
  album: boolean;
  album_public: boolean;
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

// ---------------------------------------------------------------------------
// events.settings anahtarları (jsonb). Davetliye açık olanlar get_invitation'da süzülür.
// ---------------------------------------------------------------------------
export type CustomQuestion = { id: string; label: string; type: 'text' | 'choice'; options?: string[] };

/** Davetiye tasarımı: özel kovada görsel + isim alanının görsel üzerindeki yeri (0–1 oranları). */
export type DesignOverlay = {
  x: number; // metin kutusunun sol kenarı (genişliğe oran)
  y: number; // metin satırının dikey merkezi (yüksekliğe oran)
  width: number; // metin kutusu genişliği (oran)
  size: number; // yazı boyutu, görsel genişliğine oran (ör. 0.05)
  color: string; // #RRGGBB
  font: 'serif' | 'serifItalic' | 'sans' | 'sansBold';
  align: 'left' | 'center' | 'right';
  prefix: string; // "Sayın " gibi; boş olabilir
};
export type EventDesign = { path: string; width: number; height: number; overlay: DesignOverlay };
/** Video davetiye: medya kovasında; isim alanı isteğe bağlı (videonun üstünde). */
export type EventVideo = { path: string; width: number; height: number; overlay?: DesignOverlay };
export type GalleryPhoto = { path: string; width: number; height: number };
/** Program: kına, nikâh, düğün gibi birden fazla tören tek davetiyede. */
export type ProgramItem = { id: string; title: string; at?: string | null; venue?: string | null; address?: string | null };
/** Takı / hediye / ödeme bilgisi. IBAN boşluksuz büyük harfle saklanır. */
export type GiftInfo = { iban: string; holder: string; bank?: string | null; note?: string | null; public?: boolean };
export type PollOption = { id: string; at: string };
export type SignupItem = { id: string; label: string; qty: number };

export type EventSettings = {
  lang?: 'tr' | 'en';
  menu?: string[];
  roster_size?: number;
  recurring?: 'weekly' | null;
  auto_invite?: boolean;
  fee?: number; // kişi başı saha ücreti (TRY), yalnızca takip
  gift_note?: string;
  questions?: CustomQuestion[];
  reminders?: { auto: boolean; days_before?: number };
  design?: EventDesign;
  last_rolled_at?: string;
  /** Davetiye sayfası */
  message?: string;
  envelope?: { enabled?: boolean; seal?: string };
  countdown?: boolean;
  program?: ProgramItem[];
  gift?: GiftInfo;
  music?: { path: string; title?: string };
  video?: EventVideo;
  gallery?: GalleryPhoto[];
  ask_children?: boolean;
  ask_names?: boolean;
  /** Araçlar */
  checkin?: boolean;
  collector?: boolean;
  album?: { enabled?: boolean; public?: boolean };
  sms_fallback?: boolean;
  poll?: { options: PollOption[]; closed?: boolean; chosen?: string | null };
  signup?: SignupItem[];
};

export type PlanLimits = {
  plan: Plan;
  max_events: number;
  max_guests_per_event: number;
  max_contacts: number;
  max_hall_items_per_event: number;
  whatsapp_per_day: number;
  email_per_day: number;
  max_cohosts: number;
  max_gallery: number;
  album_photos: number;
  sms_per_day: number;
  ai_per_day: number;
  music: boolean;
  video: boolean;
  checkin: boolean;
  collector: boolean;
};

export type TeamMember = { id: string | null; user_id: string | null; full_name: string | null; email: string; role: 'owner' | 'cohost'; accepted: boolean; created_at: string };
export type GuestRequest = { id: string; event_id: string; name: string; phone: string | null; email: string | null; party: number; note: string | null; status: 'pending' | 'approved' | 'rejected'; created_at: string };
export type AlbumPhoto = { id: string; event_id: string; path: string; content_type: string; uploader: string | null; confirmed: boolean; hidden: boolean; created_at: string };
export type Announcement = { id: string; event_id: string; body: string; created_at: string };
export type MatchRow = {
  id: string;
  event_id: string;
  played_at: string;
  players: { id: string; name: string; team: 1 | 2 | null }[];
  goals: Record<string, number>;
  score_a: number | null;
  score_b: number | null;
  created_at: string;
};

export type MyPlan = {
  plan: Plan;
  expires_at: string | null;
  limits: PlanLimits;
  usage: { events: number; contacts: number };
};
