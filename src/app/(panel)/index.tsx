import { router } from 'expo-router';
import { useState } from 'react';
import { useWindowDimensions, View } from 'react-native';

import { useI18n } from '@/i18n';
import { getMyPlan, useQuery } from '@/lib/api';
import { listEvents } from '@/lib/api-guests';
import { OptionChip } from '@/ui/guests/common';
import { useSession } from '@/lib/session';
import { BrandBar } from '@/ui/BrandBar';
import { EventCard } from '@/ui/EventCard';
import { Body, Button, Display, DisplayAccent, EmptyState, Notice, Skeleton, Surface } from '@/ui/primitives';
import { Screen } from '@/ui/Screen';
import { color } from '@/ui/tokens';

export default function MyEvents() {
  const { profile } = useSession();
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const [showArchived, setShowArchived] = useState(false);
  const { data, loading, error, reload } = useQuery(() => listEvents(showArchived), [showArchived]);
  const plan = useQuery(() => getMyPlan().catch(() => null), []);

  const columns = width >= 1160 ? 3 : width >= 720 ? 2 : 1;
  const gap = 18;
  const contentWidth = Math.min(width, 1360) - 40;
  const cardWidth = columns === 1 ? '100%' : (contentWidth - gap * (columns - 1)) / columns;

  const firstName = profile?.full_name?.split(' ')[0];
  const active = (data ?? []).filter((e) => e.status !== 'archived');
  const archivedN = (data ?? []).length - active.length;
  const pending = active.reduce((s, e) => s + (e.summary?.pending_households ?? 0), 0);
  // Paket sınırına yaklaşınca nazik bir uyarı.
  const p = plan.data;
  const nearEvents = !!p && p.usage.events >= Math.max(1, p.limits.max_events - 1);
  const nearContacts = !!p && p.usage.contacts >= p.limits.max_contacts * 0.9;

  return (
    <Screen>
      <BrandBar area="panel" />

      <View style={{ flexDirection: width >= 720 ? 'row' : 'column', alignItems: width >= 720 ? 'flex-end' : 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <View style={{ gap: 8, flexShrink: 1 }}>
          <Display size={width >= 720 ? 56 : 44}>
            {t('home.hello')}
            {firstName ? ', ' : ''}
            <DisplayAccent style={{ color: color.lavender }}>{firstName ?? ''}</DisplayAccent>
          </Display>
          <Body>
            {active.length
              ? `${t('home.summary', { count: active.length })}${pending ? t('home.summaryPending', { count: pending }) : ''}.`
              : t('home.firstInvite')}
          </Body>
        </View>
        <Button label={t('home.newEvent')} variant="accent" size="lg" icon="plus" onPress={() => router.push('/yeni')} />
      </View>

      {p && (nearEvents || nearContacts) && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, minWidth: 240 }}>
            <Notice
              tone="info"
              text={[
                nearEvents ? t('home.limit.events', { max: p.limits.max_events, used: p.usage.events }) : null,
                nearContacts ? t('home.limit.contacts', { max: p.limits.max_contacts, used: p.usage.contacts }) : null,
              ]
                .filter(Boolean)
                .join(' ')}
            />
          </View>
          <Button label={t('home.limit.cta')} variant="secondary" icon="star" onPress={() => router.push('/paketler')} />
        </View>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <OptionChip small icon="archive" label={t('home.showArchived')} on={showArchived} onPress={() => setShowArchived((v) => !v)} />
        {showArchived && archivedN > 0 && <Body>{t('home.archivedCount', { count: archivedN })}</Body>}
      </View>

      {error && (
        <View style={{ gap: 12 }}>
          <Notice tone="error" text={t('home.loadFailed')} />
          <Button label={t('common.retry')} variant="secondary" onPress={reload} style={{ alignSelf: 'flex-start' }} />
        </View>
      )}

      {loading && !data ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
          {[0, 1, 2].slice(0, columns).map((i) => (
            <Surface key={i} style={{ width: cardWidth, gap: 12 }}>
              <Skeleton height={100} radius={18} />
              <Skeleton height={18} width="70%" />
              <Skeleton height={14} width="45%" />
              <Skeleton height={8} radius={4} />
            </Surface>
          ))}
        </View>
      ) : data && data.length === 0 && !showArchived ? (
        <EmptyState
          title={t('home.emptyTitle')}
          body={t('home.emptyBody')}
          action={<Button label={t('home.newEvent')} variant="accent" icon="plus" onPress={() => router.push('/yeni')} />}
        />
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
          {(data ?? []).map((e) => (
            <EventCard key={e.id} event={e} summary={e.summary} width={cardWidth} onPress={() => router.push({ pathname: '/etkinlik/[id]', params: { id: e.id } })} />
          ))}
        </View>
      )}
    </Screen>
  );
}
