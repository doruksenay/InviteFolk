// iyzico API istemcisi (Checkout Form). Kimlik doğrulama: IYZWSv2 (HMAC-SHA256).
//   imza  = hex(HMAC_SHA256(secretKey, randomKey + uriPath + body))
//   başlık = "IYZWSv2 " + base64("apiKey:" + apiKey + "&randomKey:" + randomKey + "&signature:" + imza)
// Ortam: IYZICO_BASE_URL (varsayılan sandbox), IYZICO_API_KEY, IYZICO_SECRET_KEY
// Belge: https://docs.iyzico.com/en/getting-started/preliminaries/authentication/hmacsha256-auth

const enc = new TextEncoder();

export function iyzicoConfig() {
  const apiKey = Deno.env.get('IYZICO_API_KEY');
  const secretKey = Deno.env.get('IYZICO_SECRET_KEY');
  const baseUrl = (Deno.env.get('IYZICO_BASE_URL') ?? 'https://sandbox-api.iyzipay.com').replace(/\/$/, '');
  if (!apiKey || !secretKey) throw new Error('iyzico anahtarları tanımlı değil');
  if (!/^https:\/\/(sandbox-)?api\.iyzipay\.com$/.test(baseUrl)) throw new Error('IYZICO_BASE_URL geçersiz');
  return { apiKey, secretKey, baseUrl };
}

async function hmacHex(key: string, data: string) {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, enc.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function randomKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return `${Date.now()}${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

/** İmzalı POST. Gövde bir kez JSON'a çevrilir; imza ve gönderilen gövde birebir aynı olmalı. */
export async function iyzicoPost<T = Record<string, unknown>>(path: string, payload: unknown): Promise<T> {
  const { apiKey, secretKey, baseUrl } = iyzicoConfig();
  const body = JSON.stringify(payload);
  const rnd = randomKey();
  const signature = await hmacHex(secretKey, rnd + path + body);
  const auth = btoa(`apiKey:${apiKey}&randomKey:${rnd}&signature:${signature}`);
  const res = await fetch(baseUrl + path, {
    method: 'POST',
    headers: { Authorization: `IYZWSv2 ${auth}`, 'x-iyzi-rnd': rnd, 'Content-Type': 'application/json', Accept: 'application/json' },
    body,
  });
  const json = (await res.json().catch(() => ({}))) as T;
  return json;
}

export const CF_INIT = '/payment/iyzipos/checkoutform/initialize/auth/ecom';
export const CF_DETAIL = '/payment/iyzipos/checkoutform/auth/ecom/detail';

/** iyzico fiyat biçimi: "750.0" gibi noktalı ondalık. */
export function iyzicoPrice(n: number) {
  return (Math.round(n * 100) / 100).toFixed(2);
}
