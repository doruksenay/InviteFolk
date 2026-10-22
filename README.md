# Invitefolk

> Events feel better together. — Plan. Invite. Celebrate.

Invitefolk; düğün, nişan, kına, doğum günü, yemek, kurumsal etkinlik, halı saha maçı ve benzeri her tür etkinlik için davetiye ve katılım (LCV) uygulamasıdır. iOS, Android ve web tek kod tabanından çalışır; arayüz Türkçe ve İngilizce'dir.

## Neler var

**Organizatör (kullanıcı paneli)**
- 4 adımlı sihirbaz: tür ve tema → bilgiler ve davetiye dili → davetliler → gönderim.
- Davetli ekleme: tek tek, Excel/CSV'den (sütunlar otomatik tanınır, önizleme ve hata kontrolü), telefon rehberinden, kendi rehberinden. Örnek CSV şablonu indirilebilir.
- Davetli listesi: filtreler, düzenleme, durumu elle değiştirme, menü sayıları, özel soru cevapları.
- Gönderim: otomatik WhatsApp (Cloud API), tek tek WhatsApp (wa.me sırası, ücretsiz), e-posta (Resend), kişiye özel link listesi; davet ya da hatırlatma.
- Kendi davetiye tasarımı: görsel ya da PDF yükle (PDF web panelinde), isim alanını sürükle, yazı tipini/boyutunu/rengini seç; her davetli kendi adını tasarımın üstünde görür.
- Oturma planı: masa ekle (4–14 kişi), sürükle-bırak, sahne/dans pisti/bar/DJ/pasta/foto köşesi/giriş, hızlı kurulum ("300 kişi, 10'luk masa"), otomatik yerleştirme, önizleme, masaları WhatsApp/e-posta ile bildirme, masa kartı ve isimlik çıktısı.
- Etkinlik düzenleme: tüm bilgiler, menü seçenekleri, en fazla 3 özel soru, hediye notu, otomatik hatırlatma, arşivleme, silme.
- Halı saha: kadro ve yedek listesi (kadro dolunca yedeğe, biri çıkınca ilk yedek kadroya), kişi başı ücret ve "kim ödedi" takibi, her hafta otomatik tekrar ve davet.
- Rehber: tüm etkinliklerde ortak kişi listesi.
- Paketler: ücretsiz / Temel 500 ₺ / Otomatik 750 ₺ / Tam 1.000 ₺ (bir yıl geçerli). iOS ve Android'de mağaza içi satın alma (RevenueCat), web'de iyzico.
- Telefon bildirimi: davetli cevap verince, yedekten kadroya geçişte, paket tanımlanınca.
- Ayarlar: dil, bildirim tercihi, paketler, yasal metinler, hesabı kalıcı silme.

**Davetli (giriş ve uygulama gerekmez)**
- Kişiye özel link (`/r/<token>`): tema ya da organizatörün tasarımı üstünde kendi adı.
- Katılım, kişi sayısı, menü, özel sorular, not; halı sahada kadro/yedek durumu ve ücret.
- Takvime ekle, haritada aç, masası belli ise "Masanız", TR · EN seçici, KVKK bağlantısı.

**Yönetim paneli** (`/admin`, iki adımlı doğrulama zorunlu)
- Platform özeti (yalnızca sayılar) ve kullanıcı yönetimi: arama, paket atama, askıya alma. Davetli kişisel verilerine erişim yoktur; her işlem denetim kaydına yazılır.

## Teknoloji ve maliyet

| Katman | Seçim | Maliyet |
|---|---|---|
| Uygulama | Expo SDK 58 + Expo Router (iOS, Android, web) | Ücretsiz |
| Veritabanı, giriş, dosya, sunucu fonksiyonları | Supabase (Postgres + RLS, e-posta kodu, Storage, Edge Functions) | Başlangıçta ücretsiz; canlıda Pro 25 $/ay |
| WhatsApp | Meta WhatsApp Cloud API (resmi) | Şablon mesaj başına |
| E-posta | Resend | Ayda 3.000'e kadar ücretsiz |
| Web | Cloudflare Pages | Ücretsiz |
| Mağaza ödemeleri | RevenueCat | Belli gelire kadar ücretsiz |
| Web ödemesi | iyzico | İşlem başına komisyon |
| Derleme ve mağazaya gönderim | EAS | Ücretsiz planda sınırlı derleme |

