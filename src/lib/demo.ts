// Örnek davetiyeler (/demo/<tür>): sunucuya hiç gitmeden, cihazda üretilen sahte verilerle çalışır.
// Davetli sayfasının API çağrıları "demo-" ile başlayan token'ları burada karşılar; gerçek token'lar 32 haneli
// onaltılık olduğundan karışmaz. Hiçbir şey kaydedilmez: sayfa yenilenince her şey baştan başlar.

import { EVENT_TYPES, type EventTypeKey, sportOf } from '@/core/event-types';
import type { PollVote, PublicGuestbookEntry, PublicInvitation } from '@/core/types';

export const DEMO_PREFIX = 'demo-';
export const isDemoToken = (token: string | null | undefined): boolean => typeof token === 'string' && token.startsWith(DEMO_PREFIX);

type Lang = 'tr' | 'en';
type Copy = { title: string; hosts: string | null; venue: string; address: string; message: string; program?: [string, number][]; guest: string };

/** Her tür için örnek içerik. Mekân ve kişi adları uydurmadır. */
const COPY: Record<EventTypeKey, Record<Lang, Copy>> = {
  dugun: {
    tr: { title: 'Ayşe & Mehmet', hosts: 'Yılmaz ve Demir aileleri', venue: 'Bahçe Davet Salonu', address: 'Kadıköy, İstanbul', message: 'Hayatımızın en güzel gününde sizi de aramızda görmek istiyoruz.', program: [['Karşılama', -60], ['Nikâh', 0], ['Yemek ve dans', 60]], guest: 'Selin ve ailesi' },
    en: { title: 'Emma & James', hosts: 'The Taylor and Wright families', venue: 'The Garden Hall', address: 'Kadıköy, Istanbul', message: 'We would love you to be with us on the happiest day of our lives.', program: [['Welcome drinks', -60], ['Ceremony', 0], ['Dinner and dancing', 60]], guest: 'Sophie and family' },
  },
  nisan: {
    tr: { title: 'Zeynep & Can', hosts: 'Kaya ve Arslan aileleri', venue: 'Çamlık Bahçe', address: 'Üsküdar, İstanbul', message: 'Ailelerimizle birlikte bu mutlu anı paylaşmak istiyoruz.', guest: 'Elif ve ailesi' },
    en: { title: 'Olivia & Daniel', hosts: 'The Clarke and Evans families', venue: 'Pine Garden', address: 'Üsküdar, Istanbul', message: 'Join our families as we celebrate our engagement.', guest: 'Grace and family' },
  },
  kina: {
    tr: { title: 'Merve’nin Kına Gecesi', hosts: 'Merve ve annesi', venue: 'Konak Bahçesi', address: 'Bağcılar, İstanbul', message: 'Kınamızı yakarken türkülerimizi birlikte söyleyelim.', program: [['Gelin alma', 0], ['Kına yakma', 90]], guest: 'Derya Hanım' },
    en: { title: 'Mia’s Henna Night', hosts: 'Mia and her mother', venue: 'The Mansion Garden', address: 'Bağcılar, Istanbul', message: 'Sing and celebrate with us as the henna is lit.', program: [['Arrival of the bride', 0], ['Henna ceremony', 90]], guest: 'Mrs Hannah' },
  },
  sunnet: {
    tr: { title: 'Ali’nin Sünnet Düğünü', hosts: 'Ahmet ve Fatma Yıldız', venue: 'Şehzade Davet Salonu', address: 'Ataşehir, İstanbul', message: 'Oğlumuz Ali’nin bu güzel gününde sizleri de aramızda görmekten mutluluk duyarız.', program: [['Mevlit', -120], ['Yemek', 0], ['Eğlence', 60]], guest: 'Kemal Bey ve ailesi' },
    en: { title: 'Ali’s Circumcision Celebration', hosts: 'Ahmet and Fatma Yıldız', venue: 'The Prince Hall', address: 'Ataşehir, Istanbul', message: 'We would be delighted to have you with us on our son Ali’s special day.', program: [['Mevlit', -120], ['Dinner', 0], ['Party', 60]], guest: 'Mr Kemal and family' },
  },
  bebek: {
    tr: { title: 'Bebek Partisi', hosts: 'Deniz ve Burak', venue: 'Bulut Kafe', address: 'Moda, İstanbul', message: 'Minik misafirimizi beklerken bir araya gelelim. Kız mı, erkek mi? Hep birlikte öğreneceğiz!', guest: 'Ece' },
    en: { title: 'Baby Shower', hosts: 'Lucy and Ben', venue: 'Cloud Café', address: 'Moda, Istanbul', message: 'Let’s get together before our little one arrives. Boy or girl? We’ll find out together!', guest: 'Chloe' },
  },
  mevlut: {
    tr: { title: 'Mevlit', hosts: 'Aydın ailesi', venue: 'Mahalle Camii', address: 'Üsküdar, İstanbul', message: 'Rahmetli babamız Hasan Aydın’ın ruhuna okutulacak mevlide davetlisiniz.', guest: 'Nuri Bey' },
    en: { title: 'Mevlit', hosts: 'The Aydın family', venue: 'Neighbourhood Mosque', address: 'Üsküdar, Istanbul', message: 'You are invited to the mevlit recited in memory of our late father Hasan Aydın.', guest: 'Mr Nuri' },
  },
  mezuniyet: {
    tr: { title: 'Mezuniyet Kutlaması', hosts: 'Ege Tan', venue: 'Kampüs Terası', address: 'Beşiktaş, İstanbul', message: 'Dört yılın sonunda keplerimizi atıyoruz! Bu anı sizinle kutlamak istiyorum.', program: [['Tören', 0], ['Yemek', 120]], guest: 'Naz' },
    en: { title: 'Graduation Party', hosts: 'Ethan Tan', venue: 'Campus Terrace', address: 'Beşiktaş, Istanbul', message: 'Four years later, the caps are flying! I’d love to celebrate with you.', program: [['Ceremony', 0], ['Dinner', 120]], guest: 'Zoe' },
  },
  veda: {
    tr: { title: 'Bekârlığa Veda', hosts: 'Gelinin kızları', venue: 'Işıltı Bar', address: 'Bebek, İstanbul', message: 'Damattan önceki son büyük gece! Parıltılı bir şey giy, gerisini bize bırak.', guest: 'Melis' },
    en: { title: 'Hen Night', hosts: 'The bridesmaids', venue: 'Glitter Bar', address: 'Bebek, Istanbul', message: 'One last big night before the wedding! Wear something sparkly and leave the rest to us.', guest: 'Amy' },
  },
  dogum: {
    tr: { title: 'Defne 30 yaşında!', hosts: 'Defne', venue: 'Teras Kafe', address: 'Moda, İstanbul', message: 'Otuzuncu yaşımı en sevdiklerimle kutlamak istiyorum.', guest: 'Kerem' },
    en: { title: 'Ella turns 30!', hosts: 'Ella', venue: 'Terrace Café', address: 'Moda, Istanbul', message: 'I want to celebrate my thirtieth with my favourite people.', guest: 'Jack' },
  },
  yemek: {
    tr: { title: 'Cuma Akşam Yemeği', hosts: 'Selin ve Okan', venue: 'Evimiz', address: 'Cihangir, İstanbul', message: 'Uzun zamandır görüşemedik. Size uyan akşamı işaretleyin, sofrayı biz kuralım.', guest: 'Ahmet' },
    en: { title: 'Friday Dinner', hosts: 'Sarah and Tom', venue: 'Our place', address: 'Cihangir, Istanbul', message: 'It’s been too long. Pick the evening that suits you and we’ll set the table.', guest: 'Harry' },
  },
  kurumsal: {
    tr: { title: 'Yıl Sonu Buluşması', hosts: 'Örnek Teknoloji', venue: 'Şehir Oteli Balo Salonu', address: 'Şişli, İstanbul', message: 'Birlikte geçen bir yılı kutluyor, yeni hedeflerimizi paylaşıyoruz.', program: [['Kayıt', -30], ['Açılış konuşması', 0], ['Akşam yemeği', 90]], guest: 'Can Öztürk' },
    en: { title: 'Year-End Gathering', hosts: 'Sample Technologies', venue: 'City Hotel Ballroom', address: 'Şişli, Istanbul', message: 'Celebrating a year together and sharing our goals for the next one.', program: [['Registration', -30], ['Opening talk', 0], ['Dinner', 90]], guest: 'Chris Morgan' },
  },
  saha: {
    tr: { title: 'Perşembe Maçı', hosts: 'Kaptan Emre', venue: 'Yeşil Halı Saha', address: 'Ataşehir, İstanbul', message: 'Saat 21.00’de sahadayız. Gelemeyecekler erken haber versin, yedekler bekliyor!', guest: 'Burak' },
    en: { title: 'Thursday Football', hosts: 'Captain Leo', venue: 'Green Pitch', address: 'Ataşehir, Istanbul', message: 'Kick-off at 9pm. Let us know early if you can’t make it, the bench is waiting!', guest: 'Sam' },
  },
  basket: {
    tr: { title: 'Pazar Basketbolu', hosts: 'Kaan', venue: 'Spor Salonu', address: 'Kadıköy, İstanbul', message: '5’e 5, iki takım. Ayakkabılarını unutma.', guest: 'Mert' },
    en: { title: 'Sunday Basketball', hosts: 'Ryan', venue: 'Sports Hall', address: 'Kadıköy, Istanbul', message: '5 on 5, two teams. Don’t forget your shoes.', guest: 'Max' },
  },
  voleybol: {
    tr: { title: 'Salı Voleybolu', hosts: 'Ece', venue: 'Okul Spor Salonu', address: 'Beşiktaş, İstanbul', message: '6’ya 6 oynuyoruz. Pasörler ve liberolar özellikle aranıyor!', guest: 'Ceren' },
    en: { title: 'Tuesday Volleyball', hosts: 'Kate', venue: 'School Sports Hall', address: 'Beşiktaş, Istanbul', message: 'We play 6 on 6. Setters and liberos especially welcome!', guest: 'Lily' },
  },
  diger: {
    tr: { title: 'Bahçe Partisi', hosts: 'Komşular', venue: 'Site Bahçesi', address: 'Bostancı, İstanbul', message: 'Yaz bitmeden bir akşam bahçede buluşalım.', guest: 'Gizem' },
    en: { title: 'Garden Party', hosts: 'The neighbours', venue: 'The courtyard', address: 'Bostancı, Istanbul', message: 'Let’s meet in the garden one evening before summer ends.', guest: 'Ruby' },
  },
};

