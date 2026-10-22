import { router } from 'expo-router';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';

import { EVENT_TYPE_ORDER, eventCopy, getEventType } from '@/core/event-types';
import { formatNumber, formatShortDate, formatTry } from '@/core/format';
import { useI18n } from '@/i18n';
import { adminRecentEvents, adminRecentUsers, adminStats, useQuery } from '@/lib/api';
import { BrandBar } from '@/ui/BrandBar';
import { Icon } from '@/ui/Icon';
import { Avatar, Body, Button, Caption, Display, DisplayItalic, Notice, Pill, Skeleton, Surface, Title } from '@/ui/primitives';
import { Screen } from '@/ui/Screen';
import { color, font, radius } from '@/ui/tokens';


/** Platform yönetim paneli: kullanıcılar, etkinlikler, mesaj sağlığı ve gelir. Yalnızca admin rolü açar. */
export default function AdminHome() {
  const { t, lang, locale } = useI18n();
  const num = (n: number) => formatNumber(n, locale);
  const { width } = useWindowDimensions();
  const wide = width >= 980;
  const stats = useQuery(adminStats, []);
  const users = useQuery(() => adminRecentUsers(12), []);
  const events = useQuery(() => adminRecentEvents(12), []);

  const s = stats.data;
  const responseRate = s && s.invitations ? Math.round((s.responses / s.invitations) * 100) : 0;
  const failRate = s && s.messages_sent + s.messages_failed ? Math.round((s.messages_failed / (s.messages_sent + s.messages_failed)) * 100) : 0;
  const maxType = s ? Math.max(1, ...Object.values(s.events_by_type ?? {})) : 1;

  const card = (label: string, value: string, sub: string, bg: string, ink: string) => (
    <View key={label} style={{ flexGrow: 1, flexBasis: wide ? 0 : '45%', minWidth: 150, backgroundColor: bg, borderRadius: radius.xl, padding: 20, gap: 4 }}>
      <Text style={{ fontFamily: font.semibold, fontSize: 13, color: ink }}>{label}</Text>
      <Text style={{ fontFamily: font.serif, fontSize: 42, lineHeight: 44, color: ink }}>{value}</Text>
      <Text style={{ fontFamily: font.medium, fontSize: 13, color: ink, opacity: 0.85 }}>{sub}</Text>
    </View>
  );

  return (
    <Screen>
      <BrandBar area="admin" />
      <View style={{ flexDirection: wide ? 'row' : 'column', alignItems: wide ? 'flex-end' : 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <View style={{ gap: 8, flexShrink: 1 }}>
          <Display size={wide ? 56 : 42}>
            {t('admin.titleA')} <DisplayItalic style={{ color: color.lavender }}>{t('admin.titleB')}</DisplayItalic>
          </Display>
          <Body>{t('admin.subtitle')}</Body>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('admin.manageUsers')}
          onPress={() => router.push('/admin/kullanicilar')}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            paddingVertical: 14,
            paddingHorizontal: 18,
            borderRadius: radius.xl,
            backgroundColor: color.ink,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          })}>
          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="users" size={20} color="#FFFFFF" />
          </View>
          <View>
            <Text style={{ fontFamily: font.semibold, fontSize: 15, color: '#FFFFFF' }}>{t('admin.manageUsers')}</Text>
            <Text style={{ fontFamily: font.regular, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{t('admin.manageUsersHint')}</Text>
          </View>
          <Icon name="arrowRight" size={18} color="#FFFFFF" />
        </Pressable>
      </View>

      {stats.error && (
        <View style={{ gap: 10 }}>
          <Notice tone="error" text={t('admin.statsError')} />
          <Button label={t('common.retry')} variant="secondary" onPress={stats.reload} style={{ alignSelf: 'flex-start' }} />
        </View>
      )}

      {!s && stats.loading ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ flexGrow: 1, flexBasis: wide ? 0 : '45%' }}>
              <Skeleton height={120} radius={28} />
            </View>
          ))}
        </View>
      ) : s ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          {card(t('admin.users'), num(s.users), t('admin.usersSub', { count: num(s.users_7d) }), color.lavenderTint, color.lavenderInk)}
          {card(t('admin.events'), num(s.events), t('admin.eventsSub', { count: num(s.active_events) }), color.coralTint, color.coralInk)}
          {card(
            t('admin.responseRate'),
            lang === 'tr' ? `%${responseRate}` : `${responseRate}%`,
            t('admin.responseRateSub', { responses: num(s.responses), invitations: num(s.invitations) }),
            color.sageTint,
            color.sageInk,
          )}
          {card(t('admin.whatsapp'), num(s.messages_sent), t('admin.whatsappSub', { rate: failRate }), color.goldTint, color.goldInk)}
          {card(t('admin.revenue'), formatTry(Number(s.revenue_try), locale), t('admin.revenueSub'), color.surface, color.ink)}
        </View>
      ) : null}

      <View style={{ flexDirection: wide ? 'row' : 'column', gap: 20, alignItems: 'flex-start' }}>
        <Surface style={{ width: wide ? 360 : '100%', gap: 14 }}>
          <Title>{t('admin.eventTypes')}</Title>
          {EVENT_TYPE_ORDER.map((k) => {
            const type = getEventType(k);
            const n = s?.events_by_type?.[k] ?? 0;
            return (
              <View key={k} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontFamily: font.semibold, fontSize: 14, color: color.ink }}>{eventCopy(k, lang).name}</Text>
                  <Text style={{ fontFamily: font.bold, fontSize: 14, color: color.ink }}>{num(n)}</Text>
                </View>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: '#F1EEE8', overflow: 'hidden' }}>
                  <View style={{ height: 8, width: `${Math.round((n / maxType) * 100)}%`, backgroundColor: type.accent, borderRadius: 4 }} />
                </View>
              </View>
            );
          })}
        </Surface>

        <View style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%', gap: 20 }}>
          <Surface style={{ gap: 4 }}>
            <Title style={{ marginBottom: 8 }}>{t('admin.recentUsers')}</Title>
            {(users.data ?? []).map((u, i) => (
              <View key={u.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: color.hairline }}>
                <Avatar text={(u.full_name ?? '?').charAt(0).toLocaleUpperCase(locale)} index={i} size={36} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: font.semibold, fontSize: 14, color: color.ink }}>{u.full_name ?? t('common.unnamed')}</Text>
                  <Caption>{formatShortDate(u.created_at, locale)}</Caption>
                </View>
                {u.role === 'admin' && <Pill label={t('admin.adminBadge')} bg={color.ink} fg="#FFFFFF" />}
                <Pill label={t(`status.plan.${u.plan}`)} bg={u.plan === 'free' ? color.surfaceSoft : color.sageTint} fg={u.plan === 'free' ? color.inkSoft : color.sageInk} />
              </View>
            ))}
            {users.data?.length === 0 && <Caption>{t('admin.noUsers')}</Caption>}
          </Surface>

          <Surface style={{ gap: 4 }}>
            <Title style={{ marginBottom: 8 }}>{t('admin.recentEvents')}</Title>
            {(events.data ?? []).map((e, i) => {
              const type = getEventType(e.type);
              return (
                <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: color.hairline }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: type.accent }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: font.semibold, fontSize: 14, color: color.ink }} numberOfLines={1}>
                      {e.title}
                    </Text>
                    <Caption>
                      {t('admin.eventLine', {
                        type: eventCopy(e.type, lang).name,
                        households: num(e.summary?.households ?? 0),
                        people: num(e.summary?.attending_people ?? 0),
                      })}
                    </Caption>
                  </View>
                  <Pill
                    label={t(`status.event.${e.status}`)}
                    bg={e.status === 'active' ? color.sageTint : color.surfaceSoft}
                    fg={e.status === 'active' ? color.sageInk : color.inkSoft}
                  />
                </View>
              );
            })}
            {events.data?.length === 0 && <Caption>{t('admin.noEvents')}</Caption>}
          </Surface>
        </View>
      </View>
    </Screen>
  );
}
