// Web: seçilen dosya tarayıcının File nesnesinden okunur; şablon doğrudan indirilir.
import type { DocumentPickerAsset } from 'expo-document-picker';

export async function readPicked(asset: DocumentPickerAsset): Promise<Uint8Array> {
  if (asset.file) return new Uint8Array(await asset.file.arrayBuffer());
  const res = await fetch(asset.uri);
  return new Uint8Array(await res.arrayBuffer());
}

export async function shareTextFile(name: string, text: string, mimeType = 'text/csv'): Promise<boolean> {
  const url = URL.createObjectURL(new Blob([text], { type: `${mimeType};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
