import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import type { CustomQuestion } from '@/core/types';
import { useI18n } from '@/i18n';
import { Icon } from '@/ui/Icon';
import { Button, Caption, Field, Label } from '@/ui/primitives';
import { color, font, radius } from '@/ui/tokens';

import { OptionChip } from '../guests/common';

export const MAX_QUESTIONS = 3;
export const MAX_OPTIONS = 8;

/** Menü seçenekleri: etiket listesi (ekle / kaldır). */
export function MenuEditor({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim().slice(0, 30);
    if (!v || value.includes(v) || value.length >= MAX_OPTIONS) return;
    onChange([...value, v]);
    setDraft('');
  };
  return (
    <View style={{ gap: 10 }}>
      <Label>{t('wizard.editor.menu')}</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {value.map((m) => (
          <View key={m} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 14, paddingRight: 6, height: 36, borderRadius: 999, backgroundColor: color.surfaceSoft }}>
            <Text style={{ fontFamily: font.semibold, fontSize: 13, color: color.ink }}>{m}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t('wizard.editor.remove', { name: m })} onPress={() => onChange(value.filter((x) => x !== m))} hitSlop={8} style={{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' }}>
              <Icon name="close" size={12} color={color.muted} strokeWidth={2.4} />
            </Pressable>
          </View>
        ))}
      </View>
      {value.length < MAX_OPTIONS && (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={add}
            placeholder={t('wizard.editor.menuPlaceholder')}
            placeholderTextColor={color.faint}
            maxLength={30}
            accessibilityLabel={t('wizard.editor.menuPlaceholder')}
            style={{ flex: 1, height: 44, borderRadius: radius.pill, backgroundColor: color.surfaceSoft, paddingHorizontal: 16, fontFamily: font.medium, fontSize: 14, color: color.ink }}
          />
          <Button label={t('wizard.editor.add')} icon="plus" variant="secondary" onPress={add} disabled={!draft.trim()} />
        </View>
      )}
      <Caption>{t('wizard.editor.menuHint')}</Caption>
    </View>
  );
}

/** Davetliye sorulacak en fazla 3 özel soru (yazı ya da seçenekli). Kimlikler (q1, q2…) değişmez. */
export function QuestionsEditor({ value, onChange }: { value: CustomQuestion[]; onChange: (v: CustomQuestion[]) => void }) {
  const { t } = useI18n();
  const nextId = () => {
    const max = value.reduce((m, q) => Math.max(m, Number(/^q(\d+)$/.exec(q.id)?.[1] ?? 0)), 0);
    return `q${max + 1}`;
  };
  const update = (id: string, patch: Partial<CustomQuestion>) => onChange(value.map((q) => (q.id === id ? { ...q, ...patch } : q)));

  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 2 }}>
        <Label>{t('wizard.editor.questions')}</Label>
        <Caption>{t('wizard.editor.questionsHint')}</Caption>
      </View>
      {value.map((q, i) => (
        <View key={q.id} style={{ gap: 10, padding: 14, borderRadius: radius.lg, backgroundColor: color.surfaceSoft }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Caption>{t('wizard.editor.questionN', { n: i + 1 })}</Caption>
            <Pressable accessibilityRole="button" accessibilityLabel={t('wizard.editor.removeQuestion')} onPress={() => onChange(value.filter((x) => x.id !== q.id))} hitSlop={8}>
              <Icon name="trash" size={16} color={color.coralInk} strokeWidth={2} />
            </Pressable>
          </View>
          <Field label={t('wizard.editor.questionLabel')} placeholder={t('wizard.editor.questionPlaceholder')} value={q.label} onChangeText={(v) => update(q.id, { label: v.slice(0, 120) })} maxLength={120} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <OptionChip small label={t('wizard.editor.typeText')} on={q.type === 'text'} onPress={() => update(q.id, { type: 'text', options: undefined })} icon="edit" />
            <OptionChip small label={t('wizard.editor.typeChoice')} on={q.type === 'choice'} onPress={() => update(q.id, { type: 'choice', options: q.options?.length ? q.options : [] })} icon="list" />
          </View>
          {q.type === 'choice' && (
            <Field
              label={t('wizard.editor.options')}
              placeholder={t('wizard.editor.optionsPlaceholder')}
              value={(q.options ?? []).join(', ')}
              onChangeText={(v) =>
                update(q.id, {
                  options: v
                    .split(',')
                    .map((s) => s.trimStart().slice(0, 40))
                    .slice(0, MAX_OPTIONS),
                })
              }
              hint={t('wizard.editor.optionsHint')}
            />
          )}
        </View>
      ))}
      {value.length < MAX_QUESTIONS && (
        <Button label={t('wizard.editor.addQuestion')} icon="plus" variant="secondary" onPress={() => onChange([...value, { id: nextId(), label: '', type: 'text' }])} style={{ alignSelf: 'flex-start' }} />
      )}
    </View>
  );
}

/** Kaydetmeden önce soruları temizler ve doğrular. Hata varsa sözlük anahtarı döner. */
export function cleanQuestions(qs: CustomQuestion[]): { questions: CustomQuestion[]; error: 'label' | 'options' | null } {
  const out: CustomQuestion[] = [];
  for (const q of qs) {
    const label = q.label.trim();
    if (!label) return { questions: [], error: 'label' };
    if (q.type === 'choice') {
      const options = Array.from(new Set((q.options ?? []).map((o) => o.trim()).filter(Boolean))).slice(0, MAX_OPTIONS);
      if (options.length < 2) return { questions: [], error: 'options' };
      out.push({ id: q.id, label, type: 'choice', options });
    } else out.push({ id: q.id, label, type: 'text' });
  }
  return { questions: out, error: null };
}
