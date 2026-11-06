// Yüz önerisinin küçük yerel kayıtları (web ve uygulama ortak): selfie vektörleri, "bu ben değilim" listesi,
// organizatörün kişi etiketleri. Web'de tarayıcının localStorage'ı, uygulamada expo-sqlite'ın senkron
// localStorage karşılığı kullanılır (storage-polyfill). Yalnızca bu cihazda durur, sunucuya gitmez.
import './storage-polyfill';

import type { Embedding } from '@/core/face-match';

function store(): Storage | null {
  try {
    return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = store()?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJson(key: string, value: unknown): void {
  try {
    store()?.setItem(key, JSON.stringify(value));
  } catch {
    // Özel pencere ya da dolu depolama: bu oturumda çalışır, kalıcı olmaz.
  }
}

export function removeKeys(keys: string[]): void {
  try {
    const s = store();
    for (const k of keys) s?.removeItem(k);
  } catch {
    // yok say
  }
}

export const selfieKey = (slug: string) => `davet:face:${slug}`;
export const rejectedKey = (slug: string) => `davet:face-no:${slug}`;

export function loadSelfies(slug: string): Embedding[] {
  const v = loadJson<unknown>(selfieKey(slug), []);
  if (!Array.isArray(v)) return [];
  return v.filter((e): e is number[] => Array.isArray(e) && e.length > 0 && e.every((n) => typeof n === 'number')).slice(0, 3);
}

export function saveSelfies(slug: string, embeddings: Embedding[]): void {
  saveJson(selfieKey(slug), embeddings);
}

/** "Bu ben değilim" diye elenen fotoğrafların anahtarları (yüz verisi değil, yalnızca fotoğraf kimliği). */
export function loadRejected(slug: string): string[] {
  const v = loadJson<unknown>(rejectedKey(slug), []);
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 2000) : [];
}

export function saveRejected(slug: string, keys: string[]): void {
  saveJson(rejectedKey(slug), keys.slice(-2000));
}
