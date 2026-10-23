# Canlıya alma (ücretsiz deneme kurulumu)

Bu kurulum, uygulamayı birkaç kişiyle (aynı anda 5–10 kişi) denemek için **tamamen ücretsiz** katmanlarla çalışır.
Kod GitHub'a her gönderildiğinde testler çalışır, veritabanı ve sunucu fonksiyonları güncellenir, web sitesi yeniden yayınlanır.

```
GitHub (main'e push)
  └─ GitHub Actions: "Yayınla"
       1. Kontrol      tip kontrolü, lint, 293 veritabanı testi, sunucu fonksiyonları
       2. Supabase     migration'lar → sırlar → sunucu fonksiyonları
       3. Web          derleme → Cloudflare Pages (https://<proje>.pages.dev)
  └─ "Android test sürümü" (elle)   EAS → kurulabilir APK
```

| Parça | Hizmet | Ücretsiz sınır (deneme için fazlasıyla yeter) |
|---|---|---|
| Veritabanı, giriş, dosyalar, sunucu fonksiyonları | Supabase Free | 500 MB veritabanı, 1 GB dosya, ayda 500.000 fonksiyon çağrısı; dosya başına 50 MB |
| Web sitesi | Cloudflare Pages Free | Ayda 500 derleme, sınırsız ziyaret |
| Otomatik yayın | GitHub Actions | Herkese açık depoda sınırsız; özel depoda ayda 2.000 dakika (bir yayın ~5 dakika) |
| Giriş kodu e-postası | Gmail SMTP | Günde ~500 e-posta |
| Android uygulaması (isteğe bağlı) | EAS Free | Ayda 15 Android derlemesi (kuyruk uzun olabilir) |

> **Dikkat:** Supabase'in ücretsiz projesi **7 gün hiç kullanılmazsa durdurulur**. Panelden tek tıkla yeniden başlatılır, veriler silinmez.

---

## 1. Hesaplar (bir kez)

