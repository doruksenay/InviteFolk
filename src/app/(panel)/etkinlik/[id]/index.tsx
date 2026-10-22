import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Pressable, Text, useWindowDimensions, View } from 'react-native';

import { eventCopy, getEventType } from '@/core/event-types';
import { daysUntil, formatNumber, formatWhen, initials, normalizePhone, rsvpUrl, waMeLink } from '@/core/format';
import { getTheme } from '@/core/themes';
import type { InvitationWithContact, RsvpStatus, Side } from '@/core/types';
import { eventLang, LANG_NAMES, LOCALE_TAG, makeT, type TKey, useI18n } from '@/i18n';
import { addGuest, getEvent, removeInvitation, sendInvitations, setInvitationStatus, useQuery } from '@/lib/api';
import { Icon } from '@/ui/Icon';
import { Avatar, Body, Button, Caption, Display, Field, IconButton, Label, Notice, Pill, Skeleton, StatusBadge, Surface, Title } from '@/ui/primitives';
import { Screen } from '@/ui/Screen';
import { color, font, radius, shadow, status as statusTokens } from '@/ui/tokens';

type Filter = 'all' | RsvpStatus | 'failed';

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const { t, locale, lang } = useI18n();
  const { data, loading, error, reload } = useQuery(() => getEvent(id), [id]);

  const [filter, setFilter] = useState<Filter>('all');
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [sending, setSending] = useState(false);

  // Davetli ekleme formu
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [side, setSide] = useState<Side | null>(null);
  const [maxParty, setMaxParty] = useState('2');
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const invitations = useMemo(() => data?.invitations ?? [], [data]);
  const filtered = useMemo(
    () => invitations.filter((i) => filter === 'all' || (filter === 'failed' ? i.delivery === 'failed' : i.status === filter)),
    [invitations, filter],
  );

  if (loading && !data) {
    return (
      <Screen>
        <Skeleton height={44} width="50%" />
        <Skeleton height={120} radius={24} />
        <Skeleton height={320} radius={24} />
      </Screen>
    );
  }

  if (error || !data) {
    return (
      <Screen maxWidth={640}>
        <Notice tone="error" text={t('event.loadError')} />
        <Button label={t('event.backToEvents')} variant="secondary" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  const { event, summary } = data;
  const cfg = getEventType(event.type);
  const theme = getTheme(event.theme);
  // Davetliye giden her şey etkinliğin dilinde.
  const evLang = eventLang(event.settings);
  const et = makeT(evLang);
  const typeName = eventCopy(event.type, lang).name;
  const days = daysUntil(event.starts_at);
  const counts = {
    all: invitations.length,
    yes: invitations.filter((i) => i.status === 'yes').length,
    pending: invitations.filter((i) => i.status === 'pending').length,
    no: invitations.filter((i) => i.status === 'no').length,
    failed: invitations.filter((i) => i.delivery === 'failed').length,
  };

  const inviteText = (inv: InvitationWithContact) =>
    et('event.waMessage', {
      name: inv.contacts.name,
      title: event.title,
      when: [formatWhen(event.starts_at, LOCALE_TAG[evLang]), event.venue_name].filter(Boolean).join(' · '),
      link: rsvpUrl(inv.token),
    });

  const submitGuest = async () => {
    setFormError(null);
    if (!name.trim()) {
      setFormError(t('event.form.errName'));
      return;
    }
    const normalized = phone.trim() ? normalizePhone(phone) : null;
    if (phone.trim() && !normalized) {
      setFormError(t('event.form.errPhone'));
      return;
    }
    setAdding(true);
    try {
      await addGuest(event.id, { name: name.trim(), phone: normalized, side, max_party: Math.min(20, Math.max(1, Number(maxParty) || 1)) });
      setName('');
      setPhone('');
      setFeedback({ tone: 'success', text: t('event.form.added', { name: name.trim() }) });
      reload();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : t('event.form.errAdd'));
    } finally {
      setAdding(false);
    }
  };

  const sendAll = async (kind: 'invite' | 'reminder') => {
    setSending(true);
    setFeedback({ tone: 'info', text: kind === 'invite' ? t('event.send.sendingInvites') : t('event.send.sendingReminders') });
    try {
      const r = await sendInvitations(event.id, kind);
      setFeedback({
        tone: r.failed ? 'error' : 'success',
        text: `${t('event.send.sent', { count: r.sent })}${r.failed ? t('event.send.failed', { count: r.failed }) : ''}${r.skipped ? t('event.send.skipped', { count: r.skipped }) : ''}.`,
      });
      reload();
    } catch {
      setFeedback({
        tone: 'error',
        text: t('event.send.unavailable'),
      });
    } finally {
      setSending(false);
    }
  };

  const setStatus = async (inv: InvitationWithContact, s: RsvpStatus) => {
    await setInvitationStatus(inv.id, s, s === 'yes' ? inv.party_size ?? 1 : 0);
    reload();
  };

  const stat = (label: string, value: string, tone: keyof typeof statusTokens | 'neutral') => {
    const st = tone === 'neutral' ? { bg: color.surface, ink: color.ink } : statusTokens[tone];
    return (
      <View key={label} style={{ flexGrow: 1, flexBasis: wide ? 0 : '45%', backgroundColor: st.bg, borderRadius: radius.xl, padding: 20, gap: 6, boxShadow: tone === 'neutral' ? shadow.card : 'none' }}>
        <Text style={{ fontFamily: font.serif, fontSize: 40, lineHeight: 42, color: st.ink }}>{value}</Text>
        <Text style={{ fontFamily: font.semibold, fontSize: 14, color: st.ink }}>{label}</Text>
      </View>
    );
  };

  return (
    <Screen>
      {/* Başlık */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14 }}>
        <IconButton icon="arrowLeft" label={t('event.backToEvents')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <View style={{ flex: 1, minWidth: 240, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Pill label={typeName} bg={cfg.iconBg} fg={color.ink} />
            <Pill label={t('event.invitationLang', { lang: LANG_NAMES[evLang] })} bg={color.surfaceSoft} fg={color.inkSoft} />
            {event.status === 'draft' && <Pill label={t('status.event.draft')} bg={color.ink} fg="#FFFFFF" />}
          </View>
          <Display size={wide ? 48 : 38}>{event.title}</Display>
          <Caption>{[formatWhen(event.starts_at, locale), event.venue_name].filter(Boolean).join(' · ') || t('event.noDateVenue')}</Caption>
        </View>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          {counts.pending > 0 && invitations.some((i) => i.delivery !== 'not_sent') && (
            <Button label={t('event.remind', { count: counts.pending })} variant="secondary" icon="send" loading={sending} onPress={() => sendAll('reminder')} />
          )}
          <Button label={t('event.inviteWhatsApp')} variant="accent" icon="send" loading={sending} disabled={!invitations.length} onPress={() => sendAll('invite')} />
        </View>
      </View>

      {feedback && <Notice tone={feedback.tone} text={feedback.text} />}

      {/* Özet */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
        {stat(t('event.stats.attending'), formatNumber(summary?.attending_people ?? 0, locale), 'yes')}
        {stat(t('event.stats.pending'), formatNumber(counts.pending, locale), 'pending')}
        {stat(t('event.stats.declined'), formatNumber(counts.no, locale), 'no')}
        {days !== null && days >= 0
          ? stat(t('event.stats.daysLeft'), formatNumber(days, locale), 'neutral')
          : stat(t('event.stats.invited'), formatNumber(counts.all, locale), 'neutral')}
      </View>

      {cfg.tools.seating && <SeatingCard eventId={event.id} invitations={invitations} wide={wide} />}

      <View style={{ flexDirection: wide ? 'row' : 'column', gap: 20, alignItems: 'flex-start' }}>
        {/* Davetli ekle */}
        <Surface style={{ width: wide ? 360 : '100%', gap: 14 }}>
          <Title>{t('event.form.title')}</Title>
          <Field label={t('event.form.name')} placeholder={t('event.form.namePlaceholder')} value={name} onChangeText={setName} />
          <Field
            label={t('event.form.phone')}
            placeholder={t('event.form.phonePlaceholder')}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            hint={t('event.form.phoneHint')}
          />
          {cfg.tools.seating && (
            <View style={{ gap: 8 }}>
              <Label>{t('event.form.side')}</Label>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['gelin', 'damat', 'ortak'] as Side[]).map((s) => (
                  <Pressable
                    key={s}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: side === s }}
                    onPress={() => setSide(side === s ? null : s)}
                    style={{ paddingHorizontal: 14, height: 38, borderRadius: 999, justifyContent: 'center', backgroundColor: side === s ? color.ink : color.surfaceSoft }}>
                    <Text style={{ fontFamily: font.semibold, fontSize: 13, color: side === s ? '#FFFFFF' : color.inkSoft }}>
                      {t(`status.side.${s}`)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
          {cfg.questions.partySize && <Field label={t('event.form.maxParty')} keyboardType="number-pad" value={maxParty} onChangeText={setMaxParty} />}
          {formError && <Notice tone="error" text={formError} />}
          <Button label={t('event.form.submit')} icon="plus" loading={adding} onPress={submitGuest} />
          <Caption>{t('event.form.importSoon')}</Caption>
        </Surface>

        {/* Liste */}
        <Surface style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%', gap: 16 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <Display size={32}>{t('event.list.title')}</Display>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(
                [
                  ['all', counts.all],
                  ['yes', counts.yes],
                  ['pending', counts.pending],
                  ['no', counts.no],
                  ['failed', counts.failed],
                ] as [Exclude<Filter, 'maybe' | 'waitlist'>, number][]
              ).map(([k, n]) => {
                const label = t(`event.list.filters.${k}` as TKey);
                const on = filter === k;
                return (
                  <Pressable
                    key={k}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    onPress={() => setFilter(k)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 38, paddingLeft: 14, paddingRight: 8, borderRadius: 999, backgroundColor: on ? color.ink : color.surface, boxShadow: on ? 'none' : `inset 0 0 0 1px ${color.hairline}` }}>
                    <Text style={{ fontFamily: font.semibold, fontSize: 13, color: on ? '#FFFFFF' : color.inkSoft }}>{label}</Text>
                    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: on ? 'rgba(255,255,255,0.18)' : color.surfaceSoft }}>
                      <Text style={{ fontFamily: font.bold, fontSize: 12, color: on ? '#FFFFFF' : color.inkSoft }}>{n}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {invitations.length === 0 ? (
            <View style={{ paddingVertical: 40, alignItems: 'center', gap: 8, borderRadius: radius.lg, backgroundColor: color.surfaceSoft }}>
              <Text style={{ fontFamily: font.serif, fontSize: 28, color: color.ink }}>{t('event.list.emptyTitle')}</Text>
              <Body center>{t('event.list.emptyBody')}</Body>
            </View>
          ) : filtered.length === 0 ? (
            <View style={{ paddingVertical: 32, alignItems: 'center', gap: 6, borderRadius: radius.lg, backgroundColor: color.surfaceSoft }}>
              <Text style={{ fontFamily: font.serif, fontSize: 26, color: color.ink }}>{t('event.list.emptyFilterTitle')}</Text>
              <Body center>{t('event.list.emptyFilterBody')}</Body>
            </View>
          ) : (
            filtered.map((inv, idx) => (
              <View key={inv.id} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: idx ? 1 : 0, borderTopColor: color.hairline }}>
                <Avatar text={initials(inv.contacts.name)} index={idx} />
                <View style={{ flex: 1, minWidth: 160, gap: 2 }}>
                  <Text style={{ fontFamily: font.semibold, fontSize: 15, color: color.ink }}>{inv.contacts.name}</Text>
                  <Caption>
                    {[
                      inv.contacts.phone ?? t('event.list.noPhone'),
                      inv.status === 'yes' ? t('event.list.party', { count: inv.party_size ?? 1 }) : t('event.list.maxParty', { count: inv.contacts.max_party }),
                      inv.menu,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Caption>
                  {inv.delivery === 'failed' && <Caption color={color.coralInk}>{t('event.list.deliveryFailed')}</Caption>}
                </View>
                <StatusBadge status={inv.status} />
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <SmallAction icon="whatsapp" label={t('event.actions.whatsapp')} onPress={() => Linking.openURL(waMeLink(inv.contacts.phone, inviteText(inv)))} />
                  <SmallAction
                    icon="copy"
                    label={t('event.actions.copyLink')}
                    onPress={async () => {
                      await Clipboard.setStringAsync(rsvpUrl(inv.token));
                      setFeedback({ tone: 'success', text: t('event.actions.linkCopied', { name: inv.contacts.name }) });
                    }}
                  />
                  <SmallAction icon="check" label={t('event.actions.markYes')} onPress={() => setStatus(inv, 'yes')} />
                  <SmallAction icon="close" label={t('event.actions.markNo')} onPress={() => setStatus(inv, 'no')} />
                  <SmallAction
                    icon="trash"
                    tone="danger"
                    label={t('event.actions.remove')}
                    onPress={async () => {
                      await removeInvitation(inv.id);
                      reload();
                    }}
                  />
                </View>
              </View>
            ))
          )}
        </Surface>
      </View>

      <Surface style={{ flexDirection: wide ? 'row' : 'column', gap: 20, alignItems: wide ? 'center' : 'flex-start', backgroundColor: theme.bg }}>
        <View style={{ flex: wide ? 1 : undefined, gap: 6 }}>
          <Title color={theme.ink}>{t('event.guestPage.title')}</Title>
          <Body color={theme.soft}>{t('event.guestPage.body')}</Body>
        </View>
        {invitations[0] && (
          <Button label={t('event.guestPage.open')} variant="secondary" iconRight="arrowRight" onPress={() => router.push({ pathname: '/r/[token]', params: { token: invitations[0].token } })} />
        )}
      </Surface>
    </Screen>
  );
}

function SmallAction({ icon, label, onPress, tone }: { icon: 'whatsapp' | 'copy' | 'check' | 'close' | 'trash'; label: string; onPress: () => void; tone?: 'danger' }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: tone === 'danger' ? color.coralTint : color.surfaceSoft }, pressed && { transform: [{ scale: 0.94 }] }]}>
      <Icon name={icon} size={16} color={tone === 'danger' ? color.coralInk : color.ink} strokeWidth={2} />
    </Pressable>
  );
}

