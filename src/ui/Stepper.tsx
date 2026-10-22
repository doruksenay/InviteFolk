import { Text, useWindowDimensions, View } from 'react-native';

import { useI18n } from '@/i18n';

import { color, font } from './tokens';

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  // Dar ekranda yalnızca etkin adımın adı yazılır, diğerleri numara olarak kalır.
  const compact = useWindowDimensions().width < 640;
  const { t } = useI18n();
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={t('wizard.stepA11y', { n: current + 1, total: steps.length, name: steps[current] })} style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: compact ? 8 : 12 }}>
            {i > 0 && <View style={{ width: compact ? 14 : 28, height: 1, backgroundColor: 'rgba(36,33,43,0.16)' }} />}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: active || done ? color.ink : color.surface,
                  boxShadow: active || done ? 'none' : `inset 0 0 0 1px ${color.ring}`,
                }}>
                <Text style={{ fontFamily: font.bold, fontSize: 12, color: active || done ? '#FFFFFF' : color.muted }}>{done ? '✓' : i + 1}</Text>
              </View>
              {(!compact || active) && <Text style={{ fontFamily: active ? font.semibold : font.medium, fontSize: 14, color: active ? color.ink : color.muted }}>{s}</Text>}
            </View>
          </View>
        );
      })}
    </View>
  );
}
