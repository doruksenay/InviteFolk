import type { ReactNode } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import type { Side } from '@/core/types';
import { useI18n } from '@/i18n';
import { Icon, type IconName } from '@/ui/Icon';
import { Field, Label } from '@/ui/primitives';
import { color, font, radius } from '@/ui/tokens';

/** Taraf (gelin/damat) yalnızca düğün ailesinde anlamlı; diğer türlerde serbest "grup" etiketi kullanılır. */
export const usesSides = (type: string) => type === 'dugun' || type === 'nisan' || type === 'kina';

export function OptionChip({ label, on, onPress, icon, small, tone }: { label: string; on: boolean; onPress: () => void; icon?: IconName; small?: boolean; tone?: string }) {
  const bg = on ? (tone ?? color.ink) : color.surfaceSoft;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        height: small ? 32 : 38,
        paddingHorizontal: small ? 12 : 14,
        borderRadius: 999,
        backgroundColor: bg,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}>
      {icon && <Icon name={icon} size={14} color={on ? '#FFFFFF' : color.inkSoft} strokeWidth={2} />}
      <Text style={{ fontFamily: font.semibold, fontSize: small ? 12 : 13, color: on ? '#FFFFFF' : color.inkSoft }}>{label}</Text>
    </Pressable>
  );
}

export function SearchField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 46, borderRadius: radius.pill, backgroundColor: color.surfaceSoft, paddingHorizontal: 16 }}>
      <Icon name="search" size={16} color={color.muted} strokeWidth={2} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={color.faint}
        accessibilityLabel={placeholder}
        autoCorrect={false}
        style={{ flex: 1, fontFamily: font.medium, fontSize: 14, color: color.ink, height: 46 }}
      />
    </View>
  );
}

export function CheckRow({ checked, onPress, title, subtitle, right, disabled }: { checked: boolean; onPress: () => void; title: string; subtitle?: string; right?: ReactNode; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        marginHorizontal: -12,
        borderRadius: radius.md,
        backgroundColor: checked ? color.lavenderTint : pressed ? color.surfaceSoft : 'transparent',
        opacity: disabled ? 0.45 : 1,
      })}>
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 7,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: checked ? color.lavender : '#FFFFFF',
          boxShadow: checked ? 'none' : `inset 0 0 0 1.5px ${color.ring}`,
        }}>
        {checked && <Icon name="check" size={12} color="#FFFFFF" strokeWidth={3.5} />}
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text numberOfLines={1} style={{ fontFamily: font.semibold, fontSize: 14, color: color.ink }}>
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={{ fontFamily: font.regular, fontSize: 12, color: color.muted }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </Pressable>
  );
}

/** Düğün türlerinde taraf seçimi, diğerlerinde grup etiketi alanı. */
export function SideOrGroup({
  type,
  side,
  onSide,
  group,
  onGroup,
}: {
  type: string;
  side: Side | null;
  onSide: (s: Side | null) => void;
  group: string;
  onGroup: (g: string) => void;
}) {
  const { t } = useI18n();
  if (usesSides(type)) {
    return (
      <View style={{ gap: 8 }}>
        <Label>{t('guests.adder.side')}</Label>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {(['gelin', 'damat', 'ortak'] as Side[]).map((s) => (
            <OptionChip key={s} label={t(`status.side.${s}`)} on={side === s} onPress={() => onSide(side === s ? null : s)} />
          ))}
        </View>
      </View>
    );
  }
  return <Field label={t('guests.adder.group')} placeholder={t('guests.adder.groupPlaceholder')} value={group} onChangeText={onGroup} maxLength={40} hint={t('guests.adder.groupHint')} />;
}

/** "−  3  +" küçük sayı seçici. */
export function NumberStepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (v: number) => void; label: string }) {
  const btn = (icon: IconName, next: number) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} ${icon === 'plus' ? '+' : '−'}`}
      disabled={next < min || next > max}
      onPress={() => onChange(next)}
      style={({ pressed }) => ({
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: color.surface,
        boxShadow: '0px 2px 6px rgba(40,30,20,0.08)',
        opacity: next < min || next > max ? 0.35 : 1,
        transform: [{ scale: pressed ? 0.94 : 1 }],
      })}>
      <Icon name={icon} size={15} color={color.ink} strokeWidth={2} />
    </Pressable>
  );
  return (
    <View accessibilityLabel={`${label}: ${value}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: color.surfaceSoft, borderRadius: radius.pill, padding: 4, alignSelf: 'flex-start' }}>
      {btn('minus', value - 1)}
      <Text style={{ fontFamily: font.display, fontSize: 20, lineHeight: 23, color: color.ink, minWidth: 30, textAlign: 'center' }}>{value}</Text>
      {btn('plus', value + 1)}
    </View>
  );
}

/** Seçenekli ekleme karosu (Excel, rehber...). */
export function SourceTile({ icon, title, hint, onPress, accent }: { icon: IconName; title: string; hint: string; onPress: () => void; accent: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${hint}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flexGrow: 1,
        flexBasis: 120,
        gap: 8,
        padding: 14,
        borderRadius: radius.lg,
        backgroundColor: color.surfaceSoft,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}>
      <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' }}>
        <Icon name={icon} size={18} color={accent} strokeWidth={2} />
      </View>
      <View style={{ gap: 1 }}>
        <Text style={{ fontFamily: font.semibold, fontSize: 14, color: color.ink }}>{title}</Text>
        <Text style={{ fontFamily: font.regular, fontSize: 12, color: color.muted }}>{hint}</Text>
      </View>
    </Pressable>
  );
}

export const foldSearch = (s: string, locale: string) => s.toLocaleLowerCase(locale);
