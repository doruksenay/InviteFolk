import { InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { I18nProvider, useI18n } from '@/i18n';
import { SessionProvider, useSession } from '@/lib/session';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Body, Display, Surface } from '@/ui/primitives';
import { color } from '@/ui/tokens';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { session, isAdmin, loading } = useSession();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  if (loading) return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg } }}>
      {/* Davetlinin LCV sayfası: herkese açık, kişiye özel token ile */}
      <Stack.Screen name="r/[token]" />
      {/* Yasal metinler: giriş gerektirmez (mağaza incelemesi, davetliler ve ziyaretçiler için) */}
      <Stack.Screen name="yasal/[doc]" />

      <Stack.Protected guard={!session}>
        <Stack.Screen name="giris" />
      </Stack.Protected>

      {/* Organizatör (kullanıcı) paneli */}
      <Stack.Protected guard={!!session} redirectTo="/giris">
        <Stack.Screen name="(panel)" />
      </Stack.Protected>

      {/* Platform yönetimi: yalnızca admin rolü. Veritabanı tarafında RLS ayrıca zorlar. */}
      <Stack.Protected guard={!!session && isAdmin}>
        <Stack.Screen name="(admin)" />
      </Stack.Protected>
    </Stack>
  );
}

function ConfigMissing() {
  const { t } = useI18n();
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: color.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Surface style={{ maxWidth: 460, gap: 12 }}>
        <Display size={34}>{t('layout.configTitle')}</Display>
        <Body>{t('layout.configBody')}</Body>
      </Surface>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
  });

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <I18nProvider>
        <StatusBar style="dark" />
        {isSupabaseConfigured ? (
          <SessionProvider>
            <RootNavigator />
          </SessionProvider>
        ) : (
          <ConfigMissing />
        )}
      </I18nProvider>
    </SafeAreaProvider>
  );
}