Mağaza hesapları: Apple Developer yıllık 99 $, Google Play bir kerelik 25 $.

## Kurulum

```bash
npm install
cp .env.example .env.local   # 1. bölümü doldurun
npx expo start               # Expo Go ile telefonda dene; w: web
```

Ödeme ve uzaktan bildirim Expo Go'da çalışmaz; bunlar için geliştirme derlemesi alın: `npx eas-cli@latest build --profile development`.

### 1. Supabase

1. [supabase.com](https://supabase.com) üzerinde proje açın; URL ve publishable key'i `.env.local`'a yazın.
2. Şemayı yükleyin (6 migration sırayla uygulanır: şema, oturma planı, güvenlik, özellikler, depolama, otomasyon):
   ```bash
   npx supabase login
   npx supabase link --project-ref PROJE_REF
   npx supabase db push
   ```
3. **Authentication → Email**: 6 haneli kodla giriş; e-posta şablonunda `{{ .Token }}`. Kendi SMTP'nizi (Resend) bağlayın.
4. **Authentication → Multi-Factor**: TOTP'yi açın (admin için zorunlu).
5. Kendinizi admin yapın (önce bir kez giriş yapın):
   ```sql
   update profiles set role = 'admin' where id = (select id from auth.users where email = 'siz@ornek.com');
   ```
6. Paket sınırlarını kontrol edin (`plan_limits`), fiyatları (`plan_prices`). Varsayılanlar:

   | Paket | Fiyat | Etkinlik | Etkinlik başına davetli | WhatsApp/gün | E-posta/gün |
   |---|---|---|---|---|---|
   | free | 0 | 3 | 50 | 0 (wa.me linkleri) | 30 |
   | temel | 500 ₺ | 10 | 150 | 300 | 300 |
   | otomatik | 750 ₺ | 10 | 400 | 800 | 800 |
   | tam | 1.000 ₺ | 20 | 1.000 | 2.000 | 2.000 |
   | b2b | — | 200 | 5.000 | 20.000 | 20.000 |

### 2. Sunucu fonksiyonları

```bash
npx supabase secrets set --env-file supabase/.env      # .env.example'ın 2. bölümü
npx supabase functions deploy                          # tümü; JWT ayarları supabase/config.toml'da
```

| Fonksiyon | Görev |
|---|---|
| `send-invitations` | WhatsApp şablonuyla davet, hatırlatma, "masanız" |
| `send-email` | E-posta ile davet, hatırlatma, "masanız" |
| `whatsapp-webhook` | Teslim durumları ve WhatsApp düğmesinden gelen cevaplar |
| `invitation-design` | Davetliye tasarım görselinin kısa süreli imzalı linki |
| `scheduled` | Haftalık tekrar, otomatik hatırlatma, telefon bildirimleri (10 dakikada bir) |
| `iyzico-checkout`, `iyzico-callback` | Web ödemesi |
| `revenuecat-webhook` | Mağaza satın alma ve iadeleri |

- WhatsApp kurulumu, şablon metinleri (`davet_lcv`, `davet_masa`; TR ve EN), e-posta ve zamanlama (pg_cron): **[docs/automation.md](docs/automation.md)**
- Ödeme kurulumu (App Store Connect, Play Console, RevenueCat, iyzico, sandbox testleri): **[docs/payments.md](docs/payments.md)**
- Mağaza metinleri, App Privacy / Veri Güvenliği cevapları, ekran görüntüsü planı: **[docs/store-listing.md](docs/store-listing.md)**

> Gayriresmî WhatsApp kütüphaneleri (whatsapp-web.js, Baileys vb.) kullanılmaz; numaranın kapatılmasına yol açar.

### 3. Web

```bash
npm run build:web     # dist/ + güvenlik başlıkları (_headers) + SPA yönlendirmesi (_redirects)
```

`dist/` klasörünü Cloudflare Pages'e yükleyin. `EXPO_PUBLIC_WEB_URL`, `APP_WEB_URL` ve `ALLOWED_ORIGINS` aynı adresi göstermelidir. PDF'ten tasarım yükleme `public/pdfjs` klasörünü kullanır (bkz. içindeki README).

### 4. App Store ve Google Play

```bash
npx eas-cli@latest init            # app.json'a projectId yazar (telefon bildirimleri için gerekli)
npx eas-cli@latest build -p ios --profile production
npx eas-cli@latest submit -p ios
npx eas-cli@latest build -p android --profile production
npx eas-cli@latest submit -p android
```

`eas.json` profilleri hazır; `submit` bölümündeki Apple/Google kimliklerini doldurun. Paket kimliği `com.invitefolk.app`.

## Marka

- Ad: **Invitefolk**. Slogan: "Events feel better together." / "Plan. Invite. Celebrate."
- Renkler: Deep Violet `#6C5CE7`, Coral `#FF6B6B`, Golden Yellow `#FBBF24`, Mint Green `#22C55E`, Soft Off-White `#FFF9F4` (`src/ui/tokens.ts`). Mercan, sarı ve yeşil üstünde beyaz yazı okunmadığı için yazı taşıyan zeminlerde koyu tonlar kullanılır.
- Kaynak görseller `assets/brand/` içinde (logo, uygulama ikonu, koyu tanıtım görseli, marka kimliği). Uygulama ikonları `assets/images/` içinde bunlardan üretildi.
- Kimlikler: paket `com.invitefolk.app`, bağlantı şeması `invitefolk://`, mağaza ürünleri `invitefolk_temel`, `invitefolk_otomatik`, `invitefolk_tam`. Alan adı örnekleri `invitefolk.app` olarak yazıldı; aldığınız alan adıyla değiştirin.

## Klasör yapısı

```
src/app/                       Ekranlar (Expo Router)
  _layout.tsx                  Oturum korumaları, dil sağlayıcısı
  giris.tsx                    E-posta kodu ile giriş
  (panel)/                     Organizatör: etkinlikler, sihirbaz, rehber, paketler, ayarlar
  (panel)/etkinlik/[id]/       Etkinlik, düzenleme, oturma planı, tasarım
  (admin)/admin/               Yönetim paneli (MFA kapısı arkasında)
  r/[token].tsx                Davetli sayfası (herkese açık)
  yasal/[doc].tsx              Gizlilik, koşullar, KVKK (herkese açık)
src/core/                      Etkinlik türleri, temalar, oturma geometrisi, Excel/CSV okuyucu, tipler
src/i18n/                      Türkçe ve İngilizce sözlükler
src/lib/                       Supabase istemcisi (native'de şifreli oturum), API, satın alma, bildirim
src/ui/                        Tasarım dili ve bileşenler (guests, send, seating, design, ...)
supabase/migrations/           Şema, RLS, fonksiyonlar, kotalar, depolama
supabase/functions/            Edge Functions
docs/                          Otomasyon, ödeme, mağaza
public/pdfjs/                  PDF'ten görsel üretimi (yalnızca web)
```

## Güvenlik

İlke: uygulama ya da web sitesi tamamen ele geçirilse bile saldırganın elinde yalnızca herkese açık anahtar ve en fazla kendi oturumu olur; asıl koruma veritabanındadır. 113 saldırı ve işlev senaryosu gerçek Postgres üzerinde test edildi; ayrıca bağımsız bir güvenlik incelemesinin bulduğu 5 açık kapatıldı ve tekrar test edildi. Son cevap günü bilerek yalnızca bilgi amaçlıdır: geç cevaplar da kabul edilir.

**Veritabanı**
- Satır düzeyi güvenlik: herkes yalnızca kendi etkinlik, kişi, masa, davet, tasarım dosyası ve bildirim anahtarını görür.
- Girişsiz rol hiçbir tabloya dokunamaz; davetliler yalnızca 32 karakterlik rastgele anahtarla çalışan iki fonksiyonu çağırır ve yalnızca kendilerine gereken alanları alır (tasarımın dosya yolu bile verilmez).
- Kolon yetkileri: istemci rolünü, paketini, paket süresini, davet anahtarını, teslim durumunu, etkinlik sahibini değiştiremez; mesaj, satın alma, ödeme oturumu, bildirim kuyruğu yazamaz.
- Paket yalnızca ödeme sağlayıcısının sunucudan doğrulanan bildirimiyle verilir; fiyat sunucuda belirlenir; aynı ödeme iki kez işlenmez.
- Admin en az yetkiyle çalışır ve iki adımlı doğrulama (TOTP, `aal2`) olmadan admin sayılmaz; davetli adı/telefonu admin'e hiç gelmez, e-posta yalnızca tam eşleşmede görünür.
- Askıya alınan hesap yazamaz; kotalar, hız sınırları ve girdi sınırları kötüye kullanımı keser.
- Tüm fonksiyonlar varsayılan kapalı; gerekenler tek tek açıldı. Denetim kaydı API'den erişilemez.
- Tasarım dosyaları özel kovada; davetli yalnızca davet anahtarı doğrulandıktan sonra 15 dakikalık imzalı linkle görür.

**Sunucu fonksiyonları**
- Kullanıcı adına çalışan fonksiyonlar kullanıcının yetkisiyle okur; servis anahtarı yalnızca istemcinin yazamadığı kayıtlar için.
- WhatsApp webhook imzası, RevenueCat ve zamanlanmış işler gizli anahtarla, iyzico sonucu sunucudan iyzico'ya sorularak doğrulanır (hepsi sabit zamanlı karşılaştırma).
- WhatsApp cevabı yalnızca davetin gittiği numaradan kabul edilir; olaylar tekrar işlenmez.
- Girdiler doğrulanır, gövde boyutu sınırlı, e-postada her değer kaçışlanır, hata ayrıntısı istemciye dönmez, CORS izin listesiyle.

**Uygulama ve web**
- Telefonda oturum anahtarları Keychain/Keystore'da şifreli; Android yedeği kapalı; çıkışta cihazın bildirim kaydı silinir.
- Web'de sıkı CSP (yalnızca kendi betiklerimiz, yalnızca kendi Supabase projemize istek), HSTS, çerçeveleme yasağı, `no-referrer`, davet linkleri dizinlenmez.

**Canlıya çıkmadan Supabase panelinde**
1. SSL zorunluluğu açık; doğrudan veritabanı erişimi yalnızca sizin IP'nize açık (Network restrictions).
2. Giriş kodu gönderimine hız sınırı; isterseniz bot koruması (Turnstile).
3. MFA açık; Supabase, GitHub, Apple, Google, Meta, iyzico, RevenueCat hesaplarınızda da iki adımlı doğrulama.
4. Açık şemalar yalnızca `public`; GraphQL'i kullanmıyorsanız kapatın.
5. Servis anahtarı ve tüm sırlar yalnızca Supabase secrets'ta; sızma şüphesinde yenileyin.
6. Pro planda günlük yedek ve PITR.

## Yayından önce sizin yapmanız gerekenler

- Yasal metinlerdeki `[Şirket Unvanı]`, `[Adres]`, `[KEP]`, `[e-posta]` alanlarını doldurup bir avukata kontrol ettirin.
- Meta'da `davet_lcv` ve `davet_masa` şablonlarını TR ve EN onaylatın.
- App Store Connect / Play Console'da `invitefolk_temel`, `invitefolk_otomatik`, `invitefolk_tam` ürünlerini, RevenueCat'te webhook'u, iyzico'da üye işyerini kurun.
- Gerçek telefonlarda test: oturma planında sürükleme, bildirimler, satın alma (sandbox), PDF/görsel yükleme.

Halı saha "kim ödedi" alanı yalnızca takip içindir; uygulama başkası adına para toplamaz.
