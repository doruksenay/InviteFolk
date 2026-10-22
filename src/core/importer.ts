// Excel (XLSX) ve CSV'den davetli listesi okuma. Harici Excel kütüphanesi yok: XLSX bir zip arşividir,
// fflate ile açılır ve iki XML (paylaşılan metinler + ilk sayfa) okunur. Tamamen istemcide çalışır.
import { strFromU8, unzipSync } from 'fflate';

import { normalizePhone } from './format';
import type { Side } from './types';

export type Table = string[][];

// ---------------------------------------------------------------------------
// Metin çözme: UTF-8 (BOM'lu/BOM'suz); bozuk görünürse Windows-1254 (Türkçe Excel'in CSV'si)
// ---------------------------------------------------------------------------
const CP1254_HIGH: Record<number, string> = {
  0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…', 0x86: '†', 0x87: '‡', 0x88: 'ˆ', 0x89: '‰', 0x8a: 'Š', 0x8b: '‹', 0x8c: 'Œ',
  0x91: '‘', 0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—', 0x98: '˜', 0x99: '™', 0x9a: 'š', 0x9b: '›', 0x9c: 'œ', 0x9f: 'Ÿ',
  0xd0: 'Ğ', 0xdd: 'İ', 0xde: 'Ş', 0xf0: 'ğ', 0xfd: 'ı', 0xfe: 'ş',
};

function decodeCp1254(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b < 0x80 ? String.fromCharCode(b) : (CP1254_HIGH[b] ?? String.fromCharCode(b));
  return out;
}

export function decodeText(bytes: Uint8Array): string {
  let start = 0;
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) start = 3;
  const body = bytes.subarray(start);
  const utf8 = strFromU8(body);
  // Geçersiz UTF-8 baytları U+FFFD olur; varsa dosya büyük olasılıkla Windows-1254'tür.
  return utf8.includes('�') ? decodeCp1254(body) : utf8;
}

// ---------------------------------------------------------------------------
// CSV: tırnaklı alanlar, kaçışlı tırnak (""), ; , ya da sekme ayraç, CRLF
// ---------------------------------------------------------------------------
function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim()) ?? '';
  const counts: [string, number][] = [';', ',', '\t'].map((d) => [d, firstLine.split(d).length - 1]);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ',';
}

export function parseCsv(input: string): Table {
  const text = input.replace(/^﻿/, '');
  const d = detectDelimiter(text);
  const rows: Table = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === '') {
      quoted = true;
    } else if (ch === d) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ''));
}

// ---------------------------------------------------------------------------
// XLSX: zip → xl/workbook.xml (ilk sayfa) → rels → sayfa XML'i + sharedStrings
// ---------------------------------------------------------------------------
function xmlUnescape(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&');
}

/** <si> ya da <is> içindeki tüm <t> parçalarını birleştirir (zengin metin dahil). */
function textRuns(xml: string): string {
  let out = '';
  const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out += m[1] ? xmlUnescape(m[1]) : '';
  return out;
}

function colIndex(ref: string): number {
  const letters = /^[A-Z]+/i.exec(ref)?.[0].toUpperCase() ?? 'A';
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** Excel sayısını metne çevirir: telefon gibi uzun tam sayılar bilimsel gösterime düşmesin. */
function numberText(v: string): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  if (Number.isInteger(n)) return BigInt(Math.round(n)).toString();
  return String(n);
}

