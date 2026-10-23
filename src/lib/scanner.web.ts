// Web: tarayıcıda yerleşik BarcodeDetector yoksa (iOS Safari, Firefox) expo-camera "barcode-detector" yedeğini kullanır.
// O yedek varsayılan olarak WASM dosyasını bir CDN'den indirir; CSP buna izin vermez ve vermemeli.
// Dosyayı kendi alan adımızdan sunuyoruz: public/zxing/zxing_reader.wasm (zxing-wasm sürümüyle aynı olmalı).
let ready: Promise<void> | null = null;

export function prepareScanner(): Promise<void> {
  if (typeof globalThis !== 'undefined' && 'BarcodeDetector' in globalThis) return Promise.resolve();
  if (!ready) {
    ready = import('barcode-detector')
      .then((m) => {
        m.setZXingModuleOverrides({
          locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? '/zxing/zxing_reader.wasm' : prefix + path),
        });
      })
      .catch(() => {
        ready = null;
      });
  }
  return ready;
}
