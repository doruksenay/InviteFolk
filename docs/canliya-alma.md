# Canlıya alma (ücretsiz, otomatik)

Uygulamayı birkaç kişiyle (aynı anda 5–10 kişi) denemek için **tamamen ücretsiz** katmanlarla çalışır (staging).
Canlıya çıkış için aşağıdaki **Canlı ortam için zorunlu ayarlar** bölümüne bak.
GitHub'a dört secret girildikten sonra her şeyi "Yayınla" iş akışı kendisi yapar; panellerde elle ayar gerekmez.

```
main'e push (ya da Actions → Yayınla → Run workflow)
  1. Kontrol    tip kontrolü, lint, 339 veritabanı testi, sunucu fonksiyonları
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

## Ortamlar: staging ve production

Yayın iki ortama ayrıldı. Her ortamın **kendi Supabase projesi ve kendi Cloudflare Pages projesi** vardır.

| Ne yaparsan | Nereye gider |
|---|---|
| `main`'e push | **staging** (`invitefolk-staging` Supabase projesi, `invitefolk-staging-<kullanıcı>.pages.dev`) |
| `v1.0.0` gibi bir etiket (`git tag v1.0.0 && git push origin v1.0.0`) | **production** (`invitefolk` projesi, `WEB_URL` = https://invitefolk.com) |
| Actions → Yayınla → Run workflow | seçtiğin ortam |

GitHub → *Settings → Environments* altında `staging` ve `production` ortamları ilk yayında kendiliğinden açılır.
**production** ortamına girip *Required reviewers* kutusuna kendini ekle: canlıya her yayın senin onayını bekler.
Depo düzeyindeki secret'lar iki ortamda da geçerlidir; ortama özel değer gerekiyorsa (ör. canlı WhatsApp token'ı) aynı adla
o ortamın altına yaz, ortamdaki değer önce gelir.

Canlıya çıkmadan önce iş özeti, uygulanacak migration'ları listeler (`supabase db push --dry-run`).

**Geri alma:** bir önceki etiketi Actions → Yayınla ile production'a yeniden yayınla; web ve sunucu fonksiyonları geri döner.
Migration'lar geri alınmaz: hatalı bir migration yeni bir migration ile düzeltilir; veri kaybı varsa Supabase →
*Database → Backups*'tan geri yüklenir. Bu yüzden riskli migration'ları önce staging'de dene.

## Canlı ortam için zorunlu ayarlar (production)

1. **Supabase Pro** (aylık ~25 $): Free projede yedek yok, depolama 1 GB ve 7 gün kullanılmayan proje durur.
   Dashboard → *Organization → Billing* → Pro. Sonra *Database → Backups*'ta günlük yedeği gör; bir kez geri yükleme denemesi yap
   (staging'e). İstersen *Point in Time Recovery* eklentisini aç.
2. **E-posta servisi ve alan adı doğrulaması.** Gmail canlı için uygun değil (günde ~500 e-posta, alan adın için SPF/DKIM yok).
   Resend → *Domains* → `invitefolk.com` ekle, verdiği DNS kayıtlarını (SPF, DKIM, DMARC) Cloudflare'e gir. Sonra:
   - Secret `SMTP_USER` = `resend`, `SMTP_PASSWORD` = Resend API anahtarı, `RESEND_API_KEY` = aynı anahtar
   - Variable `SMTP_HOST` = `smtp.resend.com`, `SMTP_PORT` = `465`, `SMTP_FROM` = `giris@invitefolk.com`,
     `EMAIL_FROM` = `Invitefolk <hello@invitefolk.com>`
   - Saatlik e-posta sınırı varsayılan 200'dür (`EMAIL_RATE_LIMIT` ile değişir). Eskiden 30'du; yayın günü giriş kodları gelmezdi.
   - Yönetici adresi artık `SMTP_USER`'dan çıkamaz: secret `ADMIN_EMAIL` = kendi e-postan.
3. **Alan adı:** variable `WEB_URL` = `https://invitefolk.com` (yalnızca production'da kullanılır; staging için istersen `STAGING_WEB_URL`).
   `info@`, `destek@`, `support@` adreslerinin mail aldığını doğrula (Cloudflare Email Routing ücretsiz).
