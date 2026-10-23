# Otomasyon, e-posta ve bildirimler

Bu belge sunucu tarafındaki otomatik işleri anlatır:

- WhatsApp ve e-posta davetleri
- "Masanız" mesajı
- Otomatik hatırlatma
- Halı saha için haftalık tekrar
- Organizatöre telefon bildirimi
- SMS yedeği ve duyurular
- Yapay zekâ yardımcısı, hava durumu, takvim aboneliği, albüm yükleme

## Fonksiyonlar

| Fonksiyon | Kim çağırır | Ne yapar |
|---|---|---|
| `send-invitations` | Uygulama (giriş yapmış organizatör) | Davetlilere WhatsApp şablonu gönderir: davet, hatırlatma ve `table` ("masanız") |
| `send-email` | Uygulama (giriş yapmış organizatör) | Aynı işi e-postayla yapar (Resend) |
| `scheduled` | Zamanlayıcı (her 10 dakikada) | Haftalık tekrar, otomatik hatırlatma ve bildirim kuyruğunu telefonlara iletme |
| `whatsapp-webhook` | Meta | Teslim durumlarını ve davetli cevaplarını işler; ulaşmayan davet/hatırlatma için (açıksa) bir kez SMS yedeği |
| `send-sms` | Uygulama (organizatör) | SMS ile davet, hatırlatma ya da duyuru (Netgsm) |
| `cohost-invite` | Uygulama (etkinlik sahibi) | Ortak yönetici davetini oluşturur ve `/katil/<anahtar>` linkini e-postalar |
| `ai-assist` | Uygulama (giriş yapmış kullanıcı) | `write`: davet metni; `extract`: basılı davetiye fotoğrafından alanlar. Günlük hak `plan_limits.ai_per_day` |
| `album-upload` | Davetli (girişsiz) | Albüm kodu ile tek kullanımlık imzalı yükleme linki verir, yüklemeyi onaylar, herkese açık albümü listeler |
| `weather` | Davetli sayfası | Etkinlik 14 gün içindeyse Open-Meteo tahmini (3 saat önbellek, anahtar gerekmez) |
| `calendar` | Takvim uygulaması | Davet anahtarıyla ICS; haftalık maçlarda `RRULE:FREQ=WEEKLY`, programdaki törenler ayrı etkinlik |

`send-invitations` ve `send-email` aynı sözleşmeyle çalışır:

```
POST { event_id, invitation_ids?: uuid[], kind?: 'invite' | 'reminder' | 'table' | 'announcement',
       announcement_id?: uuid (duyuruda zorunlu, son 24 saatte yazılmış), audience?: 'all' | 'yes' }
→ 200 { sent, failed, skipped, quota_left, via_sms? }
→ 402 { error: 'quota_exceeded', detail: 'whatsapp' | 'email' | 'sms' }
```

`send-sms` de aynı sözleşmeyi kullanır. Duyuruda metin istemciden alınmaz: uygulama duyuruyu önce `event_announcements` tablosuna yazar (günde 10; silmek sınırı sıfırlamaz) ve gönderimde yalnızca `announcement_id` verir. Fonksiyon metni kayıttan okur; her duyuru her kanaldan bir kez gönderilir (`409 already_sent`). Ortak yöneticinin gönderimleri etkinlik sahibinin günlük hakkından düşer.

Üç fonksiyon da güvenlik kurallarını aynı şekilde uygular:

- Etkinlik ve davetler kullanıcının kendi yetkisiyle okunur (RLS), yani başkasının etkinliğine gönderim yapılamaz.
- Günlük hak `plan_limits` tablosundan gelir.
- Gönderim günlüğü servis anahtarıyla yazılır.
- İstemciye sağlayıcı hata ayrıntısı dönmez.

## Ortam değişkenleri (Supabase → Edge Functions → Secrets)

