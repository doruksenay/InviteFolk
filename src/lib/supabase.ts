import 'expo-sqlite/localStorage/install';

import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

/** .env dosyası doldurulmadan uygulama açılırsa çökmek yerine kurulum ekranı gösterilir. */
export const isSupabaseConfigured = url.startsWith('http') && key.length > 0;

export const supabase = createClient(isSupabaseConfigured ? url : 'http://localhost:54321', isSupabaseConfigured ? key : 'missing-key', {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