/** Oturma planına giriş: küçük bir salon çizimi ve yerleşim durumu. */
function SeatingCard({ eventId, invitations, wide }: { eventId: string; invitations: InvitationWithContact[]; wide: boolean }) {
  const { t } = useI18n();
  const coming = invitations.filter((i) => i.status !== 'no');
  const seated = coming.filter((i) => i.table_id).length;
  const dots = [color.coral, color.lavender, color.sage, color.gold, color.lavender, color.coral];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('event.seatingCard.a11y')}
      onPress={() => router.push({ pathname: '/etkinlik/[id]/oturma', params: { id: eventId } })}
      style={({ pressed }) => ({
        flexDirection: wide ? 'row' : 'column',
        alignItems: wide ? 'center' : 'flex-start',
        gap: 22,
        padding: 22,
        borderRadius: radius.xl,
        backgroundColor: color.lavenderTint,
        transform: [{ scale: pressed ? 0.99 : 1 }],
      })}>
      <View style={{ width: 150, height: 92 }}>
        <View style={{ position: 'absolute', left: 40, top: 0, width: 70, height: 14, borderRadius: 5, backgroundColor: color.ink }} />
        {[0, 1, 2].map((c) => (
          <View key={c} style={{ position: 'absolute', left: 12 + c * 46, top: 38 }}>
            {dots.slice(0, 6).map((d, i) => {
              const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
              const filled = i < 3 + c;
              return (
                <View
                  key={i}
                  style={{
                    position: 'absolute',
                    left: 14 + Math.cos(a) * 19 - 3.5,
                    top: 14 + Math.sin(a) * 19 - 3.5,
                    width: 7,
                    height: 7,
                    borderRadius: 4,
                    backgroundColor: filled ? d : '#FFFFFF',
                  }}
                />
              );
            })}
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFFFFF', boxShadow: '0px 2px 6px rgba(40,30,20,0.10)' }} />
          </View>
        ))}
      </View>
      <View style={{ flex: wide ? 1 : undefined, gap: 4 }}>
        <Title>{t('event.seatingCard.title')}</Title>
        <Body>{coming.length ? t('event.seatingCard.progress', { seated, total: coming.length }) : t('event.seatingCard.empty')}</Body>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: color.lavender, paddingHorizontal: 18, height: 46, borderRadius: radius.pill }}>
        <Text style={{ fontFamily: font.semibold, fontSize: 15, color: '#FFFFFF' }}>{t('event.seatingCard.open')}</Text>
        <Icon name="arrowRight" size={18} color="#FFFFFF" strokeWidth={2} />
      </View>
    </Pressable>
  );
}
