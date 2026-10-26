import { router } from 'expo-router';
import { Image, Text, useWindowDimensions, View } from 'react-native';

import markImage from '../../assets/images/logo-mark.png';

import { useI18n } from '@/i18n';
import { useSession } from '@/lib/session';

import { Button, IconButton } from './primitives';
import { color, font } from './tokens';

/** Invitefolk işareti: konuşma balonunda bir arada insanlar. */
export function BrandMark({ size = 30 }: { size?: number }) {
  return <Image source={markImage} style={{ width: size, height: size }} resizeMode="contain" accessibilityIgnoresInvertColors />;
}

const FOLK = ['#6C5CE7', '#FF6B6B', '#FBBF24', '#22C55E'];

/** Yazı logosu: "Invite" mürekkep, "folk" harf harf marka renkleri (assets/brand/invitefolk-brand-identity.png). */
export function Wordmark({ size = 20 }: { size?: number }) {
  return (
    <Text accessibilityRole="header" accessibilityLabel="Invitefolk" style={{ fontFamily: font.black, fontSize: size, letterSpacing: -0.03 * size, color: color.ink }}>
      Invite
      {'folk'.split('').map((ch, i) => (
        <Text key={i} style={{ color: FOLK[i] }}>
          {ch}
        </Text>
      ))}
    </Text>
  );
}

/** Üst çubuk: marka, admin için "Yönetim" kısayolu, ayarlar, çıkış. */
export function BrandBar({ area }: { area: 'panel' | 'admin' }) {
  const { isAdmin, signOut } = useSession();
  const { t } = useI18n();
  const wide = useWindowDimensions().width >= 760;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <BrandMark size={34} />
        <Wordmark size={19} />
        {area === 'admin' && (
          <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: color.ink }}>
            <Text style={{ fontFamily: font.bold, fontSize: 11, color: '#FFFFFF', letterSpacing: 0.8 }}>{t('home.brand.adminBadge')}</Text>
          </View>
        )}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {isAdmin && area === 'panel' && (wide ? <Button label={t('common.adminPanel')} variant="secondary" icon="shield" onPress={() => router.push('/admin')} /> : <IconButton icon="shield" label={t('common.adminPanel')} onPress={() => router.push('/admin')} />)}
        {area === 'admin' && <Button label={t('common.userPanel')} variant="secondary" icon="calendar" onPress={() => router.push('/etkinlikler')} />}
        {area === 'panel' &&
          (wide ? (
            <>
              <Button label={t('home.brand.contacts')} variant="ghost" icon="users" onPress={() => router.push('/rehber')} />
              <Button label={t('home.brand.plans')} variant="ghost" icon="star" onPress={() => router.push('/paketler')} />
            </>
          ) : (
            <>
              <IconButton icon="users" label={t('home.brand.contacts')} onPress={() => router.push('/rehber')} />
              <IconButton icon="star" label={t('home.brand.plans')} onPress={() => router.push('/paketler')} />
            </>
          ))}
        <IconButton icon="settings" label={t('common.settings')} onPress={() => router.push('/ayarlar')} />
        <IconButton icon="logout" label={t('common.signOut')} onPress={signOut} />
      </View>
    </View>
  );
}
