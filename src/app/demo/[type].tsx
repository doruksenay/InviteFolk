import { Redirect, useLocalSearchParams } from 'expo-router';

import { EVENT_TYPES, type EventTypeKey } from '@/core/event-types';
import { demoToken } from '@/lib/demo';

/** /demo/dugun?lang=en → örnek davetiye (davetli sayfasının kendisi, sahte verilerle). */
export default function DemoRedirect() {
  const { type, lang } = useLocalSearchParams<{ type: string; lang?: string }>();
  const key = (type in EVENT_TYPES ? type : 'dugun') as EventTypeKey;
  return <Redirect href={{ pathname: '/r/[token]', params: { token: demoToken(key, lang === 'en' ? 'en' : 'tr') } }} />;
}
