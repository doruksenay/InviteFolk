# Yüz önerisi dosyaları

Bu klasörde git'te yalnızca `loader.mjs`, `bridge.html`, `bridge.mjs` ve bu dosya durur. Gerisini
`npm run vendor:face` üretir (`npm run web` ve `npm run build:web` bunu kendiliğinden yapar):

- `human.esm.js` ve modeller (`blazeface`, `facemesh`, `faceres`): `node_modules/@vladmandic/*` paketlerinden kopyalanır.
- `engine/*.mjs`: `src/lib/face.web.ts` ve bağımlılıklarının tipleri silinmiş JavaScript hâli. Yalnızca köprü sayfası kullanır.

## Uygulama içi köprü

iOS/Android uygulaması yüz motorunu kendi içinde çalıştırmaz; web sitesindeki `/face/bridge.html` sayfasını
görünmez bir WebView'da açar (`src/lib/face-bridge.ts`, `src/ui/FaceBridgeHost.tsx`). Sayfa web sürümündeki
motorun aynısını telefonun kendi tarayıcı motorunda çalıştırır; böylece web ve uygulama aynı modeli ve aynı eşikleri
kullanır. Uygulamanın köprüyü bulabilmesi için `EXPO_PUBLIC_WEB_URL` tanımlı ve site yayında olmalıdır.

Kütüphane ve modeller [Human](https://github.com/vladmandic/human) projesindendir (MIT lisansı, bkz. `LICENSE`).
Hepsi kullanıcının cihazında çalışır; yüz verisi hiçbir sunucuya gönderilmez.