4. **Uygulama içi satın alma:** secret `REVENUECAT_WEBHOOK_SECRET` (RevenueCat → Integrations → Webhooks → Authorization değeri).
   Sandbox satın almaları artık varsayılan olarak paket **vermez**. App Review'a vereceğin demo hesabın Supabase kullanıcı
   kimliğini variable `REVENUECAT_SANDBOX_USERS`'a yaz (virgülle birden fazla). `REVENUECAT_ALLOW_SANDBOX=true` yalnızca staging'de.
5. **Web ödemesi kapalı:** şirket kurulana kadar paketler yalnızca mağazadan satılır; web paneli "uygulamadan al" der.
   Şirketle birlikte iyzico açılacaksa variable `WEB_PAYMENTS` = `true` ve iyzico anahtarları.
6. **İzleme:**
   - Sağlık kontrolü: `https://<proje>.supabase.co/functions/v1/health`. UptimeRobot / Better Stack'te 5 dakikalık bir HTTP
     izleme aç; 503 dönerse veritabanına ulaşılamıyor ya da zamanlanmış iş 30 dakikadır çalışmıyor demektir.
   - Hata takibi (isteğe bağlı, önerilir): sentry.io'da React Native projesi aç. Variable `SENTRY_DSN` (web derlemesi),
     EAS ortam değişkeni `EXPO_PUBLIC_SENTRY_DSN` (uygulama). Kaynak haritaları için EAS'ta `SENTRY_ORG`, `SENTRY_PROJECT`,
     `SENTRY_AUTH_TOKEN`. Davet anahtarları, e-posta ve telefonlar gönderilmeden ayıklanır.
7. **Kayıt koruması (isteğe bağlı, önerilir):** Cloudflare → Turnstile → site ekle (`invitefolk.com`). Secret
   `TURNSTILE_SECRET_KEY` (Supabase'e yazılır), variable `TURNSTILE_SITE_KEY` (web) ve EAS'ta `EXPO_PUBLIC_TURNSTILE_SITE_KEY`
   (uygulama). İkisi birlikte verilmeli: gizli anahtar varken site anahtarı olmayan derlemede giriş kodu istenemez.
8. **Yasal metinler:** `src/i18n/tr/legal.ts` ve `src/i18n/en/legal.ts` içindeki `[Ad Soyad]` / `[Yazışma adresi]` alanlarını doldur,
   avukata kontrol ettir.
9. **Mağaza gönderimi:** `eas.json` → `submit.production` içindeki Apple kimlikleri ve `secrets/google-play-service-account.json`.

### Saklama süresi (otomatik)

Zamanlanmış iş, etkinlik tarihinden 13 ay sonra etkinliği arşivler, 2 yıl sonra (tarihsiz etkinliklerde 30 ay) etkinliği davetli
verisi ve bütün dosyalarıyla siler. Organizatörün rehberindeki kişiler silinmez. Süreler `retention_sweep` fonksiyonundadır
(`supabase/migrations/20261126010000_launch_fixes.sql`); değiştirirsen yasal metinleri de güncelle.

### Satın alma incelemesi

Bir yükseltme ürünü kullanıcının o anki paketine uymuyorsa (ör. ücretsiz kullanıcı "Düğün → Düğün Tam" ürününü aldıysa) paket
verilmez, satın alma `review` durumunda kaydedilir. Admin panelinden ya da SQL ile `select * from public.admin_review_purchases()`
(MFA gerekli) listeyi gör; mağazadan iade et ya da `admin_set_plan` ile elle paket ver.

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
| …ya da Brevo ile (e-posta davetiyesi ve organizatöre günlük özet) | `BREVO_API_KEY` | `EMAIL_FROM` (ör. `Invitefolk <destek@invitefolk.com>`), `EMAIL_REPLY_TO` |
| SMS (Netgsm; ücretli) | `NETGSM_USERCODE`, `NETGSM_PASSWORD` | `NETGSM_HEADER` |
| Web ödemesi (iyzico; şirket gerekir, varsayılan kapalı) | `IYZICO_API_KEY`, `IYZICO_SECRET_KEY` | `WEB_PAYMENTS` = `true`, `IYZICO_BASE_URL` |
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
