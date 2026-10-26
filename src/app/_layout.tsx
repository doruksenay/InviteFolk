import { GreatVibes_400Regular } from '@expo-google-fonts/great-vibes';
import { InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif';
import {
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
  useFonts,
} from '@expo-google-fonts/nunito';
import { PlayfairDisplay_400Regular, PlayfairDisplay_400Regular_Italic, PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
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
      {/* Kök: web'de tanıtım sayfası, giriş yapınca etkinlikler (src/app/index.tsx) */}
      <Stack.Screen name="index" />
      {/* Örnek davetiyeler: sahte verilerle davetli sayfası */}
      <Stack.Screen name="demo/[type]" />
      {/* Davetlinin LCV sayfası: herkese açık, kişiye özel token ile */}
      <Stack.Screen name="r/[token]" />
      {/* Yasal metinler: giriş gerektirmez (mağaza incelemesi, davetliler ve ziyaretçiler için) */}
      <Stack.Screen name="yasal/[doc]" />
      {/* Herkese açık etkinlik sayfaları: fotoğraf albümü, hediye bilgisi, bilgi toplama formu */}
      <Stack.Screen name="a/[slug]" />
      <Stack.Screen name="h/[slug]" />
      <Stack.Screen name="k/[slug]" />
      {/* Ortak yönetici daveti: girişsiz açılır, kabul için giriş ister */}
      <Stack.Screen name="katil/[token]" />

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
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
    PlayfairDisplay_400Regular,
    PlayfairDisplay_400Regular_Italic,
    PlayfairDisplay_700Bold,
    GreatVibes_400Regular,
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
