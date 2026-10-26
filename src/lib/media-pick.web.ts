// Web: fotoğraf, ses ve video seçtirir; fotoğrafları tuvalde küçültür.
import * as DocumentPicker from 'expo-document-picker';

import { type AlbumUpload, type PickedFile, type PickedPhoto, ALBUM_VIDEO_TYPES, MAX_AUDIO_BYTES, MAX_PHOTO_EDGE, MAX_VIDEO_BYTES, AUDIO_TYPES, VIDEO_TYPES } from './media-types';

export type { AlbumUpload, PickedFile, PickedPhoto } from './media-types';

async function loadImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

async function toJpeg(file: Blob, edge: number): Promise<{ blob: Blob; width: number; height: number }> {
  const img = await loadImage(file);
  const scale = Math.min(1, edge / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('toBlob'))), 'image/jpeg', 0.85));
  return { blob, width: canvas.width, height: canvas.height };
}

async function fileOf(a: DocumentPicker.DocumentPickerAsset): Promise<Blob | null> {
  return a.file ?? (a.uri ? await (await fetch(a.uri)).blob() : null);
}

export async function pickPhotos(max: number): Promise<PickedPhoto[]> {
  if (max <= 0) return [];
  const res = await DocumentPicker.getDocumentAsync({ type: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'], multiple: max > 1 });
  if (res.canceled || !res.assets?.length) return [];
  const out: PickedPhoto[] = [];
  for (const a of res.assets.slice(0, max)) {
    const f = await fileOf(a);
    if (!f || f.size > 40 * 1024 * 1024) continue;
    try {
      const r = await toJpeg(f, MAX_PHOTO_EDGE);
      out.push({ data: r.blob, mime: 'image/jpeg', width: r.width, height: r.height });
    } catch {
      // Tarayıcının açamadığı biçim (ör. bazı HEIC dosyaları) atlanır.
    }
  }
  return out;
}

export async function pickAudio(): Promise<PickedFile | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: AUDIO_TYPES, multiple: false });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  const f = await fileOf(a);
  if (!f) return null;
  if (f.size > MAX_AUDIO_BYTES) throw new Error('too-large');
  const name = (a.name ?? '').toLowerCase();
  const mime = (a.mimeType || f.type || '').toLowerCase();
  const ext = name.endsWith('.m4a') ? 'm4a' : name.endsWith('.aac') ? 'aac' : name.endsWith('.mp3') || mime.includes('mpeg') ? 'mp3' : mime.includes('aac') ? 'aac' : 'm4a';
  return { data: f, mime: ext === 'mp3' ? 'audio/mpeg' : ext === 'aac' ? 'audio/aac' : 'audio/mp4', ext, name: a.name ?? '', size: f.size };
}

export async function pickVideo(): Promise<(PickedFile & { width: number; height: number }) | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: VIDEO_TYPES, multiple: false });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  const f = await fileOf(a);
  if (!f) return null;
  if (f.size > MAX_VIDEO_BYTES) throw new Error('too-large');
  const mime = (a.mimeType || f.type || '').toLowerCase();
  if (mime && !VIDEO_TYPES.includes(mime)) throw new Error('unsupported-type');
  const ext = mime.includes('quicktime') || (a.name ?? '').toLowerCase().endsWith('.mov') ? 'mov' : 'mp4';
  const dims = await new Promise<{ width: number; height: number }>((resolve) => {
    const v = document.createElement('video');
    const url = URL.createObjectURL(f);
    v.preload = 'metadata';
    v.onloadedmetadata = () => {
      resolve({ width: v.videoWidth || 1080, height: v.videoHeight || 1920 });
      URL.revokeObjectURL(url);
    };
    v.onerror = () => {
      resolve({ width: 1080, height: 1920 });
      URL.revokeObjectURL(url);
    };
    v.src = url;
  });
  return { data: f, mime: ext === 'mov' ? 'video/quicktime' : 'video/mp4', ext, name: a.name ?? '', size: f.size, ...dims };
}

/** Albüm için fotoğraf ve video (en fazla `max`); fotoğraflar küçültülür, 50 MB'ı aşan videolar atlanır. */
export async function pickAlbumMedia(max: number): Promise<{ items: AlbumUpload[]; skipped: number }> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['image/*', ...ALBUM_VIDEO_TYPES], multiple: max > 1 });
  if (res.canceled || !res.assets?.length) return { items: [], skipped: 0 };
  const items: AlbumUpload[] = [];
  let skipped = 0;
  for (const a of res.assets.slice(0, max)) {
    const f = await fileOf(a);
    if (!f) continue;
    const mime = (a.mimeType || f.type || '').toLowerCase();
    if (mime.startsWith('video/')) {
      if (f.size > MAX_VIDEO_BYTES || !ALBUM_VIDEO_TYPES.includes(mime)) {
        skipped++;
        continue;
      }
      items.push({ data: f, mime, kind: 'video' });
      continue;
    }
    if (f.size > 40 * 1024 * 1024) {
      skipped++;
      continue;
    }
    try {
      const r = await toJpeg(f, MAX_PHOTO_EDGE);
      items.push({ data: r.blob, mime: 'image/jpeg', kind: 'photo' });
    } catch {
      skipped++;
    }
  }
  return { items, skipped };
}
