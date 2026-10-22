// Tarih ve sayı biçimleri. `locale` BCP 47 etiketidir: 'tr-TR' ya da 'en-GB' (useI18n().locale).
const TZ = 'Europe/Istanbul';
const cache = new Map<string, Intl.DateTimeFormat>();
function fmt(locale: string, opts: Intl.DateTimeFormatOptions) {
  const k = locale + JSON.stringify(opts);
  let f = cache.get(k);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, { timeZone: TZ, ...opts });
    cache.set(k, f);
  }
  return f;
}

/** "12 Haziran 2027 Cumartesi · 19:00" / "Saturday 12 June 2027 · 19:00" */
export function formatWhen(iso: string | null | undefined, locale = 'tr-TR'): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const date = fmt(locale, { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' }).format(d);
  const time = fmt(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
  return `${date} · ${time}`;
}

/** "1 Mayıs" / "1 May" */
export function formatDayMonth(iso: string | null | undefined, locale = 'tr-TR'): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return fmt(locale, { day: 'numeric', month: 'long' }).format(d);
}

/** "20 Eki 2026" */
export function formatShortDate(iso: string | null | undefined, locale = 'tr-TR'): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : fmt(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

/** { day: "12", mon: "HAZ" } */
export function dateBadge(iso: string | null | undefined, locale = 'tr-TR'): { day: string; mon: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = fmt(locale, { day: '2-digit', month: 'short' }).formatToParts(d);
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  const mon = (parts.find((p) => p.type === 'month')?.value ?? '').replace('.', '').toLocaleUpperCase(locale);
  return { day, mon };
}

export function formatNumber(n: number, locale = 'tr-TR') {
  return n.toLocaleString(locale);
}

export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

/** "0532 123 45 67" -> "+905321234567". Geçersizse null. */
export function normalizePhone(input: string): string | null {
  const d = input.replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('90')) return '+' + d;
  if (d.length === 11 && d.startsWith('0')) return '+90' + d.slice(1);
  if (d.length === 10 && d.startsWith('5')) return '+90' + d;
  if (d.length >= 10 && d.length <= 15) return '+' + d;
  return null;
}

/** Davetlinin LCV sayfası adresi. EXPO_PUBLIC_WEB_URL web dağıtımının kök adresidir. */
export function rsvpUrl(token: string): string {
  const base = process.env.EXPO_PUBLIC_WEB_URL ?? 'http://localhost:8081';
  return `${base.replace(/\/$/, '')}/r/${token}`;
}

/** Ücretsiz katman: WhatsApp'ı hazır mesajla açan link (kullanıcı "gönder"e kendisi basar). */
export function waMeLink(phone: string | null, text: string): string {
  const d = (phone ?? '').replace(/\D/g, '');
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toLocaleUpperCase('tr-TR'))
    .join('');
}

export function formatTry(n: number, locale = 'tr-TR'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);
}
