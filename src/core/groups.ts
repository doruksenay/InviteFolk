// Davetli grupları ("lise arkadaşlarım", "baba tarafı"): contacts.group_label üzerinden çalışır.
// Ayrı bir tablo yok; grup, aynı etiketi taşıyan kişilerin kümesidir. Renk etiketten türetilir, böylece kalıcıdır.
import type { InvitationWithContact } from './types';

export const GROUP_MAX = 40;

/** Etiketleri karşılaştırmak için: boşluk ve büyük/küçük harf farkını yok sayar. */
export function groupKey(label: string | null | undefined): string {
  return (label ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

/** Veritabanına yazılacak biçim: kırpılmış, tek boşluklu, en fazla GROUP_MAX karakter; boşsa null. */
export function cleanGroupLabel(label: string | null | undefined): string | null {
  const v = (label ?? '').trim().replace(/\s+/g, ' ').slice(0, GROUP_MAX);
  return v || null;
}

// Salon renkleriyle (taraf renkleri) karışmayacak kadar ayrışan sabit bir palet.
const PALETTE = ['#D1495B', '#2E86AB', '#3E9E6B', '#E0A030', '#8E5BD9', '#C2417D', '#1B998B', '#B5651D', '#4C6EF5', '#6C757D'];

/** Etiketten kararlı renk; grup yoksa null. */
export function groupColor(label: string | null | undefined): string | null {
  const k = groupKey(label);
  if (!k) return null;
  let h = 5381;
  for (let i = 0; i < k.length; i++) h = ((h << 5) + h + k.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

export type GroupInfo = { key: string; label: string; color: string; households: number };

/** Davetlilerdeki grupları, kalabalıktan aza doğru sıralı listeler. İlk görülen yazım gösterilir. */
export function collectGroups(invitations: Pick<InvitationWithContact, 'contacts'>[]): GroupInfo[] {
  const map = new Map<string, GroupInfo>();
  for (const inv of invitations) {
    const label = cleanGroupLabel(inv.contacts.group_label);
    if (!label) continue;
    const key = groupKey(label);
    const g = map.get(key);
    if (g) g.households++;
    else map.set(key, { key, label, color: groupColor(label)!, households: 1 });
  }
  return [...map.values()].sort((a, b) => b.households - a.households || a.label.localeCompare(b.label));
}
