// pdf.js'i (Metro paketine girmeden) aynı kökenden yükler; CSP "script-src 'self'" ile uyumlu.
// Davet web paneli PDF davetiyelerin ilk sayfasını görsele çevirmek için kullanır.
import * as pdfjsLib from './pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
window.__davetPdfjs = pdfjsLib;
window.dispatchEvent(new Event('davet-pdfjs-ready'));
