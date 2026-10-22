// Masa kartları ve isim kartları: yazdırılabilir HTML (A4) üretir ve yazdırır.
// Native: expo-print (iOS/Android yazdırma penceresi; oradan PDF olarak da kaydedilebilir).
// Web: yeni pencerede açıp tarayıcının yazdırma penceresi (expo-print web'de yalnızca mevcut sayfayı yazdırır).
// Tüm metinler escape edilir.
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export type CardTable = { label: string; guests: { name: string; count: number }[] };

export type CardStrings = {
  docTitle: string;
  eventTitle: string;
  dateLine: string | null;
  tableHeading: string;
  emptyTable: string;
  guestsLabel: (count: number) => string;
};

const esc = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** "Masa 7" / "Table 7" → { kicker: "Masa", big: "7" }; özel adlar olduğu gibi. */
function splitLabel(label: string, heading: string) {
  const m = /^(.*?)(\d+)\s*$/.exec(label.trim());
  if (m && m[1].trim().length <= 12) return { kicker: m[1].trim() || heading, big: m[2] };
  return { kicker: heading, big: label.trim() };
}

export function buildCardsHtml(tables: CardTable[], tents: boolean, s: CardStrings): string {
  const sorted = [...tables].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  const tableCards = sorted
    .map((tb) => {
      const { kicker, big } = splitLabel(tb.label, s.tableHeading);
      const total = tb.guests.reduce((a, g) => a + g.count, 0);
      const names = tb.guests.length
        ? tb.guests.map((g) => `<li>${esc(g.name)}${g.count > 1 ? ` <span class="n">(${g.count})</span>` : ''}</li>`).join('')
        : `<li class="empty">${esc(s.emptyTable)}</li>`;
      return `<section class="card">
  <div class="event">${esc(s.eventTitle)}</div>
  <div class="kicker">${esc(kicker)}</div>
  <div class="big${big.length > 3 ? ' long' : ''}">${esc(big)}</div>
  <div class="rule"></div>
  <ul>${names}</ul>
  <div class="foot">${esc(s.guestsLabel(total))}</div>
</section>`;
    })
    .join('\n');

  const tentCards = tents
    ? sorted
        .flatMap((tb) => tb.guests.map((g) => ({ name: g.name, table: tb.label })))
        .map(
          (x) => `<section class="tent">
  <div class="half flip"><div class="tname">${esc(x.name)}</div><div class="ttable">${esc(x.table)}</div></div>
  <div class="half"><div class="tname">${esc(x.name)}</div><div class="ttable">${esc(x.table)}</div></div>
</section>`,
        )
        .join('\n')
    : '';

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(s.docTitle)}</title>
<style>
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1F1B2E; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; }
  .card { height: 133mm; border: 0.4mm solid #E7E1D8; border-radius: 6mm; padding: 9mm 8mm; display: flex; flex-direction: column; align-items: center; text-align: center; break-inside: avoid; page-break-inside: avoid; background: #FFFDF9; }
  .event { font-size: 8.5pt; letter-spacing: 0.18em; text-transform: uppercase; color: #8A8590; }
  .kicker { margin-top: 7mm; font-family: Georgia, 'Times New Roman', serif; font-style: italic; font-size: 15pt; color: #6C5CE7; }
  .big { font-family: Georgia, 'Times New Roman', serif; font-size: 64pt; line-height: 1; margin-top: 1mm; }
  .big.long { font-size: 30pt; line-height: 1.15; }
  .rule { width: 16mm; height: 0.5mm; background: #FF6B6B; margin: 6mm 0 5mm; border-radius: 1mm; }
  ul { list-style: none; margin: 0; padding: 0; font-size: 10.5pt; line-height: 1.55; flex: 1; overflow: hidden; }
  li .n { color: #8A8590; font-size: 9pt; }
  li.empty { color: #A9A49D; font-style: italic; }
  .foot { font-size: 8pt; color: #A9A49D; letter-spacing: 0.08em; }
  .tents { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; break-before: page; page-break-before: always; }
  .tent { height: 64mm; border: 0.3mm dashed #CFC8BE; border-radius: 3mm; display: flex; flex-direction: column; break-inside: avoid; page-break-inside: avoid; }
  .half { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0 6mm; text-align: center; }
  .half + .half { border-top: 0.3mm dashed #CFC8BE; }
  .flip { transform: rotate(180deg); }
  .tname { font-family: Georgia, 'Times New Roman', serif; font-size: 17pt; line-height: 1.15; }
  .ttable { margin-top: 1.5mm; font-size: 8pt; letter-spacing: 0.16em; text-transform: uppercase; color: #8A8590; }
  h1 { font-family: Georgia, 'Times New Roman', serif; font-weight: 400; font-size: 20pt; margin: 0 0 1mm; }
  .date { font-size: 9pt; color: #8A8590; margin-bottom: 6mm; }
</style></head><body>
<h1>${esc(s.eventTitle)}</h1>
${s.dateLine ? `<div class="date">${esc(s.dateLine)}</div>` : '<div class="date"></div>'}
<div class="grid">${tableCards}</div>
${tents && tentCards ? `<div class="tents">${tentCards}</div>` : ''}
</body></html>`;
}

export type PrintOutcome = 'ok' | 'popup_blocked' | 'failed';

export async function printHtml(html: string): Promise<PrintOutcome> {
  if (Platform.OS === 'web') {
    const w = typeof window !== 'undefined' ? window.open('', '_blank') : null;
    if (!w) return 'popup_blocked';
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => {
      try {
        w.print();
      } catch {
        // kullanıcı pencereyi kapattıysa
      }
    }, 300);
    return 'ok';
  }
  try {
    await Print.printAsync({ html, width: 595, height: 842 });
    return 'ok';
  } catch {
    // Yazıcı penceresi açılamazsa PDF üretip paylaş.
    try {
      const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
      return 'ok';
    } catch {
      return 'failed';
    }
  }
}
