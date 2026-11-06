// Yüz önerisi için gereken dosyaları (Human kütüphanesi ve 3 model) node_modules'tan public/face içine kopyalar.
// Böylece her şey kendi alan adımızdan sunulur (CSP "script-src 'self'") ve depoya 9 MB'lık ikili dosya girmez.
// Kullanım: node scripts/vendor-face.mjs   (build:web ve web komutları kendiliğinden çalıştırır)
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
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
