// Meta WhatsApp webhook'u.
// GET: Meta doğrulaması (hub.verify_token = WHATSAPP_VERIFY_TOKEN).
// POST: mesaj durumları (sent/delivered/read/failed) ve davetli cevapları (buton ve liste).
// Bu fonksiyon JWT doğrulaması olmadan yayınlanmalı: supabase functions deploy whatsapp-webhook --no-verify-jwt

import { adminClient } from '../_shared/supabase.ts';
import { sendPartySizeQuestion, sendText, verifySignature } from '../_shared/whatsapp.ts';

const STATUS_MAP: Record<string, string> = { sent: 'sent', delivered: 'delivered', read: 'read', failed: 'failed' };

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const ok =
      url.searchParams.get('hub.mode') === 'subscribe' &&
      url.searchParams.get('hub.verify_token') === Deno.env.get('WHATSAPP_VERIFY_TOKEN');
    return ok ? new Response(url.searchParams.get('hub.challenge') ?? '', { status: 200 }) : new Response('forbidden', { status: 403 });
  }

  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  const raw = await req.text();
  if (!(await verifySignature(raw, req.headers.get('x-hub-signature-256')))) {
    return new Response('invalid signature', { status: 401 });
  }

  const db = adminClient();
  // deno-lint-ignore no-explicit-any
  const body = JSON.parse(raw) as any;

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};

      // 1) Teslim durumları
      for (const s of value.statuses ?? []) {
        const status = STATUS_MAP[s.status];
        if (!status) continue;
        const { data: msg } = await db
          .from('messages')
          .update({ status, error_code: s.errors?.[0]?.code ? String(s.errors[0].code) : null })
          .eq('provider_id', s.id)
          .select('invitation_id')
          .maybeSingle();
        if (msg?.invitation_id) {
          await db.from('invitations').update({ delivery: status }).eq('id', msg.invitation_id);
        }
      }

      // 2) Davetli cevapları
      for (const m of value.messages ?? []) {
        const from: string = m.from;
        const payload: string | undefined =
          m.button?.payload ?? m.interactive?.button_reply?.id ?? m.interactive?.list_reply?.id;
        if (!payload) continue;

        const [kind, a, b] = payload.split(':');

        if (kind === 'rsvp' && (a === 'yes' || a === 'no')) {
          const token = b;
          const { data: inv } = await db
            .from('invitations')
            .select('id, contacts!inner(max_party)')
            .eq('token', token)
            .maybeSingle();
          if (!inv) continue;
          // deno-lint-ignore no-explicit-any
          const maxParty = (inv as any).contacts.max_party as number;

          if (a === 'yes') {
            await db.rpc('respond_invitation', { p_token: token, p_status: 'yes', p_party_size: 1 });
            if (maxParty > 1) await sendPartySizeQuestion(from, token, maxParty);
            else await sendText(from, 'Teşekkürler! Katılımınızı kaydettik. Görüşmek üzere.');
          } else {
            await db.rpc('respond_invitation', { p_token: token, p_status: 'no' });
            await sendText(from, 'Cevabınızı ilettik, teşekkürler. Fikriniz değişirse davetiyedeki linkten güncelleyebilirsiniz.');
          }
        }

        if (kind === 'party') {
          const size = Number(a);
          const token = b;
          await db.rpc('respond_invitation', { p_token: token, p_status: 'yes', p_party_size: size });
          await sendText(from, `Teşekkürler! ${size} kişi olarak kaydettik. Etkinlikten önce hatırlatacağız.`);
        }
      }
    }
  }

  // Meta 200 bekler; aksi halde aynı olayı tekrar gönderir.
  return new Response('ok', { status: 200 });
});
