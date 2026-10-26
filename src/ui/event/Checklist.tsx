import { Pressable, Text, View } from 'react-native';

import { useI18n } from '@/i18n';
import { Icon } from '@/ui/Icon';
import { color, font, radius, shadow } from '@/ui/tokens';

export type ChecklistStep = { key: string; label: string; done: boolean; hint?: string; onPress?: () => void };

/** Etkinlik sayfasının üstündeki hazırlık listesi: hepsi tamamlanınca kendiliğinden kaybolur. */
export function Checklist({ steps }: { steps: ChecklistStep[] }) {
  const { t } = useI18n();
  const done = steps.filter((s) => s.done).length;
  if (!steps.length || done === steps.length) return null;
  const next = steps.find((s) => !s.done);
  return (
    <View style={{ gap: 14, padding: 20, borderRadius: radius.xl, backgroundColor: color.surface, boxShadow: shadow.card }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <Text style={{ fontFamily: font.display, fontSize: 18, color: color.ink }}>{t('event.checklist.title')}</Text>
        <Text style={{ fontFamily: font.bold, fontSize: 13, color: color.lavenderInk }}>{t('event.checklist.progress', { done, total: steps.length })}</Text>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: color.lavenderTint, overflow: 'hidden' }}>
        <View style={{ width: `${Math.round((done / steps.length) * 100)}%`, height: 6, backgroundColor: color.lavender }} />
      </View>
      <View style={{ gap: 6 }}>
        {steps.map((s, i) => {
          const current = s === next;
          return (
            <Pressable
              key={s.key}
              accessibilityRole={s.onPress && !s.done ? 'button' : undefined}
              accessibilityState={{ checked: s.done }}
              disabled={!s.onPress || s.done}
              onPress={s.onPress}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 10, borderRadius: radius.md, backgroundColor: current ? color.lavenderTint : 'transparent' }}>
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: s.done ? color.sage : 'transparent',
                  boxShadow: s.done ? 'none' : `inset 0 0 0 2px ${current ? color.lavender : color.ring}`,
                }}>
                {s.done ? <Icon name="check" size={15} color="#FFFFFF" strokeWidth={3} /> : <Text style={{ fontFamily: font.bold, fontSize: 12, color: current ? color.lavenderInk : color.muted }}>{i + 1}</Text>}
              </View>
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={{ fontFamily: current ? font.bold : font.semibold, fontSize: 15, color: s.done ? color.muted : color.ink, textDecorationLine: s.done ? 'line-through' : 'none' }}>{s.label}</Text>
                {current && s.hint ? <Text style={{ fontFamily: font.regular, fontSize: 13, color: color.inkSoft }}>{s.hint}</Text> : null}
              </View>
              {s.onPress && !s.done ? <Icon name="arrowRight" size={16} color={current ? color.lavenderInk : color.muted} strokeWidth={2.2} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