export function parseXlsx(bytes: Uint8Array): Table {
  const files = unzipSync(bytes, {
    filter: (f) => f.name === 'xl/workbook.xml' || f.name === 'xl/_rels/workbook.xml.rels' || f.name === 'xl/sharedStrings.xml' || f.name.startsWith('xl/worksheets/sheet'),
  });
  const read = (name: string) => (files[name] ? strFromU8(files[name]) : null);

  const shared: string[] = [];
  const ss = read('xl/sharedStrings.xml');
  if (ss) {
    const re = /<si>([\s\S]*?)<\/si>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(ss))) shared.push(textRuns(m[1]));
  }

  // İlk sayfanın dosya yolu: workbook'taki ilk <sheet r:id> → rels'teki Target.
  let sheetPath = 'xl/worksheets/sheet1.xml';
  const wb = read('xl/workbook.xml');
  const rels = read('xl/_rels/workbook.xml.rels');
  const rid = wb ? /<sheet\b[^>]*\br:id="([^"]+)"/.exec(wb)?.[1] : undefined;
  if (rid && rels) {
    const target = new RegExp(`<Relationship\\b[^>]*Id="${rid}"[^>]*Target="([^"]+)"`).exec(rels)?.[1] ?? new RegExp(`<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="${rid}"`).exec(rels)?.[1];
    if (target) sheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
  }
  const sheet = read(sheetPath) ?? read(Object.keys(files).find((n) => n.startsWith('xl/worksheets/sheet')) ?? '');
  if (!sheet) throw new Error('xlsx_no_sheet');

  const rows: Table = [];
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let rm: RegExpExecArray | null;
  while ((rm = rowRe.exec(sheet))) {
    const row: string[] = [];
    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cm: RegExpExecArray | null;
    let next = 0;
    while ((cm = cellRe.exec(rm[1]))) {
      const attrs = cm[1];
      const inner = cm[2] ?? '';
      const ref = /\br="([A-Z]+\d+)"/i.exec(attrs)?.[1];
      const idx = ref ? colIndex(ref) : next;
      const type = /\bt="([^"]+)"/.exec(attrs)?.[1];
      const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
      let value = '';
      if (type === 's') value = shared[Number(v)] ?? '';
      else if (type === 'inlineStr') value = textRuns(/<is>([\s\S]*?)<\/is>/.exec(inner)?.[1] ?? '');
      else if (type === 'str' || type === 'e') value = v ? xmlUnescape(v) : '';
      else if (type === 'b') value = v === '1' ? 'TRUE' : 'FALSE';
      else if (v !== undefined) value = numberText(v);
      while (row.length < idx) row.push('');
      row[idx] = value.trim();
      next = idx + 1;
    }
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c !== ''));
}

export function isXlsx(bytes: Uint8Array): boolean {
  return bytes[0] === 0x50 && bytes[1] === 0x4b; // "PK" zip imzası
}

export function parseFile(bytes: Uint8Array, name = ''): Table {
  if (isXlsx(bytes) || /\.xlsx$/i.test(name)) return parseXlsx(bytes);
  return parseCsv(decodeText(bytes));
}

// ---------------------------------------------------------------------------
// Başlık tanıma ve satırlara dönüştürme
// ---------------------------------------------------------------------------
export type ColumnKey = 'name' | 'phone' | 'email' | 'party' | 'side' | 'group';
export const COLUMN_KEYS: ColumnKey[] = ['name', 'phone', 'email', 'party', 'side', 'group'];
export type Mapping = Partial<Record<ColumnKey, number>>;

