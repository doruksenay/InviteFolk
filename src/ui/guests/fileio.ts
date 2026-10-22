// Native: seçilen dosyayı bayt olarak okur, örnek şablonu paylaşım menüsüyle verir.
import type { DocumentPickerAsset } from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export async function readPicked(asset: DocumentPickerAsset): Promise<Uint8Array> {
  return new File(asset.uri).bytes();
}

/** Metin dosyasını önbelleğe yazar ve paylaşım menüsünü açar. Paylaşım yoksa false döner. */
export async function shareTextFile(name: string, text: string, mimeType = 'text/csv'): Promise<boolean> {
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write(text);
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: name, UTI: 'public.comma-separated-values-text' });
  return true;
}
