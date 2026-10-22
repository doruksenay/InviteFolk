import { Stack } from 'expo-router';
import { View } from 'react-native';

import { usePushRouting } from '@/lib/push';
import { PushPrompt } from '@/ui/notifications/PushPrompt';
import { color } from '@/ui/tokens';

export default function PanelLayout() {
  // Bildirime dokununca ilgili etkinliği aç.
  usePushRouting();
  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg } }} />
      <PushPrompt />
    </View>
  );
}
