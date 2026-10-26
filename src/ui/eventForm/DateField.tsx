import { useState } from 'react';
import type { ViewStyle } from 'react-native';

import { useI18n } from '@/i18n';
import { Field } from '@/ui/primitives';

import { displayDate, normDate } from './dates';

// Uygulamada tarih GG.AA.YYYY biçiminde yazılır; değer her zaman YYYY-AA-GG olarak dışarı verilir.
// (Geçersiz yazım olduğu gibi iletilir; kaydederken doğrulama hatası gösterilir.)
type Props = { label: string; value: string; onChange: (v: string) => void; hint?: string; style?: ViewStyle; error?: string | null };

export function DateField({ label, value, onChange, hint, style, error }: Props) {
  const { t } = useI18n();
  const [text, setText] = useState(() => displayDate(value));
  return (
    <Field
      style={style}
      label={label}
      hint={hint ?? t('wizard.fields.dateFormat')}
      error={error}
      placeholder={t('wizard.fields.datePlaceholder')}
      value={text}
      keyboardType="numbers-and-punctuation"
      maxLength={10}
      onChangeText={(v) => {
        setText(v);
        onChange(normDate(v) ?? v);
      }}
    />
  );
}

export function TimeField({ label, value, onChange, hint, style, error }: Props) {
  return <Field style={style} label={label} hint={hint} error={error} placeholder="19:00" value={value} keyboardType="numbers-and-punctuation" maxLength={5} onChangeText={(v) => onChange(v.replace('.', ':'))} />;
}
