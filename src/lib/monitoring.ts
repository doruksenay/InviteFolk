// Hata takibi (Sentry). Yalnızca EXPO_PUBLIC_SENTRY_DSN tanımlıysa açılır; tanımsızsa hiçbir şey yüklenmez.
//
// Kişisel veri gönderilmez:
//  - sendDefaultPii kapalı (IP, çerez, kullanıcı bilgisi yok); kullanıcı kimliği eklenmez.
//  - Adreslerdeki davet anahtarları ve herkese açık bağlantılar (/r/<anahtar>, /katil/<anahtar>, /a|h|k/<bağlantı>)
//    ve e-posta/telefon benzeri dizgiler olay, istek ve iz kayıtlarından silinir.
//  - Ekran görüntüsü ve oturum kaydı (replay) kapalı.
// Paket, davetiye sayfasının ilk yükünü büyütmesin diye dinamik olarak yüklenir.

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';
const ENV = process.env.EXPO_PUBLIC_APP_ENV ?? (typeof __DEV__ !== 'undefined' && __DEV__ ? 'development' : 'production');

const HEX = /\b[0-9a-f]{32}\b/gi;
const EMAIL = /[^\s@/]+@[^\s@/]+\.[^\s@/]+/g;
const PHONE = /\+?\d[\d\s-]{8,}\d/g;

/** Dizgideki anahtar, e-posta ve telefon numaralarını maskeler. */
export function scrub(s: string): string {
  return s.replace(HEX, '[anahtar]').replace(EMAIL, '[e-posta]').replace(PHONE, '[telefon]');
}

type Loose = any;

function scrubEvent(event: Loose): Loose {
  if (event?.request?.url) event.request.url = scrub(String(event.request.url));
  if (event?.request) {
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.data;
    delete event.request.query_string;
  }
  delete event?.user;
  if (event?.message) event.message = scrub(String(event.message));
  for (const ex of event?.exception?.values ?? []) if (ex?.value) ex.value = scrub(String(ex.value));
  for (const b of event?.breadcrumbs ?? []) scrubBreadcrumb(b);
  if (event?.transaction) event.transaction = scrub(String(event.transaction));
  return event;
}

function scrubBreadcrumb(b: Loose): Loose {
  if (b?.message) b.message = scrub(String(b.message));
  if (b?.data) {
    for (const k of Object.keys(b.data)) if (typeof b.data[k] === 'string') b.data[k] = scrub(b.data[k]);
    delete b.data.body;
  }
  return b;
}

let started = false;

export function initMonitoring(): void {
  if (started || !DSN) return;
  started = true;
  import('@sentry/react-native')
    .then((Sentry) => {
      Sentry.init({
        dsn: DSN,
        environment: ENV,
        sendDefaultPii: false,
        attachScreenshot: false,
        attachViewHierarchy: false,
        tracesSampleRate: 0,
        enableAutoSessionTracking: true,
        beforeSend: (e) => scrubEvent(e),
        beforeBreadcrumb: (b) => (b?.category === 'console' ? null : scrubBreadcrumb(b)),
      });
    })
    .catch(() => {
      // Hata takibi uygulamayı asla durdurmaz.
    });
}

/** Yakalanmış ama raporlanması gereken hatalar için (ör. ödeme sonrası paket gelmedi). */
export function reportError(e: unknown, context?: string): void {
  if (!DSN) return;
  import('@sentry/react-native')
    .then((Sentry) => Sentry.captureException(e, context ? { tags: { context } } : undefined))
    .catch(() => {});
}
