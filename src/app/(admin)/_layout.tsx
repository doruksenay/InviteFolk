import { Stack } from 'expo-router';

import { useSession } from '@/lib/session';
import { MfaGate } from '@/ui/MfaGate';
import { color } from '@/ui/tokens';

/**
 * Yönetim paneli yalnızca iki adımlı doğrulanmış (aal2) oturumla açılır.
 * Bu yalnızca arayüz kapısıdır: veritabanındaki is_admin() de aal2 olmayan oturuma admin yetkisi vermez,
 * yani biri bu ekranı atlatsa bile hiçbir admin verisi alamaz.
 */
export default function AdminLayout() {
  const { aal } = useSession();
  if (aal !== 'aal2') return <MfaGate />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg } }} />;
}