type Book = 'wedding' | 'mevlut' | 'other';
const GUESTBOOK: Record<Book, Record<Lang, [string, string][]>> = {
  wedding: {
    tr: [['Zeynep', 'Bir ömür boyu mutluluklar dileriz! Bu güzel günde yanınızda olmak çok güzel.'], ['Halil Amca', 'Allah bir yastıkta kocatsın evlatlarım.']],
    en: [['Zoe', 'Wishing you a lifetime of happiness! So glad to be here with you.'], ['Uncle Bob', 'Here’s to many happy years together.']],
  },
  mevlut: {
    tr: [['Nuri Bey', 'Allah rahmet eylesin, mekânı cennet olsun.'], ['Ayten Hanım', 'Başınız sağ olsun, dualarımız sizinle.']],
    en: [['Mr Nuri', 'May he rest in peace.'], ['Mrs Ayten', 'Our prayers are with your family.']],
  },
  other: {
    tr: [['Naz', 'Harika olacak, sabırsızlıkla bekliyorum!'], ['Kerem', 'Ellerinize sağlık, orada olacağız.']],
    en: [['Zoe', 'This is going to be great, can’t wait!'], ['Jack', 'Thanks for organising, we’ll be there.']],
  },
};

const SIGNUP: Record<Lang, [string, number][]> = {
  tr: [['Pasta', 1], ['Meyve tabağı', 2], ['Balon ve süs', 1], ['İçecek', 3]],
  en: [['Cake', 1], ['Fruit platter', 2], ['Balloons and decorations', 1], ['Drinks', 3]],
};

