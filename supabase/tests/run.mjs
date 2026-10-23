// Veritabanı testleri: tüm migration'lar gerçek Postgres'e (PGlite, WebAssembly) uygulanır ve
// her test dosyası sırayla çalışır. Supabase'e bağlanmaz; CI'da ve yerelde aynı şekilde çalışır.
// Kullanım: npm run test:db
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const migDir = join(here, '..', 'migrations');
const migrations = readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort().map((f) => join(migDir, f));
const suites = ['guvenlik', 'ozellikler', 'gerileme', 'otomasyon', 'araclar', 'inceleme', 'sporlar'];

let failed = 0;
for (const s of suites) {
  const r = spawnSync(process.execPath, [join(here, `${s}.mjs`), ...migrations], { encoding: 'utf8' });
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  const summary = out.match(/SONUÇ: .*/)?.[0] ?? 'sonuç yok';
  console.log(`${r.status === 0 ? '✓' : '✗'} ${s.padEnd(11)} ${summary}`);
  if (r.status !== 0) {
    failed++;
    // Başarısız testleri ve hata satırlarını göster (PGlite'ın uzun paket çıktısı hariç).
    console.log(out.split('\n').filter((l) => /✗|error|Error|VULN/.test(l) && l.length < 400).join('\n'));
  }
}
process.exit(failed ? 1 : 0);
