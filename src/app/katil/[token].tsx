import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { useI18n } from '@/i18n';
import { useQuery } from '@/lib/api';
import { acceptCohostInvite, cohostInviteInfo } from '@/lib/api-team';
import { setPendingRedirect } from '@/lib/pending';
import { useSession } from '@/lib/session';
import { BrandMark } from '@/ui/BrandBar';
import { Body, Button, Caption, Display, DisplayAccent, Notice, Skeleton, Surface } from '@/ui/primitives';
import { Screen } from '@/ui/Screen';
import { color, font } from '@/ui/tokens';

/** Ortak yönetici davet linki: giriş yapılmamışsa girişe yönlendirir, sonra buraya döner. */
export default function AcceptCohost() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { t } = useI18n();
  const { session, signOut } = useSession();
  const info = useQuery(() => (session ? cohostInviteInfo(token) : Promise.resolve(null)), [token, session?.user.id ?? '']);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const signIn = () => {
    setPendingRedirect(`/katil/${token}`);
    router.push('/giris');
  };

  const accept = async () => {
    setBusy(true);
    setErr(null);
    try {
      const eventId = await acceptCohostInvite(token);
      router.replace({ pathname: '/etkinlik/[id]', params: { id: eventId } });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const data = info.data;
  return (
    <Screen maxWidth={560} contentStyle={{ paddingTop: 48 }}>
      <BrandMark size={48} />
      <View style={{ gap: 8 }}>
        <Text style={{ fontFamily: font.bold, fontSize: 12, letterSpacing: 1.4, color: color.lavenderInk }}>{t('pub.katil.kicker')}</Text>
        <Display size={48}>
          {t('pub.katil.title').split(' ').slice(0, -1).join(' ')} <DisplayAccent style={{ color: color.lavender }}>{t('pub.katil.title').split(' ').slice(-1)[0]}</DisplayAccent>
        </Display>
      </View>
      <Surface style={{ gap: 14 }}>
        {!session ? (
          <>
            <Body>{t('pub.katil.signInHint')}</Body>
            <Button label={t('pub.katil.signIn')} icon="arrowRight" variant="accent" size="lg" onPress={signIn} style={{ alignSelf: 'flex-start' }} />
          </>
        ) : info.loading && !data ? (
          <Skeleton height={90} radius={18} />
        ) : !data ? (
          <>
            <Notice tone="error" text={t('pub.katil.invalid')} />
            <Button label={t('pub.katil.goHome')} variant="secondary" onPress={() => router.replace('/')} style={{ alignSelf: 'flex-start' }} />
          </>
        ) : (
          <>
            <Body>{t('pub.katil.body', { inviter: data.inviter || t('pub.katil.inviterFallback'), title: data.title })}</Body>
            {data.email_matches ? (
              <Button label={busy ? t('pub.katil.accepting') : t('pub.katil.accept')} icon="check" variant="accent" size="lg" loading={busy} onPress={accept} style={{ alignSelf: 'flex-start' }} />
            ) : (
              <>
                <Notice tone="warning" text={t('pub.katil.wrongEmail', { email: data.invited_email })} />
                <Button
                  label={t('pub.katil.signOut')}
                  variant="secondary"
                  onPress={async () => {
                    setPendingRedirect(`/katil/${token}`);
                    await signOut();
                  }}
                  style={{ alignSelf: 'flex-start' }}
                />
              </>
            )}
            {err && <Notice tone="error" text={err} />}
          </>
        )}
        <Caption>Invitefolk</Caption>
      </Surface>
    </Screen>
  );
}
