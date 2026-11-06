import type { InvitationTheme } from '@/core/themes';
import type { TFn } from '@/i18n';

// Yüz önerisi davetlinin tarayıcısında çalışır (yüz verisi cihazdan çıkmaz); uygulama sürümünde yoktur.
export const FACE_FINDER_SUPPORTED = false;

export function FaceFinder(_: { theme: InvitationTheme; t: TFn; slug: string; enabled: boolean; photos: string[]; tile: number }) {
  return null;
}
