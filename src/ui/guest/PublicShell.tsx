import type { ReactNode } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getTheme, type InvitationTheme } from '@/core/themes';
import { ThemeArt } from '@/ui/theme/ThemeArt';
import { themeTitle } from '@/ui/theme/typography';
import { font } from '@/ui/tokens';

/** Herkese açık sayfaların (albüm, hediye, bilgi formu) ortak çerçevesi: etkinliğin temasıyla. */
export function PublicShell({ themeKey, kicker, title, subtitle, children }: { themeKey: string; kicker: string; title: string; subtitle?: string | null; children: ReactNode }) {
  const theme = getTheme(themeKey);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.dark ? theme.bg : '#F6F1E8' }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', padding: 20, paddingBottom: 48 }}>
        <View style={{ width: '100%', maxWidth: 440, gap: 18 }}>
          <View style={{ borderRadius: 28, overflow: 'hidden', backgroundColor: theme.bg, boxShadow: '0px 20px 44px rgba(30,20,10,0.16)' }}>
            <View style={{ height: 150 }}>
              <ThemeArt theme={theme} width="100%" height={150} />
            </View>
            <View style={{ padding: 22, gap: 8 }}>
              <Text style={{ fontFamily: font.bold, fontSize: 11, letterSpacing: 1.6, color: theme.key_ }}>{kicker}</Text>
              <Text style={[themeTitle(theme, 42), { color: theme.ink }]}>{title}</Text>
              {subtitle ? <Text style={{ fontFamily: font.regular, fontSize: 14, lineHeight: 20, color: theme.soft }}>{subtitle}</Text> : null}
            </View>
          </View>
          {children}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function PublicLoading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F6F1E8' }}>
      <ActivityIndicator color="#24212B" />
    </View>
  );
}

export function PublicNotFound({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F6F1E8', padding: 28, gap: 10 }}>
      <Text style={{ fontFamily: font.serif, fontSize: 40, color: '#24212B', textAlign: 'center' }}>{title}</Text>
      <Text style={{ fontFamily: font.regular, fontSize: 15, lineHeight: 23, color: '#5F5D70', textAlign: 'center' }}>{body}</Text>
    </View>
  );
}

export function PublicPanel({ theme, children }: { theme: InvitationTheme; children: ReactNode }) {
  return <View style={{ gap: 14, padding: 20, borderRadius: 24, backgroundColor: theme.dark ? 'rgba(255,255,255,0.07)' : '#FFFFFF' }}>{children}</View>;
}
