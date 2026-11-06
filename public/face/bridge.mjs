// Uygulama içi köprü: uygulamanın görünmez WebView'ında çalışır (src/lib/face-bridge.ts, src/ui/FaceBridgeHost.tsx).
// Web sürümündeki motorun aynısını kullanır: ./engine/*.mjs, src/lib/face.web.ts'ten scripts/vendor-face.mjs ile üretilir.
// Mesajlar yalnızca uygulamadan gelir (injectJavaScript); yanıtlar ReactNativeWebView.postMessage ile döner.
// Yüz verisi bu sayfadan dışarıya, sunucuya gönderilmez; yalnızca uygulamaya geri verilir.
import { clearFaceData, loadFaceEngine } from './engine/face.web.mjs';

const send = (m) => {
  try {
    window.ReactNativeWebView?.postMessage(JSON.stringify(m));
  } catch {
    // uygulama dışında açıldıysa sessizce dur
  }
};

const ops = {
  async init() {
    const engine = await loadFaceEngine();
    return { backend: engine.backend };
  },
  async selfie({ slug, dataUrl }) {
    const engine = await loadFaceEngine(slug || undefined);
    return engine.analyzeSelfie({ dataUrl });
  },
  async embedUrl({ slug, url, key }) {
    const engine = await loadFaceEngine(slug || undefined);
    return engine.embedUrl(url, key);
  },
  async prefetch({ slug, url }) {
    const engine = await loadFaceEngine(slug || undefined);
    engine.prefetch(url);
  },
  async clear({ slug }) {
    if (slug) await clearFaceData(slug);
    return true;
  },
};

window.__faceIn = (m) => {
  const fn = m && typeof m.op === 'string' && Object.hasOwn(ops, m.op) ? ops[m.op] : null;
  if (!fn) {
    if (m && typeof m.id === 'number') send({ id: m.id, ok: false, error: 'unknown_op' });
    return;
  }
  Promise.resolve()
    .then(() => fn(m))
    .then(
      (result) => typeof m.id === 'number' && send({ id: m.id, ok: true, result: result ?? null }),
      (e) => typeof m.id === 'number' && send({ id: m.id, ok: false, error: String((e && e.message) || e) }),
    );
};

send({ op: 'ready' });
