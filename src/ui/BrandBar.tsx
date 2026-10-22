import { router } from 'expo-router';
import { Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useI18n } from '@/i18n';
import { useSession } from '@/lib/session';

import { Button, IconButton } from './primitives';
import { color, font } from './tokens';

export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 30 30">
      <Circle cx={10} cy={10} r={7} fill="#A08CEB" />
      <Circle cx={21} cy={9} r={4.5} fill="#F2846F" />
      <Circle cx={10} cy={21} r={4.5} fill="#E2B04A" />
      <Circle cx={21} cy={21} r={5.5} fill="#9CC3AB" />
    </Svg>
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
        <BrandMark />
        <Text style={{ fontFamily: font.bold, fontSize: 18, color: color.ink }}>{t('common.appName')}</Text>
        {area === 'admin' && (
          <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: color.ink }}>
            <Text style={{ fontFamily: font.bold, fontSize: 11, color: '#FFFFFF', letterSpacing: 0.8 }}>{t('home.brand.adminBadge')}</Text>
          </View>
        )}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {isAdmin && area === 'panel' && (wide ? <Button label={t('common.adminPanel')} variant="secondary" icon="shield" onPress={() => router.push('/admin')} /> : <IconButton icon="shield" label={t('common.adminPanel')} onPress={() => router.push('/admin')} />)}
        {area === 'admin' && <Button label={t('common.userPanel')} variant="secondary" icon="calendar" onPress={() => router.push('/')} />}
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
