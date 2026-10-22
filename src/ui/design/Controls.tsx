import { Pressable, Text, View } from 'react-native';

import { Icon, type IconName } from '@/ui/Icon';
import { tapFeedback } from '@/ui/primitives';
import { color, font, radius } from '@/ui/tokens';

export function Segment<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string; fontFamily?: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', backgroundColor: color.surfaceSoft, borderRadius: radius.pill, padding: 4 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={o.label}
            onPress={() => {
              tapFeedback();
              onChange(o.value);
            }}
            style={{ flex: 1, paddingVertical: 9, borderRadius: radius.pill, alignItems: 'center', backgroundColor: on ? color.surface : 'transparent', boxShadow: on ? '0px 2px 6px rgba(40,30,20,0.08)' : 'none' }}>
            <Text numberOfLines={1} style={{ fontFamily: o.fontFamily ?? font.semibold, fontSize: o.fontFamily ? 15 : 13, color: on ? color.ink : color.muted }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function StepperControl({
  value,
  onMinus,
  onPlus,
  minusLabel,
  plusLabel,
  disabledMinus,
  disabledPlus,
}: {
  value: string;
  onMinus: () => void;
  onPlus: () => void;
  minusLabel: string;
  plusLabel: string;
  disabledMinus?: boolean;
  disabledPlus?: boolean;
}) {
  const btn = (icon: IconName, onPress: () => void, a11y: string, disabled?: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      disabled={disabled}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) => ({
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: color.surface,
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0px 2px 6px rgba(40,30,20,0.08)',
        opacity: disabled ? 0.35 : 1,
        transform: [{ scale: pressed ? 0.94 : 1 }],
      })}>
      <Icon name={icon} size={16} color={color.ink} strokeWidth={2} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: color.surfaceSoft, borderRadius: radius.pill, padding: 4, alignSelf: 'flex-start' }}>
      {btn('minus', onMinus, minusLabel, disabledMinus)}
      <Text style={{ fontFamily: font.semibold, fontSize: 14, color: color.ink, minWidth: 46, textAlign: 'center' }}>{value}</Text>
      {btn('plus', onPlus, plusLabel, disabledPlus)}
    </View>
  );
}

export function Swatches({ colors, value, onChange, label }: { colors: string[]; value: string; onChange: (c: string) => void; label: string }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {colors.map((c) => {
        const on = c.toLowerCase() === value.toLowerCase();
        return (
          <Pressable
            key={c}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={c}
            onPress={() => {
              tapFeedback();
              onChange(c);
            }}
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: c,
              boxShadow: on ? `0 0 0 2px #FFFFFF, 0 0 0 4px ${color.lavender}` : 'inset 0 0 0 1px rgba(36,33,43,0.14)',
            }}
          />
        );
      })}
    </View>
  );
}
