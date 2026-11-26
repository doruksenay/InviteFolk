// Yüz önerisi motoru (web): yüzleri davetlinin tarayıcısında bulur ve vektöre çevirir.
// Kütüphane (Human) ve modeller kendi alan adımızdan, /face altından yüklenir (CSP "script-src 'self'"); bkz. public/face/README.md.
// Selfie vektörleri yalnızca bu cihazın localStorage'ında, fotoğraf vektörleri yalnızca IndexedDB önbelleğinde durur.
// Sunucuya hiçbir yüz verisi gönderilmez. Kullanıcı "yüzümü sil" derse ya da organizatör özelliği kapatırsa hepsi silinir.
import { type FaceHit, faceSimilarity, mergeFaces, MIN_FACE_PX, MIN_FACE_SCORE } from '@/core/face-match';

import type { FaceEngine, SelfieSource } from './face';
import { rejectedKey, removeKeys, selfieKey } from './face-store';

export type { FaceEngine, SelfieResult, SelfieSource } from './face';
export { loadJson, loadRejected, loadSelfies, saveJson, saveRejected, saveSelfies } from './face-store';

type Face = { embedding?: number[]; box: number[]; score: number };
type HumanInstance = {
  load(): Promise<void>;
  detect(input: unknown, cfg?: unknown): Promise<{ face: Face[] }>;
  match: { similarity(a: number[], b: number[]): number };
};
type HumanCtor = new (cfg: object) => HumanInstance;

declare global {
  interface Window {
    __davetHuman?: HumanCtor;
  }
}

export const FACE_SUPPORTED = typeof window !== 'undefined' && typeof document !== 'undefined';

const MAX_EDGE_GPU = 1280; // işlenen uzun kenar; daha büyük fotoğraflar küçültülür (hız)
const MAX_EDGE_CPU = 960; // WebGL yoksa daha küçük çalışılır, yoksa tarama çok uzar
const MAX_FACES = 40;
// Büyük grup fotoğraflarında (küçültünce yüzler küçülür) parçalara bölerek yeniden taranır.
const TILE_MIN_NATURAL = 1800; // bu uzunluğun altındaki fotoğraflara karo taraması gerekmez
const TILE_TRIGGER_FACES = 5; // bu kadar ya da daha fazla yüz bulunduysa fotoğraf kalabalıktır
const TILE_TRIGGER_PX = 90; // ya da bulunan yüzlerin ortancası bundan küçükse

// ---------------------------------------------------------------------------
// Kütüphaneyi yükle
// ---------------------------------------------------------------------------
let ctorPromise: Promise<HumanCtor> | null = null;

function loadHumanCtor(): Promise<HumanCtor> {
  if (window.__davetHuman) return Promise.resolve(window.__davetHuman);
  if (ctorPromise) return ctorPromise;
  ctorPromise = new Promise<HumanCtor>((resolve, reject) => {
    const fail = (why: string) => {
      ctorPromise = null;
      reject(new Error(why));
    };
    window.addEventListener('davet-human-ready', () => (window.__davetHuman ? resolve(window.__davetHuman) : fail('human')), { once: true });
    const s = document.createElement('script');
    s.type = 'module';
    s.src = '/face/loader.mjs';
    s.onerror = () => fail('human');
    document.head.appendChild(s);
    setTimeout(() => {
      if (!window.__davetHuman) fail('human-timeout');
    }, 30000);
  });
  return ctorPromise;
}

function config(backend: 'webgl' | 'cpu') {
  return {
    backend,
    modelBasePath: '/face/',
    cacheSensitivity: 0,
    filter: { enabled: false },
    debug: false,
    face: {
      enabled: true,
      detector: { rotation: true, maxDetected: MAX_FACES },
      mesh: { enabled: true },
      iris: { enabled: false },
      description: { enabled: true },
      emotion: { enabled: false },
      antispoof: { enabled: false },
      liveness: { enabled: false },
    },
    body: { enabled: false },
    hand: { enabled: false },
    object: { enabled: false },
    gesture: { enabled: false },
    segmentation: { enabled: false },
  };
}

