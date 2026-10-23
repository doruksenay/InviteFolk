import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Pressable, Text, useWindowDimensions, View } from 'react-native';

import { eventCopy, getEventType, sportOf } from '@/core/event-types';
import { daysUntil, formatNumber, formatTry, formatWhen, initials, rsvpUrl, waMeLink } from '@/core/format';
import { getTheme } from '@/core/themes';
import type { EventSettings, InvitationWithContact, RsvpStatus } from '@/core/types';
import { eventLang, LANG_NAMES, type TKey, useI18n } from '@/i18n';
import { getEvent, useQuery } from '@/lib/api';
import { setPaid, setStatus, updateEvent } from '@/lib/api-guests';
import { getEventLimits } from '@/lib/api-tools';
import { AnnounceSheet } from '@/ui/event/AnnounceSheet';
import { ExportSheet } from '@/ui/event/ExportSheet';
import { type ToolTile, ToolsGrid } from '@/ui/event/ToolsGrid';
import { GuestAdder } from '@/ui/guests/GuestAdder';
import { GuestEditSheet } from '@/ui/guests/GuestEditSheet';
import { Icon, type IconName } from '@/ui/Icon';
import { Avatar, Body, Button, Caption, Display, IconButton, Notice, Pill, Skeleton, StatusBadge, Surface, Title } from '@/ui/primitives';
import { Screen } from '@/ui/Screen';
import { guestMessage, SendPanel } from '@/ui/send/SendPanel';
import { Sheet } from '@/ui/Sheet';
import { color, font, radius, shadow, status as statusTokens } from '@/ui/tokens';

