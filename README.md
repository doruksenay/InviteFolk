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
- **Yönetim paneli** (`/admin`): yalnızca `role = 'admin'` olan hesaplara açılır. Platform istatistikleri, etkinlik türleri, son kullanıcılar ve son etkinlikler burada görünür.
- **Davetli sayfası** (`/r/[token]`): giriş ve uygulama indirme gerektirmez. Davetli katılıp katılmayacağını, kaç kişi geleceğini, menü tercihini ve notunu buradan bildirir.

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
3. **Authentication → Email**: giriş 6 haneli kodla yapılır. E-posta şablonunda `{{ .Token }}` kullanın. Canlıya çıkmadan önce kendi SMTP sağlayıcınızı bağlayın (ör. Resend), çünkü Supabase'in yerleşik SMTP'si saatlik limitlidir.
4. Kendinizi admin yapın. Önce uygulamaya bir kez giriş yapın, sonra SQL Editor'da şunu çalıştırın:
   ```sql
   update profiles set role = 'admin'
   where id = (select id from auth.users where email = 'siz@ornek.com');
   ```
   Kullanıcılar kendi `role` ve `plan` alanlarını değiştiremez; bu alanlar sütun düzeyindeki yetkiyle kilitlidir.

### 2. WhatsApp Cloud API

1. Meta for Developers'da bir **Business** uygulaması açın ve WhatsApp ürününü ekleyin. Kendi numaranızı Cloud API'ye kaydedin.
2. WhatsApp Manager'da **Utility** kategorisinde, adı `davet_lcv` ve dili Türkçe olan bir şablon oluşturun:
   - Gövde: `Merhaba {{1}}, {{2}} için sizi aramızda görmek isteriz. {{3}}`
     - `{{1}}` davetli adı, `{{2}}` etkinlik adı, `{{3}}` tarih ve yer.
   - İki **hızlı yanıt** düğmesi: `Katılacağım` ve `Katılamayacağım`.
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
npx expo export -p web       # çıktı: dist/
```

`dist/` klasörünü Cloudflare Pages'e yükleyin. Uygulama tek sayfa olduğu için `/r/...` gibi bütün yolların `index.html`'e düşmesi gerekir; bunun için `dist/_redirects` dosyasına `/* /index.html 200` satırını ekleyin. `EXPO_PUBLIC_WEB_URL` bu alan adını göstermelidir.

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
  _layout.tsx        Oturum korumaları: giriş / kullanıcı paneli / admin
  giris.tsx          E-posta kodu ile giriş
  (panel)/           Kullanıcı paneli
  (admin)/admin/     Yönetim paneli
  r/[token].tsx      Davetlinin cevap sayfası (herkese açık)
src/core/            Etkinlik türleri, temalar, biçimlendirme, tipler
src/lib/             Supabase istemcisi, oturum, API çağrıları
src/ui/              Tasarım dili: renkler, bileşenler, davetiye kartı
src/ui/seating/      Salon tuvali, sürüklenebilir masa, paneller, hızlı kurulum
supabase/migrations/ Şema + RLS
supabase/functions/  send-invitations, whatsapp-webhook
```

Her etkinlik türü `src/core/event-types.ts` içinde bir ayar kaydıdır: cevap etiketleri, sorulan sorular ve hangi araçların açık olduğu. Yeni bir tür eklemek için yeni ekran yazmak gerekmez.

## Güvenlik notları

- Anon rolün hiçbir tabloya doğrudan erişimi yoktur. Davetliler yalnızca token ile çalışan iki fonksiyonu çağırabilir. Kişi sayısı, davetliye tanımlanan üst sınırla kesilir.
- Her kullanıcı yalnızca kendi etkinliklerini, kişilerini ve davetlerini görür. Admin hepsini okuyabilir.
- `service_role` anahtarı yalnızca Edge Functions içinde kullanılır.
- Halı saha "kim ödedi" alanı yalnızca takip içindir. Uygulama başkası adına para toplamaz.

## Yol haritası

1. ~~Oturma planı~~ (tamam). Sonraki adım: WhatsApp ile "masanız" mesajı ve masa kartı PDF çıktısı
2. Kendi PDF ya da görsel davetiyesini yükleme ve isim alanını kişiye özel yazma
3. Excel/CSV ile toplu davetli aktarma ve rehberden seçme
4. Paketler: ücretsiz / 500 / 750 / 1.000 TL. Uygulama içi satın alma için RevenueCat, web için iyzico
5. E-posta ile davet
6. Halı saha için haftalık otomatik davet, yedek listesi ve ödeme takibi
7. Yönetim panelinde kullanıcı yönetimi (plan değiştirme, askıya alma)
