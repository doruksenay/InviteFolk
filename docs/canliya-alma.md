# Canlıya alma (ücretsiz, otomatik)

Uygulamayı birkaç kişiyle (aynı anda 5–10 kişi) denemek için **tamamen ücretsiz** katmanlarla çalışır.
GitHub'a dört secret girildikten sonra her şeyi "Yayınla" iş akışı kendisi yapar; panellerde elle ayar gerekmez.

```
main'e push (ya da Actions → Yayınla → Run workflow)
  1. Kontrol    tip kontrolü, lint, 332 veritabanı testi, sunucu fonksiyonları
  2. Ortam      Supabase projesi yoksa açar (Frankfurt) ve hazır olmasını bekler
                giriş ayarları: Gmail SMTP, 6 haneli kod e-postası, site adresi, iki adımlı doğrulama
                Cloudflare Pages projesi yoksa açar, adresini bulur
  3. Supabase   migration'lar → sunucu sırları → fonksiyonlar → zamanlayıcı (yoksa) → yönetici yetkisi
  4. Web        derleme → Cloudflare Pages
"Android test sürümü" (elle): EAS'ta kurulabilir APK
```

| Parça | Hizmet | Ücretsiz sınır |
|---|---|---|
| Veritabanı, giriş, dosyalar, sunucu fonksiyonları | Supabase Free | 500 MB veritabanı, 1 GB dosya, ayda 500.000 fonksiyon çağrısı; dosya başına 50 MB |
| Web sitesi | Cloudflare Pages Free | Ayda 500 yayın, sınırsız ziyaret |
| Otomatik yayın | GitHub Actions | Herkese açık depoda sınırsız |
| Giriş kodu e-postası | Gmail SMTP | Günde ~500 e-posta |
| Android uygulaması (isteğe bağlı) | EAS Free | Ayda 15 Android derlemesi (kuyruk uzun olabilir) |

> Supabase'in ücretsiz projesi **7 gün hiç kullanılmazsa durdurulur**. "Yayınla" bir sonraki çalışmada projeyi kendisi uyandırır (ya da panelden *Restore*); veriler silinmez.

## Senin yapacakların (yaklaşık 10 dakika, bir kez)

Bu adımlar senin kimliğinle hesap açmayı ve anahtar üretmeyi gerektirdiği için otomatikleştirilemez.

