import { Pressable, type PressableStateCallbackType, Text, View } from 'react-native';

import { THEME_ORDER, THEMES, type ThemeKey } from '@/core/themes';
import { type Lang, LANG_NAMES, LANGS, useI18n } from '@/i18n';
import { Icon } from '@/ui/Icon';
import { ThemeArt } from '@/ui/theme/ThemeArt';
import { themeTitle } from '@/ui/theme/typography';
import { Pill, tapFeedback } from '@/ui/primitives';
import { color, font, shadow } from '@/ui/tokens';

type PressState = PressableStateCallbackType & { hovered?: boolean };

const GROUPS = ['wedding', 'tradition', 'celebration', 'everyday'] as const;

/** Davetiye teması küçük resimleri; düğün, kutlama ve gündelik olarak gruplu. Önerilen tema grubun başında. */
export function ThemePicker({ value, onChange, suggested }: { value: ThemeKey; onChange: (k: ThemeKey) => void; suggested?: ThemeKey }) {
  const { t } = useI18n();
  return (
    <View accessibilityRole="radiogroup" style={{ gap: 18 }}>
      {GROUPS.map((g) => {
        const keys = THEME_ORDER.filter((k) => THEMES[k].group === g);
        const ordered = suggested && keys.includes(suggested) ? [suggested, ...keys.filter((k) => k !== suggested)] : keys;
        return (
          <View key={g} style={{ gap: 10 }}>
            <Text style={{ fontFamily: font.bold, fontSize: 12, letterSpacing: 1.2, color: color.muted, textTransform: 'uppercase' }}>{t(`themes.groups.${g}`)}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
              {ordered.map((k) => (
                <ThemeThumb key={k} k={k} on={k === value} suggested={k === suggested} onPress={() => onChange(k)} />
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function ThemeThumb({ k, on, suggested, onPress }: { k: ThemeKey; on: boolean; suggested: boolean; onPress: () => void }) {
  const { t } = useI18n();
  const tm = THEMES[k];
  const themeName = t(`themes.${k}`);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      accessibilityLabel={t('wizard.themeA11y', { name: themeName })}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={(s: PressState) => [{ width: 104, gap: 8 }, s.hovered && { transform: [{ translateY: -3 }] }]}>
      <View
        style={{
          width: 104,
          height: 130,
          borderRadius: 18,
          overflow: 'hidden',
          backgroundColor: tm.bg,
          boxShadow: on ? `0 0 0 2px ${color.bg}, 0 0 0 4px ${color.ink}, 0px 12px 26px rgba(40,30,20,0.14)` : shadow.card,
        }}>
        <ThemeArt theme={tm} width={104} height={84} align="xMidYMid" />
        <Text style={[themeTitle(tm, 22), { position: 'absolute', left: 10, right: 6, bottom: 8, color: tm.ink }]} numberOfLines={1}>
          A & M
        </Text>
        {on && (
          <View style={{ position: 'absolute', right: 8, top: 8, width: 22, height: 22, borderRadius: 11, backgroundColor: color.ink, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" size={11} color="#FFFFFF" strokeWidth={3.5} />
          </View>
        )}
      </View>
      <View style={{ gap: 3 }}>
        <Text numberOfLines={1} style={{ fontFamily: font.semibold, fontSize: 13, color: color.ink }}>
          {themeName}
        </Text>
        {suggested && !on && <Pill label={t('wizard.suggested')} bg={color.lavenderTint} fg={color.lavenderInk} style={{ alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 2 }} />}
      </View>
    </Pressable>
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
