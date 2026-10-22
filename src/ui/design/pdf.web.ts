// Web: PDF'nin ilk sayfasını yüksek çözünürlüklü bir PNG'ye çevirir.
// pdf.js paket dışında, aynı kökenden (/pdfjs) modül olarak yüklenir; böylece CSP "script-src 'self'" bozulmaz
// ve uygulama paketi büyümez. Yalnızca kullanıcı PDF seçtiğinde indirilir.

type PdfJs = {
  getDocument: (src: Record<string, unknown>) => { promise: Promise<PdfDoc>; destroy: () => Promise<void> };
};
type PdfDoc = { numPages: number; getPage: (n: number) => Promise<PdfPage> };
type PdfPage = {
  getViewport: (o: { scale: number }) => { width: number; height: number };
  render: (o: Record<string, unknown>) => { promise: Promise<void> };
};

declare global {
  interface Window {
    __davetPdfjs?: PdfJs;
  }
}

let loading: Promise<PdfJs> | null = null;

function loadPdfJs(): Promise<PdfJs> {
  if (window.__davetPdfjs) return Promise.resolve(window.__davetPdfjs);
  if (loading) return loading;
  loading = new Promise<PdfJs>((resolve, reject) => {
    const done = () => (window.__davetPdfjs ? resolve(window.__davetPdfjs) : reject(new Error('pdfjs')));
    window.addEventListener('davet-pdfjs-ready', done, { once: true });
    const s = document.createElement('script');
    s.type = 'module';
    s.src = '/pdfjs/loader.mjs';
    s.onerror = () => {
      loading = null;
      reject(new Error('pdfjs'));
    };
    document.head.appendChild(s);
    setTimeout(() => {
      if (!window.__davetPdfjs) {
        loading = null;
        reject(new Error('pdfjs-timeout'));
      }
    }, 20000);
  });
  return loading;
}

/** İlk sayfayı uzun kenarı en fazla `maxEdge` piksel olacak şekilde PNG'ye çizer. */
export async function renderPdfFirstPage(data: ArrayBuffer, maxEdge = 2400): Promise<{ blob: Blob; width: number; height: number }> {
  const pdfjs = await loadPdfJs();
  const task = pdfjs.getDocument({
    data: new Uint8Array(data),
    isEvalSupported: false, // CSP: eval kullanma
    standardFontDataUrl: '/pdfjs/standard_fonts/',
    disableAutoFetch: true,
  });
  try {
    const doc = await task.promise;
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(4, maxEdge / Math.max(base.width, base.height));
    const vp = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(vp.width);
    canvas.height = Math.round(vp.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport: vp }).promise;
    const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('toBlob'))), 'image/png'));
    return { blob, width: canvas.width, height: canvas.height };
  } finally {
    await task.destroy();
  }
}
