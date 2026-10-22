import type { Session } from '@supabase/supabase-js';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';

import type { Profile } from '@/core/types';

import { supabase } from './supabase';

type SessionState = {
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!s) {
      setProfile(null);
      return;
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle();
    setProfile((data as Profile) ?? null);
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      await loadProfile(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      // Supabase istemcisini auth olayı içinde beklemek kilitlenmeye yol açabilir; profil yüklemesini sonraya bırak.
      setTimeout(() => loadProfile(s), 0);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const value: SessionState = {
    session,
    profile,
    // Rol sadece arayüzü yönlendirir; asıl yetki veritabanındaki RLS ve is_admin() ile zorlanır.
    isAdmin: profile?.role === 'admin',
    loading,
    refreshProfile: () => loadProfile(session),
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession, SessionProvider içinde kullanılmalı');
  return v;
}
