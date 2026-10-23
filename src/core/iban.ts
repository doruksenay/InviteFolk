// IBAN: boşlukları atıp büyük harfe çevirir, ülke uzunluğunu (TR: 26) ve sağlama toplamını (mod 97) denetler.
// Veritabanı aynı kuralı private.iban_valid ile ayrıca zorlar.
export function normalizeIban(v: string) {
  return v.replace(/[\s-]/g, '').toUpperCase();
}

export function ibanValid(raw: string) {
  const v = normalizeIban(raw);
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(v)) return false;
  if (v.startsWith('TR') && v.length !== 26) return false;
  const moved = v.slice(4) + v.slice(0, 4);
  let m = 0;
  for (const ch of moved) {
    const digits = /[0-9]/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);
    for (const d of digits) m = (m * 10 + Number(d)) % 97;
  }
  return m === 1;
}

export function formatIban(v: string) {
  return normalizeIban(v).replace(/(.{4})/g, '$1 ').trim();
}
