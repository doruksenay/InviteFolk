// Meta WhatsApp webhook'u.
// GET: Meta doğrulaması (hub.verify_token = WHATSAPP_VERIFY_TOKEN).
// POST: mesaj durumları (sent/delivered/read/failed) ve davetli cevapları (buton ve liste).
// Yayın: supabase functions deploy whatsapp-webhook --no-verify-jwt
//
// Güvenlik:
// - Her POST, Meta uygulama gizli anahtarıyla imzalı olmalı (X-Hub-Signature-256, sabit zamanlı karşılaştırma).
// - Cevap, yalnızca davetin gönderildiği telefon numarasından geliyorsa kabul edilir (token tek başına yetmez).
// - Aynı olay iki kez işlenmez (webhook_dedupe).
// - Gövde boyutu sınırlı; beklenmeyen biçimler sessizce yok sayılır.

import { langOf, text } from '../_shared/messages.ts';
import { adminClient, readBody, TOKEN } from '../_shared/supabase.ts';
import { sendPartySizeQuestion, sendText, toWaNumber, verifySignature } from '../_shared/whatsapp.ts';

const STATUS_MAP: Record<string, string> = { sent: 'sent', delivered: 'delivered', read: 'read', failed: 'failed' };

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const expected = Deno.env.get('WHATSAPP_VERIFY_TOKEN') ?? '';
    const ok = !!expected && url.searchParams.get('hub.mode') === 'subscribe' && safeEqual(url.searchParams.get('hub.verify_token') ?? '', expected);
    return ok ? new Response(url.searchParams.get('hub.challenge') ?? '', { status: 200 }) : new Response('forbidden', { status: 403 });
  }

  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  const raw = await readBody(req, 512 * 1024);
  if (raw === null) return new Response('payload too large', { status: 413 });
  if (!(await verifySignature(raw, req.headers.get('x-hub-signature-256')))) {
    return new Response('invalid signature', { status: 401 });
  }

  const db = adminClient();
  // deno-lint-ignore no-explicit-any
  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response('ok', { status: 200 });
  }

  /** Olayı ilk kez görüyorsak true döner. */
  const firstTime = async (id: string) => {
    const { data } = await db.from('webhook_dedupe').upsert({ id: id.slice(0, 200) }, { onConflict: 'id', ignoreDuplicates: true }).select('id');
    return (data?.length ?? 0) > 0;
  };

  for (const entry of body?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value ?? {};

      // 1) Teslim durumları
      for (const s of value.statuses ?? []) {
        const status = STATUS_MAP[s?.status];
        if (!status || typeof s.id !== 'string') continue;
        const { data: msg } = await db
          .from('messages')
          .update({ status, error_code: s.errors?.[0]?.code ? String(s.errors[0].code).slice(0, 20) : null })
          .eq('provider_id', s.id)
          .select('invitation_id')
          .maybeSingle();
        if (msg?.invitation_id) await db.from('invitations').update({ delivery: status }).eq('id', msg.invitation_id);
      }

      // 2) Davetli cevapları
      for (const m of value.messages ?? []) {
        const from = typeof m?.from === 'string' ? m.from.replace(/\D/g, '') : '';
        const payload: unknown = m?.button?.payload ?? m?.interactive?.button_reply?.id ?? m?.interactive?.list_reply?.id;
        if (!from || typeof payload !== 'string' || payload.length > 100) continue;
        if (typeof m.id === 'string' && !(await firstTime(`msg:${m.id}`))) continue;

        const [kind, a, token] = payload.split(':');
        if (!TOKEN.test(token ?? '')) continue;

        const { data: inv } = await db
          .from('invitations')
          .select('id, contacts!inner(phone, max_party), events!inner(settings, status)')
          .eq('token', token)
          .maybeSingle();
        if (!inv) continue;
        // deno-lint-ignore no-explicit-any
        const contact = (inv as any).contacts as { phone: string | null; max_party: number };
        // deno-lint-ignore no-explicit-any
        const ev = (inv as any).events as { settings: unknown; status: string };
        // Cevap yalnızca davetin gittiği numaradan geçerli.
        if (!contact.phone || toWaNumber(contact.phone) !== from) {
          console.warn('rsvp from unexpected number ignored');
          continue;
        }
        if (ev.status === 'archived') continue;
        const tx = text(langOf(ev.settings));

        if (kind === 'rsvp' && (a === 'yes' || a === 'no')) {
          if (a === 'yes') {
            await db.rpc('respond_invitation', { p_token: token, p_status: 'yes', p_party_size: 1 });
            if (contact.max_party > 1) await sendPartySizeQuestion(from, token, contact.max_party, langOf(ev.settings));
            else await sendText(from, tx.thanksYes);
          } else {
            await db.rpc('respond_invitation', { p_token: token, p_status: 'no' });
            await sendText(from, tx.thanksNo);
          }
        } else if (kind === 'party') {
          const size = Math.trunc(Number(a));
          if (!Number.isFinite(size) || size < 1 || size > 20) continue;
          await db.rpc('respond_invitation', { p_token: token, p_status: 'yes', p_party_size: size });
          await sendText(from, tx.thanksParty(Math.min(size, contact.max_party)));
        }
      }
    }
  }

  // Meta 200 bekler; aksi halde aynı olayı tekrar gönderir.
  return new Response('ok', { status: 200 });
});
