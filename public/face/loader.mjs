// Human (yüz tanıma) kütüphanesini Metro paketine sokmadan, aynı kökenden yükler; CSP "script-src 'self'" ile uyumlu.
// human.esm.js ve modeller scripts/vendor-face.mjs ile node_modules'tan kopyalanır (git'te yoktur).
import Human from './human.esm.js';

window.__davetHuman = Human;
window.dispatchEvent(new Event('davet-human-ready'));
