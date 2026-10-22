// Meta WhatsApp Cloud API yardımcıları (Supabase Edge Functions, Deno).
// Gerekli ortam değişkenleri: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID
// İsteğe bağlı: WHATSAPP_GRAPH_VERSION (varsayılan v23.0)

import { type Lang, text } from './messages.ts';

const GRAPH_VERSION = Deno.env.get('WHATSAPP_GRAPH_VERSION') ?? 'v23.0';

function endpoint() {
  const phoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  if (!phoneId) throw new Error('WHATSAPP_PHONE_NUMBER_ID tanımlı değil');
  return `https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`;
}

export type SendResult = { ok: true; id: string } | { ok: false; code: string; detail: string };

async function post(body: unknown): Promise<SendResult> {
  const token = Deno.env.get('WHATSAPP_TOKEN');
  if (!token) throw new Error('WHATSAPP_TOKEN tanımlı değil');
  const res = await fetch(endpoint(), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = json?.error ?? {};
    return { ok: false, code: String(err.code ?? res.status), detail: String(err.message ?? 'bilinmeyen hata') };
  }
  return { ok: true, id: json?.messages?.[0]?.id ?? '' };
}

/** "+90 532 123 45 67" -> "905321234567" */
export function toWaNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return null;
  if (digits.startsWith('0') && digits.length === 11) return '90' + digits.slice(1);
  if (digits.length === 10 && digits.startsWith('5')) return '90' + digits;
  return digits;
}

/**
 * Onaylı davet şablonunu gönderir.
 * Şablon gövdesi 3 değişken bekler: {{1}} davetli adı, {{2}} etkinlik başlığı, {{3}} tarih ve yer.
 * Butonlar: 0 = "Katılacağım" (quick reply), 1 = "Katılamayacağım" (quick reply).
 */
export function sendInviteTemplate(args: {
  to: string;
  template: string;
  language?: string;
  guestName: string;
  eventTitle: string;
  whenWhere: string;
  token: string;
  headerImageUrl?: string;
}) {
  const components: unknown[] = [];
  if (args.headerImageUrl) {
    components.push({ type: 'header', parameters: [{ type: 'image', image: { link: args.headerImageUrl } }] });
  }
  components.push({
    type: 'body',
    parameters: [
      { type: 'text', text: args.guestName },
      { type: 'text', text: args.eventTitle },
      { type: 'text', text: args.whenWhere },
    ],
  });
  components.push({ type: 'button', sub_type: 'quick_reply', index: '0', parameters: [{ type: 'payload', payload: `rsvp:yes:${args.token}` }] });
  components.push({ type: 'button', sub_type: 'quick_reply', index: '1', parameters: [{ type: 'payload', payload: `rsvp:no:${args.token}` }] });

  return post({
    messaging_product: 'whatsapp',
    to: args.to,
    type: 'template',
    template: { name: args.template, language: { code: args.language ?? 'tr' }, components },
  });
}

/**
 * "Masanız" şablonu (ayrı onaylı şablon, ör. davet_masa).
 * Gövde 3 değişken bekler: {{1}} davetli adı, {{2}} etkinlik başlığı, {{3}} masa adı. Düğme yok.
 */
export function sendTableTemplate(args: { to: string; template: string; language?: string; guestName: string; eventTitle: string; tableLabel: string }) {
  return post({
    messaging_product: 'whatsapp',
    to: args.to,
    type: 'template',
    template: {
      name: args.template,
      language: { code: args.language ?? 'tr' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: args.guestName },
            { type: 'text', text: args.eventTitle },
            { type: 'text', text: args.tableLabel },
          ],
        },
      ],
    },
  });
}

/** Davetli butona bastıktan sonra açılan 24 saatlik pencerede kişi sayısı sorusu (liste mesajı), etkinlik dilinde. */
export function sendPartySizeQuestion(to: string, token: string, maxParty: number, lang: Lang) {
  const tx = text(lang);
  const rows = Array.from({ length: Math.min(maxParty, 10) }, (_, i) => ({
    id: `party:${i + 1}:${token}`,
    title: tx.partyRow(i + 1),
  }));
  return post({
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: tx.askParty },
      action: { button: tx.partyButton, sections: [{ title: tx.partyButton, rows }] },
    },
  });
}

export function sendText(to: string, text: string) {
  return post({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } });
}

/** X-Hub-Signature-256 doğrulaması (Meta uygulama gizli anahtarı ile HMAC-SHA256). */
export async function verifySignature(rawBody: string, header: string | null): Promise<boolean> {
  const secret = Deno.env.get('WHATSAPP_APP_SECRET');
  if (!secret || !header?.startsWith('sha256=')) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
  const expected = header.slice('sha256='.length);
  if (expected.length !== hex.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
