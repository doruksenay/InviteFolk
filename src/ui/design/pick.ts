// Native: fotoğraflardan görsel seçtirir. PDF telefonda görsele çevrilmez; arayüz web panelini önerir.
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'react-native';

import type { PickedDesign } from './pick-types';

export type { PickedDesign } from './pick-types';

const OK_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024;

export const pdfSupported = false;

export async function pickDesign(): Promise<PickedDesign | null> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, allowsEditing: false, exif: false });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  let mime = (a.mimeType ?? '').toLowerCase();
  if (!mime) {
    const lower = (a.fileName ?? a.uri).toLowerCase();
    mime = lower.endsWith('.png') ? 'image/png' : lower.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
  }
  if (!OK_TYPES.includes(mime)) throw new Error('unsupported-type');
  const file = new File(a.uri);
  if (file.size > MAX_BYTES || (a.fileSize ?? 0) > MAX_BYTES) throw new Error('too-large');
  const data = await file.arrayBuffer();
  let { width, height } = a;
  if (!width || !height) {
    // Bazı cihazlar ölçüyü vermez; görselden oku.
    ({ width, height } = await new Promise<{ width: number; height: number }>((res, rej) =>
      Image.getSize(a.uri, (w, h) => res({ width: w, height: h }), rej),
    ));
  }
  return { data, mime, width, height };
}
