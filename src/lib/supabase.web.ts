import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

export const isSupabaseConfigured = url.startsWith('http') && key.length > 0;

// Web'de tarayıcının kendi localStorage'ı kullanılır.
export const supabase = createClient(isSupabaseConfigured ? url : 'http://localhost:54321', isSupabaseConfigured ? key : 'missing-key', {
  auth: {
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