// ---------------------------------------------------------------------------
// Görüntü yardımcıları
// ---------------------------------------------------------------------------
/** Görüntünün (sx,sy,sw,sh) bölgesini en çok `maxEdge` uzun kenara sığacak şekilde tuvale çizer. */
function drawRegion(img: CanvasImageSource, sx: number, sy: number, sw: number, sh: number, maxEdge: number): HTMLCanvasElement {
  const scale = Math.min(1, maxEdge / Math.max(sw, sh));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function loadImage(src: string, cors: boolean): Promise<HTMLImageElement> {
  const img = new Image();
  if (cors) img.crossOrigin = 'anonymous'; // tuvali "kirletmesin" (aksi halde piksel okunamaz)
  img.src = src;
  await img.decode();
  return img;
}

const area = (f: Face) => f.box[2] * f.box[3];
const yieldToUi = () => new Promise<void>((r) => setTimeout(r, 0));
const sideOf = (f: Face) => Math.min(f.box[2], f.box[3]);

// ---------------------------------------------------------------------------
// Motor
// ---------------------------------------------------------------------------
type Engine = FaceEngine & { setSlug(s: string): void };
let enginePromise: Promise<Engine> | null = null;

async function createEngine(): Promise<Engine> {
  const Human = await loadHumanCtor();
  let backend: 'webgl' | 'cpu' = 'webgl';
  let human = new Human(config('webgl'));
  try {
    await human.load();
  } catch {
    // WebGL kullanılamıyorsa (eski cihaz, kısıtlı tarayıcı) yavaş ama çalışan CPU'ya düşer.
    backend = 'cpu';
    human = new Human(config('cpu'));
    await human.load();
  }
  const h = human;
  const maxEdge = backend === 'webgl' ? MAX_EDGE_GPU : MAX_EDGE_CPU;
  let slug = '';
  const pending = new Map<string, Promise<HTMLImageElement>>();

  /** Güvenilir yüzler: algılama skoru yeterli ve yüz yeterince büyük; gerisi gürültülü vektör üretir. */
  const detect = async (canvas: HTMLCanvasElement): Promise<Face[]> => {
    const r = await h.detect(canvas);
    return r.face.filter((f) => f.embedding?.length && f.score >= MIN_FACE_SCORE && sideOf(f) >= MIN_FACE_PX);
  };

  const toHit = (f: Face, ox: number, oy: number, scale: number, w: number, hgt: number): FaceHit & { box: [number, number, number, number] } => ({
    embedding: Array.from(f.embedding!),
    box: [(ox + f.box[0] / scale) / w, (oy + f.box[1] / scale) / hgt, f.box[2] / scale / w, f.box[3] / scale / hgt],
  });

  const scanImage = async (img: HTMLImageElement): Promise<{ hits: FaceHit[]; aspect: number }> => {
    const w = img.naturalWidth;
    const hgt = img.naturalHeight;
    const aspect = w / hgt;
    const scale = Math.min(1, maxEdge / Math.max(w, hgt));
    let found = (await detect(drawRegion(img, 0, 0, w, hgt, maxEdge))).map((f) => ({ f, hit: toHit(f, 0, 0, scale, w, hgt) }));

    const crowded = found.length >= TILE_TRIGGER_FACES || (found.length > 0 && found.map((x) => x.f.box[2]).sort((a, b) => a - b)[Math.floor(found.length / 2)] < TILE_TRIGGER_PX);
    if (Math.max(w, hgt) >= TILE_MIN_NATURAL && crowded) {
      // Örtüşen karolar: yüzler küçültülmeden, yerel çözünürlükte taranır. Çok büyük fotoğraflarda 3×3, diğerlerinde 2×2.
      const n = Math.max(w, hgt) >= 2400 ? 3 : 2;
      const frac = n === 3 ? 0.45 : 0.6;
      const tw = Math.round(w * frac);
      const th = Math.round(hgt * frac);
      const offsets: [number, number][] = [];
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) offsets.push([Math.round(((w - tw) * c) / (n - 1)), Math.round(((hgt - th) * r) / (n - 1))]);
      for (const [ox, oy] of offsets) {
        const tscale = Math.min(1, maxEdge / Math.max(tw, th));
        const extra = (await detect(drawRegion(img, ox, oy, tw, th, maxEdge))).map((f) => ({ f, hit: toHit(f, ox, oy, tscale, w, hgt) }));
        found = found.concat(extra);
        await yieldToUi();
      }
      const kept = mergeFaces(found.map((x) => ({ box: x.hit.box, x })));
      found = kept.map((k) => k.x);
    }
    return { hits: found.map((x) => x.hit), aspect };
  };

  const engine: Engine = {
    backend,
    setSlug: (s) => {
      slug = s;
    },
    similarity: faceSimilarity,
    prefetch(url) {
      if (pending.has(url) || pending.size > 6) return;
      const p = loadImage(url, true);
      p.catch(() => {}); // hata, asıl çağrıda ele alınır
      pending.set(url, p);
    },
    async analyzeSelfie(src) {
      const url = URL.createObjectURL(toBlob(src));
      try {
        const img = await loadImage(url, false);
        const w = img.naturalWidth;
        const hgt = img.naturalHeight;
        const r = await h.detect(drawRegion(img, 0, 0, w, hgt, maxEdge));
        const faces = r.face.filter((f) => f.embedding?.length).sort((a, b) => area(b) - area(a));
        if (!faces.length) return { status: 'no_face' };
        const main = faces[0];
        // İkinci büyük yüz ana yüzün yarısından büyükse kimin aranacağı belli değildir.
        if (faces[1] && area(faces[1]) > area(main) * 0.5) return { status: 'multiple' };
        const scale = Math.min(1, maxEdge / Math.max(w, hgt));
        if (main.box[2] < 90 || main.box[3] < 90 || main.box[2] * main.box[3] < 0.04 * canvasArea(w, hgt, scale)) return { status: 'small' };
        if (main.score < 0.75) return { status: 'low_quality' };
        // Küçük bir yüz önizlemesi (yalnızca bu oturumda ekranda görünür, saklanmaz).
        const m = Math.max(main.box[2], main.box[3]) * 1.5;
        const cx = main.box[0] + main.box[2] / 2;
        const cy = main.box[1] + main.box[3] / 2;
        const pv = document.createElement('canvas');
        pv.width = 96;
        pv.height = 96;
        pv.getContext('2d')?.drawImage(img, (cx - m / 2) / scale, (cy - m / 2) / scale, m / scale, m / scale, 0, 0, 96, 96);
        return { status: 'ok', embedding: Array.from(main.embedding!), preview: pv.toDataURL('image/jpeg', 0.8) };
      } finally {
        URL.revokeObjectURL(url);
      }
    },
    async embedUrl(url, cacheKey) {
      const key = cacheKey ?? url.split('?')[0];
      const hit = await cacheGet(slug, key);
      if (hit) {
        pending.delete(url);
        return hit.faces;
      }
      const img = await (pending.get(url) ?? loadImage(url, true));
      pending.delete(url);
      const { hits, aspect } = await scanImage(img);
      await cachePut(slug, key, { aspect, faces: hits });
      await yieldToUi();
      return hits;
    },
  };
  return engine;
}

