# Davet

Davet; düğün, nişan, kına, doğum günü, yemek, kurumsal etkinlik, halı saha maçı ve benzeri her tür etkinlik için bir davetiye ve katılım (LCV) uygulamasıdır. Davetiyeler WhatsApp ile gönderilir, davetlinin cevabı listeye kendiliğinden düşer.

- **Kullanıcı paneli** (`/`, `/yeni`, `/etkinlik/[id]`): etkinlik oluşturma sihirbazı, davetli listesi, WhatsApp ile gönderim ve hatırlatma, elle durum düzenleme.
- **Oturma planı** (`/etkinlik/[id]/oturma`):
  - Masa ekleme (4–14 kişilik, yuvarlak ya da uzun) ve sürükle-bırak.
  - Sahne, dans pisti, bar, DJ, pasta, fotoğraf köşesi ve giriş nesneleri.
  - "Hızlı kurulum": "300 kişi, 10'luk masa" gibi bir girdiden salonun tamamı kurulur.
  - Davetliyi seçip masaya dokunarak yerleştirme.
  - Otomatik yerleştirme: gelin tarafı soldan, damat tarafı sağdan dolar; aileler bölünmez.
  - Önizleme modu ve salona gönderilecek masa listesini kopyalama.
  - Davetli, atandığı masayı kendi sayfasında görür.
- **Yönetim paneli** (`/admin`): yalnızca `role = 'admin'` olan ve iki adımlı doğrulamayı (TOTP) geçen hesaplara açılır. Yalnızca özet görür: kullanıcı/etkinlik sayıları, cevap oranı, WhatsApp teslim sağlığı, gelir. Davetlilerin adını ya da telefonunu göremez.
- **Ayarlar** (`/ayarlar`): uygulama dili, hesap, güvenlik bilgisi ve hesabı kalıcı silme (App Store kuralı).
- **Davetli sayfası** (`/r/[token]`): giriş ve uygulama indirme gerektirmez. Davetli katılıp katılmayacağını, kaç kişi geleceğini, menü tercihini ve notunu buradan bildirir.

### Diller: Türkçe ve İngilizce

- Uygulama cihaz dilinde açılır; kullanıcı Ayarlar'dan değiştirebilir.
- Her etkinliğin ayrı bir **davetiye dili** vardır (sihirbazın 2. adımı). Davetli sayfası, WhatsApp mesajları ve wa.me metinleri bu dilde gider; davetli sayfanın üstündeki "TR · EN" ile değiştirebilir.
- Metinler `src/i18n/tr/*.ts` ve `src/i18n/en/*.ts` içinde. İngilizce sözlük Türkçe ile aynı şekle sahip olmak zorundadır; eksik anahtar derleme hatası verir.

## Teknoloji

| Katman | Seçim | Maliyet |
|---|---|---|
| Uygulama | Expo SDK 58 + Expo Router: iOS, Android ve web tek kod tabanından | Ücretsiz |
| Veritabanı ve kimlik | Supabase (Postgres + RLS, e-posta kodu ile giriş, Edge Functions) | Free plan, büyüyünce Pro $25/ay |
| WhatsApp | Meta WhatsApp Cloud API (resmi). Ücretsiz pakette `wa.me` linkleri | Utility şablon mesaj başına ücret |
| Web | Cloudflare Pages (davetli sayfası ve web paneli) | Ücretsiz |
| Mağaza derlemeleri | EAS Build ve EAS Submit | Free plan ayda 30 derleme |

Mağaza hesapları: Apple Developer yıllık $99, Google Play tek seferlik $25.

## Kurulum

```bash
npm install
cp .env.example .env.local   # değerleri doldurun
npx expo start               # i: iOS simülatör, a: Android, w: web
```

Supabase ayarları yapılmamışsa uygulama, eksik değişkenleri gösteren bir ekranla açılır.

### 1. Supabase projesi

