// Kayıt koruması (Cloudflare Turnstile), uygulama: kendi alan adımızdaki /captcha/ sayfası küçük bir WebView'da
// açılır ve çözülen token postMessage ile gelir. Yalnızca EXPO_PUBLIC_TURNSTILE_SITE_KEY tanımlıysa kullanılır.
import { WebView } from 'react-native-webview';

import { webBase } from '@/core/format';

export const CAPTCHA_SITE_KEY = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY ?? '';

type Props = { lang: 'tr' | 'en'; onToken: (token: string | null) => void };

export function Captcha({ lang, onToken }: Props) {
  if (!CAPTCHA_SITE_KEY) return null;
  const base = webBase();
  const page = `${base}/captcha/index.html?k=${encodeURIComponent(CAPTCHA_SITE_KEY)}&lang=${lang}`;
  return (
    <WebView
      source={{ uri: page }}
      originWhitelist={[base, 'https://challenges.cloudflare.com']}
      // Üst çerçeve yalnızca kendi doğrulama sayfamız; Turnstile kendi alt çerçevesini açar.
      onShouldStartLoadWithRequest={(req) => req.isTopFrame === false || req.url.startsWith(`${base}/captcha/`)}
      onMessage={(e) => {
        try {
          const m = JSON.parse(e.nativeEvent.data) as { type?: string; token?: string };
          onToken(m.type === 'token' && typeof m.token === 'string' ? m.token : null);
        } catch {
          onToken(null);
        }
      }}
      javaScriptEnabled
      setSupportMultipleWindows={false}
      scrollEnabled={false}
      style={{ height: 70, backgroundColor: 'transparent' }}
    />
  );
}
