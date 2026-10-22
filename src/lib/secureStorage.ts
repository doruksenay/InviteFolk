// Oturum anahtarları için şifreli depolama (iOS Keychain / Android Keystore).
// Supabase oturumu bazı platformların tek değer sınırını (~2 KB) aşabildiği için parçalara bölünür.
// WHEN_UNLOCKED_THIS_DEVICE_ONLY: cihaz kilitliyken okunamaz, yedekle başka cihaza taşınmaz.
import * as SecureStore from 'expo-secure-store';

const CHUNK = 1800;
const OPTS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const safeKey = (k: string) => k.replace(/[^A-Za-z0-9._-]/g, '_');

async function read(key: string): Promise<string | null> {
  const k = safeKey(key);
  const count = Number(await SecureStore.getItemAsync(`${k}.n`, OPTS));
  if (!count) return null;
  const parts = await Promise.all(Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(`${k}.${i}`, OPTS)));
  if (parts.some((p) => p === null)) return null;
  return parts.join('');
}

async function remove(key: string) {
  const k = safeKey(key);
  const count = Number(await SecureStore.getItemAsync(`${k}.n`, OPTS));
  await SecureStore.deleteItemAsync(`${k}.n`, OPTS);
  await Promise.all(Array.from({ length: count || 0 }, (_, i) => SecureStore.deleteItemAsync(`${k}.${i}`, OPTS)));
}

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const v = await read(key);
    if (v !== null) return v;
    // Eski sürümden kalma, şifresiz saklanmış oturum varsa şifreli depoya taşı ve eskisini sil.
    try {
      const legacy = globalThis.localStorage?.getItem(key) ?? null;
      if (legacy) {
        await secureStorage.setItem(key, legacy);
        globalThis.localStorage?.removeItem(key);
      }
      return legacy;
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    await remove(key);
    const k = safeKey(key);
    const chunks = value.match(new RegExp(`[\\s\\S]{1,${CHUNK}}`, 'g')) ?? [''];
    for (let i = 0; i < chunks.length; i++) await SecureStore.setItemAsync(`${k}.${i}`, chunks[i], OPTS);
    // Sayaç en son yazılır: yarıda kesilen yazma eksik bir oturum bırakmaz.
    await SecureStore.setItemAsync(`${k}.n`, String(chunks.length), OPTS);
  },
  async removeItem(key: string): Promise<void> {
    await remove(key);
  },
};