type Filter = 'all' | RsvpStatus | 'failed' | 'unopened';
type Feedback = { tone: 'success' | 'error' | 'info'; text: string } | null;

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const { t, locale, lang } = useI18n();
  const { data, loading, error, reload } = useQuery(() => getEvent(id), [id]);

  const [filter, setFilter] = useState<Filter>('all');
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [editing, setEditing] = useState<InvitationWithContact | null>(null);
  const [announceOpen, setAnnounceOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const lim = useQuery(() => getEventLimits(id).catch(() => null), [id]);

  const invitations = useMemo(() => data?.invitations ?? [], [data]);
  const filtered = useMemo(() => {
    const list = invitations.filter((i) =>
      filter === 'all' ? true : filter === 'failed' ? i.delivery === 'failed' : filter === 'unopened' ? i.delivery !== 'not_sent' && !i.opened_at && i.status === 'pending' : i.status === filter,
    );
    if (filter === 'waitlist') return [...list].sort((a, b) => (a.responded_at ?? a.created_at).localeCompare(b.responded_at ?? b.created_at));
    return list;
  }, [invitations, filter]);

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
  const settings = (event.settings ?? {}) as EventSettings;
  const cfg = getEventType(event.type);
  const theme = getTheme(event.theme);
  const evLang = eventLang(event.settings);
  const typeName = eventCopy(event.type, lang).name;
  const days = daysUntil(event.starts_at);
  const archived = event.status === 'archived';
  const roster = typeof settings.roster_size === 'number' ? settings.roster_size : null;
  const fee = typeof settings.fee === 'number' && settings.fee > 0 ? settings.fee : null;
  const questions = settings.questions ?? [];

  const counts = {
    all: invitations.length,
    yes: invitations.filter((i) => i.status === 'yes').length,
    pending: invitations.filter((i) => i.status === 'pending').length,
    no: invitations.filter((i) => i.status === 'no').length,
    waitlist: invitations.filter((i) => i.status === 'waitlist').length,
    failed: invitations.filter((i) => i.delivery === 'failed').length,
    paid: invitations.filter((i) => i.status === 'yes' && i.paid).length,
    unopened: invitations.filter((i) => i.delivery !== 'not_sent' && !i.opened_at && i.status === 'pending').length,
    opened: invitations.filter((i) => i.opened_at).length,
    checkedIn: invitations.filter((i) => i.checked_in_at).length,
    claims: invitations.filter((i) => i.paid_claimed_at && !i.paid).length,
  };
  const L = lim.data?.limits ?? null;
  const isOwner = lim.data?.is_owner ?? true;
  const saha = !!sportOf(event.type);
  const go = (path: '/etkinlik/[id]/sayfa' | '/etkinlik/[id]/ekip' | '/etkinlik/[id]/giris' | '/etkinlik/[id]/album' | '/etkinlik/[id]/basvurular' | '/etkinlik/[id]/takim') => router.push({ pathname: path, params: { id: event.id } });
  const plan = (k: 'temel' | 'otomatik' | 'tam') => t('tools.locked', { plan: t(`status.plan.${k}`) });
  const tiles: ToolTile[] = [
    { key: 'page', icon: 'envelope', title: t('tools.card.page.title'), body: t('tools.card.page.body'), tint: color.coralTint, ink: color.coralInk, onPress: () => go('/etkinlik/[id]/sayfa') },
    ...(saha ? [{ key: 'teams', icon: 'shirt' as const, title: t('tools.card.teams.title'), body: t('tools.card.teams.body'), badge: counts.claims ? t('tools.teams.paidClaims', { count: counts.claims }) : null, tint: color.sageTint, ink: color.sageInk, onPress: () => go('/etkinlik/[id]/takim') }] : []),
    { key: 'announce', icon: 'megaphone', title: t('tools.card.announce.title'), body: t('tools.card.announce.body'), tint: color.goldTint, ink: color.goldInk, onPress: () => setAnnounceOpen(true) },
    { key: 'export', icon: 'download', title: t('tools.card.export.title'), body: t('tools.card.export.body'), tint: color.sageTint, ink: color.sageInk, onPress: () => setExportOpen(true) },
    { key: 'team', icon: 'userPlus', title: t('tools.card.team.title'), body: t('tools.card.team.body'), locked: L && L.max_cohosts <= 0 ? plan('temel') : null, badge: lim.data?.cohosts ? String(lim.data.cohosts) : null, tint: color.lavenderTint, ink: color.lavenderInk, onPress: () => go('/etkinlik/[id]/ekip') },
    { key: 'checkin', icon: 'scan', title: t('tools.card.checkin.title'), body: t('tools.card.checkin.body'), locked: L && !L.checkin ? plan('otomatik') : null, badge: counts.checkedIn ? `${counts.checkedIn}/${counts.yes}` : null, tint: color.lavenderTint, ink: color.lavenderInk, onPress: () => go('/etkinlik/[id]/giris') },
    ...(saha
      ? []
      : [
          { key: 'album', icon: 'camera' as const, title: t('tools.card.album.title'), body: t('tools.card.album.body'), locked: L && L.album_photos <= 0 ? plan('otomatik') : null, badge: lim.data?.album_used ? String(lim.data.album_used) : null, tint: color.coralTint, ink: color.coralInk, onPress: () => go('/etkinlik/[id]/album') },
          { key: 'collector', icon: 'qr' as const, title: t('tools.card.collector.title'), body: t('tools.card.collector.body'), locked: L && !L.collector ? plan('temel') : null, tint: color.goldTint, ink: color.goldInk, onPress: () => go('/etkinlik/[id]/basvurular') },
        ]),
  ];

  // Menü dağılımı (gelen haneler)
  const menuCounts = (settings.menu ?? []).map((m) => ({ m, n: invitations.filter((i) => i.status === 'yes' && i.menu === m).length })).filter((x) => x.n > 0);

  const quickStatus = async (inv: InvitationWithContact, s: RsvpStatus) => {
    try {
      await setStatus(inv.id, s, s === 'yes' ? (inv.party_size || 1) : 0);
      reload();
    } catch (e) {
      setFeedback({ tone: 'error', text: e instanceof Error ? e.message : String(e) });
    }
  };

  const togglePaid = async (inv: InvitationWithContact) => {
    try {
      await setPaid(inv.id, !inv.paid);
      reload();
    } catch (e) {
      setFeedback({ tone: 'error', text: e instanceof Error ? e.message : String(e) });
    }
  };

  const unarchive = async () => {
    try {
      await updateEvent(event.id, { status: 'active' });
      reload();
    } catch (e) {
      setFeedback({ tone: 'error', text: e instanceof Error ? e.message : String(e) });
    }
  };

  const stat = (label: string, value: string, tone: keyof typeof statusTokens | 'neutral', sub?: string) => {
    const st = tone === 'neutral' ? { bg: color.surface, ink: color.ink } : statusTokens[tone];
    return (
      <View key={label} style={{ flexGrow: 1, flexBasis: wide ? 0 : '45%', backgroundColor: st.bg, borderRadius: radius.xl, padding: 20, gap: 6, boxShadow: tone === 'neutral' ? shadow.card : 'none' }}>
        <Text style={{ fontFamily: font.display, fontSize: 31, lineHeight: 33, color: st.ink }}>{value}</Text>
        <Text style={{ fontFamily: font.semibold, fontSize: 14, color: st.ink }}>{label}</Text>
        {sub ? <Text style={{ fontFamily: font.medium, fontSize: 12, color: st.ink, opacity: 0.8 }}>{sub}</Text> : null}
      </View>
    );
  };

  const filters: [Filter, number][] = [
    ['all', counts.all],
    ['yes', counts.yes],
    ['pending', counts.pending],
    ['no', counts.no],
    ...(roster ? ([['waitlist', counts.waitlist]] as [Filter, number][]) : []),
    ...(counts.unopened ? ([['unopened', counts.unopened]] as [Filter, number][]) : []),
    ['failed', counts.failed],
  ];

  const answerLine = (inv: InvitationWithContact) => {
    const parts = questions.map((q) => (inv.answers?.[q.id] ? `${q.label}: ${inv.answers[q.id]}` : null)).filter(Boolean);
    return parts.length ? parts.join(' · ') : null;
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
            {archived && <Pill label={t('status.event.archived')} bg={color.goldTint} fg={color.goldInk} />}
            {settings.recurring === 'weekly' && <Pill label={t('event.weekly')} bg={color.sageTint} fg={color.sageInk} />}
            {!isOwner && <Pill label={t('tools.team.shared')} bg={color.lavenderTint} fg={color.lavenderInk} />}
          </View>
          <Display size={wide ? 48 : 38}>{event.title}</Display>
          <Caption>{[formatWhen(event.starts_at, locale), event.venue_name].filter(Boolean).join(' · ') || t('event.noDateVenue')}</Caption>
        </View>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button label={t('event.edit')} variant="secondary" icon="edit" onPress={() => router.push({ pathname: '/etkinlik/[id]/duzenle', params: { id: event.id } })} />
          <Button label={t('event.send')} variant="accent" icon="send" disabled={!invitations.length || archived} onPress={() => setSendOpen(true)} />
        </View>
      </View>

      {archived && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, backgroundColor: color.goldTint, borderRadius: radius.lg, padding: 16 }}>
          <Icon name="archive" size={20} color={color.goldInk} />
          <Text style={{ flex: 1, minWidth: 200, fontFamily: font.semibold, fontSize: 14, color: color.goldInk }}>{t('event.archivedBanner')}</Text>
          {isOwner && <Button label={t('event.unarchive')} variant="secondary" onPress={unarchive} />}
        </View>
      )}

      {feedback && <Notice tone={feedback.tone} text={feedback.text} />}

      {/* Özet */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
        {roster ? (
          <>
            {stat(t('event.stats.squad'), `${formatNumber(counts.yes, locale)}/${roster}`, 'yes')}
            {stat(t('event.stats.waitlist'), formatNumber(counts.waitlist, locale), 'maybe')}
            {stat(t('event.stats.pendingPlayers'), formatNumber(counts.pending, locale), 'pending')}
            {fee
              ? stat(t('event.stats.paid'), `${counts.paid}/${counts.yes}`, 'neutral', t('event.feeLine', { collected: formatTry(counts.paid * fee, locale), expected: formatTry(counts.yes * fee, locale) }))
              : stat(t('event.stats.declined'), formatNumber(counts.no, locale), 'no')}
          </>
        ) : (
          <>
            {stat(t('event.stats.attending'), formatNumber(summary?.attending_people ?? 0, locale), 'yes')}
            {stat(t('event.stats.pending'), formatNumber(counts.pending, locale), 'pending')}
            {stat(t('event.stats.declined'), formatNumber(counts.no, locale), 'no')}
            {days !== null && days >= 0 ? stat(t('event.stats.daysLeft'), formatNumber(days, locale), 'neutral') : stat(t('event.stats.invited'), formatNumber(counts.all, locale), 'neutral')}
          </>
        )}
      </View>

      {menuCounts.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <Caption style={{ marginRight: 4 }}>{t('event.menuSummary')}</Caption>
          {menuCounts.map(({ m, n }) => (
            <View key={m} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 14, paddingRight: 6, height: 34, borderRadius: 999, backgroundColor: color.surface, boxShadow: shadow.card }}>
              <Text style={{ fontFamily: font.semibold, fontSize: 13, color: color.ink }}>{m}</Text>
              <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: color.sageTint }}>
                <Text style={{ fontFamily: font.bold, fontSize: 12, color: color.sageInk }}>{n}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={{ flexDirection: wide ? 'row' : 'column', gap: 16 }}>
        {cfg.tools.seating && (
          <FeatureCard
            icon="table"
            tint={color.lavenderTint}
            ink={color.lavenderInk}
            title={t('event.seatingCard.title')}
            body={
              invitations.some((i) => i.status !== 'no')
                ? t('event.seatingCard.progress', { seated: invitations.filter((i) => i.status !== 'no' && i.table_id).length, total: invitations.filter((i) => i.status !== 'no').length })
                : t('event.seatingCard.empty')
            }
            cta={t('event.seatingCard.open')}
            onPress={() => router.push({ pathname: '/etkinlik/[id]/oturma', params: { id: event.id } })}
          />
        )}
        <FeatureCard
          icon="image"
          tint={color.coralTint}
          ink={color.coralInk}
          title={t('event.designCard.title')}
          body={settings.design ? t('event.designCard.bodyHas') : t('event.designCard.body')}
          cta={settings.design ? t('event.designCard.edit') : t('event.designCard.open')}
          onPress={() => router.push({ pathname: '/etkinlik/[id]/tasarim', params: { id: event.id } })}
        />
      </View>

      <View style={{ gap: 10 }}>
        <Caption>{t('tools.section')}</Caption>
        <ToolsGrid tiles={tiles} columns={width >= 1100 ? 4 : width >= 760 ? 3 : 2} />
      </View>

      <View style={{ flexDirection: wide ? 'row' : 'column', gap: 20, alignItems: 'flex-start' }}>
        <View style={{ width: wide ? 380 : '100%' }}>{!archived && <GuestAdder event={event} onAdded={reload} />}</View>

        {/* Liste */}
        <Surface style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%', gap: 16 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <Display size={32}>{t('event.list.title')}</Display>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {filters.map(([k, n]) => {
                const label = k === 'unopened' ? t('tools.list.filterNotOpened') : t(`event.list.filters.${k}` as TKey);
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
              <Text style={{ fontFamily: font.display, fontSize: 22, color: color.ink }}>{t('event.list.emptyTitle')}</Text>
              <Body center>{t('event.list.emptyBody')}</Body>
            </View>
          ) : filtered.length === 0 ? (
            <View style={{ paddingVertical: 32, alignItems: 'center', gap: 6, borderRadius: radius.lg, backgroundColor: color.surfaceSoft }}>
              <Text style={{ fontFamily: font.display, fontSize: 20, color: color.ink }}>{t('event.list.emptyFilterTitle')}</Text>
              <Body center>{t('event.list.emptyFilterBody')}</Body>
            </View>
          ) : (
            filtered.map((inv, idx) => {
              const answers = answerLine(inv);
              return (
                <View key={inv.id} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: idx ? 1 : 0, borderTopColor: color.hairline }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('event.actions.edit', { name: inv.contacts.name })}
                    onPress={() => setEditing(inv)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 200 }}>
                    {filter === 'waitlist' ? (
                      <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: color.lavenderTint, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontFamily: font.display, fontSize: 17, color: color.lavenderInk }}>{idx + 1}</Text>
                      </View>
                    ) : (
                      <Avatar text={initials(inv.contacts.name)} index={idx} />
                    )}
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ fontFamily: font.semibold, fontSize: 15, color: color.ink }}>{inv.contacts.name}</Text>
                      <Caption numberOfLines={1}>
                        {[
                          inv.contacts.phone ?? inv.contacts.email ?? t('event.list.noPhone'),
                          inv.status === 'yes' || inv.status === 'waitlist' ? t('event.list.party', { count: inv.party_size || 1 }) : t('event.list.maxParty', { count: inv.contacts.max_party }),
                          inv.menu,
                          inv.contacts.side ? t(`status.side.${inv.contacts.side}`) : inv.contacts.group_label,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </Caption>
                      {answers && (
                        <Caption numberOfLines={1} color={color.lavenderInk}>
                          {answers}
                        </Caption>
                      )}
                      {inv.delivery === 'failed' && <Caption color={color.coralInk}>{t('event.list.deliveryFailed')}</Caption>}
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        {inv.delivery !== 'not_sent' && inv.status === 'pending' && (
                          <MiniBadge icon={inv.opened_at ? 'eye' : 'eyeOff'} label={inv.opened_at ? t('tools.list.opened') : t('tools.list.notOpened')} tone={inv.opened_at ? 'lavender' : 'muted'} />
                        )}
                        {inv.status === 'yes' && inv.children > 0 && <MiniBadge icon="child" label={t('tools.list.children', { count: inv.children })} tone="gold" />}
                        {inv.checked_in_at && <MiniBadge icon="check" label={t('tools.list.checkedIn')} tone="sage" />}
                        {roster && inv.paid_claimed_at && !inv.paid && <MiniBadge icon="creditCard" label={t('tools.list.paidClaim')} tone="gold" />}
                      </View>
                    </View>
                  </Pressable>
                  <StatusBadge status={inv.status} />
                  {roster && inv.status === 'yes' && (
                    <Pressable
                      accessibilityRole="switch"
                      accessibilityState={{ checked: inv.paid }}
                      accessibilityLabel={t('event.actions.paid')}
                      onPress={() => togglePaid(inv)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingHorizontal: 10, borderRadius: 999, backgroundColor: inv.paid ? color.sageTint : color.surfaceSoft }}>
                      <Icon name={inv.paid ? 'check' : 'creditCard'} size={13} color={inv.paid ? color.sageInk : color.muted} strokeWidth={2.2} />
                      <Text style={{ fontFamily: font.semibold, fontSize: 12, color: inv.paid ? color.sageInk : color.muted }}>{inv.paid ? t('event.actions.paid') : t('event.actions.unpaid')}</Text>
                    </Pressable>
                  )}
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {inv.contacts.phone && (
                      <SmallAction icon="whatsapp" label={t('event.actions.whatsapp')} onPress={() => Linking.openURL(waMeLink(inv.contacts.phone, guestMessage(event, inv, inv.status === 'pending' && inv.delivery !== 'not_sent' ? 'reminder' : 'invite')))} />
                    )}
                    <SmallAction
                      icon="copy"
                      label={t('event.actions.copyLink')}
                      onPress={async () => {
                        await Clipboard.setStringAsync(rsvpUrl(inv.token));
                        setFeedback({ tone: 'success', text: t('event.actions.linkCopied', { name: inv.contacts.name }) });
                      }}
                    />
                    {inv.status !== 'yes' && <SmallAction icon="check" label={t('event.actions.markYes')} onPress={() => quickStatus(inv, 'yes')} />}
                    {inv.status !== 'no' && <SmallAction icon="close" label={t('event.actions.markNo')} onPress={() => quickStatus(inv, 'no')} />}
                    <SmallAction icon="edit" label={t('event.actions.edit', { name: inv.contacts.name })} onPress={() => setEditing(inv)} />
                  </View>
                </View>
              );
            })
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

      <Sheet open={sendOpen} onClose={() => setSendOpen(false)} title={t('send.title')} italic={t('send.titleAccent')} subtitle={t('send.subtitle')} maxWidth={640}>
        <SendPanel flat event={event} invitations={invitations} onSent={reload} />
      </Sheet>

      <AnnounceSheet open={announceOpen} onClose={() => setAnnounceOpen(false)} eventId={event.id} limits={L} onDone={reload} />
      <ExportSheet open={exportOpen} onClose={() => setExportOpen(false)} event={event} invitations={invitations} />

      <GuestEditSheet
        open={!!editing}
        onClose={() => setEditing(null)}
        onChanged={reload}
        contactId={editing?.contact_id ?? null}
        invitation={editing}
        event={{ type: event.type, settings }}
      />
    </Screen>
  );
}