| Değişken | Gerekli | Açıklama |
|---|---|---|
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` | WhatsApp için | README'deki WhatsApp kurulumuna bakın |
| `WHATSAPP_INVITE_TEMPLATE` | hayır | Varsayılan `davet_lcv` |
| `WHATSAPP_TABLE_TEMPLATE` | hayır | Varsayılan `davet_masa` |
| `WHATSAPP_ANNOUNCE_TEMPLATE` | hayır | Varsayılan `davet_duyuru` |
| `NETGSM_USERCODE`, `NETGSM_PASSWORD`, `NETGSM_HEADER` | SMS için | Netgsm abone numarası, API şifresi ve onaylı gönderici adı |
| `NETGSM_URL` | hayır | Varsayılan `https://api.netgsm.com.tr/sms/rest/v2/send` |
| `ANTHROPIC_API_KEY` | yapay zekâ için | console.anthropic.com → API Keys. Yoksa yapay zekâ düğmeleri "şu an kullanılamıyor" der |
| `AI_MODEL` | hayır | Varsayılan `claude-sonnet-5-5` |
| `ANTHROPIC_VERSION` | hayır | Varsayılan `2023-06-01` |
| `WHATSAPP_TEMPLATE_LANG` / `WHATSAPP_TEMPLATE_LANG_EN` | hayır | Varsayılan `tr` / `en` |
| `RESEND_API_KEY` | e-posta için | resend.com → API Keys (yalnızca "Sending access") |
| `EMAIL_FROM` | e-posta için | `Invitefolk <hello@invitefolk.app>`; alan adı Resend'de doğrulanmış olmalı (SPF, DKIM) |
| `EMAIL_REPLY_TO` | hayır | Davetlilerin cevap yazacağı adres |
| `APP_WEB_URL` | e-posta için | Davetli sayfasının kök adresi, ör. `https://invitefolk.app`. Yalnızca https kabul edilir |
| `CRON_SECRET` | `scheduled` için | En az 32 karakterlik rastgele dize: `openssl rand -hex 32` |
| `EXPO_ACCESS_TOKEN` | hayır | Expo hesabında "Enhanced push security" açıksa gerekir |
| `ALLOWED_ORIGINS` | web için | Web panelinin adresi (CORS) |

## WhatsApp şablonları (WhatsApp Manager → Message templates, kategori: Utility)

Her şablonu aynı adla iki dilde (Türkçe `tr`, İngilizce `en`) oluşturun.

### `davet_lcv`: davet ve hatırlatma

| Dil | Gövde | Hızlı yanıt düğmeleri (bu sırayla) |
|---|---|---|
| tr | `Merhaba {{1}}, {{2}} için sizi aramızda görmek isteriz. {{3}}` | `Katılacağım`, `Katılamayacağım` |
| en | `Hello {{1}}, we would love to see you at {{2}}. {{3}}` | `I'll be there`, `Can't make it` |

Değişkenler: `{{1}}` davetli adı, `{{2}}` etkinlik adı, `{{3}}` tarih ve yer.

### `davet_masa`: masanız

| Dil | Gövde |
|---|---|
| tr | `Merhaba {{1}}, {{2}} için yeriniz hazır: {{3}}. Görüşmek üzere!` |
| en | `Hello {{1}}, your seat for {{2}} is ready: {{3}}. See you there!` |

Değişkenler: `{{1}}` davetli adı, `{{2}}` etkinlik adı, `{{3}}` masa adı (ör. "Masa 7"). Düğme yok.

> "Masanız" mesajı yalnızca katılacağını bildirmiş ve masası atanmış davetlilere gider. Davetin teslim durumunu değiştirmez.

### `davet_duyuru`: duyuru

| Dil | Gövde |
|---|---|
| tr | `Merhaba {{1}}, {{2}} hakkında bir duyuru var: {{3}} Ayrıntılar: {{4}}` |
| en | `Hello {{1}}, there is an update about {{2}}: {{3}} Details: {{4}}` |

Değişkenler: `{{1}}` davetli adı, `{{2}}` etkinlik adı, `{{3}}` duyuru metni (satır sonları " · " olur), `{{4}}` davetlinin kişisel linki. Düğme yok. Teslim durumunu değiştirmez. "Kime" seçeneği: gelmeyeceğini söyleyenler hariç herkes ya da yalnızca gelenler.

## SMS (Netgsm)

