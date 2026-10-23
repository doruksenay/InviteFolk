// Invitefolk e-postaları (Resend HTTP API) ve şablonları.
// Ortam: RESEND_API_KEY, EMAIL_FROM ("Invitefolk <hello@invitefolk.app>"), EMAIL_REPLY_TO (isteğe bağlı), APP_WEB_URL
//
// Güvenlik: e-postaya giren HER değer escapeHtml'den geçer (etkinlik başlığı, davetli adı, mekân, organizatör adı).
// Link yalnızca APP_WEB_URL + doğrulanmış 32 haneli davet anahtarından oluşur.

import { type Lang, LOCALE } from './messages.ts';

export type EmailKind = 'invite' | 'reminder' | 'table' | 'announcement';

export function escapeHtml(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Başlık satırına yeni satır/kontrol karakteri sızmasın (e-posta başlığı enjeksiyonuna karşı). */
export function cleanHeader(v: string, max = 150): string {
  return v.replace(/[\r\n\t\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max);
}

// Davetiye temalarının e-postada kullanılan renkleri (src/core/themes.ts ile uyumlu).
const THEME: Record<string, { bg: string; ink: string; soft: string; accent: string; button: string; buttonInk: string; shape: string }> = {
  adacayi: { bg: '#EEF4EF', ink: '#20332A', soft: '#4F6358', accent: '#3F7559', button: '#20332A', buttonInk: '#FFFFFF', shape: '#9CC3AB' },
  lavanta: { bg: '#F2EDFC', ink: '#2A2440', soft: '#5E5873', accent: '#5B47C2', button: '#2A2440', buttonInk: '#FFFFFF', shape: '#A08CEB' },
  mercan: { bg: '#FFF1EC', ink: '#3A211B', soft: '#6E5048', accent: '#B5432F', button: '#3A211B', buttonInk: '#FFFFFF', shape: '#F2846F' },
  altin: { bg: '#FBF4E3', ink: '#33280F', soft: '#6A5B3B', accent: '#8A6414', button: '#33280F', buttonInk: '#FFFFFF', shape: '#E2B04A' },
  gece: { bg: '#24223A', ink: '#F7F1E7', soft: '#CCC5D8', accent: '#F6D38E', button: '#F6D38E', buttonInk: '#24223A', shape: '#A08CEB' },
  fildisi: { bg: '#FBF7EF', ink: '#2B2620', soft: '#655B4C', accent: '#86652E', button: '#2B2620', buttonInk: '#FFFFFF', shape: '#E9DCC3' },
  gul: { bg: '#FBF0EE', ink: '#3B2526', soft: '#6F5455', accent: '#9A4F53', button: '#3B2526', buttonInk: '#FFFFFF', shape: '#E8B4B0' },
  zumrut: { bg: '#123B32', ink: '#F6F0E3', soft: '#C9D6CC', accent: '#E2C27E', button: '#E2C27E', buttonInk: '#123B32', shape: '#2F6B5A' },
  lacivert: { bg: '#16213E', ink: '#F4EFE6', soft: '#C3C9D9', accent: '#E0BE7C', button: '#E0BE7C', buttonInk: '#16213E', shape: '#2C3E66' },
  okaliptus: { bg: '#EFF3EE', ink: '#22332B', soft: '#52645A', accent: '#3E6A52', button: '#22332B', buttonInk: '#FFFFFF', shape: '#8FAE9B' },
  sampanya: { bg: '#F8F1E6', ink: '#3A2E22', soft: '#6C5C4A', accent: '#866438', button: '#3A2E22', buttonInk: '#FFFFFF', shape: '#E7D2B0' },
  bordo: { bg: '#F7EEEC', ink: '#3A1E24', soft: '#6E4C51', accent: '#7B2D3B', button: '#3A1E24', buttonInk: '#FFFFFF', shape: '#7B2D3B' },
  beyaz: { bg: '#FFFFFF', ink: '#222222', soft: '#626262', accent: '#6B6459', button: '#222222', buttonInk: '#FFFFFF', shape: '#E8E4DD' },
  pudra: { bg: '#FDF1F3', ink: '#3A2A30', soft: '#6D5960', accent: '#A4566D', button: '#3A2A30', buttonInk: '#FFFFFF', shape: '#F3C6D0' },
  zeytin: { bg: '#F3F2E8', ink: '#2C2F1E', soft: '#5E6249', accent: '#566238', button: '#2C2F1E', buttonInk: '#FFFFFF', shape: '#7E8B5A' },
  kina_kirmizi: { bg: '#FBEFE6', ink: '#3B1612', soft: '#6F3E36', accent: '#9E2A22', button: '#3B1612', buttonInk: '#FFFFFF', shape: '#B8322A' },
  mor_gece: { bg: '#2A1B3D', ink: '#F6F1FF', soft: '#CFC6E3', accent: '#F2C46D', button: '#F2C46D', buttonInk: '#2A1B3D', shape: '#6C5CE7' },
  konfeti: { bg: '#FFF9F4', ink: '#1F1B2E', soft: '#5B566A', accent: '#5A49D6', button: '#1F1B2E', buttonInk: '#FFFFFF', shape: '#6C5CE7' },
  limon: { bg: '#FFFBEA', ink: '#2A2A1A', soft: '#5F5E45', accent: '#7A5900', button: '#2A2A1A', buttonInk: '#FFFFFF', shape: '#FFD95A' },
  deniz: { bg: '#EEF6FA', ink: '#12324A', soft: '#45627A', accent: '#1C6591', button: '#12324A', buttonInk: '#FFFFFF', shape: '#5BA4CF' },
  pembe: { bg: '#FFF1F7', ink: '#3A1F2E', soft: '#6E5161', accent: '#B0306F', button: '#3A1F2E', buttonInk: '#FFFFFF', shape: '#FF8FC2' },
  gokkusagi: { bg: '#FFF9F4', ink: '#1F1B2E', soft: '#5B566A', accent: '#5A49D6', button: '#1F1B2E', buttonInk: '#FFFFFF', shape: '#6C5CE7' },
  kurumsal: { bg: '#F4F5F7', ink: '#1E2430', soft: '#586174', accent: '#3D4A63', button: '#1E2430', buttonInk: '#FFFFFF', shape: '#4E5A72' },
  saha_yesil: { bg: '#EEF6EF', ink: '#183223', soft: '#4A6555', accent: '#2A6B3C', button: '#183223', buttonInk: '#FFFFFF', shape: '#3F8F55' },
  parke: { bg: '#FBF3EA', ink: '#3A2414', soft: '#6E5240', accent: '#A84D17', button: '#3A2414', buttonInk: '#FFFFFF', shape: '#D9A066' },
  file: { bg: '#EEF4FB', ink: '#14263D', soft: '#4A5E78', accent: '#1F5598', button: '#14263D', buttonInk: '#FFFFFF', shape: '#2F6DB5' },
};

const COPY = {
  tr: {
    subject: { invite: '{title} · Davetlisiniz', reminder: 'Hatırlatma: {title}', table: '{title} · Masanız: {table}', announcement: '{title} · Duyuru' },
    kicker: { invite: 'Davetlisiniz', reminder: 'Küçük bir hatırlatma', table: 'Yeriniz hazır', announcement: 'Duyuru' },
    greet: 'Sayın {name},',
    intro: {
      invite: '{host} sizi {title} için aramızda görmek istiyor.',
      reminder: '{title} davetine henüz cevap vermediniz. Gelip gelemeyeceğinizi tek dokunuşla bildirebilirsiniz.',
      table: '{title} için yeriniz ayrıldı. Sizi {table} masasında ağırlayacağız.',
      announcement: '{host}, {title} hakkında bir duyuru paylaştı:',
    },
    button: { invite: 'Davetiyeyi aç ve cevap ver', reminder: 'Cevabımı bildir', table: 'Davetiyeyi aç', announcement: 'Davetiyeyi aç' },
    when: 'Tarih',
    where: 'Yer',
    table: 'Masanız',
    deadline: 'Lütfen {date} tarihine kadar cevap verin.',
    fallbackLink: 'Düğme çalışmazsa bu adresi tarayıcınıza yapıştırın:',
    footer: 'Bu e-postayı {host} adına Invitefolk gönderdi. Kişisel verileriniz yalnızca bu davet için, davet sahibi adına işlenir.',
    privacy: 'Aydınlatma metni',
    hostFallback: 'Davet sahibi',
  },
  en: {
    subject: { invite: "You're invited: {title}", reminder: 'Reminder: {title}', table: 'Your table at {title}: {table}', announcement: 'Update: {title}' },
    kicker: { invite: "You're invited", reminder: 'A gentle reminder', table: 'Your seat is ready', announcement: 'Update' },
    greet: 'Dear {name},',
    intro: {
      invite: '{host} would love to have you with them for {title}.',
      reminder: "We haven't heard back from you about {title} yet. You can let us know with a single tap.",
      table: "Your seat for {title} is ready. We'll be welcoming you at {table}.",
      announcement: '{host} shared an update about {title}:',
    },
    button: { invite: 'Open the invitation and reply', reminder: 'Send my reply', table: 'Open the invitation', announcement: 'Open the invitation' },
    when: 'When',
    where: 'Where',
    table: 'Your table',
    deadline: 'Please reply by {date}.',
    fallbackLink: "If the button doesn't work, paste this address into your browser:",
    footer: 'This email was sent by Invitefolk on behalf of {host}. Your personal data is processed only for this invitation, on behalf of the host.',
    privacy: 'Privacy notice',
    hostFallback: 'Your host',
  },
} as const;

function fill(s: string, vars: Record<string, string>) {
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k] : m));
}

