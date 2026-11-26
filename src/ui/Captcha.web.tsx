// Kayıt koruması (Cloudflare Turnstile), web: widget doğrudan sayfaya çizilir.
// CSP, anahtar tanımlıysa challenges.cloudflare.com'a izin verir (scripts/web-headers.mjs).
import { useEffect, useRef } from 'react';

export const CAPTCHA_SITE_KEY = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY ?? '';

type Props = { lang: 'tr' | 'en'; onToken: (token: string | null) => void };

type Turnstile = { render: (el: HTMLElement, opts: Record<string, unknown>) => string; remove: (id: string) => void };
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

let loading: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error('captcha_load'));
    };
    document.head.appendChild(s);
  });
  return loading;
}

export function Captcha({ lang, onToken }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onToken);
  useEffect(() => {
    cb.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!CAPTCHA_SITE_KEY) return;
    let id: string | null = null;
    let alive = true;
    loadScript()
      .then(() => {
        const el = ref.current;
        if (!alive || !el || !window.turnstile) return;
        id = window.turnstile.render(el, {
          sitekey: CAPTCHA_SITE_KEY,
          language: lang,
          callback: (token: string) => cb.current(token),
          'expired-callback': () => cb.current(null),
          'error-callback': () => cb.current(null),
        });
      })
      .catch(() => cb.current(null));
    return () => {
      alive = false;
      if (id && window.turnstile) window.turnstile.remove(id);
    };
  }, [lang]);

  if (!CAPTCHA_SITE_KEY) return null;
  return <div ref={ref} style={{ minHeight: 65 }} />;
}
