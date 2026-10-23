// Tek bir davetliye WhatsApp, e-posta ya da SMS gönderen ortak işlevler.
// send-invitations, send-email, send-sms, whatsapp-webhook ve scheduled fonksiyonları kullanır.
// Her gönderim önce messages tablosuna "queued" yazılır, sonuçla güncellenir (servis istemcisiyle).

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

import { appWebUrl, EMAIL_RE, type EmailEvent, type EmailKind, renderEmail, sendEmail } from './email.ts';
import { type Lang, LOCALE, text } from './messages.ts';
import { sendSms, toSmsNumber } from './sms.ts';
import { sendAnnouncementTemplate, sendInviteTemplate, sendTableTemplate, toWaNumber } from './whatsapp.ts';

export type DeliveryKind = 'invite' | 'reminder' | 'table' | 'announcement';
export type Outcome = 'sent' | 'failed' | 'skipped';
export type Channel = 'whatsapp' | 'email' | 'sms';

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

export function canSms(t: DeliveryTarget) {
  return !!(t.phone && toSmsNumber(t.phone));
}

/** Etkinlik WhatsApp'a ulaşılamayınca SMS'e düşsün mü (organizatör açtıysa). */
export function smsFallbackOn(ev: { settings: unknown }) {
  return (ev.settings as { sms_fallback?: boolean } | null)?.sms_fallback === true;
}

function guestLink(token: string) {
  const base = appWebUrl();
  return base ? `${base}/r/${token}` : null;
}

/**
 * Gönderim kaydı. Günlük hak veritabanında bu ekleme sırasında atomik olarak düşülür (private.count_message);
 * hak bittiyse ekleme reddedilir. Kayıt açılamazsa mesaj GÖNDERİLMEZ: paralel isteklerle kota aşılamaz.
 */
async function logStart(db: SupabaseClient, invitationId: string, channel: Channel, kind: DeliveryKind) {
  const { data, error } = await db.from('messages').insert({ invitation_id: invitationId, channel, kind, status: 'queued' }).select('id').single();
  if (error || !data?.id) return null;
  return data.id as string;
}

async function logResult(db: SupabaseClient, msgId: string | null, invitationId: string, kind: DeliveryKind, ok: boolean, providerId?: string, code?: string) {
  if (msgId) {
    await db
      .from('messages')
      .update(ok ? { status: 'sent', provider_id: providerId ?? null } : { status: 'failed', error_code: (code ?? 'error').slice(0, 20) })
      .eq('id', msgId);
  }
  // Teslim durumu davet/hatırlatmayı yansıtır; "masanız" ve duyuru mesajları bunu değiştirmez.
  if (kind === 'invite' || kind === 'reminder') await db.from('invitations').update({ delivery: ok ? 'sent' : 'failed' }).eq('id', invitationId);
}

export async function deliverWhatsApp(
  db: SupabaseClient,
  ev: DeliveryEvent,
  target: DeliveryTarget,
  kind: DeliveryKind,
  lang: Lang,
  message?: string | null,
): Promise<Outcome> {
  const to = target.phone ? toWaNumber(target.phone) : null;
  if (!to) return 'skipped';
  if (kind === 'table' && !target.table_label) return 'skipped';
  const language = lang === 'en' ? (Deno.env.get('WHATSAPP_TEMPLATE_LANG_EN') ?? 'en') : (Deno.env.get('WHATSAPP_TEMPLATE_LANG') ?? 'tr');
  const link = guestLink(target.token);
  if (kind === 'announcement' && (!message || !link)) return 'skipped';

  const msgId = await logStart(db, target.invitation_id, 'whatsapp', kind);
  if (!msgId) return 'skipped';
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
      : kind === 'announcement'
        ? await sendAnnouncementTemplate({
            to,
            template: Deno.env.get('WHATSAPP_ANNOUNCE_TEMPLATE') ?? 'davet_duyuru',
            language,
            guestName: target.name.slice(0, 60),
            eventTitle: ev.title.slice(0, 120),
            message: String(message),
            link: link!,
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
  message?: string | null,
): Promise<Outcome> {
  if (!canEmail(target)) return 'skipped';
  if (kind === 'table' && !target.table_label) return 'skipped';
  if (kind === 'announcement' && !message) return 'skipped';
  const baseUrl = appWebUrl();
  if (!baseUrl) {
    console.error('APP_WEB_URL tanımlı değil ya da https değil');
    return 'failed';
  }
  const mail = renderEmail({ kind, lang, event: ev, guestName: target.name, hostName, token: target.token, baseUrl, tableLabel: target.table_label, message });
  const msgId = await logStart(db, target.invitation_id, 'email', kind);
  if (!msgId) return 'skipped';
  // Aynı mesaj kaydı tekrar denenirse Resend ikinci kez göndermez.
  const result = await sendEmail({ to: target.email!, ...mail, idempotencyKey: msgId ?? undefined });
  await logResult(db, msgId, target.invitation_id, kind, result.ok, result.ok ? result.id : undefined, result.ok ? undefined : result.code);
  return result.ok ? 'sent' : 'failed';
}

export async function deliverSms(
  db: SupabaseClient,
  ev: DeliveryEvent,
  target: DeliveryTarget,
  kind: DeliveryKind,
  lang: Lang,
  message?: string | null,
): Promise<Outcome> {
  const to = target.phone ? toSmsNumber(target.phone) : null;
  const link = guestLink(target.token);
  if (!to || !link) return 'skipped';
  if (kind === 'table' && !target.table_label) return 'skipped';
  if (kind === 'announcement' && !message) return 'skipped';
  const tx = text(lang).sms;
  const name = target.name.slice(0, 40);
  const title = ev.title.slice(0, 60);
  const body =
    kind === 'table'
      ? tx.table(name, title, link, String(target.table_label).slice(0, 40))
      : kind === 'announcement'
        ? tx.announcement(name, title, link, String(message).replace(/\s+/g, ' ').slice(0, 300))
        : kind === 'reminder'
          ? tx.reminder(name, title, link)
          : tx.invite(name, title, link);
  const msgId = await logStart(db, target.invitation_id, 'sms', kind);
  if (!msgId) return 'skipped';
  const result = await sendSms(to, body);
  await logResult(db, msgId, target.invitation_id, kind, result.ok, result.ok ? result.id : undefined, result.ok ? undefined : result.code);
  return result.ok ? 'sent' : 'failed';
}