const fold = (s: string) =>
  s
    .toLocaleLowerCase('tr-TR')
    .replace(/[ıİ]/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const ALIASES: Record<ColumnKey, string[]> = {
  name: ['ad', 'isim', 'ad soyad', 'adi soyadi', 'adi', 'isim soyisim', 'davetli', 'hane', 'name', 'full name', 'guest', 'guest name'],
  phone: ['telefon', 'tel', 'gsm', 'cep', 'cep telefonu', 'telefon numarasi', 'numara', 'phone', 'mobile', 'phone number', 'whatsapp'],
  email: ['e posta', 'eposta', 'mail', 'email', 'e mail', 'e mail adresi'],
  party: ['kisi', 'kisi sayisi', 'adet', 'max', 'en fazla', 'party', 'party size', 'guests', 'people', 'count'],
  side: ['taraf', 'side'],
  group: ['grup', 'group', 'kategori', 'category', 'sirket', 'company'],
};

/** İlk satır başlık mı? Başlık değilse sütunlar içerikten tahmin edilir. */
export function detectMapping(table: Table): { mapping: Mapping; hasHeader: boolean; confident: boolean } {
  const head = (table[0] ?? []).map(fold);
  const mapping: Mapping = {};
  head.forEach((h, i) => {
    for (const key of COLUMN_KEYS) {
      if (mapping[key] === undefined && ALIASES[key].includes(h)) mapping[key] = i;
    }
  });
  if (mapping.name !== undefined) return { mapping, hasHeader: true, confident: true };

  // Başlık yok: içerikten tahmin (telefona benzeyen, e-postaya benzeyen, kalan ilk metin = ad).
  const sample = table.slice(0, 20);
  const width = Math.max(0, ...sample.map((r) => r.length));
  const guess: Mapping = {};
  for (let c = 0; c < width; c++) {
    const vals = sample.map((r) => r[c] ?? '').filter(Boolean);
    if (!vals.length) continue;
    const ratio = (pred: (v: string) => boolean) => vals.filter(pred).length / vals.length;
    if (guess.email === undefined && ratio((v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) > 0.6) guess.email = c;
    else if (guess.phone === undefined && ratio((v) => !!normalizePhone(v)) > 0.6) guess.phone = c;
    else if (guess.party === undefined && ratio((v) => /^\d{1,2}$/.test(v)) > 0.8) guess.party = c;
    else if (guess.name === undefined && ratio((v) => /\p{L}/u.test(v)) > 0.6) guess.name = c;
  }
  return { mapping: guess, hasHeader: false, confident: false };
}

export type ImportRow = {
  line: number; // dosyadaki satır numarası (1'den)
  name: string;
  phone: string | null;
  email: string | null;
  max_party: number;
  side: Side | null;
  group: string | null;
  errors: ('name' | 'phone' | 'email')[];
};

const SIDE_WORDS: Record<string, Side> = {
  gelin: 'gelin', 'gelin tarafi': 'gelin', bride: 'gelin', "bride s side": 'gelin', 'bride side': 'gelin',
  damat: 'damat', 'damat tarafi': 'damat', groom: 'damat', 'groom s side': 'damat', 'groom side': 'damat',
  ortak: 'ortak', shared: 'ortak', both: 'ortak', 'her ikisi': 'ortak',
};

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function buildRows(table: Table, mapping: Mapping, hasHeader: boolean): ImportRow[] {
  const body = hasHeader ? table.slice(1) : table;
  const at = (r: string[], k: ColumnKey) => (mapping[k] === undefined ? '' : (r[mapping[k]!] ?? '').trim());
  return body.map((r, i) => {
    const errors: ImportRow['errors'] = [];
    const name = at(r, 'name').slice(0, 120);
    if (!name) errors.push('name');
    const rawPhone = at(r, 'phone');
    const phone = rawPhone ? normalizePhone(rawPhone) : null;
    if (rawPhone && !phone) errors.push('phone');
    const rawEmail = at(r, 'email').toLowerCase();
    const email = rawEmail ? (EMAIL_RE.test(rawEmail) && rawEmail.length <= 254 ? rawEmail : null) : null;
    if (rawEmail && !email) errors.push('email');
    const party = parseInt(at(r, 'party'), 10);
    const side = SIDE_WORDS[fold(at(r, 'side'))] ?? null;
    const group = at(r, 'group').slice(0, 40) || null;
    return {
      line: i + 1 + (hasHeader ? 1 : 0),
      name,
      phone,
      email,
      max_party: Number.isFinite(party) ? Math.min(20, Math.max(1, party)) : 1,
      side,
      group,
      errors,
    };
  });
}

/** Geçerli satırları import_guests RPC'sinin beklediği biçime çevirir. */
export function toRpcRows(rows: ImportRow[], opts: { sides: boolean }) {
  return rows
    .filter((r) => r.errors.length === 0)
    .map((r) => ({
      name: r.name,
      phone: r.phone,
      email: r.email,
      max_party: r.max_party,
      side: opts.sides ? r.side : null,
      group: r.group,
    }));
}

/** İndirilebilir örnek şablon. */
export function sampleCsv(lang: 'tr' | 'en', sides: boolean): string {
  const rows =
    lang === 'tr'
      ? [
          ['Ad Soyad', 'Telefon', 'E-posta', 'Kişi', sides ? 'Taraf' : 'Grup'],
          ['Ahmet Yılmaz ve ailesi', '0532 123 45 67', 'ahmet@ornek.com', '3', sides ? 'Gelin' : 'Aile'],
          ['Elif Şahin', '0541 080 83 33', '', '1', sides ? 'Damat' : 'İş'],
        ]
      : [
          ['Name', 'Phone', 'Email', 'Party', sides ? 'Side' : 'Group'],
          ['Ahmet Yılmaz and family', '+90 532 123 45 67', 'ahmet@example.com', '3', sides ? 'Bride' : 'Family'],
          ['Elif Şahin', '+90 541 080 83 33', '', '1', sides ? 'Groom' : 'Work'],
        ];
  const esc = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return '﻿' + rows.map((r) => r.map(esc).join(';')).join('\r\n') + '\r\n';
}
