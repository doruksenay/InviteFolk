// POST { package: 'temel' | 'otomatik' | 'tam' | 'album', lang?: 'tr' | 'en' }  → { paymentPageUrl }
// Web'de paket, yükseltme ya da albüm eklentisi satın alma: iyzico Ortak Ödeme Sayfası (Checkout Form) başlatır.
//
// Güvenlik:
// - Kullanıcı JWT ile doğrulanır (verify_jwt = true + getUser).
// - Fiyat istemciden ALINMAZ; veritabanındaki teklif (my_quotes) belirler: geçerli paketten üst pakete geçişte
//   yalnızca fark, albüm eklentisinde eklenti fiyatı. Ürün kimliği de teklifle birlikte oturuma yazılır.
// - Ödeme oturumu sunucuda açılır (checkout_sessions); dönüşte sonuç iyzico'dan sunucu tarafında sorgulanır.
// - Hata ayrıntısı istemciye dönmez.
// Ortam: IYZICO_API_KEY, IYZICO_SECRET_KEY, IYZICO_BASE_URL, ALLOWED_ORIGINS

import { adminClient, corsHeaders, json, readBody, userClient } from '../_shared/supabase.ts';
import { CF_INIT, iyzicoPost, iyzicoPrice } from './iyzico.ts';

const PACKAGES = ['temel', 'otomatik', 'tam', 'album'] as const;
type Pkg = (typeof PACKAGES)[number];
const ITEM_NAMES: Record<Pkg, string> = {
  temel: 'Invitefolk Davet paketi',
  otomatik: 'Invitefolk Düğün paketi',
  tam: 'Invitefolk Düğün Tam paketi',
  album: 'Invitefolk Anı albümü',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405);

  const raw = await readBody(req, 4 * 1024);
  if (raw === null) return json(req, { error: 'payload_too_large' }, 413);
  let body: { package?: unknown; lang?: unknown };
  try {
    body = JSON.parse(raw || '{}');
  } catch {
    return json(req, { error: 'invalid_json' }, 400);
  }
  const pkg = PACKAGES.includes(body.package as Pkg) ? (body.package as Pkg) : null;
  if (!pkg) return json(req, { error: 'invalid_input' }, 400);
  const locale = body.lang === 'en' ? 'en' : 'tr';

  const asUser = userClient(req);
  const { data: auth } = await asUser.auth.getUser();
  const user = auth?.user;
  if (!user?.email) return json(req, { error: 'unauthorized' }, 401);

  const db = adminClient();
  const [{ data: quotes }, { data: profile }] = await Promise.all([
    asUser.rpc('my_quotes'),
    db.from('profiles').select('full_name, phone, suspended_at').eq('id', user.id).single(),
  ]);
  if (!profile) return json(req, { error: 'server_error' }, 500);
  if (profile.suspended_at) return json(req, { error: 'forbidden' }, 403);
  // Teklif: geçerli üst paket varken daha düşük paket, albümü içeren pakette eklenti satılmaz.
  const quote = (quotes as Record<string, { available?: boolean; amount?: number | string; product?: string }> | null)?.[pkg];
  if (!quote?.available || !quote.product || !/^invitefolk_[a-z_]{3,40}$/.test(quote.product)) return json(req, { error: 'invalid_input' }, 409);
  const amount = Number(quote.amount);
  const product = quote.product;
  if (!Number.isFinite(amount) || amount <= 0) return json(req, { error: 'server_error' }, 500);

  // Kısa sürede çok fazla ödeme oturumu açılmasın (kötüye kullanım freni).
  const { count } = await db
    .from('checkout_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gt('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());
  if ((count ?? 0) >= 10) return json(req, { error: 'rate_limited' }, 429);

  const { data: session, error: sErr } = await db
    .from('checkout_sessions')
    .insert({ user_id: user.id, package: pkg, amount_try: amount, product_id: product })
    .select('id')
    .single();
  if (sErr || !session) {
    console.error('checkout session', sErr);
    return json(req, { error: 'server_error' }, 500);
  }

  const fullName = (profile.full_name ?? '').trim() || user.email.split('@')[0];
  const [name, ...rest] = fullName.split(/\s+/);
  const surname = rest.join(' ') || name;
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || '85.34.78.112';
  const phone = profile.phone && /^\+[1-9][0-9]{7,14}$/.test(profile.phone) ? profile.phone : undefined;
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const p = iyzicoPrice(amount);
  const address = { contactName: fullName.slice(0, 100), city: 'Istanbul', country: 'Turkey', address: 'Dijital hizmet / Digital service' };

  const init = await iyzicoPost<{ status?: string; token?: string; paymentPageUrl?: string; errorCode?: string; errorMessage?: string }>(CF_INIT, {
    locale,
    conversationId: session.id,
    price: p,
    paidPrice: p,
    currency: 'TRY',
    basketId: session.id,
    paymentGroup: 'PRODUCT',
    callbackUrl: `${supabaseUrl}/functions/v1/iyzico-callback`,
    enabledInstallments: [1],
    buyer: {
      id: user.id,
      name: name.slice(0, 50),
      surname: surname.slice(0, 50),
      email: user.email,
      ...(phone ? { gsmNumber: phone } : {}),
      // Kimlik numarası toplanmıyor; iyzico bu durumda 11 haneli yer tutucu kabul eder (docs/payments.md).
      identityNumber: '11111111111',
      registrationAddress: address.address,
      ip,
      city: address.city,
      country: address.country,
    },
    billingAddress: address,
    basketItems: [{ id: product, name: ITEM_NAMES[pkg], category1: 'Dijital hizmet', itemType: 'VIRTUAL', price: p }],
  });

  if (init.status !== 'success' || !init.token || !init.paymentPageUrl?.startsWith('https://')) {
    console.error('iyzico init failed', init.errorCode, init.errorMessage);
    await db.from('checkout_sessions').update({ status: 'failed' }).eq('id', session.id);
    return json(req, { error: 'payment_provider_error' }, 502);
  }

  await db.from('checkout_sessions').update({ provider_token: init.token }).eq('id', session.id);
  return json(req, { paymentPageUrl: init.paymentPageUrl });
});
