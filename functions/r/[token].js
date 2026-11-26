// Cloudflare Pages Function: /r/<davet anahtarı> paylaşım önizlemesi.
// WhatsApp, iMessage ve Telegram linki açmadan önce sayfanın HTML'ini okur; uygulama tek sayfa (SPA) olduğu için
// statik index.html'de yalnızca genel "Invitefolk" başlığı vardır. Bu fonksiyon index.html'i alır ve
// etkinliğin başlığını, ev sahiplerini, tarihini ve mekânını OG etiketlerine yazar. Sayfanın geri kalanı aynıdır.
//
// Kişisel veri: davetlinin adı, masası ya da cevabı önizlemeye KONMAZ (önizlemeler mesajlaşma sunucularında
// önbelleklenebilir). Yalnızca davetiyenin kendisinde zaten yazan etkinlik bilgileri kullanılır.
// Yapılandırma: derleme sırasında yazılan /og-config.json (Supabase adresi ve herkese açık anahtar; gizli değildir).

const TOKEN = /^[0-9a-f]{32}$/;

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .slice(0, 300);

function fmtDate(iso, lang) {
  try {
    return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Istanbul',
    }).format(new Date(iso));
  } catch {
    return '';
  }
}

async function preview(context, token) {
  const cfgRes = await context.env.ASSETS.fetch(new URL('/og-config.json', context.request.url));
  if (!cfgRes.ok) return null;
  const cfg = await cfgRes.json();
  const r = await fetch(`${cfg.url}/rest/v1/rpc/get_invitation`, {
    method: 'POST',
    headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_token: token }),
    cf: { cacheTtl: 0 },
  });
  if (!r.ok) return null;
  const j = await r.json();
  const ev = j?.event;
  if (!ev) return null;
  const lang = ev.settings?.lang === 'en' ? 'en' : 'tr';
  const title = ev.host_names ? `${ev.host_names} · ${ev.title}` : ev.title;
  const when = ev.starts_at ? fmtDate(ev.starts_at, lang) : '';
  const parts = [when, ev.venue_name].filter(Boolean);
  const desc = parts.length ? parts.join(' · ') : lang === 'en' ? 'You are invited. Tap to reply.' : 'Davetlisin. Cevabını bildirmek için dokun.';
  return { title, desc: lang === 'en' ? `${desc} — tap to RSVP` : `${desc} — cevabını bildir`, lang };
}

export async function onRequestGet(context) {
  const token = String(context.params.token ?? '');
  const page = await context.env.ASSETS.fetch(new URL('/', context.request.url));
  let html = await page.text();
  if (TOKEN.test(token)) {
    try {
      const p = await preview(context, token);
      if (p) {
        const t = esc(p.title);
        const d = esc(p.desc);
        const origin = new URL(context.request.url).origin;
        html = html
          .replace(/<title>[^<]*<\/title>/, `<title>${t}</title>`)
          .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${t}">`)
          .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${d}">`)
          .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${d}">`)
          .replace(/<meta property="og:url" content="[^"]*">/, '')
          .replace(/<link rel="canonical" href="[^"]*">/, '')
          .replace('</head>', `<meta property="og:image" content="${origin}/og.jpg"><meta property="og:locale" content="${p.lang === 'en' ? 'en_GB' : 'tr_TR'}"></head>`)
          .replace(/<html lang="[^"]*"/, `<html lang="${p.lang}"`);
      }
    } catch {
      // Önizleme alınamazsa genel başlıkla devam edilir; sayfa her durumda açılır.
    }
  }
  const headers = new Headers(page.headers);
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Robots-Tag', 'noindex, nofollow');
  headers.delete('Content-Length');
  return new Response(html, { status: 200, headers });
}
