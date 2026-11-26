// Yüz önerisi motoru, uygulama (iOS/Android) sürümü. Web sürümü face.web.ts'tir; ikisi aynı arayüzü verir.
// Uygulamada motor, web sitemizdeki köprü sayfasını görünmez bir WebView'da çalıştırır (bkz. face-bridge.ts):
// aynı kütüphane, aynı modeller, aynı eşikler. Yüzler telefonda işlenir; sunucuya yüz verisi gitmez.
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { type Embedding, type FaceHit, faceSimilarity } from '@/core/face-match';

import { BRIDGE_URL, callBridge, requestBridge, sendBridge } from './face-bridge';
import { loadJson, rejectedKey, removeKeys, saveJson, selfieKey } from './face-store';

export { loadJson, loadRejected, loadSelfies, saveJson, saveRejected, saveSelfies } from './face-store';

/** Selfie analizinin sonucu: kullanılabilir mi, değilse neden. */
export type SelfieResult =
  | { status: 'ok'; embedding: Embedding; preview: string }
  | { status: 'no_face' | 'multiple' | 'small' | 'low_quality' };

/** Selfie girdisi: web'de seçilen dosya, uygulamada küçültülmüş fotoğrafın data URL'i. */
export type SelfieSource = Blob | { dataUrl: string };

export type FaceEngine = {
  /** Selfie'yi çözümler: tek, yeterince büyük ve net bir yüz arar. */
  analyzeSelfie(src: SelfieSource): Promise<SelfieResult>;
  /** Sıradaki fotoğrafı arka planda indirip çözer, böylece tarama beklemeden devam eder. */
  prefetch(url: string): void;
  /** Fotoğraftaki güvenilir yüzler (önbellek kullanır). Büyük grup fotoğraflarında karo taraması yapar. */
  embedUrl(url: string, cacheKey?: string): Promise<FaceHit[]>;
  similarity(a: Embedding, b: Embedding): number;
  /** Kullanılan altyapı: webgl hızlı, cpu yavaş. */
  backend: 'webgl' | 'cpu';
};

/** Uygulamada köprü sayfası için web adresi (EXPO_PUBLIC_WEB_URL) gerekir. */
export const FACE_SUPPORTED = !!BRIDGE_URL;

// Köprünün önbelleğinde bu etkinliğe ait veri olabilir mi? Silerken gereksiz yere WebView açmamak için.
const usedKey = (slug: string) => `davet:face-used:${slug}`;

const MODEL_TIMEOUT = 90_000; // ilk açılışta ~9 MB kütüphane + model indirilir
const PHOTO_TIMEOUT = 180_000; // kalabalık büyük fotoğraf, WebGL yoksa uzun sürebilir

let initPromise: Promise<'webgl' | 'cpu'> | null = null;

function init(): Promise<'webgl' | 'cpu'> {
  initPromise ??= callBridge<{ backend: 'webgl' | 'cpu' }>('init', {}, MODEL_TIMEOUT)
    .then((r) => (r.backend === 'webgl' ? 'webgl' : 'cpu'))
    .catch((e) => {
      initPromise = null;
      throw e;
    });
  return initPromise;
}

/** Motoru bir kez yükler; `slug` her çağrıda köprüye ayrıca bildirilir (önbellek etkinlik başına ayrılır). */
export async function loadFaceEngine(slug?: string): Promise<FaceEngine> {
  if (!FACE_SUPPORTED) throw new Error('face_unsupported');
  let backend: 'webgl' | 'cpu';
  try {
    backend = await init();
  } catch (e) {
    // Köprü çöktüyse bir sonraki denemede yeniden kurulur.
    initPromise = null;
    throw e;
  }
  const s = slug ?? '';
  if (s) saveJson(usedKey(s), 1);
  return {
    backend,
    similarity: faceSimilarity,
    analyzeSelfie: (src) => {
      if (src instanceof Blob) return Promise.reject(new Error('face_selfie_blob'));
      return callBridge<SelfieResult>('selfie', { slug: s, dataUrl: src.dataUrl }, MODEL_TIMEOUT);
    },
    prefetch: (url) => sendBridge('prefetch', { slug: s, url }),
    embedUrl: (url, key) => callBridge<FaceHit[]>('embedUrl', { slug: s, url, key }, PHOTO_TIMEOUT),
  };
}

/** Ön kamerayı (camera) ya da galeriyi (gallery) açar; fotoğraf 1280 piksele küçültülür. İptalde null. */
export async function pickSelfie(source: 'camera' | 'gallery'): Promise<SelfieSource | null> {
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, exif: false, cameraType: ImagePicker.CameraType.front };
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return null;
  }
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  const w = a.width || 1280;
  const h = a.height || 1280;
  const scale = Math.min(1, 1280 / Math.max(w, h));
  const ctx = ImageManipulator.manipulate(a.uri);
  if (scale < 1) ctx.resize({ width: Math.round(w * scale), height: null });
  const out = await (await ctx.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.85, base64: true });
  return out.base64 ? { dataUrl: `data:image/jpeg;base64,${out.base64}` } : null;
}

/** Bu etkinliğe ait tüm yerel yüz verisini siler: selfie vektörleri, elenenler ve köprünün fotoğraf önbelleği. */
export async function clearFaceData(slug: string): Promise<void> {
  removeKeys([selfieKey(slug), rejectedKey(slug)]);
  if (!FACE_SUPPORTED || !loadJson<number>(usedKey(slug), 0)) return;
  try {
    await requestBridge();
    await callBridge('clear', { slug }, 15_000);
    removeKeys([usedKey(slug)]);
  } catch {
    // Köprü açılamadıysa işaret kalır; bir sonraki silmede yeniden denenir.
  }
}