function MiniBadge({ icon, label, tone }: { icon: IconName; label: string; tone: 'sage' | 'gold' | 'lavender' | 'muted' }) {
  const bg = tone === 'sage' ? color.sageTint : tone === 'gold' ? color.goldTint : tone === 'lavender' ? color.lavenderTint : color.surfaceSoft;
  const ink = tone === 'sage' ? color.sageInk : tone === 'gold' ? color.goldInk : tone === 'lavender' ? color.lavenderInk : color.muted;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, height: 22, borderRadius: 999, backgroundColor: bg }}>
      <Icon name={icon} size={11} color={ink} strokeWidth={2.2} />
      <Text style={{ fontFamily: font.semibold, fontSize: 11, color: ink }}>{label}</Text>
    </View>
  );
}

function SmallAction({ icon, label, onPress, tone }: { icon: IconName; label: string; onPress: () => void; tone?: 'danger' }) {
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

/** Oturma planı / davetiye tasarımı gibi araçlara giriş kartı. */
function FeatureCard({ icon, tint, ink, title, body, cta, onPress }: { icon: IconName; tint: string; ink: string; title: string; body: string; cta: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${cta}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 16,
        padding: 20,
        borderRadius: radius.xl,
        backgroundColor: tint,
        transform: [{ scale: pressed ? 0.99 : 1 }],
      })}>
      <View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={24} color={ink} />
      </View>
      <View style={{ flex: 1, minWidth: 180, gap: 3 }}>
        <Title>{title}</Title>
        <Caption>{body}</Caption>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: ink, paddingHorizontal: 14, height: 40, borderRadius: radius.pill }}>
        <Text style={{ fontFamily: font.semibold, fontSize: 14, color: '#FFFFFF' }}>{cta}</Text>
        <Icon name="arrowRight" size={16} color="#FFFFFF" strokeWidth={2} />
      </View>
    </Pressable>
  );
}
