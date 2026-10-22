// RevenueCat sunucu bildirimi (iOS App Store ve Google Play satın almaları).
// Doğrulama: RevenueCat panelinde tanımlanan Authorization başlığı = REVENUECAT_WEBHOOK_SECRET (sabit zamanlı karşılaştırma).
// NON_RENEWING_PURCHASE / INITIAL_PURCHASE → grant_purchase; CANCELLATION (iade dahil) → refund_purchase.
// Aynı işlem iki kez işlenmez (provider_ref = transaction_id).
// Ortam: REVENUECAT_WEBHOOK_SECRET, REVENUECAT_ALLOW_SANDBOX ("true" ise sandbox satın almaları da paket verir; App Review için gerekli)

import { adminClient, readBody, UUID } from '../_shared/supabase.ts';

const PRODUCT_TO_PACKAGE: Record<string, 'temel' | 'otomatik' | 'tam'> = {
  invitefolk_temel: 'temel',
  invitefolk_otomatik: 'otomatik',
  invitefolk_tam: 'tam',
};
const STORE: Record<string, 'app_store' | 'google_play'> = { APP_STORE: 'app_store', PLAY_STORE: 'google_play' };

function safeEqual(a: string, b: string) {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let d = 0;
  for (let i = 0; i < ea.length; i++) d |= ea[i] ^ eb[i];
  return d === 0;
}

const ok = () => new Response('ok', { status: 200 });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  const secret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET') ?? '';
  const header = req.headers.get('authorization') ?? '';
  const presented = header.startsWith('Bearer ') ? header.slice(7) : header;
  if (secret.length < 16 || !safeEqual(presented, secret)) return new Response('unauthorized', { status: 401 });

  const raw = await readBody(req, 64 * 1024);
  if (raw === null) return new Response('payload too large', { status: 413 });
  // deno-lint-ignore no-explicit-any
  let event: any;
  try {
    event = JSON.parse(raw)?.event;
  } catch {
    return new Response('bad request', { status: 400 });
  }
  if (!event || typeof event.type !== 'string') return ok();

  const allowSandbox = (Deno.env.get('REVENUECAT_ALLOW_SANDBOX') ?? 'true') === 'true';
  if (event.environment === 'SANDBOX' && !allowSandbox) return ok();

  const provider = STORE[event.store];
  const pkg = PRODUCT_TO_PACKAGE[event.product_id];
  const ref = typeof event.transaction_id === 'string' ? event.transaction_id.slice(0, 200) : '';
  if (!provider || !pkg || !ref) return ok(); // tanımadığımız mağaza/ürün: yok say

  // Uygulama RevenueCat'e Supabase kullanıcı kimliğiyle giriş yapar; takma adlarda da arar.
  const candidates = [event.app_user_id, event.original_app_user_id, ...(Array.isArray(event.aliases) ? event.aliases : [])];
  const userId = candidates.find((x) => typeof x === 'string' && UUID.test(x));
  const db = adminClient();

  if (event.type === 'NON_RENEWING_PURCHASE' || event.type === 'INITIAL_PURCHASE') {
    if (!userId) return ok();
    const price = Number(event.price_in_purchased_currency);
    const { error } = await db.rpc('grant_purchase', {
      p_user: userId,
      p_package: pkg,
      p_amount: event.currency === 'TRY' && Number.isFinite(price) ? price : 0,
      p_provider: provider,
      p_ref: ref,
      p_product: event.product_id,
    });
    if (error) {
      console.error('grant_purchase', error.message);
      return new Response('retry', { status: 500 }); // RevenueCat tekrar dener
    }
    return ok();
  }

  if (event.type === 'CANCELLATION') {
    const { error } = await db.rpc('refund_purchase', { p_provider: provider, p_ref: ref });
    if (error) {
      console.error('refund_purchase', error.message);
      return new Response('retry', { status: 500 });
    }
  }
  return ok();
});