const LEADERS: Record<Lang, { name: string; goals: number; mvps: number }[]> = {
  tr: [{ name: 'Emre', goals: 14, mvps: 3 }, { name: 'Burak', goals: 9, mvps: 2 }, { name: 'Onur', goals: 7, mvps: 1 }],
  en: [{ name: 'Leo', goals: 14, mvps: 3 }, { name: 'Sam', goals: 9, mvps: 2 }, { name: 'Noah', goals: 7, mvps: 1 }],
};

/** İstanbul saatiyle `days` gün sonra saat `hour`:`minute` (ISO). */
function at(days: number, hour: number, minute = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour - 3, minute, 0, 0);
  return d.toISOString();
}

export function demoToken(type: EventTypeKey, lang: Lang) {
  return `${DEMO_PREFIX}${type}${lang === 'en' ? '-en' : ''}`;
}

function parse(token: string): { type: EventTypeKey; lang: Lang } | null {
  const rest = token.slice(DEMO_PREFIX.length);
  const lang: Lang = rest.endsWith('-en') ? 'en' : 'tr';
  const type = rest.replace(/-en$/, '') as EventTypeKey;
  return type in EVENT_TYPES ? { type, lang } : null;
}

function build(token: string): PublicInvitation | null {
  const p = parse(token);
  if (!p) return null;
  const { type, lang } = p;
  const c = COPY[type][lang];
  const cfg = EVENT_TYPES[type];
  const sport = sportOf(type);
  const wedding = type === 'dugun' || type === 'nisan' || type === 'sunnet' || type === 'kina';
  const days = sport ? 2 : 24;
  const hour = sport ? 21 : type === 'mevlut' ? 14 : 19;
  const starts = at(days, hour);
  const settings: PublicInvitation['event']['settings'] = {
    lang,
    message: c.message,
    countdown: !sport,
    envelope: wedding ? { enabled: true, seal: type === 'dugun' ? (lang === 'en' ? 'E&J' : 'A&M') : undefined } : undefined,
    program: c.program?.map(([title, mins], i) => ({ id: `p${i}`, title, at: new Date(new Date(starts).getTime() + mins * 60000).toISOString() })),
    guestbook: sport ? undefined : { enabled: true, public: true },
    checkin: type === 'dugun' || type === 'kurumsal' || type === 'mezuniyet',
    ...(sport ? { roster_size: 14, fee: 150 } : {}),
  };
  const inv: PublicInvitation = {
    guest_name: c.guest,
    max_party: sport ? 1 : type === 'veda' || type === 'kurumsal' ? 1 : 4,
    status: 'pending',
    party_size: null,
    menu: null,
    note: null,
    roster: sport ? { size: sport.defaultRoster, confirmed: sport.defaultRoster - 3, waitlist_position: null } : null,
    leaders: sport ? LEADERS[lang] : null,
    paid: false,
    paid_claimed: false,
    signup: type === 'bebek' ? SIGNUP[lang].map(([label, qty], i) => ({ id: `s${i}`, label, qty, taken: i === 0 ? 1 : 0, mine: 0 })) : null,
    poll:
      type === 'yemek'
        ? {
            options: [{ id: 'o1', at: at(8, 20) }, { id: 'o2', at: at(9, 20) }, { id: 'o3', at: at(15, 20) }],
            closed: false,
            chosen: null,
            mine: {},
            counts: { o1: 3, o2: 5, o3: 2 },
          }
        : null,
    announcement: null,
    event: {
      type,
      theme: cfg.suggestedTheme,
      title: c.title,
      host_names: c.hosts,
      starts_at: type === 'yemek' ? null : starts,
      venue_name: c.venue,
      venue_address: c.address,
      rsvp_deadline: sport ? null : at(days - 10, 23, 59),
      settings,
    },
  };
  return inv;
}

