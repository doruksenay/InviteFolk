// Etkinlik türlerinin metinleri. Görsel ve davranış ayarları src/core/event-types.ts içindedir.
export type EventTypeCopy = {
  name: string;
  description: string;
  rsvp: { yes: string; no: string; askParty: string };
  menu: string[] | null;
  features: { title: string; detail: string }[];
  sample: { greet: string; kicker: string; title: string; line: string; when: string; where: string; deadline: string; host: string; wa: string };
};

const RSVP = { yes: 'Katılacağım', no: 'Katılamayacağım', askParty: 'Ne güzel! Kaç kişi geleceksiniz?' };

export const eventTypes: Record<'dugun' | 'nisan' | 'kina' | 'sunnet' | 'bebek' | 'mevlut' | 'mezuniyet' | 'veda' | 'dogum' | 'yemek' | 'kurumsal' | 'saha' | 'basket' | 'voleybol' | 'diger', EventTypeCopy> = {
  dugun: {
    name: 'Düğün',
    description: 'Davetiye, katılım ve masa planı tek yerde.',
    rsvp: RSVP,
    menu: ['Et', 'Balık', 'Vejetaryen', 'Çocuk menüsü'],
    features: [
      { title: 'Oturma planı', detail: 'Masaları kur, davetlileri tek dokunuşla yerleştir.' },
      { title: 'Kına ve düğün aynı rehberden', detail: 'Listeyi bir kez yükle, kınaya da tek dokunuşla davet et.' },
      { title: 'Menü tercihi', detail: 'Et, balık ve vejetaryen sayıları hazır gelir.' },
    ],
    sample: { greet: 'Sayın Ahmet Yılmaz ve ailesi', kicker: 'Evleniyoruz', title: 'Ayşe\n& Mehmet', line: 'Hayatımızın en güzel gününde sizi de aramızda görmek istiyoruz.', when: '12 Haziran 2027, Cumartesi · 19.00', where: 'Kalamış Davet Salonu, Kadıköy', deadline: '1 Mayıs', host: 'A', wa: 'Ayşe ve Mehmet sizi düğünlerine davet ediyor.' },
  },
  nisan: {
    name: 'Nişan ve söz',
    description: 'Aile odaklı, sıcak ve küçük davetler.',
    rsvp: RSVP,
    menu: null,
    features: [
      { title: 'Aile grupları', detail: 'Gelin ve damat tarafını ayrı takip et.' },
      { title: 'Kişi sınırı', detail: 'Her haneye en fazla kaç kişi gelebileceğini belirle.' },
      { title: 'Otomatik hatırlatma', detail: 'Cevap vermeyen ailelere nazik bir hatırlatma gider.' },
    ],
    sample: { greet: 'Sayın Ahmet Yılmaz ve ailesi', kicker: 'Söz veriyoruz', title: 'Ayşe\n& Mehmet', line: 'Ailelerimizle birlikte bu mutlu anı paylaşmak istiyoruz.', when: '20 Mart 2027, Cumartesi · 17.00', where: '[Mekân adı], Üsküdar', deadline: '1 Mart', host: 'A', wa: 'Ayşe ve Mehmet sizi nişanlarına davet ediyor.' },
  },
  kina: {
    name: 'Kına gecesi',
    description: 'Düğünle aynı davetli listesini kullanır.',
    rsvp: RSVP,
    menu: null,
    features: [
      { title: 'Düğün rehberinden ekle', detail: 'Aynı davetlileri ikinci etkinliğe tek dokunuşla çağır.' },
      { title: 'Kendi davetiye tasarımın', detail: 'Görselini yükle, her davetlinin adı üstüne yazılsın.' },
      { title: 'Otomatik hatırlatma', detail: 'Kına gününden önce cevap vermeyenlere haber gider.' },
    ],
    sample: { greet: 'Sayın Ahmet Yılmaz ve ailesi', kicker: 'Kına gecesi', title: "Ayşe'nin\nkınası", line: 'Kınamızı yakarken sevdiklerimiz yanımızda olsun istiyoruz.', when: '11 Haziran 2027, Cuma · 20.00', where: '[Mekân adı], Üsküdar', deadline: '25 Mayıs', host: 'A', wa: 'Ayşe sizi kına gecesine davet ediyor.' },
  },
  sunnet: {
    name: 'Sünnet düğünü',
    description: 'Şehzademizin günü: davetiye, katılım ve masa planı.',
    rsvp: RSVP,
    menu: ['Et', 'Tavuk', 'Vejetaryen', 'Çocuk menüsü'],
    features: [
      { title: 'Oturma planı', detail: 'Masaları kur, aileleri tek dokunuşla yerleştir.' },
      { title: 'Mevlüt ve düğün tek davetiyede', detail: 'Programa mevlüt, kına ve düğünü ayrı saatlerle ekle.' },
      { title: 'Menü ve çocuk sayısı', detail: 'Kaç çocuk geleceği ve menü tercihleri hazır gelir.' },
    ],
    sample: { greet: 'Sayın Ahmet Yılmaz ve ailesi', kicker: 'Sünnet düğünümüze davetlisiniz', title: 'Şehzade\nEmir', line: 'Oğlumuz Emir’in en mutlu gününde sizleri de aramızda görmekten onur duyarız.', when: '5 Temmuz 2027, Pazar · 18.00', where: '[Salon adı], Bağcılar', deadline: '20 Haziran', host: 'Y', wa: 'Yılmaz ailesi sizi Emir’in sünnet düğününe davet ediyor.' },
  },
  bebek: {
    name: 'Baby shower ve cinsiyet partisi',
    description: 'Bebeğe hoş geldin, kız mı erkek mi?',
    rsvp: RSVP,
    menu: null,
    features: [
      { title: 'Getir listesi', detail: 'Bez, body, emzik… kim ne getiriyor, aynısı iki kez gelmesin.' },
      { title: 'Fotoğraf albümü', detail: 'Herkes çektiğini masadaki karekoddan yüklesin.' },
      { title: 'Anı defteri', detail: 'Bebeğe ilk mesajlar tek yerde birikir.' },
    ],
    sample: { greet: 'Sevgili [Davetli adı],', kicker: 'Bebeğimiz geliyor', title: 'Kız mı\nerkek mi?', line: 'Bu tatlı sürprizi sizinle birlikte öğrenmek istiyoruz.', when: '14 Mart 2027, Pazar · 15.00', where: '[Mekân adı], Ataşehir', deadline: '7 Mart', host: 'Z', wa: 'Zeynep ve Can sizi baby shower’a davet ediyor.' },
  },
  mevlut: {
    name: 'Mevlüt',
    description: 'Mevlid-i Şerif ve ikram için davet.',
    rsvp: RSVP,
    menu: null,
    features: [
      { title: 'Kişi sayısı', detail: 'İkram için kaç kişi geleceğini önceden bil.' },
      { title: 'Yol tarifi', detail: 'Cami ya da ev, adres tek dokunuşla haritada açılır.' },
      { title: 'Hatırlatma', detail: 'Cevap vermeyenlere mevlitten önce kibar bir hatırlatma gider.' },
    ],
    sample: { greet: 'Sayın [Davetli adı]', kicker: 'Mevlid-i Şerif', title: 'Mevlüt\ndavetimiz', line: 'Merhum babamız Hasan Yılmaz’ın ruhuna okunacak mevlüdümüze teşriflerinizi rica ederiz.', when: '10 Nisan 2027, Cumartesi · ikindi namazından sonra', where: '[Cami adı], Üsküdar', deadline: '8 Nisan', host: 'Y', wa: 'Yılmaz ailesi sizi mevlüde davet ediyor.' },
  },
  mezuniyet: {
    name: 'Mezuniyet',
    description: 'Tören, gala yemeği ya da mezuniyet partisi.',
    rsvp: RSVP,
    menu: ['Et', 'Balık', 'Vejetaryen'],
    features: [
      { title: 'Program', detail: 'Tören ve gala yemeğini ayrı saatlerle göster.' },
      { title: 'Oturma planı', detail: 'Gala masalarını sürükle-bırak kur.' },
      { title: 'Fotoğraf albümü', detail: 'Kep atma anı herkesin telefonundan tek albümde.' },
    ],
    sample: { greet: 'Sevgili [Davetli adı],', kicker: 'Mezun oluyorum', title: 'Elif\n2027', line: 'Dört yılın sonunda bu anı sizinle kutlamak istiyorum.', when: '25 Haziran 2027, Cuma · 18.00', where: '[Üniversite / mekân], Beşiktaş', deadline: '15 Haziran', host: 'E', wa: 'Elif seni mezuniyet kutlamasına çağırıyor.' },
  },
  veda: {
    name: 'Bekârlığa veda',
    description: 'Gelin ya da damat için son özgür gece.',
    rsvp: { yes: 'Varım!', no: 'Bu sefer olmuyor', askParty: 'Harika!' },
    menu: null,
    features: [
      { title: 'Tarih anketi', detail: 'Herkese uyan geceyi oylamayla bul.' },
      { title: 'Getir listesi', detail: 'Taç, kuşak, pasta… kim ne getiriyor.' },
      { title: 'Ortak albüm', detail: 'Gecenin fotoğrafları tek yerde, gelin görmeden önce gizli kalabilir.' },
    ],
    sample: { greet: 'Kızlar,', kicker: 'Bekârlığa veda', title: 'Ayşe’nin\nson gecesi', line: 'Ayşe evlenmeden önce son bir kez çılgınca eğleniyoruz!', when: '29 Mayıs 2027, Cumartesi · 21.00', where: '[Mekân adı], Bebek', deadline: '20 Mayıs', host: 'S', wa: 'Selin seni Ayşe’nin bekârlığa veda partisine çağırıyor.' },
  },
  dogum: {
    name: 'Doğum günü',
    description: 'Dakikalar içinde hazır, samimi bir davet.',
    rsvp: { yes: 'Geliyorum', no: 'Gelemiyorum', askParty: 'Süper! Yanında kimse gelecek mi?' },
    menu: null,
    features: [
      { title: 'Dakikalar içinde hazır', detail: 'Tarih, yer ve liste; gerisi otomatik.' },
      { title: 'Artı bir kişi', detail: 'Davetliler yanında biriyle gelebilir.' },
      { title: 'Hediye notu', detail: 'İstersen davette kısa bir not göster.' },
    ],
    sample: { greet: 'Selam [Davetli adı],', kicker: '30 yaşında', title: "Deniz'in\ndoğum günü", line: 'Hediye yok, sadece sen gel. Bunu birlikte kutlayalım.', when: '8 Mayıs 2027, Cumartesi · 20.00', where: '[Mekân adı], Moda', deadline: '1 Mayıs', host: 'D', wa: 'Deniz seni doğum günü partisine çağırıyor.' },
  },
  yemek: {
    name: 'Yemek daveti',
    description: 'Menü tercihi ve kişi sınırıyla birlikte.',
    rsvp: RSVP,
    menu: ['Et', 'Balık', 'Vejetaryen'],
    features: [
      { title: 'Menü tercihi', detail: 'Et, balık ya da vejetaryen seçimi.' },
      { title: 'Kişi sınırı', detail: 'Her haneye en fazla kaç kişi gelebileceğini belirle.' },
      { title: 'Alerji notu', detail: 'Davetliler özel isteklerini yazar.' },
    ],
    sample: { greet: 'Sayın [Davetli adı]', kicker: 'Akşam yemeği', title: 'Cumartesi\nbize gelin', line: 'Sofrayı kuruyoruz, gerisini sohbete bırakıyoruz.', when: '13 Mart 2027, Cumartesi · 20.00', where: "Ece ve Can'ın evi, Cihangir", deadline: '6 Mart', host: 'E', wa: 'Ece ve Can sizi akşam yemeğine davet ediyor.' },
  },
  kurumsal: {
    name: 'Kurumsal',
    description: 'Lansman, gala ve toplantılar için.',
    rsvp: RSVP,
    menu: null,
    features: [
      { title: 'Grup etiketleri', detail: 'Şirket ya da ekip adıyla listeni düzenle.' },
      { title: 'Özel sorular', detail: 'Katılımcılara istediğin bilgiyi sor.' },
      { title: 'Toplu e-posta', detail: 'WhatsApp yanında kurumsal e-posta da gider.' },
    ],
    sample: { greet: 'Sayın [Davetli adı]', kicker: 'Davetlisiniz', title: 'Bayi\ntoplantısı 2027', line: 'Yeni dönemin planlarını birlikte konuşalım.', when: '4 Nisan 2027, Pazar · 10.00', where: '[Otel adı], Şişli', deadline: '25 Mart', host: 'Ş', wa: '[Şirket adı] sizi bayi toplantısına davet ediyor.' },
  },
  saha: {
    name: 'Halı saha maçı',
    description: 'Kadro, yedek listesi ve haftalık tekrar.',
    rsvp: { yes: 'Geliyorum', no: 'Bu hafta yokum', askParty: 'Süper! Yedek listesine de yazayım mı?' },
    menu: null,
    features: [
      { title: 'Kadro ve yedek listesi', detail: 'Kadro dolunca yedekler sıraya girer.' },
      { title: 'Her hafta otomatik', detail: 'Maç bitince yeni hafta açılır, davet kendiliğinden gider.' },
      { title: 'Kim ödedi', detail: 'Saha ücretini kişi kişi takip et.' },
    ],
    sample: { greet: 'Selam [Davetli adı],', kicker: 'Perşembe maçı', title: 'Halı saha\n21.00', line: 'Kadroda yerin hazır, eksik kalmayalım.', when: 'Her perşembe · 21.00–22.00', where: '[Saha adı], Ataşehir', deadline: 'Çarşamba 18.00', host: 'B', wa: 'Burak seni perşembe maçına çağırıyor.' },
  },
  basket: {
    name: 'Basketbol maçı',
    description: 'Kadro, yedek listesi, haftalık tekrar ve dengeli takımlar.',
    rsvp: { yes: 'Geliyorum', no: 'Bu hafta yokum', askParty: 'Süper! Yedek listesine de yazayım mı?' },
    menu: null,
    features: [
      { title: 'Kadro ve yedek listesi', detail: 'Kadro dolunca yedekler sıraya girer.' },
      { title: 'Dengeli takımlar', detail: 'Seviye ve mevkiye (oyun kurucu, kanat, pivot) göre iki takım.' },
      { title: 'Skor ve sayı krallığı', detail: 'Maç sonucu, sayılar ve maçın oyuncusu oylaması.' },
    ],
    sample: { greet: 'Selam [Davetli adı],', kicker: 'Salı basketi', title: 'Basketbol\n20.30', line: 'Beşe beş oynuyoruz, kadroda yerin hazır.', when: 'Her salı · 20.30–22.00', where: '[Salon adı], Kadıköy', deadline: 'Pazartesi 18.00', host: 'E', wa: 'Ege seni salı basketine çağırıyor.' },
  },
  voleybol: {
    name: 'Voleybol maçı',
    description: 'Kadro, yedek listesi, haftalık tekrar ve dengeli takımlar.',
    rsvp: { yes: 'Geliyorum', no: 'Bu hafta yokum', askParty: 'Süper! Yedek listesine de yazayım mı?' },
    menu: null,
    features: [
      { title: 'Kadro ve yedek listesi', detail: 'Kadro dolunca yedekler sıraya girer.' },
      { title: 'Dengeli takımlar', detail: 'Seviye ve mevkiye (pasör, smaçör, orta oyuncu, libero) göre iki takım.' },
      { title: 'Set skoru ve maçın oyuncusu', detail: 'Maç sonucu, sayılar ve oylama.' },
    ],
    sample: { greet: 'Selam [Davetli adı],', kicker: 'Pazar voleybolu', title: 'Voleybol\n11.00', line: 'Altıya altı oynuyoruz, kadroda yerin hazır.', when: 'Her pazar · 11.00–13.00', where: '[Salon adı], Beşiktaş', deadline: 'Cumartesi 18.00', host: 'D', wa: 'Deniz seni pazar voleyboluna çağırıyor.' },
  },
  diger: {
    name: 'Başka bir şey',
    description: 'Mezuniyet, parti ya da arkadaş buluşması.',
    rsvp: RSVP,
    menu: null,
    features: [
      { title: 'Kendi soruların', detail: 'Davetlilere istediğin soruyu sor.' },
      { title: 'Otomatik hatırlatma', detail: 'Son güne doğru cevap vermeyenlere bir kez daha haber verilir.' },
      { title: 'WhatsApp ve e-posta', detail: 'Herkese en kolay kanaldan ulaş.' },
    ],
    sample: { greet: 'Sayın [Davetli adı]', kicker: 'Davetlisiniz', title: '[Etkinlik\nadı]', line: 'Bu güzel günde sizi de aramızda görmek isteriz.', when: '[Tarih] · [Saat]', where: '[Mekân]', deadline: '[Tarih]', host: 'D', wa: '[Ev sahibi] sizi davet ediyor.' },
  },
};
