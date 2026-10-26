import type { InvitationTheme } from '@/core/themes';
import type { TFn } from '@/i18n';

// Uygulama sürümü mikrofon izni istemez (organizatör uygulaması); sesli mesaj davetlinin tarayıcısından kaydedilir.
export const VOICE_SUPPORTED = false;

export function VoiceRecorder(_: { theme: InvitationTheme; t: TFn; onSend: (blob: Blob, mime: string) => Promise<boolean> }) {
  return null;
}
