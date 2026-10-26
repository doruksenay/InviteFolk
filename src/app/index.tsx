import { Redirect } from 'expo-router';
import Head from 'expo-router/head';
import { Platform } from 'react-native';

import { useI18n } from '@/i18n';
import { useSession } from '@/lib/session';
import { Landing } from '@/ui/landing/Landing';

/** Kök adres: giriş yapmışsa etkinlikler; web'de ziyaretçiye tanıtım sayfası, uygulamada giriş ekranı. */
export default function Root() {
  const { session } = useSession();
  const { d } = useI18n();
  if (session) return <Redirect href="/etkinlikler" />;
  if (Platform.OS !== 'web') return <Redirect href="/giris" />;
  return (
    <>
      <Head>
        <title>{d.landing.meta.title}</title>
        <meta name="description" content={d.landing.meta.description} />
        <meta property="og:title" content={d.landing.meta.title} />
        <meta property="og:description" content={d.landing.meta.description} />
      </Head>
      <Landing />
    </>
  );
}
