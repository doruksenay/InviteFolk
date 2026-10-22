const dateFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long', timeZone: 'Europe/Istanbul' });
const timeFmt = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' });
const shortFmt = new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'short', timeZone: 'Europe/Istanbul' });

/** "12 Haziran 2027 Cumartesi · 19:00" */
export function formatWhen(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${dateFmt.format(d)} · ${timeFmt.format(d)}`;
}

/** { day: "12", mon: "HAZ" } */
export function dateBadge(iso: string | null | undefined): { day: string; mon: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const [day, mon] = shortFmt.format(d).split(' ');
  return { day, mon: (mon ?? '').replace('.', '').toLocaleUpperCase('tr-TR') };
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

export function formatTry(n: number): string {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);
}
