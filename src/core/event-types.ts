// Etkinlik türleri veri olarak tanımlanır: yeni bir tür eklemek kod değil, bu listeye bir kayıt eklemektir.
// Her tür; cevap etiketlerini, sorulacak soruları, açılan araçları ve önerilen temayı belirler.

import type { ThemeKey } from './themes';

export type EventTypeKey = 'dugun' | 'nisan' | 'kina' | 'dogum' | 'yemek' | 'kurumsal' | 'saha' | 'diger';

export type IconName = 'rings' | 'ring' | 'lantern' | 'cake' | 'plate' | 'briefcase' | 'ball' | 'sparkle';

export type EventTypeConfig = {
  key: EventTypeKey;
  name: string;
  description: string;
  icon: IconName;
  accent: string;
  tint: string;
  iconBg: string;
  glow: string;
  suggestedTheme: ThemeKey;
  rsvp: { yes: string; no: string; askParty: string };
  questions: {
    partySize: boolean;   // kaç kişi geleceğini sor
    menu: string[] | null; // menü seçenekleri
    roster: boolean;      // kadro limiti + yedek listesi
  };
  tools: { seating: boolean; recurring: boolean; payments: boolean; companyFields: boolean };
  features: { title: string; detail: string }[];
  // Önizleme ve boş form için örnek metinler
  sample: { greet: string; kicker: string; title: string; line: string; when: string; where: string; deadline: string; host: string; wa: string };
};

const DEFAULT_RSVP = { yes: 'Katılacağım', no: 'Katılamayacağım', askParty: 'Ne güzel! Kaç kişi geleceksiniz?' };

