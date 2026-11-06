// Yüz önerisi motoru: yalnızca web'de (kullanıcının tarayıcısı) vardır. Uygulama sürümünde kapalıdır.
import type { Embedding, FaceHit } from '@/core/face-match';

/** Selfie analizinin sonucu: kullanılabilir mi, değilse neden. */
export type SelfieResult =
  | { status: 'ok'; embedding: Embedding; preview: string }
  | { status: 'no_face' | 'multiple' | 'small' | 'low_quality' };

export type FaceEngine = {
  /** Selfie'yi çözümler: tek, yeterince büyük ve net bir yüz arar. */
  analyzeSelfie(file: Blob): Promise<SelfieResult>;
  /** Sıradaki fotoğrafı arka planda indirip çözer, böylece tarama beklemeden devam eder. */
  prefetch(url: string): void;
  /** Fotoğraftaki güvenilir yüzler (önbellek kullanır). Büyük grup fotoğraflarında karo taraması yapar. */
  embedUrl(url: string, cacheKey?: string): Promise<FaceHit[]>;
  similarity(a: Embedding, b: Embedding): number;
  /** Kullanılan altyapı: webgl hızlı, cpu yavaş. */
  backend: 'webgl' | 'cpu';
};

export const FACE_SUPPORTED = false;

const off = () => Promise.reject(new Error('face_unsupported'));
export const loadFaceEngine = (_slug?: string): Promise<FaceEngine> => off();
export const pickSelfie = (_source: 'camera' | 'gallery'): Promise<File | null> => Promise.resolve(null);
export const loadSelfies = (_slug: string): Embedding[] => [];
export const saveSelfies = (_slug: string, _e: Embedding[]): void => {};
export const loadRejected = (_slug: string): string[] => [];
export const saveRejected = (_slug: string, _keys: string[]): void => {};
/** Bu etkinliğe ait tüm yerel yüz verisini siler (selfie vektörleri, fotoğraf önbelleği, elenenler). */
export const clearFaceData = (_slug: string): Promise<void> => Promise.resolve();
export const loadJson = <T,>(_key: string, fallback: T): T => fallback;
export const saveJson = (_key: string, _value: unknown): void => {};
