// Masaya konacak karekodlu kartlar (A4'e 4 kart): fotoğraf albümü, hediye bilgisi, bilgi toplama formu.
// Tüm metinler escape edilir; karekod SVG olarak gömülür (ağdan bir şey yüklenmez).
import type { InvitationTheme } from '@/core/themes';
import { qrSvgString } from '@/ui/QrCode';

const esc = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export function buildQrCardsHtml(args: { theme: InvitationTheme; eventTitle: string; heading: string; body: string; url: string; docTitle: string; lines?: string[] }) {
  const { theme } = args;
  const qr = qrSvgString(args.url, 220, '#1F1B2E');
  const card = `<div class="card">
  <div class="kicker">${esc(args.eventTitle)}</div>
  <div class="heading">${esc(args.heading)}</div>
  <div class="qr">${qr}</div>
  <div class="body">${esc(args.body)}</div>
  ${(args.lines ?? []).map((l) => `<div class="line">${esc(l)}</div>`).join('')}
  <div class="url">${esc(args.url.replace(/^https?:\/\//, ''))}</div>
</div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(args.docTitle)}</title>
<style>
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Helvetica, Arial, sans-serif; color: #1F1B2E; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; }
  .card { height: 132mm; border-radius: 6mm; background: ${theme.bg}; border: 0.4mm solid ${theme.shapeB}; padding: 8mm; display: flex; flex-direction: column; align-items: center; text-align: center; page-break-inside: avoid; }
  .kicker { font-size: 9pt; letter-spacing: 1.5pt; text-transform: uppercase; color: ${theme.dark ? theme.ink : theme.key_}; }
  .heading { font-family: Georgia, 'Times New Roman', serif; font-size: 22pt; margin-top: 3mm; color: ${theme.ink}; }
  .qr { margin-top: 6mm; padding: 3mm; background: #fff; border-radius: 3mm; }
  .qr svg { width: 52mm; height: 52mm; display: block; }
  .body { margin-top: 5mm; font-size: 11pt; line-height: 1.35; color: ${theme.ink}; }
  .line { margin-top: 1.5mm; font-size: 10pt; color: ${theme.ink}; font-weight: 600; letter-spacing: 0.5pt; }
  .url { margin-top: auto; font-size: 8pt; color: ${theme.soft}; word-break: break-all; }
</style></head><body><div class="grid">${card}${card}${card}${card}</div></body></html>`;
}
