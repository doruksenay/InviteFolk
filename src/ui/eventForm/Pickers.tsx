import { Pressable, type PressableStateCallbackType, Text, View } from 'react-native';

import { THEME_ORDER, THEMES, type ThemeKey } from '@/core/themes';
import { type Lang, LANG_NAMES, LANGS, useI18n } from '@/i18n';
import { Icon } from '@/ui/Icon';
import { Pill, tapFeedback } from '@/ui/primitives';
import { color, font, shadow } from '@/ui/tokens';

type PressState = PressableStateCallbackType & { hovered?: boolean };

/** Davetiye teması küçük resimleri. */
export function ThemePicker({ value, onChange, suggested }: { value: ThemeKey; onChange: (k: ThemeKey) => void; suggested?: ThemeKey }) {
  const { t } = useI18n();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
      {THEME_ORDER.map((k) => {
        const tm = THEMES[k];
        const themeName = t(`themes.${k}`);
        const on = k === value;
        return (
          <Pressable
            key={k}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={t('wizard.themeA11y', { name: themeName })}
            onPress={() => {
              tapFeedback();
              onChange(k);
            }}
            style={(s: PressState) => [{ width: 104, gap: 10 }, s.hovered && { transform: [{ translateY: -3 }] }]}>
            <View
              style={{
                width: 104,
                height: 130,
                borderRadius: 18,
                overflow: 'hidden',
                backgroundColor: tm.bg,
                boxShadow: on ? `0 0 0 2px ${color.bg}, 0 0 0 4px ${color.ink}, 0px 12px 26px rgba(40,30,20,0.14)` : shadow.card,
              }}>
              <View style={{ position: 'absolute', left: -22, top: -22, width: 80, height: 80, borderRadius: 40, backgroundColor: tm.shapeA }} />
              <View style={{ position: 'absolute', right: 12, top: 30, width: 36, height: 60, borderTopLeftRadius: 18, borderTopRightRadius: 18, backgroundColor: tm.shapeB }} />
              <Text style={{ position: 'absolute', left: 12, bottom: 12, fontFamily: font.serif, fontSize: 20, color: tm.ink }}>A & M</Text>
              {on && (
                <View style={{ position: 'absolute', right: 8, top: 8, width: 22, height: 22, borderRadius: 11, backgroundColor: color.ink, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="check" size={11} color="#FFFFFF" strokeWidth={3.5} />
                </View>
              )}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
              <Text style={{ fontFamily: font.semibold, fontSize: 14, color: color.ink }}>{themeName}</Text>
              {k === suggested && !on && <Pill label={t('wizard.suggested')} bg={color.lavenderTint} fg={color.lavenderInk} style={{ paddingHorizontal: 7, paddingVertical: 2 }} />}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Davetiye dili seçimi. */
export function LangPicker({ value, onChange }: { value: Lang; onChange: (l: Lang) => void }) {
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
      {LANGS.map((l) => {
        const on = l === value;
        return (
          <Pressable
            key={l}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => {
              tapFeedback();
              onChange(l);
            }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, paddingHorizontal: 16, borderRadius: 999, backgroundColor: on ? color.ink : color.surfaceSoft }}>
            <Icon name="globe" size={15} color={on ? '#FFFFFF' : color.inkSoft} strokeWidth={2} />
            <Text style={{ fontFamily: font.semibold, fontSize: 14, color: on ? '#FFFFFF' : color.ink }}>{LANG_NAMES[l]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
