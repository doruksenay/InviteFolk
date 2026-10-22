// Web: görsel ya da PDF seçtirir; PDF'nin ilk sayfasını PNG'ye çevirir, büyük görselleri küçültür.
import * as DocumentPicker from 'expo-document-picker';

import { renderPdfFirstPage } from './pdf';
import type { PickedDesign } from './pick-types';

export type { PickedDesign } from './pick-types';

const MAX_EDGE = 2400;
const MAX_BYTES = 9.5 * 1024 * 1024;
const OK_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export const pdfSupported = true;

async function loadImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    // decode() bitti; görsel bellekte, adres bırakılabilir.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

async function normalizeImage(file: Blob, type: string): Promise<PickedDesign> {
  const img = await loadImage(file);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
  if (scale === 1 && file.size <= MAX_BYTES && OK_TYPES.includes(type)) {
    return { data: file, mime: type, width: w, height: h };
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  // Saydamlık gerekmiyorsa JPEG çok daha küçük olur.
  const outType = type === 'image/png' ? 'image/png' : 'image/jpeg';
  let blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('toBlob'))), outType, 0.9));
  if (blob.size > MAX_BYTES) {
    blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('toBlob'))), 'image/jpeg', 0.85));
  }
  return { data: blob, mime: blob.type || outType, width: canvas.width, height: canvas.height };
}

/** Kullanıcı vazgeçerse null. Hata kodları: 'unsupported-type', 'pdf-failed', 'too-large'. */
export async function pickDesign(): Promise<PickedDesign | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: [...OK_TYPES, 'application/pdf'], multiple: false, base64: false });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  const file: Blob | undefined = a.file ?? (a.uri ? await (await fetch(a.uri)).blob() : undefined);
  if (!file) return null;
  const type = (a.mimeType || file.type || '').toLowerCase();
  if (file.size > 40 * 1024 * 1024) throw new Error('too-large');

  if (type === 'application/pdf' || a.name?.toLowerCase().endsWith('.pdf')) {
    try {
      const r = await renderPdfFirstPage(await file.arrayBuffer(), MAX_EDGE);
      return normalizeImage(r.blob, 'image/png');
    } catch {
      throw new Error('pdf-failed');
    }
  }
  if (!OK_TYPES.includes(type)) throw new Error('unsupported-type');
  return normalizeImage(file, type);
}
