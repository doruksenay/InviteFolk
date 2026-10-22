import * as DocumentPicker from 'expo-document-picker';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { buildRows, COLUMN_KEYS, type ColumnKey, detectMapping, type Mapping, parseFile, sampleCsv, type Table, toRpcRows } from '@/core/importer';
import { useI18n } from '@/i18n';
import { importGuests, type ImportResult } from '@/lib/api-guests';
import { Icon } from '@/ui/Icon';
import { Body, Button, Caption, Label, Notice, Toggle } from '@/ui/primitives';
import { Sheet } from '@/ui/Sheet';
import { color, font, radius } from '@/ui/tokens';

import { OptionChip, usesSides } from './common';
import { readPicked, shareTextFile } from './fileio';

type Stage = 'pick' | 'map' | 'preview' | 'done';

/** Excel/CSV'den davetli aktarma: dosya → sütun eşleştirme → önizleme → ekleme. */
export function ImportSheet({ open, onClose, eventId, eventType, onImported }: { open: boolean; onClose: () => void; eventId: string; eventType: string; onImported: (r: ImportResult) => void }) {
  const { t, lang } = useI18n();
  const sides = usesSides(eventType);
  const [stage, setStage] = useState<Stage>('pick');
  const [table, setTable] = useState<Table>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [hasHeader, setHasHeader] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const rows = useMemo(() => (table.length ? buildRows(table, mapping, hasHeader) : []), [table, mapping, hasHeader]);
  const valid = rows.filter((r) => !r.errors.length);
  const invalid = rows.filter((r) => r.errors.length);

  const reset = () => {
    setStage('pick');
    setTable([]);
    setMapping({});
    setErr(null);
    setInfo(null);
    setResult(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const pick = async () => {
    setErr(null);
    const res = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', '*/*'],
      multiple: false,
      copyToCacheDirectory: true,
      base64: false,
    });
    if (res.canceled || !res.assets?.length) return;
    const asset = res.assets[0];
    if ((asset.size ?? 0) > 5 * 1024 * 1024) {
      setErr(t('guests.import.readFailed'));
      return;
    }
    setBusy(t('guests.import.reading'));
    try {
      const bytes = await readPicked(asset);
      const tbl = parseFile(bytes, asset.name).slice(0, 2001);
      if (!tbl.length) {
        setErr(t('guests.import.empty'));
        return;
      }
      const det = detectMapping(tbl);
      setTable(tbl);
      setMapping(det.mapping);
      setHasHeader(det.hasHeader);
      setStage(det.confident ? 'preview' : 'map');
    } catch {
      setErr(t('guests.import.readFailed'));
    } finally {
      setBusy(null);
    }
  };

  const downloadTemplate = async () => {
    const ok = await shareTextFile(t('guests.import.templateName'), sampleCsv(lang, sides)).catch(() => false);
    if (ok) setInfo(t('guests.import.templateShared'));
  };

  const run = async () => {
    setErr(null);
    setBusy(t('guests.import.importing', { done: 0, total: valid.length }));
    try {
      const r = await importGuests(eventId, toRpcRows(rows, { sides }), (done, total) => setBusy(t('guests.import.importing', { done, total })));
      setResult(r);
      setStage('done');
      onImported(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const width = Math.max(0, ...table.slice(0, 50).map((r) => r.length));
  const header = hasHeader ? (table[0] ?? []) : [];
  const colLabel = (i: number) => header[i] || t('guests.import.columnN', { n: i + 1 });
  const keys = COLUMN_KEYS.filter((k) => (k === 'side' ? sides : k === 'group' ? !sides : true));

  const footer =
    stage === 'pick' ? null : stage === 'map' ? (
      <>
        <Button label={t('guests.import.back')} variant="ghost" onPress={reset} />
        <Button label={t('common.continue')} iconRight="arrowRight" disabled={mapping.name === undefined} onPress={() => setStage('preview')} />
      </>
    ) : stage === 'preview' ? (
      <>
        <Button label={t('guests.import.back')} variant="ghost" onPress={() => setStage('map')} />
        <Button label={busy ?? t('guests.import.importButton', { count: valid.length })} variant="accent" icon="upload" loading={!!busy} disabled={!valid.length} onPress={run} />
      </>
    ) : (
      <>
        <Button label={t('guests.import.another')} variant="ghost" onPress={reset} />
        <Button label={t('guests.import.done')} onPress={close} />
      </>
    );

  return (
    <Sheet open={open} onClose={close} title={t('guests.import.title')} italic={t('guests.import.titleAccent')} subtitle={t('guests.import.subtitle')} footer={footer} maxWidth={640}>
      {err && <Notice tone="error" text={err} />}
      {info && <Notice tone="success" text={info} />}

      {stage === 'pick' && (
        <View style={{ gap: 14 }}>
          <View style={{ alignItems: 'center', gap: 14, paddingVertical: 28, borderRadius: radius.lg, backgroundColor: color.surfaceSoft }}>
            <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="file" size={26} color={color.sage} />
            </View>
            <Button label={busy ?? t('guests.import.pick')} icon="upload" variant="accent" loading={!!busy} onPress={pick} />
            <Caption>.xlsx · .csv</Caption>
          </View>
          <Button label={t('guests.import.template')} icon="download" variant="secondary" onPress={downloadTemplate} style={{ alignSelf: 'flex-start' }} />
        </View>
      )}

      {stage === 'map' && (
        <View style={{ gap: 16 }}>
          <View style={{ gap: 4 }}>
            <Label>{t('guests.import.mapTitle')}</Label>
            <Caption>{t('guests.import.mapHint')}</Caption>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Text style={{ fontFamily: font.medium, fontSize: 15, color: color.ink }}>{t('guests.import.hasHeader')}</Text>
            <Toggle value={hasHeader} onChange={setHasHeader} label={t('guests.import.hasHeader')} />
          </View>
          {keys.map((k: ColumnKey) => (
            <View key={k} style={{ gap: 8 }}>
              <Label>{t(`guests.import.keys.${k}`)}</Label>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {k !== 'name' && <OptionChip small label={t('guests.import.none')} on={mapping[k] === undefined} onPress={() => setMapping({ ...mapping, [k]: undefined })} />}
                {Array.from({ length: width }, (_, i) => (
                  <OptionChip key={i} small label={colLabel(i).slice(0, 24)} on={mapping[k] === i} onPress={() => setMapping({ ...mapping, [k]: i })} />
                ))}
              </View>
            </View>
          ))}
        </View>
      )}

      {stage === 'preview' && (
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <View style={{ flexGrow: 1, backgroundColor: color.sageTint, borderRadius: radius.lg, padding: 14 }}>
              <Text style={{ fontFamily: font.semibold, fontSize: 14, color: color.sageInk }}>{t('guests.import.valid', { count: valid.length })}</Text>
            </View>
            {invalid.length > 0 && (
              <View style={{ flexGrow: 1, backgroundColor: color.goldTint, borderRadius: radius.lg, padding: 14 }}>
                <Text style={{ fontFamily: font.semibold, fontSize: 14, color: color.goldInk }}>{t('guests.import.invalidRows', { count: invalid.length })}</Text>
              </View>
            )}
          </View>
          <Label>{t('guests.import.previewTitle')}</Label>
          {[...invalid.slice(0, 20), ...valid.slice(0, Math.max(0, 40 - Math.min(20, invalid.length)))].map((r) => (
            <View key={r.line} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: color.hairline }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: r.errors.length ? color.gold : color.sage }} />
              <View style={{ flex: 1, gap: 1 }}>
                <Text numberOfLines={1} style={{ fontFamily: font.semibold, fontSize: 14, color: color.ink }}>
                  {r.name || '—'}
                </Text>
                <Caption numberOfLines={1}>
                  {[t('guests.import.line', { n: r.line }), r.phone, r.email, r.max_party > 1 ? t('common.people', { count: r.max_party }) : null, sides && r.side ? t(`status.side.${r.side}`) : r.group]
                    .filter(Boolean)
                    .join(' · ')}
                </Caption>
                {r.errors.length > 0 && <Caption color={color.goldInk}>{r.errors.map((e) => t(`guests.import.rowErrors.${e}`)).join(', ')}</Caption>}
              </View>
            </View>
          ))}
          {rows.length > 40 && <Caption>{t('guests.import.more', { count: rows.length - 40 })}</Caption>}
        </View>
      )}

      {stage === 'done' && result && (
        <View style={{ alignItems: 'center', gap: 12, paddingVertical: 20 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: color.sageTint, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" size={28} color={color.sageInk} strokeWidth={2.5} />
          </View>
          <Body center>
            {t('guests.result.added', { count: result.added })}
            {result.existing ? t('guests.result.existing', { count: result.existing }) : ''}
            {result.invalid ? t('guests.result.invalid', { count: result.invalid }) : ''}.
          </Body>
        </View>
      )}
    </Sheet>
  );
}
