// Native: PDF burada görsele çevrilmez (web panelinde çevrilir). Arayüz kullanıcıya yol gösterir.
export async function renderPdfFirstPage(_data: ArrayBuffer, _maxEdge = 2400): Promise<{ blob: Blob; width: number; height: number }> {
  throw new Error('pdf-native-unsupported');
}