1. **Supabase hesabı**: [supabase.com](https://supabase.com) → *Sign in with GitHub*. Organizasyon oluşturmanı isterse adını yaz, plan: **Free**. Proje açma, iş akışı açacak.
   Sonra [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) → *Generate new token* → kopyala.
2. **Cloudflare hesabı**: [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up) (kart gerekmez).
   Sonra *My Profile → API Tokens → Create Token → Create Custom Token*: izin **Account · Cloudflare Pages · Edit**, hesap: kendi hesabın → kopyala.
3. **Gmail uygulama şifresi** (giriş kodlarını göndermek için): Google hesabında iki adımlı doğrulama açık olmalı →
   [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) → ad: `Supabase` → 16 haneli şifreyi kopyala.
4. **GitHub**: depo → *Settings → Secrets and variables → Actions → New repository secret*, dört tane:

   | Secret | Değer |
   |---|---|
   | `SUPABASE_ACCESS_TOKEN` | 1. adımdaki token |
   | `CLOUDFLARE_API_TOKEN` | 2. adımdaki token |
   | `SMTP_USER` | Gmail adresin (yönetici de bu adres olur) |
   | `SMTP_PASSWORD` | 3. adımdaki uygulama şifresi |

5. *Actions → Yayınla → Run workflow*. İlk çalışma 8–12 dakika sürer (proje açılıyor). Bitince özet sayfasında site adresi yazar
   (`https://invitefolk-<github-kullanıcı-adın>.pages.dev`).
6. Siteye kendi Gmail adresinle bir kez giriş yap, sonra **Yayınla**'yı bir kez daha çalıştır: hesabına yönetici yetkisi verilir.
   `/admin` sayfasından deneyenlere istediğin paketi (ör. *Tam*) ver; böylece ücretli özellikler ödeme yapmadan denenir.

> Anahtarları sohbete ya da koda yazma; yalnızca GitHub Secrets'a gir. Depo herkese açık olsa da Secrets ve iş akışı kayıtlarında görünmez.
> Deneme bitince Supabase ve Cloudflare token'larını silmen yeterli.

## İsteğe bağlı özellikler

Boş bırakılan özellik kapalı kalır, uygulamanın geri kalanı çalışır. Ekledikten sonra **Yayınla**'yı çalıştır.

| Özellik | Secrets | Variables |
|---|---|---|
| Otomatik WhatsApp (Meta test numarası ücretsiz, 5 doğrulanmış alıcıya gönderir) | `WHATSAPP_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` | `WHATSAPP_PHONE_NUMBER_ID` |
| E-postayla davetiye (Resend; alan adı doğrulaması gerekir) | `RESEND_API_KEY` | `EMAIL_FROM` |
| SMS (Netgsm; ücretli) | `NETGSM_USERCODE`, `NETGSM_PASSWORD` | `NETGSM_HEADER` |
| Web ödemesi (iyzico sandbox ücretsiz) | `IYZICO_API_KEY`, `IYZICO_SECRET_KEY` | `IYZICO_BASE_URL` = `https://sandbox-api.iyzipay.com` |
| Android APK | `EXPO_TOKEN` (expo.dev → Account settings → Access tokens) | |
| Farklı yönetici adresi | `ADMIN_EMAIL` | |
| Gmail yerine başka e-posta servisi (ör. Brevo: `smtp-relay.brevo.com`, 587) | `SMTP_USER`, `SMTP_PASSWORD` (servisin SMTP bilgileri) | `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM` (serviste doğrulanmış gönderen adresi) |
| Var olan bir Supabase projesini kullan | | `SUPABASE_PROJECT_REF` |
| Token organizasyonu göremiyorsa | | `SUPABASE_ORG_ID` (supabase.com/dashboard/org/`<kod>`) |
| Kendi alan adın (Cloudflare'de; token'a ayrıca *Zone · DNS · Edit* izni) | | `WEB_URL` = `https://alanadin.com` |

## Telefonda deneme

- **iPhone ve Android, kurulum gerektirmeden:** siteyi tarayıcıda aç → paylaş menüsü → *Ana Ekrana Ekle*.
- **Android uygulaması:** `EXPO_TOKEN`'ı ekle → *Actions* → **Android test sürümü** → *Run workflow*. Derleme bitince expo.dev'deki derleme sayfasında APK linki ve karekodu olur.
- **iPhone uygulaması:** Apple geliştirici hesabı (yıllık 99 $) gerektirir; deneme için web yeterli.

## Ücretsiz modda ne çalışır?

| Özellik | Durum |
|---|---|
| Etkinlik, şablonlar, davetiye sayfası, oturma planı, takım kurma, kapıda giriş, albüm, bilgi toplama, dışa aktarma | ✓ |
| Davetliye gönderim: WhatsApp linkleriyle tek tek, kişiye özel link kopyalama | ✓ |
| Giriş kodu e-postası | ✓ (Gmail; ilk e-postalar Spam'e düşebilir) |
| Organizatöre telefon bildirimi | Android APK'da ✓, web'de yok |
| Otomatik WhatsApp, e-posta davetiyesi, SMS, ödeme | Anahtarları ekleyince açılır |

## Sorun giderme

- **Ortam adımı "eksik secret" diyor:** dört secret'ın adını birebir kontrol et.
- **"Supabase hesabında organizasyon yok":** supabase.com'a bir kez girip organizasyon oluştur.
- **Cloudflare hatası:** token izni *Account · Cloudflare Pages · Edit* olmalı.
- **Giriş kodu gelmiyor:** Spam klasörü; Supabase → *Authentication → Logs*; `SMTP_PASSWORD` uygulama şifresi mi (normal Gmail şifresi çalışmaz).
- **Video yüklenmiyor:** ücretsiz planda dosya başına sınır 50 MB.
- **Elle kurulum** (iş akışı kullanmadan): README'deki *Kurulum* bölümü ve `scripts/zamanlayici.sql`.
