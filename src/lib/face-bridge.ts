// Uygulama (iOS/Android): yüz motoru, web sitemizdeki /face/bridge.html sayfasını görünmez bir WebView'da
// açarak çalışır. Sayfa web sürümündeki motorun aynısını (Human + aynı modeller) telefonun kendi tarayıcı
// motorunda çalıştırır; yüz işleme yine cihazda kalır, sunucuya yüz verisi gitmez.
// Bu dosya yalnızca mesajlaşmayı yönetir; WebView'ı ekrana koyan bileşen src/ui/FaceBridgeHost.tsx.

export type BridgeView = { injectJavaScript(script: string): void };

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> };

const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? '').replace(/\/$/, '');

/** Köprü sayfasının adresi; web adresi tanımlı değilse köprü kullanılamaz. */
export const BRIDGE_URL = WEB_URL ? `${WEB_URL}/face/bridge.html` : '';
export const BRIDGE_ORIGIN = WEB_URL ? WEB_URL.replace(/^(https?:\/\/[^/]+).*$/, '$1') : '';

let wanted = false;
let generation = 0; // WebView her yeniden kurulduğunda artar (çökme ya da hata sonrası temiz başlangıç)
const listeners = new Set<() => void>();
let view: BridgeView | null = null;
let readyPromise: Promise<void> | null = null;
let readyResolve: (() => void) | null = null;
let readyReject: ((e: Error) => void) | null = null;
const pending = new Map<number, Pending>();
let nextId = 1;

const notify = () => listeners.forEach((l) => l());

/** Barındırıcı bileşen için: WebView kurulmalı mı, hangi kuşak. */
export function bridgeSnapshot(): string {
  return wanted ? `on:${generation}` : 'off';
}

export function subscribeBridge(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function attachBridgeView(v: BridgeView | null): void {
  view = v;
}

/** WebView'ı kurdurur ve sayfanın hazır olmasını bekler (modeller henüz yüklenmez). */
export function requestBridge(timeoutMs = 30000): Promise<void> {
  if (!BRIDGE_URL) return Promise.reject(new Error('face_bridge_url'));
  if (readyPromise) return readyPromise;
  readyPromise = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => fail(new Error('face_bridge_timeout')), timeoutMs);
    readyResolve = () => {
      clearTimeout(timer);
      resolve();
    };
    readyReject = (e) => {
      clearTimeout(timer);
      reject(e);
    };
  });
  // Başarısız bir hazırlık bir sonraki denemede baştan kurulur.
  readyPromise.catch(() => undefined);
  wanted = true;
  notify();
  return readyPromise;
}

/** Sayfa yüklenemedi ya da WebView çöktü: bekleyen her şeyi reddet, bir sonraki istekte yeniden kur. */
export function failBridge(reason: string): void {
  fail(new Error(reason));
}

function fail(e: Error) {
  const rej = readyReject;
  readyPromise = null;
  readyResolve = null;
  readyReject = null;
  rej?.(e);
  for (const [, p] of pending) {
    clearTimeout(p.timer);
    p.reject(e);
  }
  pending.clear();
  generation += 1;
  notify();
}

/** WebView'dan gelen mesaj. */
export function receiveBridgeMessage(raw: string): void {
  let m: { op?: string; id?: number; ok?: boolean; result?: unknown; error?: string };
  try {
    m = JSON.parse(raw);
  } catch {
    return;
  }
  if (m.op === 'ready') {
    readyResolve?.();
    return;
  }
  if (typeof m.id !== 'number') return;
  const p = pending.get(m.id);
  if (!p) return;
  pending.delete(m.id);
  clearTimeout(p.timer);
  if (m.ok) p.resolve(m.result);
  else p.reject(new Error(m.error || 'face_bridge_error'));
}

function post(msg: object) {
  if (!view) throw new Error('face_bridge_view');
  // JSON.stringify bir JS ifadesi üretir; ek kaçışa gerek yoktur. Sondaki "true" WebView'ın uyarısını önler.
  view.injectJavaScript(`window.__faceIn && window.__faceIn(${JSON.stringify(msg)}); true;`);
}

/** Yanıt beklemeyen mesaj (ör. önden indirme). */
export function sendBridge(op: string, payload: object): void {
  try {
    post({ op, ...payload });
  } catch {
    // köprü yoksa önden indirme önemsizdir
  }
}

/** Yanıt bekleyen çağrı. */
export async function callBridge<T>(op: string, payload: object, timeoutMs: number): Promise<T> {
  // Beklerken köprü çöküp yeniden kurulduysa eski WebView'a yazmamak için güncel hazırlığı bekle.
  let ready = requestBridge();
  await ready;
  while (readyPromise !== ready) {
    ready = requestBridge();
    await ready;
  }
  const id = nextId++;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('face_bridge_timeout'));
    }, timeoutMs);
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer });
    try {
      post({ op, id, ...payload });
    } catch (e) {
      clearTimeout(timer);
      pending.delete(id);
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
}
