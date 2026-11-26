// Yüz önerisi için gereken dosyaları (Human kütüphanesi ve 3 model) node_modules'tan public/face içine kopyalar.
// Böylece her şey kendi alan adımızdan sunulur (CSP "script-src 'self'") ve depoya 9 MB'lık ikili dosya girmez.
// Ayrıca uygulama içi köprü sayfası (public/face/bridge.html) için web motorunu src/lib/face.web.ts'ten
// public/face/engine/ altına düz JavaScript modülleri olarak üretir; böylece web ve uygulama aynı kodu çalıştırır.
// Kullanım: node scripts/vendor-face.mjs   (build:web ve web komutları kendiliğinden çalıştırır)
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'face');
const lib = join(root, 'node_modules', '@vladmandic', 'human');
const models = join(root, 'node_modules', '@vladmandic', 'human-models', 'models');

const files = [
  [join(lib, 'dist', 'human.esm.js'), 'human.esm.js'],
  [join(lib, 'LICENSE'), 'LICENSE'],
  ...['blazeface', 'facemesh', 'faceres'].flatMap((m) => [
    [join(models, `${m}.json`), `${m}.json`],
    [join(models, `${m}.bin`), `${m}.bin`],
  ]),
];

const missing = files.filter(([src]) => !existsSync(src));
if (missing.length) {
  console.warn('[vendor-face] Paketler kurulu değil, yüz önerisi bu derlemede çalışmaz. `npm install` çalıştırın.');
  process.exit(process.argv.includes('--strict') ? 1 : 0);
}
mkdirSync(out, { recursive: true });
for (const [src, name] of files) copyFileSync(src, join(out, name));
console.log(`[vendor-face] ${files.length} dosya public/face içine kopyalandı`);

// ---- Köprü için motor modülleri (TypeScript → JavaScript, yalnızca tip silme; paketleme yok)
const ts = (await import('typescript')).default;
const engineOut = join(out, 'engine');
mkdirSync(engineOut, { recursive: true });
const modules = [
  ['src/core/face-match.ts', 'face-match.mjs'],
  ['src/lib/storage-polyfill.web.ts', 'storage-polyfill.web.mjs'],
  ['src/lib/face-store.ts', 'face-store.mjs'],
  ['src/lib/face.web.ts', 'face.web.mjs'],
];
// Kaynak dosyalardaki iç içe aktarımlar köprüde aynı klasördeki modüllere yönlendirilir.
const rewrites = [
  [/(['"])@\/core\/face-match\1/g, "'./face-match.mjs'"],
  [/(['"])\.\/face-store\1/g, "'./face-store.mjs'"],
  [/(['"])\.\/storage-polyfill\1/g, "'./storage-polyfill.web.mjs'"],
];
for (const [rel, name] of modules) {
  const { outputText } = ts.transpileModule(readFileSync(join(root, rel), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, verbatimModuleSyntax: false },
    fileName: rel,
  });
  let code = outputText;
  for (const [re, to] of rewrites) code = code.replace(re, to);
  const left = /from\s+['"](@\/|\.\/face['"])/.exec(code);
  if (left) throw new Error(`[vendor-face] ${rel}: köprü için çözülemeyen aktarım: ${left[0]}`);
  writeFileSync(join(engineOut, name), `// Otomatik üretildi (scripts/vendor-face.mjs) — elle düzenlemeyin. Kaynak: ${rel}\n${code}`);
}
console.log(`[vendor-face] köprü motoru public/face/engine içine üretildi (${modules.length} modül)`);