- Kullanım: WhatsApp'a ulaşılamayan davet ve hatırlatmaların yedeği (davetiye sayfası ayarlarında "SMS gönder" açıksa), ayrıca gönderim panelinden ve duyurulardan doğrudan SMS.
- Günlük hak `plan_limits.sms_per_day` (Otomatik 100, Tam 300). Yedek SMS de bu haktan düşer; her davet için en fazla bir kez. Hak, gönderim kaydı açılırken veritabanında atomik düşülür (`private.count_message`); kayıt açılamazsa mesaj gönderilmez.
- Yalnızca Türkiye cep numaralarına (+90 5xx) SMS gider; yurt dışı numaralar atlanır (SMS-pompalama dolandırıcılığına karşı).
- Metinler `supabase/functions/_shared/messages.ts` içinde, etkinlik dilinde; Türkçe karakterler korunur (uzun mesajlar birden fazla SMS sayılır).
- Davet SMS'i ticari ileti değildir (kişinin davet edildiği etkinlik bilgisi), bu yüzden `iysfilter` `0` gönderilir. Kampanya/pazarlama için kullanılmamalıdır.
- `_shared/sms.ts` Netgsm REST v2 (`POST /sms/rest/v2/send`, Basic auth) biçimini kullanır; canlıya çıkmadan Netgsm'in güncel dokümanıyla ve bir test numarasıyla doğrulayın.

## Yapay zekâ

- `write`: tür, başlık, ev sahipleri, ton (sıcak/resmî/eğlenceli/kısa) ve isteğe bağlı ipucuyla 400 karakteri aşmayan davet metni. Yalnızca etkinlik başlığı ve ev sahibi adları gider; davetli bilgisi gönderilmez.
- `extract`: basılı davetiyenin fotoğrafı (JPEG, uzun kenar ≤ 2000 px, ≤ 5 MB) modele gönderilir, JSON olarak başlık, ev sahipleri, tarih, saat, mekân, adres ve metin döner; görsel saklanmaz. Uygulama yalnızca okunan alanları doldurur, kullanıcı kontrol eder.
- Günlük hak (`ai_per_day`) her başarılı çağrıdan önce veritabanında düşülür (`ai_take`), böylece paralel isteklerle aşılamaz.

## Albüm, takvim ve hava durumu

- `album` kovası özeldir. Davetli `/a/<kod>` sayfasında fotoğraf seçer; tarayıcıda JPEG'e küçültülür, `album-upload` kota ve hız sınırını kontrol edip tek kullanımlık imzalı yükleme linki verir, yükleme bitince `confirm` ile albüme eklenir. Yarım kalan yüklemeler `scheduled` tarafından temizlenir.
- `calendar?token=<davet anahtarı>` takvim uygulamalarına `webcal://` ile eklenir; haftalık maçta her hafta kendiliğinden güncellenir.
- `weather` yalnızca etkinliğin adresi ve tarihi belli, tarih 14 gün içindeyse çalışır; konum adresten Open-Meteo'nun ücretsiz geocoding servisiyle bulunur ve 3 saat önbelleğe alınır.

## E-posta

- E-postalar Resend üzerinden, etkinliğin davetiye dilinde (Türkçe ya da İngilizce) ve davetiye temasının renklerinde gider. Her e-postada hem HTML hem düz metin sürümü vardır.
- E-postaya giren her değer (etkinlik adı, davetli adı, mekân, organizatör adı) HTML'e kaçırılarak yazılır. Konu satırından satır sonları temizlenir; bu, başlık enjeksiyonuna karşı korur.
- Link yalnızca `APP_WEB_URL/r/<davet anahtarı>` biçimindedir.
- Altbilgide KVKK aydınlatma metnine link bulunur: `APP_WEB_URL/yasal/kvkk`.
- Aynı mesaj kaydı tekrar denenirse Resend `Idempotency-Key` ile ikinci kez göndermez.
- Günlük e-posta hakkı paket kotasından gelir (`plan_limits.email_per_day`).

## Zamanlanmış işler (`scheduled`)

Her çalıştırmada sırasıyla şunlar yapılır:

1. **Haftalık tekrar.** `settings.recurring = 'weekly'` olan etkinliklerin (halı saha) maç saati 2 saatten fazla geçtiyse etkinlik bir sonraki haftaya alınır.
   - Cevaplar ve "kim ödedi" bilgisi sıfırlanır.
   - `settings.auto_invite = true` ise davetler yeniden gönderilir: önce WhatsApp (numara ve hak varsa), olmazsa e-posta.
2. **Otomatik hatırlatma.** `settings.reminders = { auto: true, days_before: 3 }` olan etkinliklerde, son cevap gününe (yoksa etkinlik tarihine) `days_before` gün kala, daveti gönderilmiş ama cevap vermemiş kişilere hatırlatma gider.
   - Her davetliye en fazla 2 hatırlatma gönderilir.
   - İki hatırlatma arasında en az 2 gün bulunur.
