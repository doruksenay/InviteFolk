// POST { event_id: string, invitation_ids?: string[], kind?: 'invite' | 'reminder' }
// Organizatörün kendi etkinliğindeki davetlilere WhatsApp şablonu gönderir.
// Ortam: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_INVITE_TEMPLATE, WHATSAPP_TEMPLATE_LANG (ops.)

import { adminClient, corsHeaders, json, userClient } from '../_shared/supabase.ts';
import { sendInviteTemplate, toWaNumber } from '../_shared/whatsapp.ts';

const fmt = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Istanbul' });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'yalnızca POST' }, 405);

  const { event_id, invitation_ids, kind = 'invite' } = await req.json().catch(() => ({}));
  if (!event_id) return json({ error: 'event_id gerekli' }, 400);

  // 1) Yetki: etkinliği kullanıcının kendi yetkisiyle okuyabiliyor mu? (RLS sahiplik kontrolü yapar)
  const asUser = userClient(req);
  const { data: event, error: evErr } = await asUser
    .from('events')
    .select('id, title, starts_at, venue_name, status')
    .eq('id', event_id)
    .single();
  if (evErr || !event) return json({ error: 'etkinlik bulunamadı' }, 404);

  // 2) Gönderilecek davetler
  const db = adminClient();
  let q = db
    .from('invitations')
    .select('id, token, status, contacts!inner(name, phone)')
    .eq('event_id', event_id);
  if (Array.isArray(invitation_ids) && invitation_ids.length) q = q.in('id', invitation_ids);
  if (kind === 'reminder') q = q.eq('status', 'pending');
  const { data: invites, error: invErr } = await q;
  if (invErr) return json({ error: invErr.message }, 500);

  const template = Deno.env.get('WHATSAPP_INVITE_TEMPLATE') ?? 'davet_lcv';
  const language = Deno.env.get('WHATSAPP_TEMPLATE_LANG') ?? 'tr';
  const whenWhere = [event.starts_at ? fmt.format(new Date(event.starts_at)) : null, event.venue_name]
    .filter(Boolean)
    .join(' · ');

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const inv of invites ?? []) {
    // deno-lint-ignore no-explicit-any
    const contact = (inv as any).contacts as { name: string; phone: string | null };
    const to = contact?.phone ? toWaNumber(contact.phone) : null;
    if (!to) {
      skipped++;
      continue;
    }

    const { data: msg } = await db
      .from('messages')
      .insert({ invitation_id: inv.id, channel: 'whatsapp', kind, status: 'queued' })
      .select('id')
      .single();

    const result = await sendInviteTemplate({
      to,
      template,
      language,
      guestName: contact.name,
      eventTitle: event.title,
      whenWhere: whenWhere || 'Ayrıntılar davetiyede',
      token: inv.token,
    });

    if (result.ok) {
      sent++;
      await db.from('messages').update({ status: 'sent', provider_id: result.id }).eq('id', msg!.id);
      await db.from('invitations').update({ delivery: 'sent' }).eq('id', inv.id);
    } else {
      failed++;
      await db.from('messages').update({ status: 'failed', error_code: result.code }).eq('id', msg!.id);
      await db.from('invitations').update({ delivery: 'failed' }).eq('id', inv.id);
    }

    // Meta hız sınırlarına saygı: numara başına saniyede makul sayıda gönderim.
    await new Promise((r) => setTimeout(r, 120));
  }

  if (event.status === 'draft' && sent > 0) {
    await db.from('events').update({ status: 'active' }).eq('id', event_id);
  }

  return json({ sent, failed, skipped });
});