1. **Supabase**: [supabase.com](https://supabase.com) → GitHub ile giriş.
2. **Cloudflare**: [dash.cloudflare.com](https://dash.cloudflare.com) → ücretsiz hesap (kart gerekmez).
3. **Google hesabı** (giriş kodu e-postaları için): iki adımlı doğrulama açık olmalı.
4. İsteğe bağlı **Expo** ([expo.dev](https://expo.dev)): Android APK için.

## 2. Supabase projesi

1. **New project** → ad: `invitefolk`, bölge: **Central EU (Frankfurt)**, güçlü bir veritabanı şifresi belirle ve sakla.
2. Not al:
   - **Project ref**: adres çubuğundaki `https://supabase.com/dashboard/project/<REF>` kısmı (20 harf).
   - **Publishable key**: *Project Settings → API Keys* → `sb_publishable_...` (uygulamaya gömülür, gizli değildir).
   - **Access token**: sağ üstte hesabın → *Access Tokens* → *Generate new token* (yalnızca GitHub'a yazılacak, gizlidir).

### Giriş ayarları (Authentication)

Panelde **Authentication** menüsünde:

1. **Sign In / Providers → Email**: açık; *Confirm email* açık. *Email OTP Length* = **6**.
2. **Emails → SMTP Settings** → *Enable custom SMTP* (Supabase'in kendi e-postası yalnızca proje ekibine ve saatte 2 e-posta gönderir, denemeye yetmez):

   | Alan | Değer |
   |---|---|
   | Sender email | Gmail adresin (ör. `doruksenay@gmail.com`) |
   | Sender name | `Invitefolk` |
   | Host | `smtp.gmail.com` |
   | Port | `465` |
   | Username | Gmail adresin |
   | Password | Google **uygulama şifresi**: [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) → ad: "Supabase" → çıkan 16 haneli şifre |

3. **Emails → Templates**: *Magic Link* ve *Confirm signup* şablonlarının gövdesini şununla değiştir (uygulama linke değil 6 haneli koda dayanır):

   ```html
   <h2>Invitefolk giriş kodun</h2>
   <p>Uygulamaya şu kodu yaz:</p>
   <p style="font-size:28px;font-weight:700;letter-spacing:6px">{{ .Token }}</p>
   <p>Bu kodu sen istemediysen e-postayı yok sayabilirsin.</p>
   ```

4. **URL Configuration** → *Site URL*: `https://invitefolk.pages.dev` (Cloudflare'de proje adını değiştirirsen ona göre).
5. **Multi-Factor** → *TOTP*: açık (yönetim paneli iki adımlı doğrulama ister).

> İlk e-postalar Gmail'den gönderildiği için alıcıda "Spam" klasörüne düşebilir; deneyenlere söyle.

## 3. Cloudflare

1. Sağ menüden **Account ID**'yi kopyala (*Workers & Pages* sayfasının sağında da görünür).
2. *My Profile → API Tokens → Create Token → Custom token*:
   - İzin: **Account → Cloudflare Pages → Edit**
   - Hesap: kendi hesabın
   - Oluşan token'ı kopyala (bir kez gösterilir).

Pages projesini elle açmana gerek yok; ilk yayında `invitefolk` adıyla oluşturulur. Ad alınmışsa GitHub'da `CLOUDFLARE_PAGES_PROJECT` değişkeniyle başka bir ad ver ve `WEB_URL`'i de ona göre değiştir.

## 4. GitHub ayarları

Depoda **Settings → Secrets and variables → Actions**:

**Secrets** (gizli):

| Ad | Değer |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Supabase access token |
| `SUPABASE_DB_PASSWORD` | Proje açarken belirlediğin veritabanı şifresi |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token |
| `CRON_SECRET` | Rastgele uzun bir dize (ör. [şuradan](https://www.random.org/strings/?num=1&len=20&digits=on&upperalpha=on&loweralpha=on&format=plain) iki tane birleştir, en az 32 karakter) |

**Variables** (gizli değil):

| Ad | Değer |
|---|---|
| `SUPABASE_PROJECT_REF` | Project ref |
| `SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID |
| `WEB_URL` | `https://invitefolk.pages.dev` |

İsteğe bağlı (boş bırakılan özellik kapalı kalır, uygulamanın geri kalanı çalışır):

| Özellik | Secrets | Variables |
|---|---|---|
| Otomatik WhatsApp (Meta test numarası ücretsiz, 5 doğrulanmış alıcıya gönderir) | `WHATSAPP_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` | `WHATSAPP_PHONE_NUMBER_ID` |
| E-postayla davetiye (Resend; alan adı doğrulaması gerekir) | `RESEND_API_KEY` | `EMAIL_FROM` |
| Yapay zekâ (davet metni, basılı davetiyeden okuma; ücretli API) | `ANTHROPIC_API_KEY` | |
| SMS (Netgsm; ücretli) | `NETGSM_USERCODE`, `NETGSM_PASSWORD` | `NETGSM_HEADER` |
| Web ödemesi (iyzico sandbox ücretsiz) | `IYZICO_API_KEY`, `IYZICO_SECRET_KEY` | `IYZICO_BASE_URL` = `https://sandbox-api.iyzipay.com` |
| Android APK | `EXPO_TOKEN` (expo.dev → Account settings → Access tokens) | |

## 5. İlk yayın

*Actions* sekmesi → **Yayınla** → *Run workflow* (ya da `main`'e herhangi bir push). Üç adım da yeşil olunca adres özet sayfasında görünür.
Bir ayar eksikse adım kırmızı olur ve hangi ayarın eksik olduğunu yazar.

## 6. Zamanlanmış işler (bir kez)

Hatırlatmalar, haftalık maçların yenilenmesi ve telefon bildirimleri 10 dakikada bir çalışan bir işle yürür.
Supabase panelinde **SQL Editor**'a `scripts/zamanlayici.sql` dosyasının içeriğini yapıştır, `<CRON_SECRET>` (GitHub'daki ile aynı) ve `<PROJE_REF>` alanlarını doldur, çalıştır.

## 7. Kendini yönetici yap ve deneyenlere paket ver

1. Sitede bir kez kendi e-postanla giriş yap.
2. SQL Editor:
   ```sql
   update profiles set role = 'admin' where id = (select id from auth.users where email = 'doruksenay@gmail.com');
   ```
3. `/admin` sayfasında iki adımlı doğrulamayı kur. **Kullanıcılar** ekranından deneyenlere istediğin paketi (ör. *Tam*) ver; böylece müzik, video, kapıda giriş, albüm gibi ücretli özellikler ödeme yapmadan denenir.

## 8. Telefonda deneme

- **iPhone ve Android, kurulum gerektirmeden:** siteyi tarayıcıda aç → paylaş menüsü → *Ana Ekrana Ekle*. Davetli sayfaları zaten tarayıcıda çalışır.
- **Android uygulaması (isteğe bağlı):** `EXPO_TOKEN`'ı ekle → *Actions* → **Android test sürümü** → *Run workflow*. Derleme bitince expo.dev'deki derleme sayfasında APK linki ve karekodu olur; telefona indirip kur ("bilinmeyen kaynaklar" izni ister).
- **iPhone uygulaması:** Apple geliştirici hesabı (yıllık 99 $) gerektirir; deneme için web yeterli.

## Ücretsiz modda ne çalışır?

| Özellik | Durum |
|---|---|
| Etkinlik, şablonlar, davetiye sayfası, oturma planı, takım kurma, kapıda giriş, albüm, bilgi toplama, dışa aktarma | ✓ |
| Davetliye gönderim: WhatsApp linkleriyle tek tek (ücretsiz), kişiye özel link kopyalama | ✓ |
| Giriş kodu e-postası | ✓ (Gmail SMTP) |
| Organizatöre telefon bildirimi | Android APK'da ✓, web'de yok |
| Otomatik WhatsApp, e-posta davetiyesi, SMS, yapay zekâ, ödeme | Anahtarları ekleyince açılır |

## Sorun giderme

- **Giriş kodu gelmiyor:** Spam klasörü; Supabase → *Authentication → Logs*; Gmail uygulama şifresi doğru mu, port 465 mi.
- **"Yayınla" Supabase adımında kırmızı:** veritabanı şifresi ya da access token yanlış; proje durdurulmuş olabilir (panelden *Restore*).
- **Web açılıyor ama giriş/veri hatası:** `SUPABASE_PROJECT_REF` ve `SUPABASE_PUBLISHABLE_KEY` doğru mu; `WEB_URL` Cloudflare adresiyle birebir aynı mı (CORS ve e-posta linkleri buna bakar).
- **Zamanlanmış iş çalışmıyor:** SQL Editor'da `select status, return_message from cron.job_run_details order by start_time desc limit 5;` — `CRON_SECRET` iki yerde aynı olmalı.
- **Video yüklenmiyor:** ücretsiz planda dosya başına sınır 50 MB.