3. **Bildirimler.** Davetli cevap verdiğinde ya da yedekten kadroya geçtiğinde veritabanı `notification_queue` tablosuna kayıt düşer.
   - Bu kayıtlar organizatörün telefonlarına Expo Push ile, organizatörün dilinde gönderilir. Örnek: "Ahmet Yılmaz katılıyor · 3 kişi".
   - Artık geçerli olmayan telefon anahtarları silinir.
   - 30 günden eski gönderilmiş kayıtlar temizlenir.

İş ~50 saniyede durur; yarım kalan bir sonraki çalıştırmada devam eder. Çağrı `x-cron-secret` başlığıyla doğrulanır (sabit zamanlı karşılaştırma), JWT doğrulaması kapalıdır.

### Zamanlama: pg_cron + pg_net (önerilen)

Fonksiyonu yayınlayın ve `CRON_SECRET`'ı belirleyin:

```bash
npx supabase secrets set CRON_SECRET=$(openssl rand -hex 32)
npx supabase functions deploy scheduled --no-verify-jwt
```

Sonra SQL Editor'da (gizli değerler Vault'ta tutulur, iş tanımında açık yazmaz):

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret('<CRON_SECRET değeri>', 'davet_cron_secret');
select vault.create_secret('https://<PROJE_REF>.supabase.co/functions/v1/scheduled', 'davet_cron_url');

select cron.schedule('davet-scheduled', '*/10 * * * *', $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'davet_cron_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'davet_cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000);
$job$);
```

Kontrol ve kaldırma:

```sql
select * from cron.job_run_details order by start_time desc limit 10;
select cron.unschedule('davet-scheduled');
```

Alternatif olarak Supabase panelindeki **Integrations → Cron** ekranından aynı HTTP isteği her 10 dakikada bir tanımlanabilir. Elle denemek için:

```bash
curl -X POST https://<PROJE_REF>.supabase.co/functions/v1/scheduled -H "x-cron-secret: <CRON_SECRET>"
```

## Telefon bildirimleri (uygulama tarafı)

- `src/lib/push.ts` dosyası Expo Push anahtarını alır ve `register_push_token` ile bu hesaba bağlar.
  - Aynı telefonda başka bir hesap giriş yaparsa anahtar yeni hesaba geçer.
  - Bir hesapta en fazla 10 cihaz tutulur.
- **İzin:** Panel açıldığında, en az bir etkinliği olan kullanıcıya bir kez nazik bir ön soru gösterilir (`PushPrompt`). Sistem izin penceresi yalnızca kullanıcı "Bildirimleri aç" derse açılır.
- **Proje kimliği:** `app.json` → `expo.extra.eas.projectId` gerekir. Bu değer `npx eas-cli@latest init` ile oluşur; yoksa bildirim kaydı sessizce atlanır.
- **Test ortamı:** Uzaktan bildirimler Android'de Expo Go'da çalışmaz; development build gerekir.
- **Bildirime dokunma:** İlgili etkinliğin sayfası açılır.
- **Çıkış:** Çıkış yapmadan önce `disablePush()` çağrılmalıdır. Aksi hâlde telefon, başka hesap giriş yapana kadar önceki hesabın bildirimlerini almaya devam eder.
- **Kapatma:** Organizatör bildirimleri Ayarlar'daki `notify_rsvp` tercihiyle kapatabilir. Veritabanı tetikleyicisi bu tercihe bakar.

## Oturma planı ekleri

- **Masaları bildir:** Masası atanmış ve gelecek davetlilere WhatsApp (`kind: 'table'`) ya da e-postayla "masanız" mesajı gönderir. Masa listesi metin olarak da kopyalanabilir.
- **Kartları yazdır:** Her masa için A6 boyutunda bir kart basar (masa numarası, oturanların adları). İsteğe bağlı olarak her hane için katlanır isim kartı da eklenir.
  - Telefonda sistemin yazdırma penceresi açılır; oradan PDF olarak da kaydedilebilir.
  - Web'de kartlar yeni pencerede açılır ve tarayıcının yazdırma penceresi gelir. Bunun için açılır pencerelere izin verilmelidir.