1. [supabase.com](https://supabase.com) üzerinde bir proje açın. URL'yi ve publishable key'i `.env.local` dosyasına yazın.
2. Şemayı yükleyin:
   ```bash
   npx supabase login
   npx supabase link --project-ref PROJE_REF
   npx supabase db push
   ```
   `supabase/migrations/` klasöründeki dosyalar sırayla uygulanır. `20261022000000_init.sql` şunları kurar:
   - tablolar ve RLS politikaları;
   - davetli sayfasının kullandığı `get_invitation` ve `respond_invitation` fonksiyonları;
   - `event_summaries` görünümü ve `admin_stats` fonksiyonu.

   `20261023000000_seating.sql` oturma planı için şunları ekler:
   - salon nesneleri ve `assign_tables` toplu atama fonksiyonu;
   - davetin yalnızca kendi etkinliğindeki bir masaya atanabilmesi; "gelmiyorum" diyen davetli masasından otomatik kalkar.

   `20261024000000_security.sql` güvenlik katmanlarını kurar (ayrıntı: "Güvenlik" bölümü).
3. **Authentication → Email**: giriş 6 haneli kodla yapılır. E-posta şablonunda `{{ .Token }}` kullanın. Canlıya çıkmadan önce kendi SMTP sağlayıcınızı bağlayın (ör. Resend), çünkü Supabase'in yerleşik SMTP'si saatlik limitlidir.
4. Kendinizi admin yapın. Önce uygulamaya bir kez giriş yapın, sonra SQL Editor'da şunu çalıştırın:
   ```sql
   update profiles set role = 'admin'
   where id = (select id from auth.users where email = 'siz@ornek.com');
   ```
   Kullanıcılar kendi `role` ve `plan` alanlarını değiştiremez; bu alanlar sütun düzeyindeki yetkiyle kilitlidir. Rol/paket değişikliği denetim kaydına (`private.audit_log`) yazılır.
5. **Authentication → Multi-Factor**: TOTP'yi açın. Admin ilk kez `/admin`'e girdiğinde QR kodu tarayıp doğrulama uygulamasını bağlar; sonraki girişlerde 6 haneli kodu sorar.
6. Paket kotalarını kontrol edin (`plan_limits` tablosu). Varsayılanlar tahmindir; ürün kararınıza göre SQL ile güncelleyin:

   | Paket | Etkinlik | Etkinlik başına davetli | WhatsApp/gün |
   |---|---|---|---|
   | free | 3 | 50 | 0 (wa.me linkleri) |
   | temel | 10 | 150 | 300 |
   | otomatik | 10 | 400 | 800 |
   | tam | 20 | 1.000 | 2.000 |
   | b2b | 200 | 5.000 | 20.000 |

### 2. WhatsApp Cloud API

1. Meta for Developers'da bir **Business** uygulaması açın ve WhatsApp ürününü ekleyin. Kendi numaranızı Cloud API'ye kaydedin.
2. WhatsApp Manager'da **Utility** kategorisinde `davet_lcv` adlı şablonu iki dilde oluşturun (aynı ad, iki dil):
   - Türkçe (`tr`) gövde: `Merhaba {{1}}, {{2}} için sizi aramızda görmek isteriz. {{3}}`; düğmeler: `Katılacağım`, `Katılamayacağım`.
   - İngilizce (`en`) gövde: `Hello {{1}}, we would love to see you at {{2}}. {{3}}`; düğmeler: `I'll be there`, `Can't make it`.
   - `{{1}}` davetli adı, `{{2}}` etkinlik adı, `{{3}}` tarih ve yer. Düğmeler **hızlı yanıt** türünde ve bu sırada olmalı.
3. Sırları girin ve fonksiyonları yayınlayın:
   ```bash
   npx supabase secrets set --env-file supabase/.env
   npx supabase functions deploy send-invitations
   npx supabase functions deploy whatsapp-webhook --no-verify-jwt
   ```
4. Meta uygulamasında **WhatsApp → Configuration → Webhook** bölümünü doldurun:
   - Callback URL: `https://PROJE_REF.supabase.co/functions/v1/whatsapp-webhook`
   - Verify token: `WHATSAPP_VERIFY_TOKEN` değeriniz
   - Abone olunacak alan: `messages`

Akış şöyle işler:
- Uygulama `send-invitations` fonksiyonunu çağırır ve şablon her davetliye kendi token'ıyla gider.
- Davetli bir düğmeye bastığında webhook imzayı doğrular (`X-Hub-Signature-256`) ve cevabı `respond_invitation` ile kaydeder.
- "Katılacağım" cevabından sonra davetliye "kaç kişi?" listesi gönderilir.
- Teslim ve okundu durumları listede görünür.

> Gayriresmî WhatsApp kütüphaneleri (whatsapp-web.js, Baileys vb.) kullanılmaz. Bu kütüphaneler numaranın kapatılmasına yol açar.

### 3. Web (davetli sayfası)

```bash
npm run build:web            # dist/ + güvenlik başlıkları (_headers) + SPA yönlendirmesi (_redirects)
```

`dist/` klasörünü Cloudflare Pages'e yükleyin. `_headers` dosyası sıkı bir içerik güvenliği politikası (CSP), HSTS, çerçeveleme yasağı ve `Referrer-Policy: no-referrer` ekler; davetli linkleri arama motorlarında dizinlenmez. `EXPO_PUBLIC_WEB_URL` bu alan adını, edge function sırrı `ALLOWED_ORIGINS` da aynı adresi göstermelidir.

### 4. App Store ve Google Play

```bash
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build -p ios --profile production
npx eas-cli@latest submit -p ios
npx eas-cli@latest build -p android --profile production
npx eas-cli@latest submit -p android
```

`EXPO_PUBLIC_*` değişkenlerini EAS ortam değişkeni olarak da tanımlayın: `npx eas-cli@latest env:create`. Paket kimliği `com.davet.app`'tir ve `app.json` içinden değiştirilebilir.

## Klasör yapısı

```
src/app/             Ekranlar (Expo Router)
  _layout.tsx        Oturum korumaları: giriş / kullanıcı paneli / admin (+ dil sağlayıcısı)
  giris.tsx          E-posta kodu ile giriş
  (panel)/           Kullanıcı paneli
  (admin)/admin/     Yönetim paneli (önünde iki adımlı doğrulama kapısı)
  (panel)/ayarlar.tsx  Dil, hesap, hesabı silme
  (panel)/etkinlik/[id]/oturma.tsx   Oturma planı
  r/[token].tsx      Davetlinin cevap sayfası (herkese açık)
src/core/            Etkinlik türleri, temalar, oturma geometrisi ve yerleştirme, biçimlendirme, tipler
src/i18n/            Türkçe ve İngilizce sözlükler, dil sağlayıcısı
src/lib/             Supabase istemcisi (native'de şifreli oturum deposu), oturum, API çağrıları
src/ui/              Tasarım dili: renkler, bileşenler, davetiye kartı
src/ui/seating/      Salon tuvali, sürüklenebilir masa, paneller, hızlı kurulum
supabase/migrations/ Şema + RLS
supabase/functions/  send-invitations, whatsapp-webhook
```

Her etkinlik türü `src/core/event-types.ts` içinde bir ayar kaydıdır: cevap etiketleri, sorulan sorular ve hangi araçların açık olduğu. Yeni bir tür eklemek için yeni ekran yazmak gerekmez.

## Güvenlik

İlke: uygulama ya da web sitesi tamamen ele geçirilse bile saldırganın elinde yalnızca herkese açık anahtar ve en fazla bir kullanıcının oturumu olur. Asıl koruma veritabanındadır ve aşağıdaki katmanlar `supabase/migrations` içinde tanımlıdır. Testleri: 40 saldırı senaryosu (yetkisiz okuma, rol yükseltme, sahte satın alma, kota aşımı, anahtar tahmini vb.) gerçek Postgres üzerinde denenip geçti.

**Veritabanı**
- Satır düzeyi güvenlik (RLS): her kullanıcı yalnızca kendi etkinlik, kişi, masa ve davetlerini görür.
- Girişsiz (anon) rol hiçbir tabloya dokunamaz; davetliler yalnızca 32 karakterlik rastgele anahtarla çalışan iki fonksiyonu çağırır. Bu fonksiyonlar etkinlik ayarlarının yalnızca davetliye gereken kısmını döndürür.
- Kolon yetkileri: istemci davet anahtarını, teslim durumunu, etkinlik sahibini, rolünü ya da paketini değiştiremez; mesaj ve satın alma kaydı yazamaz.
- **Admin en az yetkiyle çalışır**: hiçbir tabloyu doğrudan okuyamaz, yalnızca özet fonksiyonları çağırır. Davetli adı, telefonu, e-postası admin'e hiç gelmez. Admin hesabı çalınsa bile kişisel veri sızmaz.
- **Admin yetkisi iki adımlı doğrulama ister**: `is_admin()` yalnızca TOTP ile doğrulanmış (`aal2`) oturumu admin sayar. Şifre/e-posta ele geçirilse bile admin olunamaz.
- Girdi sınırları (uzunluk, telefon biçimi, ayar boyutu, koordinat aralığı) ile büyük veriyle saldırı engellenir.
- Paket kotaları ve hız sınırları: etkinlik/davetli/kişi/salon öğesi sayısı, günlük WhatsApp hakkı; davetli cevabı saatte 20 değişiklikle sınırlı.
- Fonksiyonlar varsayılan olarak kimseye açık değil; yalnızca gerekenler tek tek açıldı. Yeni fonksiyon eklerken `grant execute` yazmayı unutmayın.
- Denetim kaydı (`private.audit_log`): rol/paket değişiklikleri ve hesap silmeler. API'den okunamaz ve yazılamaz.
- Hesap silme (`delete_my_account`): kullanıcının tüm verisi zincirleme silinir.

**Sunucu fonksiyonları**
- `send-invitations` davetleri kullanıcının kendi yetkisiyle okur. Servis anahtarı yalnızca istemcinin yazamadığı mesaj günlüğü için kullanılır. Girdiler doğrulanır, gövde boyutu sınırlıdır, hata ayrıntısı istemciye dönmez, CORS yalnızca `ALLOWED_ORIGINS`.
- `whatsapp-webhook` her isteği Meta imzasıyla sabit zamanlı doğrular. Cevabı yalnızca davetin gittiği telefon numarasından kabul eder; aynı olayı iki kez işlemez.

**Uygulama ve web**
- Telefonda oturum anahtarları iOS Keychain / Android Keystore'da şifreli tutulur (cihaz kilitliyken okunamaz, yedekle taşınmaz). Android uygulama yedeği kapalı.
- Web'de sıkı CSP: yalnızca kendi alan adımızdan betik, yalnızca kendi Supabase projemize istek. XSS olsa bile veri başka sunucuya gönderilemez.
- Giriş tek kullanımlık e-posta koduyla; şifre saklanmaz.

**Canlıya çıkmadan önce Supabase panelinde yapılacaklar**
1. *Settings → Database → SSL enforcement*: açın. *Network restrictions*: doğrudan veritabanı bağlantısını yalnızca kendi IP'nize açın (uygulama yalnızca API kullanır).
2. *Authentication → Rate limits*: e-posta kodu gönderimini sınırlayın. İsterseniz *Bot protection* (Cloudflare Turnstile) açın.
3. *Authentication → Multi-Factor*: TOTP açık. Supabase hesabınızda ve GitHub'da da iki adımlı doğrulamayı açın.
4. *API → Exposed schemas*: yalnızca `public`. GraphQL'i kullanmıyorsanız kapatın.
5. Servis anahtarını (`service_role` / `sb_secret_…`) hiçbir zaman uygulamaya, web'e ya da depoya koymayın. Sızdığından şüphelenirseniz panelden yenileyin.
6. *Database → Backups*: Pro planda günlük yedek ve PITR açık olsun.

Halı saha "kim ödedi" alanı yalnızca takip içindir. Uygulama başkası adına para toplamaz.

## Yol haritası

1. ~~Oturma planı~~ (tamam). Sonraki adım: WhatsApp ile "masanız" mesajı ve masa kartı PDF çıktısı
2. Kendi PDF ya da görsel davetiyesini yükleme ve isim alanını kişiye özel yazma
3. Excel/CSV ile toplu davetli aktarma ve rehberden seçme
4. Paketler: ücretsiz / 500 / 750 / 1.000 TL. Uygulama içi satın alma için RevenueCat, web için iyzico
5. E-posta ile davet
6. Halı saha için haftalık otomatik davet, yedek listesi ve ödeme takibi
7. Yönetim panelinde kullanıcı yönetimi (plan değiştirme, askıya alma)