const store = new Map<string, PublicInvitation>();
const books = new Map<string, PublicGuestbookEntry[]>();
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function get(token: string): PublicInvitation {
  let inv = store.get(token);
  if (!inv) {
    const b = build(token);
    if (!b) throw new Error('not_found');
    inv = b;
    store.set(token, inv);
  }
  return inv;
}

const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));

export async function demoInvitation(token: string): Promise<PublicInvitation | null> {
  await wait(150);
  try {
    return clone(get(token));
  } catch {
    return null;
  }
}

export async function demoRespond(token: string, status: 'yes' | 'no' | 'maybe', partySize?: number, menu?: string | null, note?: string | null, answers?: Record<string, string> | null, extra?: { children?: number | null; companions?: string[] | null }) {
  await wait();
  const inv = get(token);
  const was = inv.status;
  inv.status = status;
  inv.party_size = status === 'yes' ? Math.max(1, partySize ?? 1) : 0;
  inv.menu = menu ?? null;
  inv.note = note ?? null;
  if (answers) inv.answers = answers;
  if (extra?.children != null) inv.children = extra.children;
  if (extra?.companions) inv.companions = extra.companions;
  if (inv.roster) inv.roster.confirmed += (status === 'yes' ? 1 : 0) - (was === 'yes' ? 1 : 0);
  inv.checkin_code = status === 'yes' && inv.event.settings.checkin ? 'DEMO42' : null;
  if (status === 'yes' && inv.event.type === 'dugun') inv.table_label = '7';
  return clone(inv);
}

