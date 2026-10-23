import { Pressable, Text, View } from 'react-native';

import { formatIban } from '@/core/iban';
import type { PollOption, SignupItem } from '@/core/types';
import { useI18n } from '@/i18n';
import { splitIso } from '@/ui/eventForm/dates';
import { Icon } from '@/ui/Icon';
import { Button, Caption, Field, Label, ToggleRow } from '@/ui/primitives';
import { color, font, radius } from '@/ui/tokens';

/** Kısa rastgele kimlik (program, anket ve getir listesi öğeleri için; veritabanı ^[a-z0-9]{1,12}$ bekler). */
export function shortId() {
  return Math.random().toString(36).slice(2, 10);
}

function RemoveButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8} style={{ padding: 4 }}>
      <Icon name="trash" size={16} color={color.coralInk} strokeWidth={2} />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Program
// ---------------------------------------------------------------------------
export type ProgramDraft = { id: string; title: string; date: string; time: string; venue: string; address: string };

export function programToDraft(items: { id: string; title: string; at?: string | null; venue?: string | null; address?: string | null }[] | undefined): ProgramDraft[] {
  return (items ?? []).map((p) => {
    const w = splitIso(p.at ?? null);
    return { id: p.id, title: p.title, date: w.date, time: w.time, venue: p.venue ?? '', address: p.address ?? '' };
  });
}

