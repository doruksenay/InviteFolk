// Tek bir davetliye WhatsApp ya da e-posta gönderen ortak işlevler.
// send-invitations, send-email ve scheduled fonksiyonları kullanır.
// Her gönderim önce messages tablosuna "queued" yazılır, sonuçla güncellenir (servis istemcisiyle).

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

import { appWebUrl, EMAIL_RE, type EmailEvent, type EmailKind, renderEmail, sendEmail } from './email.ts';
import { type Lang, LOCALE, text } from './messages.ts';
import { sendInviteTemplate, sendTableTemplate, toWaNumber } from './whatsapp.ts';

export type DeliveryKind = 'invite' | 'reminder' | 'table';
export type Outcome = 'sent' | 'failed' | 'skipped';

export type DeliveryEvent = EmailEvent & { id: string; settings: unknown };

export type DeliveryTarget = {
  invitation_id: string;
  token: string;
  name: string;
  phone: string | null;
  email: string | null;
  table_label?: string | null;
};

export function whenWhere(ev: { starts_at: string | null; venue_name: string | null }, lang: Lang): string {
  const fmt = new Intl.DateTimeFormat(LOCALE[lang], { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Istanbul' });
  return [ev.starts_at ? fmt.format(new Date(ev.starts_at)) : null, ev.venue_name].filter(Boolean).join(' · ') || text(lang).detailsInInvite;
}

export function canWhatsApp(t: DeliveryTarget) {
  return !!(t.phone && toWaNumber(t.phone));
}

export function canEmail(t: DeliveryTarget) {
  return !!(t.email && EMAIL_RE.test(t.email) && t.email.length <= 254);
}

async function logStart(db: SupabaseClient, invitationId: string, channel: 'whatsapp' | 'email', kind: DeliveryKind) {
  const { data } = await db.from('messages').insert({ invitation_id: invitationId, channel, kind, status: 'queued' }).select('id').single();
  return (data?.id as string | undefined) ?? null;
}

async function logResult(db: SupabaseClient, msgId: string | null, invitationId: string, kind: DeliveryKind, ok: boolean, providerId?: string, code?: string) {
  if (msgId) {
    await db
      .from('messages')
      .update(ok ? { status: 'sent', provider_id: providerId ?? null } : { status: 'failed', error_code: (code ?? 'error').slice(0, 20) })
      .eq('id', msgId);
  }
  // Teslim durumu davet/hatırlatmayı yansıtır; "masanız" mesajı bunu değiştirmez.
  if (kind !== 'table') await db.from('invitations').update({ delivery: ok ? 'sent' : 'failed' }).eq('id', invitationId);
}

export async function deliverWhatsApp(db: SupabaseClient, ev: DeliveryEvent, target: DeliveryTarget, kind: DeliveryKind, lang: Lang): Promise<Outcome> {
  const to = target.phone ? toWaNumber(target.phone) : null;
  if (!to) return 'skipped';
  if (kind === 'table' && !target.table_label) return 'skipped';
  const language = lang === 'en' ? (Deno.env.get('WHATSAPP_TEMPLATE_LANG_EN') ?? 'en') : (Deno.env.get('WHATSAPP_TEMPLATE_LANG') ?? 'tr');

  const msgId = await logStart(db, target.invitation_id, 'whatsapp', kind);
  const result =
    kind === 'table'
      ? await sendTableTemplate({
          to,
          template: Deno.env.get('WHATSAPP_TABLE_TEMPLATE') ?? 'davet_masa',
          language,
          guestName: target.name.slice(0, 60),
          eventTitle: ev.title.slice(0, 120),
          tableLabel: String(target.table_label).slice(0, 40),
        })
      : await sendInviteTemplate({
          to,
          template: Deno.env.get('WHATSAPP_INVITE_TEMPLATE') ?? 'davet_lcv',
          language,
          guestName: target.name.slice(0, 60),
          eventTitle: ev.title.slice(0, 120),
          whenWhere: whenWhere(ev, lang),
          token: target.token,
        });
  if (!result.ok) console.error('whatsapp send failed', result.code, result.detail);
  await logResult(db, msgId, target.invitation_id, kind, result.ok, result.ok ? result.id : undefined, result.ok ? undefined : result.code);
  // Meta hız sınırlarına saygı.
  await new Promise((r) => setTimeout(r, 120));
  return result.ok ? 'sent' : 'failed';
}

export async function deliverEmail(
  db: SupabaseClient,
  ev: DeliveryEvent,
  target: DeliveryTarget,
  kind: EmailKind,
  lang: Lang,
  hostName: string | null,
): Promise<Outcome> {
  if (!canEmail(target)) return 'skipped';
  if (kind === 'table' && !target.table_label) return 'skipped';
  const baseUrl = appWebUrl();
  if (!baseUrl) {
    console.error('APP_WEB_URL tanımlı değil ya da https değil');
    return 'failed';
  }
  const mail = renderEmail({ kind, lang, event: ev, guestName: target.name, hostName, token: target.token, baseUrl, tableLabel: target.table_label });
  const msgId = await logStart(db, target.invitation_id, 'email', kind);
  // Aynı mesaj kaydı tekrar denenirse Resend ikinci kez göndermez.
  const result = await sendEmail({ to: target.email!, ...mail, idempotencyKey: msgId ?? undefined });
  await logResult(db, msgId, target.invitation_id, kind, result.ok, result.ok ? result.id : undefined, result.ok ? undefined : result.code);
  return result.ok ? 'sent' : 'failed';
}
