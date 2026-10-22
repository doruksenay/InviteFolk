// Gönderim (WhatsApp / e-posta) ve bildirim kaydı için istemci çağrıları.
import { currentLang, makeT } from '@/i18n';

import { friendlyError, supabase } from './api';

export type SendKind = 'invite' | 'reminder' | 'table';
export type SendChannel = 'whatsapp' | 'email';
export type SendResult = { sent: number; failed: number; skipped: number; quota_left?: number };

/**
 * send-invitations (WhatsApp) ya da send-email fonksiyonunu çağırır. İkisi de aynı sözleşmeyle çalışır.
 * Hata gövdesi { error, detail } kullanıcının dilinde anlaşılır bir mesaja çevrilir.
 */
export async function sendToGuests(channel: SendChannel, eventId: string, kind: SendKind, invitationIds?: string[]): Promise<SendResult> {
  const fn = channel === 'email' ? 'send-email' : 'send-invitations';
  const body: Record<string, unknown> = { event_id: eventId, kind };
  if (invitationIds?.length) body.invitation_ids = invitationIds;
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const payload = ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) : null;
    if (payload?.error === 'quota_exceeded') throw friendlyError({ message: 'quota_exceeded', details: payload.detail ?? channel });
    if (payload?.error === 'not_configured') throw new Error(makeT(currentLang())('notifications.emailNotConfigured'));
    throw friendlyError(payload?.error ? { message: String(payload.error) } : error);
  }
  return data as SendResult;
}

export async function registerPushToken(token: string, platform: 'ios' | 'android') {
  const { error } = await supabase.rpc('register_push_token', { p_token: token, p_platform: platform });
  if (error) throw friendlyError(error);
}

export async function unregisterPushToken(token: string) {
  await supabase.rpc('unregister_push_token', { p_token: token });
}
