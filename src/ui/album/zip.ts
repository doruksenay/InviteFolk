// Albümü toplu indirme: imzalı adreslerden dosyaları sırayla indirip sıkıştırmadan zip'ler (fotoğraf ve video zaten sıkışık).
// Bellek dolmasın diye ~400 MB'ta bir parçayı bitirip yenisine geçer: "album-1.zip", "album-2.zip"…
import type { AlbumItem } from '@/lib/api-tools';
import { shareBinaryFile } from '@/ui/guests/fileio';

const PART_BYTES = 400 * 1024 * 1024;

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/aac': 'aac',
};

function safe(s: string) {
  return s
    .normalize('NFKD')
    .replace(/[^\w\- ]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40);
}

export function fileNameFor(p: Pick<AlbumItem, 'created_at' | 'content_type' | 'uploader' | 'kind'>, n: number) {
  const d = new Date(p.created_at);
  const pad = (x: number) => String(x).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const who = p.uploader ? safe(p.uploader) : '';
  const ext = EXT[p.content_type.split(';')[0].trim().toLowerCase()] ?? (p.kind === 'video' ? 'mp4' : p.kind === 'audio' ? 'm4a' : 'jpg');
  return `${String(n).padStart(4, '0')}-${stamp}${who ? `-${who}` : ''}.${ext}`;
}

export type ZipProgress = { done: number; total: number; part: number };

/** Dosyaları indirip zip olarak paylaşır/indirir. İndirilemeyenler atlanır; sayısı döner. */
export async function downloadAlbumZip(items: AlbumItem[], base: string, onProgress: (p: ZipProgress) => void, signal?: { cancelled: boolean }): Promise<{ saved: number; failed: number; parts: number }> {
  const { zipSync } = await import('fflate');
  const list = items.filter((p) => p.url);
  let files: Record<string, [Uint8Array, { level: 0 }]> = {};
  let size = 0;
  let part = 1;
  let saved = 0;
  let failed = items.length - list.length;
  let parts = 0;

  const flush = async (last: boolean) => {
    if (!Object.keys(files).length) return;
    const bytes = zipSync(files);
    const name = last && part === 1 ? `${base}.zip` : `${base}-${part}.zip`;
    await shareBinaryFile(name, bytes, 'application/zip', 'public.zip-archive');
    parts++;
    part++;
    files = {};
    size = 0;
  };

  for (let i = 0; i < list.length; i++) {
    if (signal?.cancelled) break;
    onProgress({ done: i, total: list.length, part });
    const p = list[i];
    try {
      const res = await fetch(p.url!);
      if (!res.ok) throw new Error(String(res.status));
      const buf = new Uint8Array(await res.arrayBuffer());
      if (size && size + buf.byteLength > PART_BYTES) await flush(false);
      files[fileNameFor(p, i + 1)] = [buf, { level: 0 }];
      size += buf.byteLength;
      saved++;
    } catch {
      failed++;
    }
  }
  if (!signal?.cancelled) await flush(true);
  onProgress({ done: list.length, total: list.length, part });
  return { saved, failed, parts };
}
