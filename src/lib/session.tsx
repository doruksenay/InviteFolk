import type { Session } from '@supabase/supabase-js';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';

import type { Profile } from '@/core/types';

import { disablePush } from './push';
import { supabase } from './supabase';

export type Aal = 'aal1' | 'aal2';

type SessionState = {
  session: Session | null;
  profile: Profile | null;
  /** Rolü admin olan hesap (arayüz yönlendirmesi için). Yetkiyi veritabanı ayrıca MFA ile doğrular. */
  isAdmin: boolean;
  /** Bu oturumun doğrulama seviyesi: aal2 = iki adımlı doğrulama yapıldı. */
  aal: Aal;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  refreshAal: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<SessionState | null>(null);

async function readAal(): Promise<Aal> {
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return data?.currentLevel === 'aal2' ? 'aal2' : 'aal1';
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [aal, setAal] = useState<Aal>('aal1');
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!s) {
      setProfile(null);
      setAal('aal1');
      return;
    }
    const [{ data }, level] = await Promise.all([supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle(), readAal()]);
    setProfile((data as Profile) ?? null);
    setAal(level);
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
      // Supabase istemcisini auth olayı içinde beklemek kilitlenmeye yol açabilir; yüklemeyi sonraya bırak.
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
    isAdmin: profile?.role === 'admin',
    aal,
    loading,
    refreshProfile: () => loadProfile(session),
    refreshAal: async () => setAal(await readAal()),
    signOut: async () => {
      // Önce bu cihazın bildirim kaydı silinir (oturum açıkken; RLS gereği), sonra oturum kapanır.
      // Böylece çıkış yapılan telefona önceki hesabın davetli bildirimleri gelmez.
      await disablePush().catch(() => {});
      await supabase.auth.signOut({ scope: 'local' });
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession, SessionProvider içinde kullanılmalı');
  return v;
}