export async function demoVotePoll(token: string, votes: Record<string, PollVote>) {
  await wait();
  const inv = get(token);
  if (inv.poll) {
    for (const [id, v] of Object.entries(votes)) {
      const before = inv.poll.mine[id];
      if (before === 'yes' && v !== 'yes') inv.poll.counts[id] = (inv.poll.counts[id] ?? 1) - 1;
      if (before !== 'yes' && v === 'yes') inv.poll.counts[id] = (inv.poll.counts[id] ?? 0) + 1;
    }
    inv.poll.mine = { ...votes };
  }
  return clone(inv);
}

export async function demoClaimSignup(token: string, item: string, qty: number) {
  await wait();
  const inv = get(token);
  const it = inv.signup?.find((s) => s.id === item);
  if (it) {
    const others = it.taken - it.mine;
    it.mine = Math.max(0, Math.min(qty, it.qty - others));
    it.taken = others + it.mine;
  }
  return clone(inv);
}

export async function demoClaimPaid(token: string) {
  await wait();
  const inv = get(token);
  inv.paid_claimed = true;
  return clone(inv);
}

export async function demoGuestbook(token: string): Promise<PublicGuestbookEntry[]> {
  await wait(100);
  const p = parse(token);
  if (!books.has(token)) {
    const now = Date.now();
    const t = p?.type;
    const kind: Book = t === 'dugun' || t === 'nisan' || t === 'kina' ? 'wedding' : t === 'mevlut' ? 'mevlut' : 'other';
    books.set(token, GUESTBOOK[kind][p?.lang ?? 'tr'].map(([name, message], i) => ({ name, message, at: new Date(now - (i + 1) * 3600_000 * 5).toISOString() })));
  }
  return clone(books.get(token)!);
}

export async function demoSignGuestbook(token: string, message: string): Promise<{ pending: boolean }> {
  await wait();
  const list = await demoGuestbook(token);
  books.set(token, [{ name: get(token).guest_name, message: message.trim().slice(0, 500), at: new Date().toISOString() }, ...list]);
  return { pending: false };
}

/** Tanıtım sayfasındaki canlı önizleme için örnek içerik (sunucuya gitmez). */
export function demoPreview(type: EventTypeKey, lang: Lang) {
  const c = COPY[type][lang];
  return { title: c.title, hosts: c.hosts, venue: c.venue, address: c.address, message: c.message, guest: c.guest, theme: EVENT_TYPES[type].suggestedTheme };
}
