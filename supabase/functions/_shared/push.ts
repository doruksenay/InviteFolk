// Organizatöre telefon bildirimi (Expo Push API). Metinler organizatörün dilinde (profiles.locale).
// Ortam: EXPO_ACCESS_TOKEN (isteğe bağlı; Expo hesabında "enhanced push security" açıksa gerekli)

import type { Lang } from './messages.ts';

export type QueueRow = { id: number; user_id: string; kind: 'rsvp' | 'promoted' | 'reminder_done' | 'purchase'; payload: Record<string, unknown> };
export type PushMessage = { to: string; title: string; body: string; data: Record<string, unknown>; sound: 'default'; channelId: string };

const PLAN: Record<Lang, Record<string, string>> = {
  tr: { temel: 'Temel', otomatik: 'Otomatik', tam: 'Tam', b2b: 'İşletme' },
  en: { temel: 'Basic', otomatik: 'Automatic', tam: 'Complete', b2b: 'Business' },
};

const clip = (s: unknown, n: number) => String(s ?? '').slice(0, n);

export function pushText(row: QueueRow, lang: Lang): { title: string; body: string } | null {
  const p = row.payload ?? {};
  const guest = clip(p.guest, 60) || (lang === 'en' ? 'A guest' : 'Bir davetli');
  const title = clip(p.title, 80) || 'Invitefolk';
  const n = Number(p.party_size ?? 0);
  if (row.kind === 'rsvp') {
    const st = String(p.status ?? '');
    if (lang === 'en') {
      const body =
        st === 'yes' ? `${guest} is coming${n > 0 ? ` · ${n === 1 ? '1 person' : `${n} people`}` : ''}`
        : st === 'no' ? `${guest} can't make it`
        : st === 'maybe' ? `${guest} might come`
        : st === 'waitlist' ? `${guest} joined the waitlist`
        : null;
      return body ? { title, body } : null;
    }
    const body =
      st === 'yes' ? `${guest} katılıyor${n > 0 ? ` · ${n} kişi` : ''}`
      : st === 'no' ? `${guest} katılamayacak`
      : st === 'maybe' ? `${guest} belki gelecek`
      : st === 'waitlist' ? `${guest} yedek listesine girdi`
      : null;
    return body ? { title, body } : null;
  }
  if (row.kind === 'promoted') {
    return { title, body: lang === 'en' ? `${guest} moved up from the waitlist to the squad` : `${guest} yedekten kadroya geçti` };
  }
  if (row.kind === 'purchase') {
    const plan = PLAN[lang][String(p.package ?? '')] ?? String(p.package ?? '');
    return lang === 'en'
      ? { title: 'Your plan is active', body: `The ${plan} plan has been added to your account. Thank you!` }
      : { title: 'Paketin hazır', body: `${plan} paketi hesabına tanımlandı. Teşekkürler!` };
  }
  return null;
}

export type Ticket = { status: 'ok' | 'error'; details?: { error?: string } };

/** En fazla 100'lük gruplar hâlinde gönderir; her mesaj için bileti (aynı sırayla) döner. */
export async function sendPush(messages: PushMessage[]): Promise<Ticket[]> {
  const tickets: Ticket[] = [];
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  const token = Deno.env.get('EXPO_ACCESS_TOKEN');
  if (token) headers.Authorization = `Bearer ${token}`;
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers, body: JSON.stringify(batch) });
      const body = await res.json().catch(() => ({}));
      const data: Ticket[] = Array.isArray(body?.data) ? body.data : [];
      for (let k = 0; k < batch.length; k++) tickets.push(data[k] ?? { status: 'error', details: { error: res.ok ? 'missing' : String(res.status) } });
    } catch (e) {
      console.error('expo push failed', e instanceof Error ? e.message : e);
      for (let k = 0; k < batch.length; k++) tickets.push({ status: 'error', details: { error: 'network' } });
    }
  }
  return tickets;
}
