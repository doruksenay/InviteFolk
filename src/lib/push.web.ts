// Web'de telefon bildirimi yok; arayüz aynı kalsın diye boş uygulama.
export type PushState = 'granted' | 'denied' | 'undetermined' | 'unavailable';

export function pushSupported() {
  return false;
}
export function wasAsked() {
  return true;
}
export function markAsked() {}
export async function pushPermission(): Promise<PushState> {
  return 'unavailable';
}
export async function enablePush(_ask: boolean, _channelName: string): Promise<PushState> {
  return 'unavailable';
}
export async function disablePush() {}
export function usePushRouting() {}
