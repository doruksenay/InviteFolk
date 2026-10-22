import type { ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { color } from './tokens';

/** Sıcak zemin, köşelerde çok hafif renk ışımaları, ortalanmış ve genişliği sınırlı içerik. */
export function Screen({ children, maxWidth = 1360, scroll = true, contentStyle }: { children: ReactNode; maxWidth?: number; scroll?: boolean; contentStyle?: ViewStyle }) {
  const inner = <View style={[styles.inner, { maxWidth }, contentStyle]}>{children}</View>;
  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      {Platform.OS === 'web' && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View style={[styles.glow, { left: -220, top: -240, backgroundColor: 'rgba(160,140,235,0.14)' }]} />
          <View style={[styles.glow, { right: -240, top: -200, backgroundColor: 'rgba(242,132,111,0.11)' }]} />
        </View>
      )}
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg, overflow: 'hidden' },
  scroll: { flexGrow: 1, paddingBottom: 48 },
  inner: { width: '100%', alignSelf: 'center', paddingHorizontal: 20, paddingTop: 16, gap: 28 },
  glow: { position: 'absolute', width: 560, height: 560, borderRadius: 280, filter: 'blur(60px)' },
});
