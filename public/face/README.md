# Yüz önerisi dosyaları

Bu klasörde yalnızca `loader.mjs` ve bu dosya git'te durur. `human.esm.js` ve model dosyaları
(`blazeface`, `facemesh`, `faceres`) `npm run vendor:face` ile `node_modules/@vladmandic/*` paketlerinden kopyalanır;
`npm run web` ve `npm run build:web` bunu kendiliğinden yapar.

Kütüphane ve modeller [Human](https://github.com/vladmandic/human) projesindendir (MIT lisansı, bkz. `LICENSE`).
Hepsi davetlinin tarayıcısında çalışır; yüz verisi hiçbir sunucuya gönderilmez.
