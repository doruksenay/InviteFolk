import type { CSSProperties } from 'react';
import { View, type ViewStyle } from 'react-native';

import { Caption, Label } from '@/ui/primitives';
import { color, font, radius } from '@/ui/tokens';

// Web: tarayıcının kendi takvim ve saat seçicisi (telefonda dokunmatik çark, bilgisayarda takvim).
// Değer YYYY-AA-GG ve SS:DD; tarayıcı tarihi kullanıcının diline göre (ör. 12.06.2027) gösterir.
type Props = { label: string; value: string; onChange: (v: string) => void; hint?: string; style?: ViewStyle; error?: string | null };

const base = (error?: string | null): CSSProperties => ({
  height: 50,
  boxSizing: 'border-box',
  width: '100%',
  borderRadius: radius.md,
  padding: '0 14px',
  backgroundColor: color.surface,
  fontFamily: `${font.medium}, system-ui, sans-serif`,
  fontSize: 15,
  color: color.ink,
  border: 'none',
  outline: 'none',
  boxShadow: `inset 0 0 0 ${error ? '1.5px' : '1px'} ${error ? color.coral : color.hairline}`,
  colorScheme: 'light',
});

function Shell({ label, hint, error, style, children }: { label: string; hint?: string; error?: string | null; style?: ViewStyle; children: React.ReactNode }) {
  return (
    <View style={[{ gap: 8 }, style]}>
      <Label>{label}</Label>
      {children}
      {error ? <Caption color={color.coralInk}>{error}</Caption> : hint ? <Caption>{hint}</Caption> : null}
    </View>
  );
}

export function DateField({ label, value, onChange, hint, style, error }: Props) {
  return (
    <Shell label={label} hint={hint} error={error} style={style}>
      <input type="date" aria-label={label} value={/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ''} min="2020-01-01" max="2100-12-31" onChange={(e) => onChange(e.target.value)} style={base(error)} />
    </Shell>
  );
}

export function TimeField({ label, value, onChange, hint, style, error }: Props) {
  return (
    <Shell label={label} hint={hint} error={error} style={style}>
      <input type="time" aria-label={label} value={/^\d{2}:\d{2}$/.test(value) ? value : ''} step={300} onChange={(e) => onChange(e.target.value)} style={base(error)} />
    </Shell>
  );
}
