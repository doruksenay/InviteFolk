// Web derlemesinden sonra Cloudflare Pages için güvenlik başlıklarını ve SPA yönlendirmesini yazar.
// Kullanım: npm run build:web   (EXPO_PUBLIC_SUPABASE_URL ortamda olmalı)
//
// CSP: betikler yalnızca kendi alan adımızdan; ağ istekleri yalnızca kendi Supabase projemize.
// Böylece bir XSS açığı olsa bile dışarıdan betik yüklenemez ve veri başka bir sunucuya gönderilemez.
// Kamera ve mikrofon yalnızca kendi sayfalarımızda (kapıda karekod okuma, albüme sesli mesaj); konum kapalı.
// Ayrıca arama motorları için robots.txt, sitemap.xml ve index.html'e açıklama/OG etiketleri yazılır.
import { existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2] ?? 'dist';
const supa = process.env.EXPO_PUBLIC_SUPABASE_URL;
if (!supa || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(supa)) {
  console.error('EXPO_PUBLIC_SUPABASE_URL https://<proje>.supabase.co biçiminde olmalı');
  process.exit(1);
}
const origin = new URL(supa).origin;

// Cloudflare Pages, adında "node_modules" geçen klasörleri yüklemez; Expo ise yazı tiplerini ve bazı görselleri
// dist/assets/node_modules altına koyar. Klasör "vendor" olarak yeniden adlandırılır ve paketlerdeki yollar güncellenir.
const nm = join(out, 'assets', 'node_modules');
if (existsSync(nm)) {
  renameSync(nm, join(out, 'assets', 'vendor'));
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(js|html|css|json)$/.test(f)) {
        const src = readFileSync(p, 'utf8');
        if (src.includes('/assets/node_modules/')) writeFileSync(p, src.replaceAll('/assets/node_modules/', '/assets/vendor/'));
      }
    }
  };
  walk(out);
  console.log('assets/node_modules → assets/vendor (Cloudflare Pages node_modules klasörlerini yüklemez)');
}
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
  Permissions-Policy: camera=(self), microphone=(self), geolocation=(), payment=(), usb=(), interest-cohort=()
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
// Arama motorları: yalnızca tanıtım sayfası ve yasal metinler dizine girer; kişisel sayfalar zaten noindex.
const site = (process.env.EXPO_PUBLIC_WEB_URL || '').replace(/\/+$/, '');
if (/^https:\/\/[^\s"<>]+$/.test(site)) {
  const pages = ['/', '/yasal/gizlilik', '/yasal/kosullar', '/yasal/kvkk'];
  writeFileSync(join(out, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /r/\nDisallow: /a/\nDisallow: /h/\nDisallow: /k/\nDisallow: /katil/\nDisallow: /etkinlik\nDisallow: /admin\nSitemap: ${site}/sitemap.xml\n`);
  writeFileSync(
    join(out, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((p) => `  <url><loc>${site}${p}</loc></url>`).join('\n')}\n</urlset>\n`,
  );
}
const indexFile = join(out, 'index.html');
if (existsSync(indexFile)) {
  const title = 'Invitefolk · Dijital davetiye ve LCV';
  const desc = 'Düğün, nişan, sünnet, doğum günü ve halı saha için WhatsApp ile gönderilen şık davetiye, canlı LCV, oturma planı ve canlı albüm.';
  const tags = [
    `<meta name="description" content="${desc}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="Invitefolk">`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${desc}">`,
    ...(site ? [`<meta property="og:url" content="${site}/">`, `<link rel="canonical" href="${site}/">`] : []),
    `<meta name="twitter:card" content="summary">`,
  ].join('');
  let html = readFileSync(indexFile, 'utf8');
  if (!html.includes('name="description"')) html = html.replace('</head>', `${tags}</head>`);
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`).replace(/<html lang="[^"]*"/, '<html lang="tr"');
  writeFileSync(indexFile, html);
}

console.log(`_headers ve _redirects yazıldı → ${out}/ (Supabase: ${origin})`);