export function ProgramEditor({ value, onChange }: { value: ProgramDraft[]; onChange: (v: ProgramDraft[]) => void }) {
  const { t } = useI18n();
  const set = (id: string, patch: Partial<ProgramDraft>) => onChange(value.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  return (
    <View style={{ gap: 12 }}>
      {value.map((p, i) => (
        <View key={p.id} style={{ gap: 10, padding: 14, borderRadius: radius.lg, backgroundColor: color.surfaceSoft }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Caption>{`${i + 1}.`}</Caption>
            <RemoveButton label={t('tools.page.program.remove')} onPress={() => onChange(value.filter((x) => x.id !== p.id))} />
          </View>
          <Field label={t('tools.page.program.itemTitle')} placeholder={t('tools.page.program.itemTitlePlaceholder')} value={p.title} onChangeText={(v) => set(p.id, { title: v })} maxLength={80} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Field style={{ flex: 1 }} label={t('tools.page.program.date')} placeholder="2027-06-10" value={p.date} onChangeText={(v) => set(p.id, { date: v })} keyboardType="numbers-and-punctuation" />
            <Field style={{ width: 110 }} label={t('tools.page.program.time')} placeholder="19:00" value={p.time} onChangeText={(v) => set(p.id, { time: v })} keyboardType="numbers-and-punctuation" />
          </View>
          <Field label={t('tools.page.program.venue')} value={p.venue} onChangeText={(v) => set(p.id, { venue: v })} maxLength={160} />
          <Field label={t('tools.page.program.address')} value={p.address} onChangeText={(v) => set(p.id, { address: v })} maxLength={300} />
        </View>
      ))}
      {value.length < 8 && (
        <Button
          label={t('tools.page.program.add')}
          icon="plus"
          variant="secondary"
          onPress={() => onChange([...value, { id: shortId(), title: '', date: '', time: '', venue: '', address: '' }])}
          style={{ alignSelf: 'flex-start' }}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Takı / hediye / ödeme bilgisi
// ---------------------------------------------------------------------------
export type GiftDraft = { holder: string; iban: string; bank: string; note: string; public: boolean };

export function GiftEditor({ value, onChange, saha }: { value: GiftDraft; onChange: (v: GiftDraft) => void; saha: boolean }) {
  const { t } = useI18n();
  return (
    <View style={{ gap: 12 }}>
      <Field label={t('tools.page.gift.holder')} value={value.holder} onChangeText={(v) => onChange({ ...value, holder: v })} maxLength={80} autoCapitalize="words" />
      <Field
        label={t('tools.page.gift.iban')}
        placeholder={t('tools.page.gift.ibanPlaceholder')}
        value={value.iban}
        onChangeText={(v) => onChange({ ...value, iban: v.toUpperCase() })}
        onBlur={() => value.iban && onChange({ ...value, iban: formatIban(value.iban) })}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={42}
      />
      <Field label={t('tools.page.gift.bank')} value={value.bank} onChangeText={(v) => onChange({ ...value, bank: v })} maxLength={60} />
      <Field label={t('tools.page.gift.note')} placeholder={t('tools.page.gift.notePlaceholder')} value={value.note} onChangeText={(v) => onChange({ ...value, note: v })} maxLength={300} multiline />
      {!saha && <ToggleRow label={t('tools.page.gift.public')} hint={t('tools.page.gift.publicHint')} value={value.public} onChange={(v) => onChange({ ...value, public: v })} />}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Tarih anketi
// ---------------------------------------------------------------------------
export type PollDraft = { id: string; date: string; time: string };

export function pollToDraft(options: PollOption[] | undefined): PollDraft[] {
  return (options ?? []).map((o) => ({ id: o.id, ...splitIso(o.at) }));
}

export function PollEditor({
  value,
  onChange,
  tallies,
  chosen,
  onChoose,
}: {
  value: PollDraft[];
  onChange: (v: PollDraft[]) => void;
  tallies: Record<string, { yes: number; maybe: number }>;
  chosen: string | null;
  onChoose: (id: string) => void;
}) {
  const { t } = useI18n();
  const best = Object.entries(tallies).sort((a, b) => b[1].yes - a[1].yes || b[1].maybe - a[1].maybe)[0]?.[0];
  return (
    <View style={{ gap: 10 }}>
      {value.map((o, i) => {
        const tl = tallies[o.id];
        return (
          <View key={o.id} style={{ gap: 8, padding: 12, borderRadius: radius.lg, backgroundColor: o.id === chosen ? color.sageTint : color.surfaceSoft }}>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
              <Field style={{ flex: 1 }} label={`${i + 1}. ${t('tools.page.program.date')}`} placeholder="2027-05-08" value={o.date} onChangeText={(v) => onChange(value.map((x) => (x.id === o.id ? { ...x, date: v } : x)))} keyboardType="numbers-and-punctuation" />
              <Field style={{ width: 100 }} label={t('tools.page.program.time')} placeholder="20:00" value={o.time} onChangeText={(v) => onChange(value.map((x) => (x.id === o.id ? { ...x, time: v } : x)))} keyboardType="numbers-and-punctuation" />
              <View style={{ paddingBottom: 14 }}>
                <RemoveButton label={t('tools.page.program.remove')} onPress={() => onChange(value.filter((x) => x.id !== o.id))} />
              </View>
            </View>
            {tl ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <Text style={{ fontFamily: font.semibold, fontSize: 13, color: o.id === best ? color.sageInk : color.inkSoft }}>
                  {t('tools.page.poll.votes', { count: tl.yes })}
                  {tl.maybe ? ` · ${t('tools.page.poll.maybe', { count: tl.maybe })}` : ''}
                </Text>
                {o.id === chosen ? (
                  <Text style={{ fontFamily: font.bold, fontSize: 12, color: color.sageInk }}>{t('tools.page.poll.chosen')}</Text>
                ) : (
                  <Button label={t('tools.page.poll.choose')} icon="check" variant="secondary" onPress={() => onChoose(o.id)} />
                )}
              </View>
            ) : null}
          </View>
        );
      })}
      {value.length < 6 && (
        <Button label={t('tools.page.poll.add')} icon="plus" variant="secondary" onPress={() => onChange([...value, { id: shortId(), date: '', time: '' }])} style={{ alignSelf: 'flex-start' }} />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Getir listesi
// ---------------------------------------------------------------------------
export function SignupEditor({ value, onChange, claims }: { value: SignupItem[]; onChange: (v: SignupItem[]) => void; claims: { item_id: string; qty: number; name: string }[] }) {
  const { t } = useI18n();
  return (
    <View style={{ gap: 10 }}>
      {value.map((it) => {
        const mine = claims.filter((c) => c.item_id === it.id);
        const taken = mine.reduce((s, c) => s + c.qty, 0);
        return (
          <View key={it.id} style={{ gap: 8, padding: 12, borderRadius: radius.lg, backgroundColor: color.surfaceSoft }}>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
              <Field style={{ flex: 1 }} label={t('tools.page.signup.label')} placeholder={t('tools.page.signup.labelPlaceholder')} value={it.label} onChangeText={(v) => onChange(value.map((x) => (x.id === it.id ? { ...x, label: v.slice(0, 60) } : x)))} />
              <Field
                style={{ width: 80 }}
                label={t('tools.page.signup.qty')}
                value={String(it.qty)}
                onChangeText={(v) => onChange(value.map((x) => (x.id === it.id ? { ...x, qty: Math.max(1, Math.min(50, parseInt(v.replace(/\D/g, '') || '1', 10))) } : x)))}
                keyboardType="number-pad"
              />
              <View style={{ paddingBottom: 14 }}>
                <RemoveButton label={t('tools.page.program.remove')} onPress={() => onChange(value.filter((x) => x.id !== it.id))} />
              </View>
            </View>
            {mine.length > 0 && (
              <Caption>
                {t('tools.page.signup.claimed', { taken, qty: it.qty })} · {mine.map((c) => (c.qty > 1 ? `${c.name} (${c.qty})` : c.name)).join(', ')}
              </Caption>
            )}
          </View>
        );
      })}
      {value.length < 20 && (
        <Button label={t('tools.page.signup.add')} icon="plus" variant="secondary" onPress={() => onChange([...value, { id: shortId(), label: '', qty: 1 }])} style={{ alignSelf: 'flex-start' }} />
      )}
    </View>
  );
}

/** Bölüm başlığı + açıklama */
export function SectionHead({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Label style={{ fontFamily: font.bold, fontSize: 16 }}>{title}</Label>
      {hint ? <Caption>{hint}</Caption> : null}
    </View>
  );
}
