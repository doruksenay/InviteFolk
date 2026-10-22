// Web: uygulama içi satın alma yok; ödeme iyzico ile (api-billing.startWebCheckout).
import type { PaidPlan } from './api-billing';

export const PRODUCT_IDS: Record<PaidPlan, string> = { temel: 'davet_temel', otomatik: 'davet_otomatik', tam: 'davet_tam' };

export type StoreAvailability = 'ready' | 'expo-go' | 'not-configured';
export type PurchaseOutcome = 'purchased' | 'cancelled';

export function storeAvailability(): StoreAvailability {
  return 'not-configured';
}

export async function getStorePrices(_userId: string): Promise<Partial<Record<PaidPlan, string>>> {
  return {};
}

export async function purchasePlan(_userId: string, _plan: PaidPlan): Promise<PurchaseOutcome> {
  throw new Error('store_unavailable');
}

export const IN_APP_PURCHASES = false;
