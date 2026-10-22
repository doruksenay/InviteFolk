pdf.js (Mozilla, Apache-2.0) — `node_modules/pdfjs-dist/legacy/build` dosyalarının kopyası.
pdfjs-dist sürümü güncellenince bu klasörü yeniden kopyalayın:

    cp node_modules/pdfjs-dist/legacy/build/pdf.min.mjs node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs public/pdfjs/
    cp -r node_modules/pdfjs-dist/standard_fonts public/pdfjs/

Uygulama paketine girmez; yalnızca web panelinde PDF yüklenirken `/pdfjs/loader.mjs` ile yüklenir.
