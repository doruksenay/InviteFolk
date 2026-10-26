import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';

import { useI18n } from '@/i18n';
import { Body, Button, Caption, Display, DisplayAccent, IconButton, Notice, Skeleton } from '@/ui/primitives';
import { Screen } from '@/ui/Screen';
import { color } from '@/ui/tokens';

/** Etkinlik araç ekranlarının ortak başlığı: geri, etkinlik adı, büyük başlık + vurgulu kelime, açıklama. */
export function ToolHeader({ eventId, eventTitle, title, accent, subtitle, right }: { eventId: string; eventTitle: string; title: string; accent: string; subtitle?: string; right?: ReactNode }) {
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const back = () => (router.canGoBack() ? router.back() : router.replace({ pathname: '/etkinlik/[id]', params: { id: eventId } }));
  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <IconButton icon="arrowLeft" label={t('common.back')} onPress={back} />
        <View style={{ flex: 1, minWidth: 220, gap: 2 }}>
          <Caption numberOfLines={1}>{eventTitle}</Caption>
          <Display size={width >= 900 ? 46 : 34}>
            {title} <DisplayAccent style={{ color: color.lavender }}>{accent}</DisplayAccent>
          </Display>
        </View>
        {right}
      </View>
      {subtitle ? <Body>{subtitle}</Body> : null}
    </>
  );
}

export function ToolLoading() {
  return (
    <Screen maxWidth={980}>
      <Skeleton height={44} width="40%" />
      <Skeleton height={320} radius={24} />
    </Screen>
  );
}

export function ToolError() {
  const { t } = useI18n();
  return (
    <Screen maxWidth={640}>
      <Notice tone="error" text={t('event.loadError')} />
      <Button label={t('event.backToEvents')} variant="secondary" onPress={() => router.replace('/etkinlikler')} />
    </Screen>
  );
}
