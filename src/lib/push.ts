// Organizatöre telefon bildirimleri (Expo Push). Yalnızca iOS/Android; web için push.web.ts.
// Akış: izin (nazik bir ön soruyla) → Expo anahtarı → register_push_token (anahtar bu hesaba bağlanır).
// Çıkış yapmadan önce disablePush() çağrılmalı: aksi hâlde bu telefona önceki hesabın bildirimleri gelmeye devam eder.
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { registerPushToken, unregisterPushToken } from './api-automation';

export type PushState = 'granted' | 'denied' | 'undetermined' | 'unavailable';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

const ASKED_KEY = 'davet.pushAsked';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let currentToken: string | null = null;
let handledResponse: string | null = null;

function projectId(): string | null {
  const id = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? Constants.easConfig?.projectId;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

export function pushSupported() {
  return Device.isDevice && !!projectId();
}

export function wasAsked(): boolean {
  try {
    return globalThis.localStorage?.getItem(ASKED_KEY) === '1';
  } catch {
    return false;
  }
}

export function markAsked() {
  try {
    globalThis.localStorage?.setItem(ASKED_KEY, '1');
  } catch {
    // önemsiz
  }
}

export async function pushPermission(): Promise<PushState> {
  if (!pushSupported()) return 'unavailable';
  try {
    const p = await Notifications.getPermissionsAsync();
    return p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'unavailable';
  }
}

/** İzin varsa (ya da `ask` ile istenip verilirse) bu telefonu hesaba bağlar. */
export async function enablePush(ask: boolean, channelName: string): Promise<PushState> {
  const pid = projectId();
  if (!Device.isDevice || !pid) return 'unavailable';
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('rsvp', { name: channelName, importance: AndroidImportance.DEFAULT });
    }
    let perm = await Notifications.getPermissionsAsync();
    if (!perm.granted && ask && perm.canAskAgain) perm = await Notifications.requestPermissionsAsync();
    if (!perm.granted) return perm.canAskAgain ? 'undetermined' : 'denied';
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId: pid });
    await registerPushToken(data, Platform.OS === 'ios' ? 'ios' : 'android');
    currentToken = data;
    return 'granted';
  } catch {
    return 'unavailable';
  }
}

/** Çıkıştan ÖNCE çağrılır: bu telefon artık bu hesabın bildirimlerini almaz. */
export async function disablePush() {
  if (!currentToken) {
    try {
      const pid = projectId();
      if (Device.isDevice && pid && (await Notifications.getPermissionsAsync()).granted) {
        currentToken = (await Notifications.getExpoPushTokenAsync({ projectId: pid })).data;
      }
    } catch {
      // anahtar alınamadıysa kayıt da yoktur
    }
  }
  if (currentToken) await unregisterPushToken(currentToken).catch(() => {});
  currentToken = null;
}

/** Bildirime dokununca ilgili etkinliği açar (uygulama kapalıyken açılış dahil). */
export function usePushRouting() {
  const last = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!last) return;
    const rid = last.notification.request.identifier;
    if (handledResponse === rid) return;
    handledResponse = rid;
    const data = last.notification.request.content.data as { event_id?: unknown; kind?: unknown } | undefined;
    const id = data?.event_id;
    if (typeof id !== 'string' || !UUID.test(id)) return;
    // Bilgi toplama başvurusu: doğrudan onay ekranı.
    if (data?.kind === 'request') router.push({ pathname: '/etkinlik/[id]/basvurular', params: { id } });
    else router.push({ pathname: '/etkinlik/[id]', params: { id } });
  }, [last]);
}
