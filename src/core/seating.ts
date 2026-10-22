// Oturma planı: salon geometrisi, koltuk sayımı, hızlı kurulum ve otomatik yerleştirme.
// Tüm koordinatlar "salon birimi" cinsindendir (ekran pikselinden bağımsız); x, y öğenin merkezidir.
import type { TFn } from '@/i18n';

import type { InvitationWithContact, SeatingItem, SeatingKind, Side } from './types';

export const HALL_W = 1400;
export const HALL_MIN_H = 900;
export const GRID = 10;

const CHAIR = 22; // sandalye çapı
const CHAIR_GAP = 14; // masa kenarı ile sandalye merkezi arası (yarıçapa eklenir)

export type ObjectSpec = { kind: Exclude<SeatingKind, 'table'>; w: number; h: number; round?: boolean };

/** Salona eklenebilen masa dışı nesneler. */
export const OBJECTS: ObjectSpec[] = [
  { kind: 'stage', w: 380, h: 120 },
  { kind: 'dance', w: 260, h: 200 },
  { kind: 'bar', w: 220, h: 64 },
  { kind: 'dj', w: 110, h: 70 },
  { kind: 'cake', w: 76, h: 76, round: true },
  { kind: 'photo', w: 140, h: 90 },
  { kind: 'entrance', w: 160, h: 26 },
];

export const objectSpec = (kind: SeatingKind) => OBJECTS.find((o) => o.kind === kind);

export const objectName = (kind: Exclude<SeatingKind, 'table'>, t: TFn) => t(`hall.objects.${kind}`);

export const TABLE_CAPACITIES = [4, 6, 8, 10, 12, 14];

/** Hızlı kurulumun koyduğu gelin-damat masası (her iki dilde); otomatik yerleştirme buraya kimseyi oturtmaz. */
export const HEAD_TABLE_LABELS = ['Gelin & Damat', 'Bride & Groom'];
export const isHeadTable = (label: string) => HEAD_TABLE_LABELS.includes(label.trim());

// ---------------------------------------------------------------------------
// Geometri
// ---------------------------------------------------------------------------
export function roundDiameter(capacity: number) {
  return Math.round(64 + capacity * 5.2);
}

/** Öğenin gövde ölçüsü (sandalyeler hariç). */
export function bodySize(item: Pick<SeatingItem, 'kind' | 'shape' | 'capacity' | 'width' | 'height'>): { w: number; h: number } {
  if (item.kind === 'table') {
    if (item.shape === 'round') {
      const d = roundDiameter(item.capacity);
      return { w: d, h: d };
    }
    const perSide = Math.max(1, Math.ceil(item.capacity / 2));
    return { w: Math.max(120, perSide * 36 + 16), h: 64 };
  }
  const spec = objectSpec(item.kind);
  return { w: item.width || spec?.w || 120, h: item.height || spec?.h || 80 };
}

/** Sandalyeler dahil kapladığı alan (yerleşim ve sınır kontrolü için). */
export function footprint(item: Pick<SeatingItem, 'kind' | 'shape' | 'capacity' | 'width' | 'height' | 'rotation'>) {
  const b = bodySize(item);
  const pad = item.kind === 'table' ? (CHAIR_GAP + CHAIR / 2) * 2 : 0;
  // Yuvarlak masada sandalyeler dört yanda, dikdörtgende yalnızca uzun kenarlarda.
  let w = b.w + (item.kind === 'table' && item.shape === 'round' ? pad : 0);
  let h = b.h + pad;
  if (Math.round(item.rotation / 90) % 2 !== 0) [w, h] = [h, w];
  return { w, h };
}

export const CHAIR_SIZE = CHAIR;

/** Sandalye merkezleri, masa merkezine göre (döndürülmemiş). */
export function chairPositions(item: Pick<SeatingItem, 'kind' | 'shape' | 'capacity'>): { x: number; y: number }[] {
  if (item.kind !== 'table') return [];
  const n = item.capacity;
  if (item.shape === 'round') {
    const r = roundDiameter(n) / 2 + CHAIR_GAP;
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      return { x: Math.cos(a) * r, y: Math.sin(a) * r };
    });
  }
  const top = Math.ceil(n / 2);
  const bottom = n - top;
  const { h } = bodySize({ kind: 'table', shape: 'rect', capacity: n, width: 0, height: 0 });
  const row = (count: number, y: number) => Array.from({ length: count }, (_, i) => ({ x: (i - (count - 1) / 2) * 36, y }));
  return [...row(top, -h / 2 - CHAIR_GAP), ...row(bottom, h / 2 + CHAIR_GAP)];
}

export function hallHeight(items: SeatingItem[]) {
  let maxY = 0;
  for (const it of items) maxY = Math.max(maxY, it.y + footprint(it).h / 2);
  return Math.max(HALL_MIN_H, Math.ceil((maxY + 140) / 100) * 100);
}

