// Native: fotoğraf, ses ve video seçtirir; fotoğrafları küçültür (yükleme ve depolama tasarrufu).
// Web karşılığı media-pick.web.ts; ikisi aynı arayüzü verir.
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { type AlbumUpload, type PickedFile, type PickedPhoto, ALBUM_VIDEO_TYPES, MAX_AUDIO_BYTES, MAX_PHOTO_EDGE, MAX_VIDEO_BYTES, AUDIO_TYPES, VIDEO_TYPES } from './media-types';

export type { AlbumUpload, PickedFile, PickedPhoto } from './media-types';

async function shrink(uri: string, width: number, height: number, edge: number, base64 = false) {
  const scale = Math.min(1, edge / Math.max(width, height));
  const ctx = ImageManipulator.manipulate(uri);
  if (scale < 1) ctx.resize({ width: Math.round(width * scale), height: null });
  const ref = await ctx.renderAsync();
  return ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.85, base64 });
}

/** Galeriden en fazla `max` fotoğraf; her biri en uzun kenarı 2000 piksel JPEG. */
export async function pickPhotos(max: number): Promise<PickedPhoto[]> {
  if (max <= 0) return [];
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: max > 1, selectionLimit: max, quality: 1, exif: false });
  if (res.canceled || !res.assets?.length) return [];
  const out: PickedPhoto[] = [];
  for (const a of res.assets.slice(0, max)) {
    const r = await shrink(a.uri, a.width || MAX_PHOTO_EDGE, a.height || MAX_PHOTO_EDGE, MAX_PHOTO_EDGE);
    out.push({ data: await new File(r.uri).arrayBuffer(), mime: 'image/jpeg', width: r.width, height: r.height });
  }
  return out;
}

export async function pickPhotoBase64(source: 'library' | 'camera' = 'library'): Promise<{ base64: string; mime: 'image/jpeg' } | null> {
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, exif: false };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  const r = await shrink(a.uri, a.width || 1600, a.height || 1600, 1600, true);
  return r.base64 ? { base64: r.base64, mime: 'image/jpeg' } : null;
}

/** Ses dosyası (mp3, m4a, aac), en fazla 10 MB. */
export async function pickAudio(): Promise<PickedFile | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: AUDIO_TYPES, multiple: false, copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  const file = new File(a.uri);
  if (file.size > MAX_AUDIO_BYTES || (a.size ?? 0) > MAX_AUDIO_BYTES) throw new Error('too-large');
  const mime = (a.mimeType ?? '').toLowerCase();
  const name = (a.name ?? '').toLowerCase();
  const ext = name.endsWith('.m4a') ? 'm4a' : name.endsWith('.aac') ? 'aac' : name.endsWith('.mp3') ? 'mp3' : mime.includes('mpeg') ? 'mp3' : mime.includes('aac') ? 'aac' : 'm4a';
  return { data: await file.arrayBuffer(), mime: ext === 'mp3' ? 'audio/mpeg' : ext === 'aac' ? 'audio/aac' : 'audio/mp4', ext, name: a.name ?? '', size: file.size };
}

/** Video (mp4, mov), en fazla 50 MB. */
export async function pickVideo(): Promise<(PickedFile & { width: number; height: number }) | null> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1, videoMaxDuration: 180 });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  const file = new File(a.uri);
  if (file.size > MAX_VIDEO_BYTES || (a.fileSize ?? 0) > MAX_VIDEO_BYTES) throw new Error('too-large');
  const mime = (a.mimeType ?? '').toLowerCase();
  const ext = mime.includes('quicktime') || a.uri.toLowerCase().endsWith('.mov') ? 'mov' : 'mp4';
  if (mime && !VIDEO_TYPES.includes(mime)) throw new Error('unsupported-type');
  return { data: await file.arrayBuffer(), mime: ext === 'mov' ? 'video/quicktime' : 'video/mp4', ext, name: a.fileName ?? '', size: file.size, width: a.width || 1080, height: a.height || 1920 };
}

/** Albüm için fotoğraf ve video (en fazla `max`); 50 MB'ı aşan videolar atlanır ve `skipped` olarak sayılır. */
export async function pickAlbumMedia(max: number): Promise<{ items: AlbumUpload[]; skipped: number }> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], allowsMultipleSelection: max > 1, selectionLimit: max, quality: 1, exif: false, videoMaxDuration: 180 });
  if (res.canceled || !res.assets?.length) return { items: [], skipped: 0 };
  const items: AlbumUpload[] = [];
  let skipped = 0;
  for (const a of res.assets.slice(0, max)) {
    if (a.type === 'video') {
      const file = new File(a.uri);
      const mime = (a.mimeType ?? '').toLowerCase() || (a.uri.toLowerCase().endsWith('.mov') ? 'video/quicktime' : 'video/mp4');
      if (file.size > MAX_VIDEO_BYTES || !ALBUM_VIDEO_TYPES.includes(mime)) {
        skipped++;
        continue;
      }
      items.push({ data: await file.arrayBuffer(), mime, kind: 'video' });
    } else {
      const r = await shrink(a.uri, a.width || MAX_PHOTO_EDGE, a.height || MAX_PHOTO_EDGE, MAX_PHOTO_EDGE);
      items.push({ data: await new File(r.uri).arrayBuffer(), mime: 'image/jpeg', kind: 'photo' });
    }
  }
  return { items, skipped };
}
