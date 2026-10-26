import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Text, View } from 'react-native';

import { initials, joinUrl, waMeLink } from '@/core/format';
import type { TeamMember } from '@/core/types';
import { useI18n } from '@/i18n';
import { useQuery } from '@/lib/api';
import { getEventRow } from '@/lib/api-guests';
import { cohostInviteToken, eventTeam, inviteCohost, leaveEvent, removeMember } from '@/lib/api-team';
import { getEventLimits } from '@/lib/api-tools';
import { useSession } from '@/lib/session';
import { ToolError, ToolHeader, ToolLoading } from '@/ui/event/ToolScreen';
import { Avatar, Button, Caption, Field, Notice, Pill, Surface, Title } from '@/ui/primitives';
import { Screen } from '@/ui/Screen';
import { color, font } from '@/ui/tokens';

export default function TeamScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang } = useI18n();
  const { session } = useSession();
  const me = session?.user.id ?? null;
  const ev = useQuery(() => getEventRow(id), [id]);
  const lim = useQuery(() => getEventLimits(id).catch(() => null), [id]);
  const team = useQuery(() => eventTeam(id).catch(() => [] as TeamMember[]), [id]);

  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [link, setLink] = useState<string | null>(null);

  if (ev.loading && !ev.data) return <ToolLoading />;
  if (ev.error || !ev.data) return <ToolError />;
  const event = ev.data;
  const isOwner = event.owner_id === me;
  const max = lim.data?.limits.max_cohosts ?? 0;
  const members = team.data ?? [];
  const cohosts = members.filter((m) => m.role === 'cohost');
  const canInvite = isOwner && cohosts.length < max;

  const shareText = (l: string) => t('tools.team.shareText', { title: event.title, link: l });

  const invite = async () => {
    setMsg(null);
    setLink(null);
    const e = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return setMsg({ tone: 'error', text: t('auth.invalidEmail') });
    setBusy(true);
    try {
      const r = await inviteCohost(event.id, e, lang);
      const l = r.link ?? (r.token ? joinUrl(r.token) : null);
      setLink(l);
      setEmail('');
      setMsg({ tone: 'success', text: r.emailed ? t('tools.team.sent', { email: e }) : t('tools.team.linkReady') });
      team.reload();
      lim.reload();
    } catch (err) {
      setMsg({ tone: 'error', text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  const copyPending = async (m: TeamMember) => {
    if (!m.id) return;
    try {
      const tok = await cohostInviteToken(m.id);
      if (!tok) return;
      const l = joinUrl(tok);
      await Clipboard.setStringAsync(l);
      setLink(l);
      setMsg({ tone: 'success', text: t('tools.team.copied') });
    } catch (err) {
      setMsg({ tone: 'error', text: err instanceof Error ? err.message : String(err) });
    }
  };

  const remove = async (m: TeamMember) => {
    if (!m.id) return;
    try {
      await removeMember(m.id);
      team.reload();
      lim.reload();
    } catch (err) {
      setMsg({ tone: 'error', text: err instanceof Error ? err.message : String(err) });
    }
  };

  const leave = async () => {
    if (!me) return;
    try {
      await leaveEvent(event.id, me);
      router.replace('/etkinlikler');
    } catch (err) {
      setMsg({ tone: 'error', text: err instanceof Error ? err.message : String(err) });
    }
  };

  return (
    <Screen maxWidth={820}>
      <ToolHeader eventId={event.id} eventTitle={event.title} title={t('tools.team.title')} accent={t('tools.team.titleAccent')} subtitle={t('tools.team.subtitle')} />
      {msg && <Notice tone={msg.tone} text={msg.text} />}

      {link && (
        <Surface style={{ gap: 10, backgroundColor: color.lavenderTint }}>
          <Text selectable style={{ fontFamily: font.semibold, fontSize: 14, color: color.lavenderInk }}>
            {link}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Button
              label={t('tools.team.copyLink')}
              icon="copy"
              variant="secondary"
              onPress={async () => {
                await Clipboard.setStringAsync(link);
                setMsg({ tone: 'success', text: t('tools.team.copied') });
              }}
            />
            <Button label={t('tools.team.shareWa')} icon="whatsapp" variant="secondary" onPress={() => Linking.openURL(waMeLink(null, shareText(link)))} />
          </View>
          <Caption>{t('tools.team.note')}</Caption>
        </Surface>
      )}

      {isOwner && (
        <Surface style={{ gap: 12 }}>
          <Title>{t('tools.team.invite')}</Title>
          {max > 0 ? (
            <>
              <Caption>{t('tools.team.limit', { count: max })}</Caption>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <Field
                  style={{ flex: 1, minWidth: 220 }}
                  label={t('tools.team.emailLabel')}
                  placeholder={t('tools.team.emailPlaceholder')}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onSubmitEditing={invite}
                />
                <View style={{ paddingBottom: 2 }}>
                  <Button label={t('tools.team.invite')} icon="userPlus" loading={busy} disabled={!canInvite || !email.trim()} onPress={invite} />
                </View>
              </View>
            </>
          ) : (
            <View style={{ gap: 10 }}>
              <Caption>{t('tools.team.noPlan')}</Caption>
              <Button label={t('send.plans')} variant="secondary" onPress={() => router.push('/paketler')} style={{ alignSelf: 'flex-start' }} />
            </View>
          )}
        </Surface>
      )}

      <Surface style={{ gap: 4 }}>
        {members.map((m, idx) => (
          <View key={m.id ?? m.user_id ?? m.email} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: idx ? 1 : 0, borderTopColor: color.hairline, flexWrap: 'wrap' }}>
            <Avatar text={initials(m.full_name || m.email)} index={idx} />
            <View style={{ flex: 1, minWidth: 160, gap: 2 }}>
              <Text style={{ fontFamily: font.semibold, fontSize: 15, color: color.ink }}>
                {m.full_name || m.email}
                {m.user_id === me ? ` (${t('tools.team.you')})` : ''}
              </Text>
              {m.full_name ? <Caption>{m.email}</Caption> : null}
            </View>
            {m.role === 'owner' ? (
              <Pill label={t('tools.team.owner')} bg={color.ink} fg="#FFFFFF" />
            ) : m.accepted ? (
              <Pill label={t('tools.team.cohost')} bg={color.lavenderTint} fg={color.lavenderInk} />
            ) : (
              <Pill label={t('tools.team.pending')} bg={color.goldTint} fg={color.goldInk} />
            )}
            {isOwner && m.role === 'cohost' && (
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {!m.accepted && <Button label={t('tools.team.copyLink')} icon="copy" variant="ghost" onPress={() => copyPending(m)} />}
                <Button label={t('tools.team.remove')} variant="ghost" onPress={() => remove(m)} />
              </View>
            )}
          </View>
        ))}
      </Surface>

      {!isOwner && (
        <View style={{ gap: 6 }}>
          <Button label={t('tools.team.leave')} icon="close" variant="ghost" onPress={leave} style={{ alignSelf: 'flex-start' }} />
          <Caption>{t('tools.team.leaveConfirm')}</Caption>
        </View>
      )}
    </Screen>
  );
}
