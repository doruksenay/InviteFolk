// Uygulama içi satın alma (iOS / Android) — RevenueCat.
// Ürünler App Store Connect ve Play Console'da tüketilebilir (consumable) tek seferlik ürün olarak tanımlanır:
//   davet_temel, davet_otomatik, davet_tam
// Paketi uygulama değil, RevenueCat'in sunucu bildirimi (revenuecat-webhook) verir; uygulama yalnızca satın almayı başlatır.
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import Purchases, { PRODUCT_CATEGORY, type PurchasesStoreProduct } from 'react-native-purchases';

import type { PaidPlan } from './api-billing';

export const PRODUCT_IDS: Record<PaidPlan, string> = { temel: 'davet_temel', otomatik: 'davet_otomatik', tam: 'davet_tam' };

const API_KEY = Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

export type StoreAvailability = 'ready' | 'expo-go' | 'not-configured';

/** Expo Go'da RevenueCat yalnızca önizleme modunda çalışır; gerçek satın alma geliştirme/mağaza derlemesi ister. */
export function storeAvailability(): StoreAvailability {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return 'expo-go';
  if (!API_KEY) return 'not-configured';
  return 'ready';
}

let configuredFor: string | null = null;

async function ensureConfigured(userId: string) {
  if (configuredFor === userId) return;
  if (configuredFor === null) {
    Purchases.configure({ apiKey: API_KEY!, appUserID: userId });
  } else {
    await Purchases.logIn(userId);
  }
  configuredFor = userId;
}

/** Mağazadaki yerel fiyatlar (ör. "₺499,99"). Bulunamazsa boş. */
export async function getStorePrices(userId: string): Promise<Partial<Record<PaidPlan, string>>> {
  if (storeAvailability() !== 'ready') return {};
  await ensureConfigured(userId);
  const products = await Purchases.getProducts(Object.values(PRODUCT_IDS), PRODUCT_CATEGORY.NON_SUBSCRIPTION);
  const out: Partial<Record<PaidPlan, string>> = {};
  for (const [plan, id] of Object.entries(PRODUCT_IDS) as [PaidPlan, string][]) {
    const p = products.find((x: PurchasesStoreProduct) => x.identifier === id);
    if (p) out[plan] = p.priceString;
  }
  return out;
}

export type PurchaseOutcome = 'purchased' | 'cancelled';

export async function purchasePlan(userId: string, plan: PaidPlan): Promise<PurchaseOutcome> {
  if (storeAvailability() !== 'ready') throw new Error('store_unavailable');
  await ensureConfigured(userId);
  const [product] = await Purchases.getProducts([PRODUCT_IDS[plan]], PRODUCT_CATEGORY.NON_SUBSCRIPTION);
  if (!product) throw new Error('product_not_found');
  try {
    await Purchases.purchaseStoreProduct(product);
    return 'purchased';
  } catch (e) {
    if ((e as { userCancelled?: boolean }).userCancelled) return 'cancelled';
    throw e;
  }
}

/** Uygulama içi satın alma bu platformda var mı (web'de yok; web iyzico kullanır). */
export const IN_APP_PURCHASES = true;
