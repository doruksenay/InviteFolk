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

/** Selfie vektörleri bu cihazda en fazla 30 gün tutulur; süresi geçen ya da zaman damgasız (eski sürüm) kayıt silinir. */
export const SELFIE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function loadSelfies(slug: string): Embedding[] {
  const v = loadJson<unknown>(selfieKey(slug), null);
  const rec = v && typeof v === 'object' && !Array.isArray(v) ? (v as { at?: unknown; list?: unknown }) : null;
  if (!rec || typeof rec.at !== 'number' || Date.now() - rec.at >= SELFIE_TTL_MS || !Array.isArray(rec.list)) {
    if (v !== null) removeKeys([selfieKey(slug), rejectedKey(slug)]);
    return [];
  }
  return rec.list.filter((e): e is number[] => Array.isArray(e) && e.length > 0 && e.every((n) => typeof n === 'number')).slice(0, 3);
}

export function saveSelfies(slug: string, embeddings: Embedding[]): void {
  if (!embeddings.length) {
    removeKeys([selfieKey(slug)]);
    return;
  }
  saveJson(selfieKey(slug), { at: Date.now(), list: embeddings });
}

/** "Bu ben değilim" diye elenen fotoğrafların anahtarları (yüz verisi değil, yalnızca fotoğraf kimliği). */
export function loadRejected(slug: string): string[] {
  const v = loadJson<unknown>(rejectedKey(slug), []);
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 2000) : [];
}

export function saveRejected(slug: string, keys: string[]): void {
  saveJson(rejectedKey(slug), keys.slice(-2000));
}