export type EmailEvent = {
  title: string;
  theme: string | null;
  starts_at: string | null;
  venue_name: string | null;
  venue_address: string | null;
  rsvp_deadline: string | null;
  host_names: string | null;
};

export function appWebUrl(): string | null {
  const u = Deno.env.get('APP_WEB_URL') ?? '';
  return /^https:\/\/[^\s/]+(\/[^\s]*)?$/.test(u) ? u.replace(/\/$/, '') : null;
}

export function formatWhen(iso: string | null, lang: Lang): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(LOCALE[lang], { dateStyle: 'full', timeStyle: 'short', timeZone: 'Europe/Istanbul' }).format(d);
}

function formatDay(isoDate: string | null, lang: Lang): string | null {
  if (!isoDate) return null;
  const d = new Date(isoDate.length === 10 ? `${isoDate}T12:00:00+03:00` : isoDate);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(LOCALE[lang], { day: 'numeric', month: 'long', timeZone: 'Europe/Istanbul' }).format(d);
}

/** Konu, HTML ve düz metin. Tüm değişken değerler escape edilir. */
export function renderEmail(args: {
  kind: EmailKind;
  lang: Lang;
  event: EmailEvent;
  guestName: string;
  hostName: string | null;
  token: string;
  baseUrl: string;
  tableLabel?: string | null;
  /** Duyuru metni (yalnızca kind = 'announcement'). */
  message?: string | null;
}): { subject: string; html: string; text: string } {
  const c = COPY[args.lang];
  const th = THEME[args.event.theme ?? ''] ?? THEME.adacayi;
  const host = (args.hostName ?? args.event.host_names ?? '').trim() || c.hostFallback;
  const title = args.event.title.trim();
  const table = (args.tableLabel ?? '').trim();
  const link = `${args.baseUrl}/r/${args.token}`;
  const privacyLink = `${args.baseUrl}/yasal/kvkk`;
  const when = formatWhen(args.event.starts_at, args.lang);
  const where = [args.event.venue_name, args.event.venue_address].filter(Boolean).join(', ');
  const deadlineDay = args.kind === 'invite' || args.kind === 'reminder' ? formatDay(args.event.rsvp_deadline, args.lang) : null;
  const message = args.kind === 'announcement' ? (args.message ?? '').trim().slice(0, 500) : '';
  const dark = ['gece', 'zumrut', 'lacivert', 'mor_gece'].includes(args.event.theme ?? '');

  // Düz değerler (metin sürümü) ve escape edilmiş değerler (HTML sürümü) ayrı tutulur.
  const plainVars = { title, host, table, name: args.guestName };
  const htmlVars = { title: `<strong>${escapeHtml(title)}</strong>`, host: escapeHtml(host), table: `<strong>${escapeHtml(table)}</strong>`, name: escapeHtml(args.guestName) };

  const subject = cleanHeader(fill(c.subject[args.kind], plainVars));
  const intro = fill(c.intro[args.kind], htmlVars);
  const greet = fill(c.greet, htmlVars);
  const footer = fill(c.footer, { host: escapeHtml(host) });

  const row = (label: string, value: string | null) =>
    value
      ? `<tr><td style="padding:6px 0;font:600 12px/18px Helvetica,Arial,sans-serif;letter-spacing:1px;text-transform:uppercase;color:${th.soft};width:96px;vertical-align:top">${escapeHtml(label)}</td><td style="padding:6px 0;font:500 15px/22px Helvetica,Arial,sans-serif;color:${th.ink}">${escapeHtml(value)}</td></tr>`
      : '';

  const html = `<!doctype html>
<html lang="${args.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:${th.bg}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(fill(c.intro[args.kind], plainVars))}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${th.bg}"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:28px;overflow:hidden">
<tr><td style="height:10px;background:${th.shape};font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td style="padding:36px 36px 8px 36px">
<p style="margin:0 0 14px 0;font:700 12px/16px Helvetica,Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;color:${dark ? '#7A5A1E' : th.accent}">${escapeHtml(c.kicker[args.kind])}</p>
<h1 style="margin:0 0 18px 0;font:400 36px/40px Georgia,'Times New Roman',serif;color:#24212B">${escapeHtml(title)}</h1>
<p style="margin:0 0 8px 0;font:500 16px/24px Helvetica,Arial,sans-serif;color:#24212B">${greet}</p>
<p style="margin:0 0 22px 0;font:400 16px/25px Helvetica,Arial,sans-serif;color:#4A4650">${intro}</p>
${message ? `<p style="margin:0 0 24px 0;padding:16px 18px;border-radius:16px;background:${th.bg};font:500 16px/25px Helvetica,Arial,sans-serif;color:${dark ? '#24212B' : th.ink};white-space:pre-line">${escapeHtml(message)}</p>` : ''}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0">${row(c.when, when)}${row(c.where, where || null)}${args.kind === 'table' ? row(c.table, table || null) : ''}</table>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:999px;background:${th.button}">
<a href="${escapeHtml(link)}" style="display:inline-block;padding:16px 30px;font:600 16px/20px Helvetica,Arial,sans-serif;color:${th.buttonInk};text-decoration:none;border-radius:999px">${escapeHtml(c.button[args.kind])}</a>
</td></tr></table>
${deadlineDay ? `<p style="margin:18px 0 0 0;font:400 14px/21px Helvetica,Arial,sans-serif;color:#6E6A72">${escapeHtml(fill(c.deadline, { date: deadlineDay }))}</p>` : ''}
<p style="margin:26px 0 0 0;font:400 12px/18px Helvetica,Arial,sans-serif;color:#9A968F">${escapeHtml(c.fallbackLink)}<br><a href="${escapeHtml(link)}" style="color:#6E6A72;word-break:break-all">${escapeHtml(link)}</a></p>
</td></tr>
<tr><td style="padding:24px 36px 32px 36px"><p style="margin:0;padding-top:18px;border-top:1px solid #EFEAE2;font:400 12px/18px Helvetica,Arial,sans-serif;color:#9A968F">${footer} <a href="${escapeHtml(privacyLink)}" style="color:#6E6A72">${escapeHtml(c.privacy)}</a></p></td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    fill(c.greet, plainVars),
    '',
    fill(c.intro[args.kind], plainVars),
    message ? `\n${message}` : null,
    '',
    when ? `${c.when}: ${when}` : null,
    where ? `${c.where}: ${where}` : null,
    args.kind === 'table' && table ? `${c.table}: ${table}` : null,
    '',
    `${c.button[args.kind]}: ${link}`,
    deadlineDay ? fill(c.deadline, { date: deadlineDay }) : null,
    '',
    '—',
    fill(c.footer, { host }),
    `${c.privacy}: ${privacyLink}`,
  ]
    .filter((l) => l !== null)
    .join('\n');

  return { subject, html, text };
}

/** Ortak yönetici daveti (etkinliği birlikte yönetmek için). */
export function renderCohostInvite(args: { lang: Lang; eventTitle: string; inviter: string | null; link: string }): { subject: string; html: string; text: string } {
  const tr = args.lang === 'tr';
  const who = (args.inviter ?? '').trim() || (tr ? 'Bir arkadaşın' : 'A friend');
  const title = args.eventTitle.trim();
  const subject = cleanHeader(tr ? `${who} seni "${title}" etkinliğini birlikte yönetmeye çağırıyor` : `${who} invited you to co-host "${title}"`);
  const body = tr
    ? `${who}, Invitefolk'ta "${title}" etkinliğini birlikte yönetmek için seni ortak yönetici olarak ekledi. Davetlileri ekleyebilir, cevapları görebilir ve oturma planını düzenleyebilirsin.`
    : `${who} added you as a co-host for "${title}" on Invitefolk. You'll be able to add guests, see replies and arrange the seating plan together.`;
  const button = tr ? 'Daveti kabul et' : 'Accept the invitation';
  const note = tr
    ? 'Bu link yalnızca bu e-posta adresiyle giriş yapıldığında çalışır ve bir kez kullanılabilir.'
    : 'This link only works when you sign in with this email address, and it can be used once.';
  const html = `<!doctype html><html lang="${args.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#FFF9F4"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF9F4"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border-radius:28px"><tr><td style="padding:36px">
<p style="margin:0 0 14px 0;font:700 12px/16px Helvetica,Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;color:#4A3BC2">Invitefolk</p>
<h1 style="margin:0 0 16px 0;font:800 26px/32px Helvetica,Arial,sans-serif;color:#1F1B2E">${escapeHtml(title)}</h1>
<p style="margin:0 0 24px 0;font:400 16px/25px Helvetica,Arial,sans-serif;color:#3A3548">${escapeHtml(body)}</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:999px;background:#6C5CE7"><a href="${escapeHtml(args.link)}" style="display:inline-block;padding:15px 28px;font:700 16px/20px Helvetica,Arial,sans-serif;color:#FFFFFF;text-decoration:none">${escapeHtml(button)}</a></td></tr></table>
<p style="margin:22px 0 0 0;font:400 13px/20px Helvetica,Arial,sans-serif;color:#6E6A72">${escapeHtml(note)}</p>
<p style="margin:14px 0 0 0;font:400 12px/18px Helvetica,Arial,sans-serif;color:#9A968F;word-break:break-all">${escapeHtml(args.link)}</p>
</td></tr></table></td></tr></table></body></html>`;
  const text = `${body}\n\n${button}: ${args.link}\n\n${note}`;
  return { subject, html, text };
}

export type EmailResult = { ok: true; id: string } | { ok: false; code: string };

/** Resend üzerinden tek e-posta. Sağlayıcı hata ayrıntısı yalnızca sunucu günlüğüne yazılır. */
export async function sendEmail(args: { to: string; subject: string; html: string; text: string; idempotencyKey?: string }): Promise<EmailResult> {
  const key = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('EMAIL_FROM');
  if (!key || !from) return { ok: false, code: 'not_configured' };
  const replyTo = Deno.env.get('EMAIL_REPLY_TO');
  const headers: Record<string, string> = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  if (args.idempotencyKey) headers['Idempotency-Key'] = args.idempotencyKey.slice(0, 256);
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        from,
        to: [args.to],
        subject: args.subject,
        html: args.html,
        text: args.text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('resend error', res.status, body?.name ?? '', body?.message ?? '');
      return { ok: false, code: String(res.status) };
    }
    return { ok: true, id: String(body?.id ?? '') };
  } catch (e) {
    console.error('resend fetch failed', e instanceof Error ? e.message : e);
    return { ok: false, code: 'network' };
  }
}

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
