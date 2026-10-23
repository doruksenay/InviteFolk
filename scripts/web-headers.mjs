// Web derlemesinden sonra Cloudflare Pages için güvenlik başlıklarını ve SPA yönlendirmesini yazar.
// Kullanım: npm run build:web   (EXPO_PUBLIC_SUPABASE_URL ortamda olmalı)
//
// CSP: betikler yalnızca kendi alan adımızdan; ağ istekleri yalnızca kendi Supabase projemize.
// Böylece bir XSS açığı olsa bile dışarıdan betik yüklenemez ve veri başka bir sunucuya gönderilemez.
// Kamera yalnızca kendi sayfalarımızda (kapıda karekod okuma); mikrofon ve konum kapalı.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2] ?? 'dist';
const supa = process.env.EXPO_PUBLIC_SUPABASE_URL;
if (!supa || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(supa)) {
  console.error('EXPO_PUBLIC_SUPABASE_URL https://<proje>.supabase.co biçiminde olmalı');
  process.exit(1);
}
const origin = new URL(supa).origin;
const wss = origin.replace('https://', 'wss://');

const csp = [
  "default-src 'self'",
  // wasm-unsafe-eval: tarayıcıda karekod okuyucunun kendi alan adımızdan yüklenen WASM'ı derlemesi için (JS eval'e izin vermez).
  "script-src 'self' 'wasm-unsafe-eval'",
  // react-native-web stilleri çalışma anında <style> etiketiyle ekler.
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${origin}`,
  // Davetiye müziği ve video davetiye: Supabase'in kısa süreli imzalı linkleri.
  `media-src 'self' blob: ${origin}`,
  "font-src 'self' data:",
  `connect-src 'self' ${origin} ${wss}`,
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  'upgrade-insecure-requests',
].join('; ');

const headers = `/*
  Content-Security-Policy: ${csp}
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(self), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin

/r/*
  X-Robots-Tag: noindex, nofollow
  Cache-Control: no-store

/a/*
  X-Robots-Tag: noindex, nofollow
  Cache-Control: no-store

/h/*
  X-Robots-Tag: noindex, nofollow
  Cache-Control: no-store

/k/*
  X-Robots-Tag: noindex, nofollow
  Cache-Control: no-store

/katil/*
  X-Robots-Tag: noindex, nofollow
  Cache-Control: no-store

/_expo/static/*
  Cache-Control: public, max-age=31536000, immutable
`;

writeFileSync(join(out, '_headers'), headers);
writeFileSync(join(out, '_redirects'), '/* /index.html 200\n');
console.log(`_headers ve _redirects yazıldı → ${out}/ (Supabase: ${origin})`);