export function clampToHall(item: SeatingItem, x: number, y: number, hallH: number) {
  const f = footprint(item);
  const snap = (v: number) => Math.round(v / GRID) * GRID;
  return {
    x: snap(Math.min(HALL_W - f.w / 2, Math.max(f.w / 2, x))),
    // Aşağı doğru salon büyüyebilsin diye alt sınıra 300 birim pay bırakılır.
    y: snap(Math.min(hallH + 300 - f.h / 2, Math.max(f.h / 2, y))),
  };
}

export function nextTableNumber(items: Pick<SeatingItem, 'kind' | 'label'>[]) {
  let max = 0;
  for (const it of items) {
    if (it.kind !== 'table') continue;
    const m = /(\d+)\s*$/.exec(it.label);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

export function nextTableLabel(items: Pick<SeatingItem, 'kind' | 'label'>[], t: TFn) {
  return t('hall.tableLabel', { n: nextTableNumber(items) });
}

/** Yeni öğe için salonda boş bir yer arar (üstten aşağı, soldan sağa). */
export function findFreeSpot(items: SeatingItem[], probe: Pick<SeatingItem, 'kind' | 'shape' | 'capacity' | 'width' | 'height' | 'rotation'>) {
  const f = footprint(probe);
  const overlaps = (x: number, y: number) =>
    items.some((it) => {
      const g = footprint(it);
      return Math.abs(it.x - x) < (g.w + f.w) / 2 + 12 && Math.abs(it.y - y) < (g.h + f.h) / 2 + 12;
    });
  for (let y = f.h / 2 + 40; y < 4000; y += 20) {
    for (let x = f.w / 2 + 40; x <= HALL_W - f.w / 2 - 40; x += 20) {
      if (!overlaps(x, y)) return { x: Math.round(x / GRID) * GRID, y: Math.round(y / GRID) * GRID };
    }
  }
  return { x: HALL_W / 2, y: 200 };
}

// ---------------------------------------------------------------------------
// Koltuk sayımı
// ---------------------------------------------------------------------------
/**
 * Bir hanenin kaç koltuk tutacağı: geliyorsa bildirdiği kişi sayısı,
 * henüz cevap vermediyse izin verilen üst sınır (yer ayırmak güvenli taraf), gelmiyorsa 0.
 */
export function seatsFor(inv: Pick<InvitationWithContact, 'status' | 'party_size'> & { contacts: Pick<InvitationWithContact['contacts'], 'max_party'> }) {
  if (inv.status === 'no') return 0;
  if (inv.status === 'yes') return Math.max(1, inv.party_size ?? 1);
  return Math.max(1, inv.contacts.max_party ?? 1);
}

export type TableLoad = { used: number; capacity: number; guests: InvitationWithContact[] };

export function tableLoads(items: SeatingItem[], invitations: InvitationWithContact[]) {
  const loads = new Map<string, TableLoad>();
  for (const it of items) if (it.kind === 'table') loads.set(it.id, { used: 0, capacity: it.capacity, guests: [] });
  for (const inv of invitations) {
    if (!inv.table_id) continue;
    const l = loads.get(inv.table_id);
    if (!l) continue;
    l.used += seatsFor(inv);
    l.guests.push(inv);
  }
  return loads;
}

// ---------------------------------------------------------------------------
// Hızlı kurulum
// ---------------------------------------------------------------------------
export type QuickSetup = {
  people: number;
  capacity: number;
  shape: 'round' | 'rect';
  stage: boolean;
  dance: boolean;
  headTable: boolean;
  entrance: boolean;
};

export type NewSeatingItem = Omit<SeatingItem, 'id' | 'event_id'>;

const obj = (kind: Exclude<SeatingKind, 'table'>, x: number, y: number, t: TFn): NewSeatingItem => {
  const s = objectSpec(kind)!;
  return { kind, label: objectName(kind, t), shape: s.round ? 'round' : 'rect', capacity: 0, x, y, rotation: 0, width: s.w, height: s.h };
};

/** "300 kişi, 10'luk masa" gibi bir girdiden komple salon düzeni üretir. */
export function buildQuickLayout(q: QuickSetup, t: TFn): NewSeatingItem[] {
  const out: NewSeatingItem[] = [];
  const cx = HALL_W / 2;
  let y = 40;

  if (q.stage) {
    out.push(obj('stage', cx, y + 60, t));
    y += 120 + 30;
  }
  if (q.headTable) {
    out.push({ kind: 'table', label: t('hall.headTable'), shape: 'rect', capacity: 2, x: cx, y: y + 58, rotation: 0, width: 0, height: 0 });
    y += 116 + 20;
  }
  if (q.dance) {
    out.push(obj('dance', cx, y + 100, t));
    y += 200 + 40;
  }

  const count = Math.max(1, Math.ceil(q.people / q.capacity));
  const probe = { kind: 'table' as const, shape: q.shape, capacity: q.capacity, width: 0, height: 0, rotation: 0 };
  const f = footprint(probe);
  const cellW = f.w + 26;
  const cellH = f.h + 26;
  const cols = Math.max(1, Math.floor((HALL_W - 80) / cellW));
  const rows = Math.ceil(count / cols);
  for (let i = 0; i < count; i++) {
    const r = Math.floor(i / cols);
    const inRow = r === rows - 1 ? count - r * cols : cols;
    const c = i - r * cols;
    const rowW = inRow * cellW;
    const x = cx - rowW / 2 + cellW / 2 + c * cellW;
    out.push({
      kind: 'table',
      label: t('hall.tableLabel', { n: i + 1 }),
      shape: q.shape,
      capacity: q.capacity,
      x: Math.round(x / GRID) * GRID,
      y: Math.round((y + cellH / 2 + r * cellH) / GRID) * GRID,
      rotation: 0,
      width: 0,
      height: 0,
    });
  }
  y += rows * cellH + 20;

  if (q.entrance) out.push(obj('entrance', cx, Math.round((y + 20) / GRID) * GRID, t));
  return out;
}

// ---------------------------------------------------------------------------
// Otomatik yerleştirme
// ---------------------------------------------------------------------------
const SIDE_ORDER: (Side | null)[] = ['gelin', 'damat', 'ortak', null];

/**
 * Masası olmayan haneleri yerleştirir; mevcut atamalara dokunmaz.
 * Aynı taraftaki aileler yan yana düşsün diye gelin tarafı salonun solundan,
 * damat tarafı sağından, ortaklar ortadan doldurulur. Bir hane bölünmez.
 */
export function autoAssign(items: SeatingItem[], invitations: InvitationWithContact[]) {
  const tables = items.filter((it) => it.kind === 'table' && !isHeadTable(it.label));
  const loads = tableLoads(items, invitations);
  const sides = new Map<string, Map<string, number>>();
  for (const t of tables) sides.set(t.id, new Map());
  for (const inv of invitations) {
    if (inv.table_id && sides.has(inv.table_id)) {
      const m = sides.get(inv.table_id)!;
      const k = inv.contacts.side ?? '-';
      m.set(k, (m.get(k) ?? 0) + 1);
    }
  }

  const waiting = invitations
    .filter((i) => !i.table_id && seatsFor(i) > 0)
    .sort((a, b) => SIDE_ORDER.indexOf(a.contacts.side) - SIDE_ORDER.indexOf(b.contacts.side) || seatsFor(b) - seatsFor(a));

  const cx = HALL_W / 2;
  const orderFor = (side: Side | null) =>
    [...tables].sort((a, b) =>
      side === 'gelin' ? a.x - b.x || a.y - b.y : side === 'damat' ? b.x - a.x || a.y - b.y : Math.abs(a.x - cx) - Math.abs(b.x - cx) || a.y - b.y,
    );

  const assignments: { id: string; table_id: string }[] = [];
  let unplaced = 0;
  for (const inv of waiting) {
    const need = seatsFor(inv);
    const side = inv.contacts.side ?? '-';
    const order = orderFor(inv.contacts.side);
    const free = (t: SeatingItem) => t.capacity - loads.get(t.id)!.used;
    const sameSide = order.find((t) => free(t) >= need && (sides.get(t.id)!.get(side) ?? 0) > 0);
    const empty = order.find((t) => free(t) >= need && loads.get(t.id)!.used === 0);
    const any = order.find((t) => free(t) >= need);
    const pick = sameSide ?? empty ?? any;
    if (!pick) {
      unplaced++;
      continue;
    }
    loads.get(pick.id)!.used += need;
    const m = sides.get(pick.id)!;
    m.set(side, (m.get(side) ?? 0) + 1);
    assignments.push({ id: inv.id, table_id: pick.id });
  }
  return { assignments, unplaced };
}

// ---------------------------------------------------------------------------
// Salon için paylaşılabilir liste
// ---------------------------------------------------------------------------
export function seatingText(title: string, items: SeatingItem[], invitations: InvitationWithContact[], t: TFn) {
  const loads = tableLoads(items, invitations);
  const tables = items
    .filter((it) => it.kind === 'table')
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  const lines = [t('hall.listTitle', { title }), ''];
  for (const table of tables) {
    const l = loads.get(table.id)!;
    lines.push(`${table.label} (${l.used}/${table.capacity})`);
    for (const g of l.guests) lines.push(`  • ${g.contacts.name}${seatsFor(g) > 1 ? ` ${t('hall.partyOf', { count: seatsFor(g) })}` : ''}`);
    lines.push('');
  }
  const left = invitations.filter((i) => !i.table_id && seatsFor(i) > 0);
  if (left.length) {
    lines.push(t('hall.unassigned'));
    for (const g of left) lines.push(`  • ${g.contacts.name} (${seatsFor(g)})`);
  }
  return lines.join('\n').trim();
}
