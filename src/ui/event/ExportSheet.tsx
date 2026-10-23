import { useState } from 'react';
import { View } from 'react-native';

import { formatShortDate, formatWhen } from '@/core/format';
import type { EventRow, EventSettings, InvitationWithContact } from '@/core/types';
import { buildCsv, buildXlsx, type Cell } from '@/core/xlsx';
import { type TKey, useI18n } from '@/i18n';
import { tableLabels } from '@/lib/api-tools';
import { OptionChip } from '@/ui/guests/common';
import { shareBinaryFile, shareTextFile } from '@/ui/guests/fileio';
import { Button, Caption, Label, Notice } from '@/ui/primitives';
import { printHtml } from '@/ui/seating/printCards';
import { Sheet } from '@/ui/Sheet';

const esc = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

type Col = { key: string; label: string; width: number; get: (i: InvitationWithContact) => Cell };

/** Davetli listesini Excel, CSV ya da yazdırılabilir tablo (PDF) olarak verir. */
export function ExportSheet({ open, onClose, event, invitations }: { open: boolean; onClose: () => void; event: EventRow; invitations: InvitationWithContact[] }) {
  const { t, locale } = useI18n();
  const [which, setWhich] = useState<'all' | 'yes'>('all');
  const [busy, setBusy] = useState<'xlsx' | 'csv' | 'pdf' | null>(null);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const s = (event.settings ?? {}) as EventSettings;
  const saha = event.type === 'saha';
  const fee = typeof s.fee === 'number' && s.fee > 0;

  const columns = (tables: Record<string, string>): Col[] => {
    const c = (k: string) => t(`tools.export.cols.${k}` as TKey);
    const cols: Col[] = [
      { key: 'name', label: c('name'), width: 26, get: (i) => i.contacts.name },
      { key: 'phone', label: c('phone'), width: 16, get: (i) => i.contacts.phone },
      { key: 'email', label: c('email'), width: 24, get: (i) => i.contacts.email },
    ];
    if (!saha) {
      cols.push({ key: 'side', label: c('side'), width: 14, get: (i) => (i.contacts.side ? t(`status.side.${i.contacts.side}`) : null) });
      cols.push({ key: 'group', label: c('group'), width: 14, get: (i) => i.contacts.group_label });
    }
    cols.push({ key: 'status', label: c('status'), width: 12, get: (i) => t(`status.rsvp.${i.status}`) });
    cols.push({ key: 'party', label: c('party'), width: 7, get: (i) => (i.status === 'yes' ? i.party_size || 1 : 0) });
    if (s.ask_children || invitations.some((i) => i.children > 0)) cols.push({ key: 'children', label: c('children'), width: 7, get: (i) => (i.status === 'yes' ? i.children : 0) });
    if (s.ask_names || invitations.some((i) => i.companions?.length)) cols.push({ key: 'companions', label: c('companions'), width: 30, get: (i) => (i.companions ?? []).join(', ') });
    if ((s.menu ?? []).length) cols.push({ key: 'menu', label: c('menu'), width: 14, get: (i) => i.menu });
    if (Object.keys(tables).length) cols.push({ key: 'table', label: c('table'), width: 12, get: (i) => (i.table_id ? tables[i.table_id] : null) });
    for (const q of s.questions ?? []) cols.push({ key: `q_${q.id}`, label: q.label, width: 18, get: (i) => i.answers?.[q.id] ?? null });
    cols.push({ key: 'note', label: c('note'), width: 30, get: (i) => i.note });
    cols.push({ key: 'opened', label: c('opened'), width: 14, get: (i) => (i.opened_at ? formatShortDate(i.opened_at, locale) : null) });
    if (s.checkin || invitations.some((i) => i.checked_in_at)) cols.push({ key: 'checkedIn', label: c('checkedIn'), width: 8, get: (i) => (i.checked_in_at ? (i.checked_in_people ?? i.party_size ?? 1) : null) });
    if (fee) cols.push({ key: 'paid', label: c('paid'), width: 8, get: (i) => (i.paid ? '✓' : i.paid_claimed_at ? '?' : null) });
    return cols;
  };

  const rows = which === 'yes' ? invitations.filter((i) => i.status === 'yes') : invitations;
  const people = rows.filter((i) => i.status === 'yes').reduce((n, i) => n + (i.party_size || 1), 0);
  const kids = rows.filter((i) => i.status === 'yes').reduce((n, i) => n + (i.children || 0), 0);
  const totals = t('tools.export.totals', { households: rows.filter((i) => i.status === 'yes').length, people, children: kids });
  const base = `${t('tools.export.fileName')}-${event.title
    .toLocaleLowerCase('tr-TR')
    .replace(/[^a-z0-9çğıöşü]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)}`;

  const run = async (kind: 'xlsx' | 'csv' | 'pdf') => {
    setMsg(null);
    setBusy(kind);
    try {
      const tables = await tableLabels(event.id).catch(() => ({}));
      const cols = columns(tables);
      const header = cols.map((c) => c.label);
      const data = rows.map((i) => cols.map((c) => c.get(i)));
      if (kind === 'xlsx') {
        const bytes = buildXlsx(t('tools.export.sheetName'), header, data, cols.map((c) => c.width));
        await shareBinaryFile(`${base}.xlsx`, bytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'org.openxmlformats.spreadsheetml.sheet');
      } else if (kind === 'csv') {
        await shareTextFile(`${base}.csv`, buildCsv(header, data, locale.startsWith('tr') ? ';' : ','));
      } else {
        const when = formatWhen(event.starts_at, locale);
        const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(event.title)}</title>
<style>
  @page { size: A4 landscape; margin: 10mm; }
  body { font-family: Helvetica, Arial, sans-serif; color: #1F1B2E; font-size: 10px; }
  h1 { font-size: 18px; margin: 0 0 2px; } .sub { color: #6B6680; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; background: #F3F0EA; padding: 5px 6px; font-size: 9px; text-transform: uppercase; letter-spacing: .04em; }
  td { padding: 5px 6px; border-bottom: 1px solid #ECE8E1; vertical-align: top; }
  tr { page-break-inside: avoid; }
</style></head><body>
<h1>${esc(event.title)}</h1>
<div class="sub">${esc([when, event.venue_name, totals].filter(Boolean).join(' · '))}</div>
<table><thead><tr>${header.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
<tbody>${data.map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>
</body></html>`;
        const out = await printHtml(html);
        if (out === 'popup_blocked') throw new Error(t('seating.print.popupBlocked'));
        if (out === 'failed') throw new Error(t('seating.print.failed'));
      }
      setMsg({ tone: 'success', text: t('tools.export.done') });
    } catch (e) {
      setMsg({ tone: 'error', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('tools.export.title')} italic={t('tools.export.titleAccent')} subtitle={t('tools.export.subtitle')} maxWidth={560}>
      <View style={{ gap: 16 }}>
        <View style={{ gap: 8 }}>
          <Label>{t('tools.export.which')}</Label>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <OptionChip label={`${t('tools.export.all')} (${invitations.length})`} on={which === 'all'} onPress={() => setWhich('all')} />
            <OptionChip label={`${t('tools.export.yes')} (${invitations.filter((i) => i.status === 'yes').length})`} on={which === 'yes'} onPress={() => setWhich('yes')} />
          </View>
          <Caption>{totals}</Caption>
        </View>
        {msg && <Notice tone={msg.tone} text={msg.text} />}
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          <Button label={t('tools.export.excel')} icon="download" loading={busy === 'xlsx'} disabled={!rows.length} onPress={() => run('xlsx')} />
          <Button label={t('tools.export.pdf')} icon="print" variant="secondary" loading={busy === 'pdf'} disabled={!rows.length} onPress={() => run('pdf')} />
          <Button label={t('tools.export.csv')} variant="ghost" loading={busy === 'csv'} disabled={!rows.length} onPress={() => run('csv')} />
        </View>
      </View>
    </Sheet>
  );
}
