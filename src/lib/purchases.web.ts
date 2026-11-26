// Web: uygulama içi satın alma yok; ödeme iyzico ile (api-billing.startWebCheckout).
export const PRODUCT_IDS = [
  'invitefolk_temel',
  'invitefolk_otomatik',
  'invitefolk_tam',
  'invitefolk_up_temel_otomatik',
  'invitefolk_up_temel_tam',
  'invitefolk_up_otomatik_tam',
  'invitefolk_album',
] as const;

export type StoreAvailability = 'ready' | 'expo-go' | 'not-configured';
export type PurchaseOutcome = 'purchased' | 'cancelled';

export function storeAvailability(): StoreAvailability {
  return 'not-configured';
}

export async function getStorePrices(_userId: string): Promise<Record<string, string>> {
  return {};
}

export async function purchaseProduct(_userId: string, _productId: string): Promise<PurchaseOutcome> {
  throw new Error('store_unavailable');
}

export const IN_APP_PURCHASES = false;
