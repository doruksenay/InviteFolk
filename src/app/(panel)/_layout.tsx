import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { takePendingRedirect } from '@/lib/pending';
import { usePushRouting } from '@/lib/push';
import { PushPrompt } from '@/ui/notifications/PushPrompt';
import { color } from '@/ui/tokens';

export default function PanelLayout() {
  // Bildirime dokununca ilgili etkinliği aç.
  usePushRouting();
  // Giriş öncesi açılmış bir link varsa (ör. ortak yönetici daveti) girişten sonra oraya dön.
  useEffect(() => {
    const next = takePendingRedirect();
    if (next) setTimeout(() => router.push(next as never), 0);
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg } }} />
      <PushPrompt />
    </View>
  );
}