export const EVENT_TYPES: Record<EventTypeKey, EventTypeConfig> = {
  dugun: {
    key: 'dugun', name: 'Düğün', description: 'Davetiye, katılım ve masa planı tek yerde.', icon: 'rings',
    accent: '#E8664F', tint: '#FFF5F2', iconBg: '#FFE4DD', glow: 'rgba(232,102,79,0.16)', suggestedTheme: 'adacayi',
    rsvp: DEFAULT_RSVP,
    questions: { partySize: true, menu: ['Et', 'Balık', 'Vejetaryen', 'Çocuk menüsü'], roster: false },
    tools: { seating: true, recurring: false, payments: false, companyFields: false },
    features: [
      { title: 'Oturma planı', detail: 'Masaları kur, davetlileri sürükleyip yerleştir.' },
      { title: 'Kına ve düğün tek listede', detail: 'Listeyi bir kez yükle, iki etkinliğe davet et.' },
      { title: 'Menü tercihi', detail: 'Et, balık ve vejetaryen sayıları hazır gelir.' },
    ],
    sample: { greet: 'Sayın Ahmet Yılmaz ve ailesi', kicker: 'Evleniyoruz', title: 'Ayşe\n& Mehmet', line: 'Hayatımızın en güzel gününde sizi de aramızda görmek istiyoruz.', when: '12 Haziran 2027, Cumartesi · 19.00', where: 'Kalamış Davet Salonu, Kadıköy', deadline: '1 Mayıs', host: 'A', wa: 'Ayşe ve Mehmet sizi düğünlerine davet ediyor.' },
  },
  nisan: {
    key: 'nisan', name: 'Nişan ve söz', description: 'Aile odaklı, sıcak ve küçük davetler.', icon: 'ring',
    accent: '#7E66DE', tint: '#F7F4FF', iconBg: '#EAE4FF', glow: 'rgba(126,102,222,0.16)', suggestedTheme: 'lavanta',
    rsvp: DEFAULT_RSVP,
    questions: { partySize: true, menu: null, roster: false },
    tools: { seating: true, recurring: false, payments: false, companyFields: false },
    features: [
      { title: 'Aile grupları', detail: 'Gelin ve damat tarafını ayrı takip et.' },
      { title: 'Kişi sınırı', detail: 'Her haneye en fazla kaç kişi gelebileceğini belirle.' },
      { title: 'Otomatik hatırlatma', detail: 'Cevap vermeyenlere kendiliğinden hatırlatır.' },
    ],
    sample: { greet: 'Sayın Ahmet Yılmaz ve ailesi', kicker: 'Söz veriyoruz', title: 'Ayşe\n& Mehmet', line: 'Ailelerimizle birlikte bu mutlu anı paylaşmak istiyoruz.', when: '20 Mart 2027, Cumartesi · 17.00', where: '[Mekân adı], Üsküdar', deadline: '1 Mart', host: 'A', wa: 'Ayşe ve Mehmet sizi nişanlarına davet ediyor.' },
  },
  kina: {
    key: 'kina', name: 'Kına gecesi', description: 'Düğünle aynı davetli listesini kullanır.', icon: 'lantern',
    accent: '#C9573A', tint: '#FFF5EF', iconBg: '#FCE0D3', glow: 'rgba(201,87,58,0.15)', suggestedTheme: 'mercan',
    rsvp: DEFAULT_RSVP,
    questions: { partySize: true, menu: null, roster: false },
    tools: { seating: false, recurring: false, payments: false, companyFields: false },
    features: [
      { title: 'Düğünle ortak liste', detail: 'Aynı davetlilere ikinci etkinlik tek dokunuşla.' },
      { title: 'Kadın ya da karma davet', detail: 'Kimlerin davetli olduğunu filtreyle seç.' },
      { title: 'Otomatik hatırlatma', detail: 'Gece yaklaşınca konum ve saat gider.' },
    ],
    sample: { greet: 'Sayın Ahmet Yılmaz ve ailesi', kicker: 'Kına gecesi', title: "Ayşe'nin\nkınası", line: 'Kınamızı yakarken sevdiklerimiz yanımızda olsun istiyoruz.', when: '11 Haziran 2027, Cuma · 20.00', where: '[Mekân adı], Üsküdar', deadline: '25 Mayıs', host: 'A', wa: 'Ayşe sizi kına gecesine davet ediyor.' },
  },
  dogum: {
    key: 'dogum', name: 'Doğum günü', description: 'Dakikalar içinde hazır, samimi bir davet.', icon: 'cake',
    accent: '#C99327', tint: '#FFFAEC', iconBg: '#FBEBC2', glow: 'rgba(201,147,39,0.16)', suggestedTheme: 'altin',
    rsvp: { yes: 'Geliyorum', no: 'Gelemiyorum', askParty: 'Süper! Yanında kimse gelecek mi?' },
    questions: { partySize: true, menu: null, roster: false },
    tools: { seating: false, recurring: false, payments: false, companyFields: false },
    features: [
      { title: 'Dakikalar içinde hazır', detail: 'Tarih, yer ve liste; gerisi otomatik.' },
      { title: 'Artı bir kişi', detail: 'Davetliler yanında biriyle gelebilir.' },
      { title: 'Hediye notu', detail: 'İstersen davette kısa bir not göster.' },
    ],
    sample: { greet: 'Selam [Davetli adı],', kicker: '30 yaşında', title: "Deniz'in\ndoğum günü", line: 'Hediye yok, sadece sen gel. Bunu birlikte kutlayalım.', when: '8 Mayıs 2027, Cumartesi · 20.00', where: '[Mekân adı], Moda', deadline: '1 Mayıs', host: 'D', wa: 'Deniz seni doğum günü partisine çağırıyor.' },
  },
  yemek: {
    key: 'yemek', name: 'Yemek daveti', description: 'Menü tercihi ve kişi sınırıyla birlikte.', icon: 'plate',
    accent: '#5E8F73', tint: '#F3F9F5', iconBg: '#DCEBE1', glow: 'rgba(94,143,115,0.16)', suggestedTheme: 'adacayi',
    rsvp: DEFAULT_RSVP,
    questions: { partySize: true, menu: ['Et', 'Balık', 'Vejetaryen'], roster: false },
    tools: { seating: false, recurring: false, payments: false, companyFields: false },
    features: [
      { title: 'Menü tercihi', detail: 'Et, balık ya da vejetaryen seçimi.' },
      { title: 'Kişi sınırı', detail: 'Masa kaç kişilikse o kadar davet.' },
      { title: 'Alerji notu', detail: 'Davetliler özel isteklerini yazar.' },
    ],
    sample: { greet: 'Sayın [Davetli adı]', kicker: 'Akşam yemeği', title: 'Cumartesi\nbize gelin', line: 'Sofrayı kuruyoruz, gerisini sohbete bırakıyoruz.', when: '13 Mart 2027, Cumartesi · 20.00', where: "Ece ve Can'ın evi, Cihangir", deadline: '6 Mart', host: 'E', wa: 'Ece ve Can sizi akşam yemeğine davet ediyor.' },
  },
  kurumsal: {
    key: 'kurumsal', name: 'Kurumsal', description: 'Lansman, gala ve toplantılar için.', icon: 'briefcase',
    accent: '#4E5A72', tint: '#F5F6F9', iconBg: '#E3E6EE', glow: 'rgba(78,90,114,0.14)', suggestedTheme: 'gece',
    rsvp: DEFAULT_RSVP,
    questions: { partySize: false, menu: null, roster: false },
    tools: { seating: true, recurring: false, payments: false, companyFields: true },
    features: [
      { title: 'Şirket ve unvan alanı', detail: 'Katılımcı bilgileri tek listede.' },
      { title: 'Yaka kartı için QR', detail: 'Girişte okut, katılımı anında gör.' },
      { title: 'Toplu e-posta', detail: 'WhatsApp yanında kurumsal e-posta da gider.' },
    ],
    sample: { greet: 'Sayın [Davetli adı]', kicker: 'Davetlisiniz', title: 'Bayi\ntoplantısı 2027', line: 'Yeni dönemin planlarını birlikte konuşalım.', when: '4 Nisan 2027, Pazar · 10.00', where: '[Otel adı], Şişli', deadline: '25 Mart', host: 'Ş', wa: '[Şirket adı] sizi bayi toplantısına davet ediyor.' },
  },
  saha: {
    key: 'saha', name: 'Halı saha maçı', description: 'Kadro, yedek listesi ve haftalık tekrar.', icon: 'ball',
    accent: '#3F7F55', tint: '#F0F8F2', iconBg: '#D5EADC', glow: 'rgba(63,127,85,0.16)', suggestedTheme: 'adacayi',
    rsvp: { yes: 'Geliyorum', no: 'Bu hafta yokum', askParty: 'Süper! Yedek listesine de yazayım mı?' },
    questions: { partySize: false, menu: null, roster: true },
    tools: { seating: false, recurring: true, payments: true, companyFields: false },
    features: [
      { title: 'Kadro ve yedek listesi', detail: 'Kadro dolunca yedekler sıraya girer.' },
      { title: 'Her hafta otomatik', detail: 'Davet her hafta kendiliğinden gider.' },
      { title: 'Kim ödedi', detail: 'Saha ücretini kişi kişi takip et.' },
    ],
    sample: { greet: 'Selam [Davetli adı],', kicker: 'Perşembe maçı', title: 'Halı saha\n21.00', line: 'Kadroda yerin hazır, eksik kalmayalım.', when: 'Her perşembe · 21.00–22.00', where: '[Saha adı], Ataşehir', deadline: 'Çarşamba 18.00', host: 'B', wa: 'Burak seni perşembe maçına çağırıyor.' },
  },
  diger: {
    key: 'diger', name: 'Başka bir şey', description: 'Mezuniyet, parti ya da arkadaş buluşması.', icon: 'sparkle',
    accent: '#8C6E4E', tint: '#FAF5EF', iconBg: '#EFE4D6', glow: 'rgba(140,110,78,0.14)', suggestedTheme: 'lavanta',
    rsvp: DEFAULT_RSVP,
    questions: { partySize: true, menu: null, roster: false },
    tools: { seating: false, recurring: false, payments: false, companyFields: false },
    features: [
      { title: 'Kendi soruların', detail: 'Davetlilere istediğin soruyu sor.' },
      { title: 'Otomatik hatırlatma', detail: 'Cevap vermeyenlere kendiliğinden gider.' },
      { title: 'WhatsApp ve e-posta', detail: 'Herkese en kolay kanaldan ulaş.' },
    ],
    sample: { greet: 'Sayın [Davetli adı]', kicker: 'Davetlisiniz', title: '[Etkinlik\nadı]', line: 'Bu güzel günde sizi de aramızda görmek isteriz.', when: '[Tarih] · [Saat]', where: '[Mekân]', deadline: '[Tarih]', host: 'D', wa: '[Ev sahibi] sizi davet ediyor.' },
  },
};

export const EVENT_TYPE_ORDER: EventTypeKey[] = ['dugun', 'nisan', 'kina', 'dogum', 'yemek', 'kurumsal', 'saha', 'diger'];

export function getEventType(key: string | null | undefined): EventTypeConfig {
  return EVENT_TYPES[(key as EventTypeKey) ?? 'diger'] ?? EVENT_TYPES.diger;
}
