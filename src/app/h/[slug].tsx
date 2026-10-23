import { useLocalSearchParams } from 'expo-router';

import { getTheme } from '@/core/themes';
import { makeT } from '@/i18n';
import { useQuery } from '@/lib/api';
import { getPublicEvent } from '@/lib/api-guest';
import { PublicLoading, PublicNotFound, PublicShell } from '@/ui/guest/PublicShell';
import { GiftCard } from '@/ui/guest/Sections';

/** Hediye / takı bilgisi sayfası (masa kartındaki karekod buraya açılır). Organizatör "herkese açık" yaptıysa görünür. */
export default function GiftPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const q = useQuery(() => getPublicEvent(slug), [slug]);
  if (q.loading && !q.data) return <PublicLoading />;
  const ev = q.data;
  const t = makeT(ev?.lang === 'en' ? 'en' : 'tr');
  if (!ev || !ev.gift) return <PublicNotFound title={t('pub.notFoundTitle')} body={t('pub.notFoundBody')} />;
  const theme = getTheme(ev.theme);
  return (
    <PublicShell themeKey={ev.theme} kicker={t('pub.gift.kicker')} title={ev.title} subtitle={t('pub.gift.body')}>
      <GiftCard theme={theme} gift={ev.gift} type={ev.type} t={t} />
    </PublicShell>
  );
}
