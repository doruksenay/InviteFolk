// iyzico Checkout Form dönüşü. iyzico tarayıcıyı bu adrese form POST'u ile yollar: token=...
// Bu adrese gelen veriye güvenilmez: ödeme sonucu token ile iyzico'dan SUNUCU TARAFINDA sorgulanır,
// tutar ve sepet kimliği ödeme oturumuyla karşılaştırılır, ancak ondan sonra paket verilir.
// Aynı ödeme iki kez işlenmez (grant_purchase provider_ref = paymentId ile idempotent).
// Ortam: IYZICO_API_KEY, IYZICO_SECRET_KEY, IYZICO_BASE_URL, APP_WEB_URL (ör. https://invitefolk.app)

import { adminClient, readBody } from '../_shared/supabase.ts';
import { CF_DETAIL, iyzicoPost } from '../iyzico-checkout/iyzico.ts';

function redirect(ok: boolean, pkg?: string) {
  const base = (Deno.env.get('APP_WEB_URL') ?? '').replace(/\/$/, '');
  const qs = ok ? `durum=basarili${pkg ? `&paket=${encodeURIComponent(pkg)}` : ''}` : 'durum=hata';
  return new Response(null, { status: 303, headers: { Location: `${base}/paketler?${qs}`, 'Cache-Control': 'no-store' } });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  const raw = await readBody(req, 8 * 1024);
  if (raw === null) return redirect(false);
  const token = new URLSearchParams(raw).get('token') ?? '';
  if (!/^[A-Za-z0-9-]{8,100}$/.test(token)) return redirect(false);

  const db = adminClient();
  const { data: session } = await db.from('checkout_sessions').select('id, user_id, package, amount_try, status').eq('provider_token', token).maybeSingle();
  if (!session) return redirect(false);
  if (session.status === 'paid') return redirect(true, session.package);

  const result = await iyzicoPost<{
    status?: string;
    paymentStatus?: string;
    paymentId?: string;
    paidPrice?: number | string;
    basketId?: string;
    conversationId?: string;
    currency?: string;
    fraudStatus?: number;
    errorCode?: string;
  }>(CF_DETAIL, { locale: 'tr', conversationId: session.id, token });

  const amountOk = Math.abs(Number(result.paidPrice) - Number(session.amount_try)) < 0.01;
  const ok =
    result.status === 'success' &&
    result.paymentStatus === 'SUCCESS' &&
    !!result.paymentId &&
    result.basketId === session.id &&
    (result.conversationId === undefined || result.conversationId === session.id) &&
    (result.currency === undefined || result.currency === 'TRY') &&
    (result.fraudStatus === undefined || result.fraudStatus === 1) &&
    amountOk;

  if (!ok) {
    console.warn('iyzico payment not accepted', result.status, result.paymentStatus, result.errorCode, amountOk);
    await db.from('checkout_sessions').update({ status: 'failed' }).eq('id', session.id).eq('status', 'pending');
    return redirect(false);
  }

  const { error } = await db.rpc('grant_purchase', {
    p_user: session.user_id,
    p_package: session.package,
    p_amount: Number(session.amount_try),
    p_provider: 'iyzico',
    p_ref: String(result.paymentId),
    p_product: `invitefolk_${session.package}`,
  });
  if (error) {
    // Ödeme alındı ama paket verilemedi: oturum "pending" kalır, yeniden denenebilir; kayıt sunucu günlüğünde.
    console.error('grant_purchase failed', error.message, session.id);
    return redirect(false);
  }
  await db.from('checkout_sessions').update({ status: 'paid' }).eq('id', session.id);
  return redirect(true, session.package);
});