const canvasArea = (w: number, hgt: number, scale: number) => w * scale * hgt * scale;

/** Motoru bir kez yükler (kütüphane + modeller yaklaşık 9 MB; yalnızca özellik kullanılınca indirilir). */
export function loadFaceEngine(slug?: string): Promise<FaceEngine> {
  enginePromise ??= createEngine().catch((e) => {
    enginePromise = null;
    throw e;
  });
  return enginePromise.then((e) => {
    if (slug) e.setSlug(slug);
    return e;
  });
}

// ---------------------------------------------------------------------------
// Selfie seçimi
// ---------------------------------------------------------------------------
/** Ön kamerayı (camera) ya da galeriyi (gallery) açar; iptal edilirse null döner. */
export function pickSelfie(source: 'camera' | 'gallery'): Promise<SelfieSource | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (source === 'camera') input.setAttribute('capture', 'user');
    input.style.display = 'none';
    let settled = false;
    const done = (f: File | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(f);
    };
    input.addEventListener('change', () => done(input.files?.[0] ?? null));
    input.addEventListener('cancel', () => done(null));
    document.body.appendChild(input);
    input.click();
  });
}

/** Selfie girdisi: web'de seçilen dosya, uygulamada (WebView köprüsü) data URL. */
function toBlob(src: SelfieSource): Blob {
  if (src instanceof Blob) return src;
  const [head, body] = src.dataUrl.split(',', 2);
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? 'image/jpeg';
  const bin = atob(body ?? '');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

// ---------------------------------------------------------------------------
// Fotoğraf önbelleği (IndexedDB, yalnızca bu cihaz)
// ---------------------------------------------------------------------------
const DB = 'davet-face';
const STORE = 'photos';
const CACHE_V = 'v2'; // v1: yalnızca vektör dizisi; v2: vektör + konum + en/boy oranı. Eski kayıtlar okunmaz.

type CacheEntry = { aspect: number; faces: FaceHit[] };

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

const dbKey = (slug: string, key: string) => `${slug}|${CACHE_V}|${key}`;

type Stored = { v: 2; aspect: number; faces: { e: Float32Array; b: [number, number, number, number] }[] };

/** Önbellekten okur; yoksa null. */
export async function cacheGet(slug: string, key: string): Promise<CacheEntry | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(dbKey(slug, key));
      req.onsuccess = () => {
        const v = req.result as Stored | undefined;
        db.close();
        resolve(v && v.v === 2 && Array.isArray(v.faces) ? { aspect: v.aspect, faces: v.faces.map((f) => ({ embedding: Array.from(f.e), box: f.b })) } : null);
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

async function cachePut(slug: string, key: string, entry: CacheEntry): Promise<void> {
  const db = await openDb();
  if (!db) return;
  const value: Stored = { v: 2, aspect: entry.aspect, faces: entry.faces.map((f) => ({ e: Float32Array.from(f.embedding), b: f.box })) };
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, dbKey(slug, key));
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

/** Bu etkinliğe ait tüm yerel yüz verisini siler: selfie vektörleri, fotoğraf önbelleği, elenenler. */
export async function clearFaceData(slug: string): Promise<void> {
  removeKeys([selfieKey(slug), rejectedKey(slug)]);
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const prefix = `${slug}|`;
      const cursorReq = store.openCursor();
      cursorReq.onsuccess = () => {
        const c = cursorReq.result;
        if (!c) return;
        if (String(c.key).startsWith(prefix)) c.delete();
        c.continue();
      };
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}
