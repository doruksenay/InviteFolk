# Ödemeler: paketler, App Store / Google Play (RevenueCat) ve web (iyzico)

Paketler tek seferlik ödemeyle satılır; otomatik yenileme yoktur.

- **Süre:** en az 1 yıl; paket döneminde oluşturulan etkinliğin tarihi daha ileriyse etkinlikten 6 ay sonrasına kadar (satın almadan en fazla 3 yıl). Etkinlik tarihi eklenince ya da değişince `private.refresh_validity` süreyi yeniden hesaplar; süre yalnızca uzar.
- **Yükseltme:** geçerli ücretli paketten üst pakete geçen yalnızca farkı öder. Yükseltme dönemi değiştirmez: süre ve etkinlik hakkı eski satın almanın döneminden devam eder (`purchases.period_start`).
- **Anı albümü eklentisi (499 ₺):** Ücretsiz, Davet ve Düğün paketlerine eklenir (Düğün Tam'da dahil). Albüm hakkı `profiles.album_until` tarihine kadar açıktır: en az 1 yıl, etkinlikten 1 yıl sonrasına kadar.
- **Teklif:** hangi ürünün hangi fiyata satılacağını sunucu belirler (`public.my_quotes()`); web ödemesi ve uygulama aynı teklifi kullanır.

| Paket (uygulamadaki ad) | İç ad | Fiyat (TRY) | Ürün kimliği (mağaza) |
|---|---|---|---|
| Davet | `temel` | 499 | `invitefolk_temel` |
| Düğün | `otomatik` | 999 | `invitefolk_otomatik` |
| Düğün Tam | `tam` | 1.749 | `invitefolk_tam` |

| Davet → Düğün (yükseltme) | | 500 | `invitefolk_up_temel_otomatik` |
| Davet → Düğün Tam (yükseltme) | | 1.250 | `invitefolk_up_temel_tam` |
| Düğün → Düğün Tam (yükseltme) | | 750 | `invitefolk_up_otomatik_tam` |
| Anı albümü (eklenti) | | 499 | `invitefolk_album` |

İç adlar ve ürün kimlikleri ilk fiyatlandırmadan kaldı; değiştirmek mağaza ürünlerini ve satın alma kayıtlarını bozacağı için yalnızca görünen adlar değişti (`src/i18n/*/status.ts`).

Web fiyatları `public.plan_prices` ve `public.addon_prices` tablolarından, yükseltme farkı bunlardan sunucuda hesaplanır (istemci fiyat gönderemez). Mağaza fiyatları App Store Connect ve Play Console'da ayrıca ayarlanır; uygulama mağazanın gösterdiği yerel fiyatı kullanır.

## Güvenlik modeli

- Paketi **hiçbir zaman uygulama vermez**. `profiles.plan` istemciden yazılamaz (kolon yetkisi). Paketi yalnızca `grant_purchase` verir; bu fonksiyonu yalnızca `service_role` çalıştırabilir, yani yalnızca sunucu fonksiyonları.
- Aynı ödeme iki kez işlenmez: `purchases(provider, provider_ref)` tekildir.
- iyzico dönüşünde tarayıcıdan gelen hiçbir değere güvenilmez; ödeme sonucu iyzico'dan sunucu tarafında sorgulanır, tutar ve sepet kimliği ödeme oturumuyla karşılaştırılır.
- RevenueCat bildirimleri gizli bir Authorization değeriyle doğrulanır (sabit zamanlı karşılaştırma).
- İadelerde (`refund_purchase`) başka geçerli satın alma yoksa hesap ücretsize döner.
- Tüm satın alma ve iadeler `private.audit_log`'a yazılır.

## 1. Web: iyzico (şimdilik kapalı)

> Şirket kurulana kadar web ödemesi kapalıdır: `iyzico-checkout` ve `iyzico-callback`, `WEB_PAYMENTS=true` sırrı yoksa çalışmaz;
> web `/paketler` sayfası kullanıcıyı uygulamaya yönlendirir (`EXPO_PUBLIC_WEB_PAYMENTS`). Açmak için ikisini de `true` yapın.


1. iyzico üye işyeri başvurusu (şahıs veya limited şirket, vergi levhası gerekir). Test için <https://sandbox-merchant.iyzipay.com> üzerinden sandbox hesabı açın.
2. Sunucu fonksiyonlarını yayınlayın:
   ```bash
   npx supabase functions deploy iyzico-checkout
   npx supabase functions deploy iyzico-callback --no-verify-jwt
   ```
3. Sırlar (`supabase/.env` → `npx supabase secrets set --env-file supabase/.env`):
   ```
   IYZICO_API_KEY=sandbox-...
   IYZICO_SECRET_KEY=sandbox-...
   IYZICO_BASE_URL=https://sandbox-api.iyzipay.com     # canlıda https://api.iyzipay.com
   APP_WEB_URL=https://invitefolk.com                       # ödeme sonrası dönülecek web adresi
   ALLOWED_ORIGINS=https://invitefolk.com
   ```
4. Akış:
   - Kullanıcı `/paketler` sayfasında paket seçer → `iyzico-checkout` paketi doğrular, fiyatı tablodan alır, `checkout_sessions` kaydı açar ve iyzico Checkout Form'u başlatır. Kullanıcı iyzico'nun güvenli ödeme sayfasına gider.
   - iyzico sonucu `https://<proje>.supabase.co/functions/v1/iyzico-callback` adresine POST eder.
   - `iyzico-callback` sonucu iyzico'dan sorgular (`/payment/iyzipos/checkoutform/auth/ecom/detail`). Şunları doğrular: `paymentStatus = SUCCESS`, `basketId = oturum`, `paidPrice = paket fiyatı`, `fraudStatus = 1`. Ardından `grant_purchase` çağırır ve kullanıcıyı `/paketler?durum=basarili&paket=...` adresine yönlendirir.
5. Notlar:
   - Kimlik numarası toplanmıyor. iyzico bu durumda `11111111111` yer tutucusunu kabul ediyor; canlıya geçmeden önce iyzico ile teyit edin.
   - Taksit kapalıdır (`enabledInstallments: [1]`), böylece ödenen tutar paket fiyatına eşit olur.
   - Fatura: iyzico panelinden ya da muhasebe yazılımınızdan e-arşiv kesin.
   - Sandbox test kartı: `5528790000000008`, son kullanma ileri bir tarih, CVC `123`. Güncel test kartları için iyzico belgelerine bakın.
   - Belgeler: <https://docs.iyzico.com/en/getting-started/preliminaries/authentication/hmacsha256-auth>

> Apple kuralı: iOS uygulamasında dijital içerik yalnızca uygulama içi satın almayla satılabilir. Bu yüzden web ödemesi (iyzico) **yalnızca web'de** gösterilir; uygulamada hiç bağlantısı yoktur.

## 2. iOS ve Android: RevenueCat

1. **App Store Connect** → uygulama → *Uygulama İçi Satın Almalar* → yedi **Tüketilebilir (Consumable)** ürün: `invitefolk_temel` (499 ₺), `invitefolk_otomatik` (999 ₺), `invitefolk_tam` (1.749 ₺), `invitefolk_up_temel_otomatik` (500 ₺), `invitefolk_up_temel_tam` (1.250 ₺), `invitefolk_up_otomatik_tam` (750 ₺), `invitefolk_album` (499 ₺). Fiyatları bu tutarlara (ya da en yakın fiyat noktasına) ayarlayın; ekran görüntüsü ve açıklama ekleyin.
   - Neden tüketilebilir? Paket bir yıl sonra yeniden satın alınabilmeli; kalıcı (non-consumable) ürün ikinci kez satın alınamaz.
2. **Play Console** → *Ürünler → Uygulama içi ürünler* → aynı yedi ürün kimliği.
3. **RevenueCat** (<https://app.revenuecat.com>):
   - Proje oluşturun, App Store ve Play Store uygulamalarını bağlayın (App Store Connect API anahtarı, Play servis hesabı).
   - *Products* bölümüne yedi ürünü ekleyin.
   - *API keys*: iOS ve Android public SDK anahtarlarını EAS ortam değişkeni yapın:
     ```bash
     npx eas-cli@latest env:create --name EXPO_PUBLIC_REVENUECAT_IOS_KEY --value appl_... --environment production
     npx eas-cli@latest env:create --name EXPO_PUBLIC_REVENUECAT_ANDROID_KEY --value goog_... --environment production
     ```
   - *Integrations → Webhooks*:
     - URL: `https://<proje>.supabase.co/functions/v1/revenuecat-webhook`
     - Authorization header: uzun rastgele bir değer. Aynı değeri `REVENUECAT_WEBHOOK_SECRET` olarak Supabase sırlarına ekleyin; en az 16 karakter olmalı, örneğin `openssl rand -hex 32`.
4. Fonksiyonu yayınlayın: `npx supabase functions deploy revenuecat-webhook --no-verify-jwt`
5. Sırlar:
   ```
   REVENUECAT_WEBHOOK_SECRET=...
   REVENUECAT_ALLOW_SANDBOX=true    # App Review sandbox'ta satın alır; kapatırsanız inceleme başarısız olabilir
   ```
6. Akış: uygulama RevenueCat'e Supabase kullanıcı kimliğiyle (`appUserID`) giriş yapar ve satın almayı başlatır. RevenueCat `NON_RENEWING_PURCHASE` bildirimini gönderir, `revenuecat-webhook` da `grant_purchase` çağırır. Uygulama `my_plan`'ı yoklayarak paketin geldiğini görür. İade bildirimi (`CANCELLATION`) gelince `refund_purchase` çalışır.
7. Test:
   - iOS sandbox test kullanıcısı (App Store Connect → Users and Access → Sandbox).
   - Android lisanslı test hesabı (Play Console → Ayarlar → Lisans testi).
   - **Expo Go'da satın alma çalışmaz.** RevenueCat orada yalnızca önizleme modunda çalışır; uygulama bu durumda uyarı gösterir. Geliştirme derlemesi kullanın: `npx eas-cli@latest build --profile development`.

## 3. Ortam değişkenleri özeti

| Nerede | Değişken | Açıklama |
|---|---|---|
| Uygulama (EAS) | `EXPO_PUBLIC_REVENUECAT_IOS_KEY` | RevenueCat iOS public SDK anahtarı (gizli değildir) |
| Uygulama (EAS) | `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` | RevenueCat Android public SDK anahtarı |
| Supabase sırrı | `IYZICO_API_KEY`, `IYZICO_SECRET_KEY` | iyzico üye işyeri anahtarları (**gizli**) |
| Supabase sırrı | `IYZICO_BASE_URL` | `https://sandbox-api.iyzipay.com` / `https://api.iyzipay.com` |
| Supabase sırrı | `APP_WEB_URL` | Ödeme sonrası dönülecek web adresi |
| Supabase sırrı | `REVENUECAT_WEBHOOK_SECRET` | RevenueCat webhook Authorization değeri (**gizli**) |
| Supabase sırrı | `REVENUECAT_ALLOW_SANDBOX` | `true` / `false` |

## 3a. Kötüye kullanım korumaları (canlıya çıkış denetimi, 26 Kasım 2026)

- **Etkinlik hakkı** dönem başına azalmayan bir sayaçta tutulur (`private.event_slots`). Davetli eklenmiş etkinliği silmek hakkı geri vermez; hiç davetlisi olmayan etkinlik silinirse hak iade edilir.
- **Yükseltme ürünü** (`invitefolk_up_<eski>_<yeni>`) yalnızca kullanıcı o an `<eski>` paketindeyse fark ödemeli yükseltme olarak işlenir. Uymuyorsa ve ödenen tutar yeni paketin tam fiyatını karşılamıyorsa paket verilmez, satın alma `status = 'review'` olarak kaydedilir (`admin_review_purchases()`), iade edilir ya da elle paket verilir.
- **Süre** etkinliğe ilk girilen tarihe göre bir kez hesaplanır (`events.first_starts_at`, istemci yazamaz). Paket satın almadan en fazla 2 yıl, albüm 2,5 yıl.
- **Sandbox** satın almaları yalnızca `REVENUECAT_SANDBOX_USERS` listesindeki hesaplara paket verir.
- Testler: `supabase/tests/fiyat.mjs`.

## 4. Elle paket verme

Admin panelinde **Kullanıcılar** ekranından (iki adımlı doğrulama gerekir) kullanıcıyı arayın ve paket atayın. İşlem denetim kaydına yazılır.
