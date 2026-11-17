// Uygulama içi satın alma (iOS / Android) — RevenueCat.
// Ürünler App Store Connect ve Play Console'da tüketilebilir (consumable) tek seferlik ürün olarak tanımlanır:
//   paketler      invitefolk_temel, invitefolk_otomatik, invitefolk_tam
//   yükseltmeler  invitefolk_up_temel_otomatik, invitefolk_up_temel_tam, invitefolk_up_otomatik_tam (yalnızca fark)
//   eklenti       invitefolk_album (Anı albümü)
// Hangi ürünün satılacağına sunucu karar verir (my_quotes); paketi uygulama değil, RevenueCat'in sunucu bildirimi
// (revenuecat-webhook) verir. Uygulama yalnızca satın almayı başlatır.
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import Purchases, { PRODUCT_CATEGORY, type PurchasesStoreProduct } from 'react-native-purchases';

export const PRODUCT_IDS = [
  'invitefolk_temel',
  'invitefolk_otomatik',
  'invitefolk_tam',
  'invitefolk_up_temel_otomatik',
  'invitefolk_up_temel_tam',
  'invitefolk_up_otomatik_tam',
  'invitefolk_album',
] as const;

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

/** Mağazadaki yerel fiyatlar, ürün kimliğine göre (ör. "₺499,99"). Bulunamazsa boş. */
export async function getStorePrices(userId: string): Promise<Record<string, string>> {
  if (storeAvailability() !== 'ready') return {};
  await ensureConfigured(userId);
  const products = await Purchases.getProducts([...PRODUCT_IDS], PRODUCT_CATEGORY.NON_SUBSCRIPTION);
  const out: Record<string, string> = {};
  for (const p of products as PurchasesStoreProduct[]) out[p.identifier] = p.priceString;
  return out;
}

export type PurchaseOutcome = 'purchased' | 'cancelled';

/** Sunucunun teklif ettiği ürünü satın alır (ürün kimliği my_quotes'tan gelir). */
export async function purchaseProduct(userId: string, productId: string): Promise<PurchaseOutcome> {
  if (storeAvailability() !== 'ready') throw new Error('store_unavailable');
  if (!(PRODUCT_IDS as readonly string[]).includes(productId)) throw new Error('product_not_found');
  await ensureConfigured(userId);
  const [product] = await Purchases.getProducts([productId], PRODUCT_CATEGORY.NON_SUBSCRIPTION);
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
