// Paketler, ödeme ve admin kullanıcı yönetimi için istemci çağrıları.
// Güvenlik: fiyat ve paket istemciden belirlenmez; ödeme sunucuda doğrulanır ve paketi yalnızca sunucu verir.
import type { Plan, PlanLimits } from '@/core/types';

import { must, supabase } from './api';

export type PaidPlan = 'temel' | 'otomatik' | 'tam';
export const PAID_PLANS: PaidPlan[] = ['temel', 'otomatik', 'tam'];

export type PlanPrice = { plan: PaidPlan; amount_try: number; rank: number };
export type { PlanLimits } from '@/core/types';

export async function getPlanCatalog(): Promise<{ prices: PlanPrice[]; limits: PlanLimits[] }> {
  const [prices, limits] = await Promise.all([
    supabase.from('plan_prices').select('plan, amount_try, rank').order('rank'),
    supabase.from('plan_limits').select('*'),
  ]);
  return {
    prices: (must(prices) as PlanPrice[]).map((p) => ({ ...p, amount_try: Number(p.amount_try) })),
    limits: must(limits) as PlanLimits[],
  };
}

/** Web ödemesi (iyzico): sunucu ödeme oturumunu açar, kullanıcıyı iyzico'nun güvenli sayfasına gönderir. */
export async function startWebCheckout(plan: PaidPlan, lang: 'tr' | 'en' = 'tr'): Promise<string> {
  const { data, error } = await supabase.functions.invoke('iyzico-checkout', { body: { package: plan, lang } });
  const url = (data as { paymentPageUrl?: string } | null)?.paymentPageUrl;
  if (error || !url || !/^https:\/\//.test(url)) throw new Error('checkout_failed');
  return url;
}

export async function setNotifyRsvp(userId: string, value: boolean) {
  must(await supabase.from('profiles').update({ notify_rsvp: value }).eq('id', userId).select('id'));
}

/** Günlük özet e-postası (yeni cevaplar, notlar, albüm). */
export async function setNotifyDigest(userId: string, value: boolean) {
  must(await supabase.from('profiles').update({ notify_digest: value }).eq('id', userId).select('id'));
}

// ---------------------------------------------------------------------------
// Admin (MFA'lı oturum; veritabanı ayrıca doğrular)
// ---------------------------------------------------------------------------
export type AdminUserRow = {
  id: string;
  full_name: string | null;
  email: string | null; // yalnızca tam e-posta eşleşmesinde dolu
  role: 'user' | 'admin';
  plan: Plan;
  plan_expires_at: string | null;
  suspended_at: string | null;
  created_at: string;
  events: number;
};

export async function adminSearchUsers(query: string): Promise<AdminUserRow[]> {
  const rows = must(await supabase.rpc('admin_search_users', { p_query: query.trim(), p_limit: 30 })) as AdminUserRow[];
  return rows.map((r) => ({ ...r, events: Number(r.events) }));
}

export async function adminSetPlan(userId: string, plan: Plan, expiresAt: string | null) {
  must(await supabase.rpc('admin_set_plan', { p_user: userId, p_plan: plan, p_expires: expiresAt }));
}

export async function adminSetSuspended(userId: string, suspended: boolean) {
  must(await supabase.rpc('admin_set_suspended', { p_user: userId, p_suspended: suspended }));
}
