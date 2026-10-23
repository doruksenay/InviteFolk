// Ortak yöneticiler: davet (e-postayla link), kabul, liste, çıkarma/ayrılma.
// Yetki veritabanında: yalnızca sahip davet eder; link yalnızca davet edilen e-postayla ve bir kez kabul edilir.
import type { TeamMember } from '@/core/types';

import { friendlyError, must, supabase } from './api';

export async function eventTeam(eventId: string): Promise<TeamMember[]> {
  return must(await supabase.rpc('event_team', { p_event: eventId })) as TeamMember[];
}

export type CohostInviteResult = { id: string; token: string | null; link: string | null; accepted: boolean; emailed: boolean };

export async function inviteCohost(eventId: string, email: string, lang: 'tr' | 'en'): Promise<CohostInviteResult> {
  const { data, error } = await supabase.functions.invoke('cohost-invite', { body: { event_id: eventId, email, lang } });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const payload = ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) : null;
    if (payload?.error === 'quota_exceeded') throw friendlyError({ message: 'quota_exceeded', details: 'cohosts' });
    if (payload?.error === 'invalid_input') throw friendlyError({ message: 'invalid', code: '22023' });
    if (payload?.error === 'rate_limited') throw friendlyError({ message: 'rate_limited' });
    throw friendlyError(payload?.error ? { message: String(payload.error) } : error);
  }
  return data as CohostInviteResult;
}

export async function cohostInviteToken(memberId: string): Promise<string | null> {
  return must(await supabase.rpc('cohost_invite_token', { p_member: memberId })) as string | null;
}

export async function removeMember(memberId: string) {
  must(await supabase.from('event_members').delete().eq('id', memberId).select('id'));
}

export async function leaveEvent(eventId: string, userId: string) {
  must(await supabase.from('event_members').delete().eq('event_id', eventId).eq('user_id', userId).select('id'));
}

export type CohostInviteInfo = { title: string; type: string; starts_at: string | null; invited_email: string; inviter: string | null; email_matches: boolean };

export async function cohostInviteInfo(token: string): Promise<CohostInviteInfo | null> {
  return must(await supabase.rpc('cohost_invite_info', { p_token: token })) as CohostInviteInfo | null;
}

export async function acceptCohostInvite(token: string): Promise<string> {
  return must(await supabase.rpc('accept_cohost_invite', { p_token: token })) as string;
}
