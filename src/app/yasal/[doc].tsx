import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, type ScrollViewInstance, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatDayMonth } from '@/core/format';
import { dict, type Lang, LANGS, LOCALE_TAG, makeT, useI18n } from '@/i18n';
import { BrandMark } from '@/ui/BrandBar';
import { Icon } from '@/ui/Icon';
import { Notice } from '@/ui/primitives';
import { color, font, radius, shadow } from '@/ui/tokens';

const DOCS = ['gizlilik', 'kosullar', 'kvkk'] as const;
type DocKey = (typeof DOCS)[number];

/** Gizlilik politikası, kullanım koşulları ve KVKK aydınlatma metni. Giriş gerektirmez. */
export default function LegalPage() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const ui = useI18n();
  const [lang, setLang] = useState<Lang>(ui.lang);
  const t = makeT(lang);
  const legal = dict(lang).legal;
  const key = (DOCS as readonly string[]).includes(doc ?? '') ? (doc as DocKey) : null;
  const content = key ? legal.docs[key] : null;

  const scroller = useRef<ScrollViewInstance>(null);
  const offsets = useRef<Record<string, number>>({});

  const year = new Date(legal.updatedAt).getFullYear();
  const updated = `${formatDayMonth(legal.updatedAt, LOCALE_TAG[lang])} ${year}`;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }}>
      <ScrollView ref={scroller} contentContainerStyle={{ alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 64 }}>
        <View style={{ width: '100%', maxWidth: 760, gap: 28 }}>
          {/* Üst çubuk */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('legal.back')}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Icon name="arrowLeft" size={18} color={color.ink} strokeWidth={2} />
              <BrandMark size={26} />
              <Text style={{ fontFamily: font.bold, fontSize: 17, color: color.ink }}>{t('common.appName')}</Text>
            </Pressable>
            <View accessibilityRole="radiogroup" accessibilityLabel={t('legal.langSwitch')} style={{ flexDirection: 'row', backgroundColor: color.surface, borderRadius: radius.pill, padding: 4, boxShadow: shadow.card }}>
              {LANGS.map((l) => (
                <Pressable
                  key={l}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: l === lang }}
                  onPress={() => setLang(l)}
                  style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: l === lang ? color.ink : 'transparent' }}>
                  <Text style={{ fontFamily: font.bold, fontSize: 12, letterSpacing: 1, color: l === lang ? '#FFFFFF' : color.muted }}>{l.toUpperCase()}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Belgeler arası sekmeler */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {DOCS.map((d) => {
              const on = d === key;
              return (
                <Pressable
                  key={d}
                  accessibilityRole="link"
                  accessibilityState={{ selected: on }}
                  onPress={() => router.replace({ pathname: '/yasal/[doc]', params: { doc: d } })}
                  style={{ paddingHorizontal: 14, height: 36, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: on ? color.lavenderTint : color.surface, boxShadow: on ? `inset 0 0 0 1.5px ${color.lavender}` : shadow.card }}>
                  <Text style={{ fontFamily: font.semibold, fontSize: 13, color: on ? color.lavenderInk : color.ink }}>{legal.nav[d]}</Text>
                </Pressable>
              );
            })}
          </View>

          {!content ? (
            <View style={{ gap: 10 }}>
              <Text style={{ fontFamily: font.display, fontSize: 34, lineHeight: 36, color: color.ink }}>{t('legal.notFoundTitle')}</Text>
              <Text style={{ fontFamily: font.regular, fontSize: 16, lineHeight: 25, color: color.muted }}>{t('legal.notFoundBody')}</Text>
            </View>
          ) : (
            <>
              <View style={{ gap: 10 }}>
                <Text accessibilityRole="header" style={{ fontFamily: font.display, fontSize: 41, lineHeight: 42, color: color.ink }}>
                  {content.title}
                </Text>
                <Text style={{ fontFamily: font.medium, fontSize: 13, color: color.muted }}>{t('legal.lastUpdated', { date: updated })}</Text>
                <Text style={{ fontFamily: font.regular, fontSize: 17, lineHeight: 27, color: color.inkSoft, marginTop: 6 }}>{content.intro}</Text>
              </View>

              <Notice tone="warning" text={t('legal.reviewNote')} />

              {/* İçindekiler */}
              <View style={{ backgroundColor: color.surface, borderRadius: radius.xl, padding: 22, gap: 8, boxShadow: shadow.card }}>
                <Text style={{ fontFamily: font.bold, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', color: color.muted, marginBottom: 4 }}>{t('legal.contents')}</Text>
                {content.sections.map((s) => (
                  <Pressable
                    key={s.id}
                    accessibilityRole="link"
                    onPress={() => scroller.current?.scrollTo({ y: Math.max(0, (offsets.current[s.id] ?? 0) - 16), animated: true })}
                    style={{ paddingVertical: 4 }}>
                    <Text style={{ fontFamily: font.medium, fontSize: 15, color: color.lavenderInk }}>{s.title}</Text>
                  </Pressable>
                ))}
              </View>

              {/* Bölümler */}
              <View style={{ gap: 34 }}>
                {content.sections.map((s) => (
                  <View
                    key={s.id}
                    onLayout={(e) => {
                      offsets.current[s.id] = e.nativeEvent.layout.y;
                    }}
                    style={{ gap: 12 }}>
                    <Text accessibilityRole="header" style={{ fontFamily: font.semibold, fontSize: 20, lineHeight: 28, color: color.ink }}>
                      {s.title}
                    </Text>
                    {s.body.map((p, i) => (
                      <Text key={i} style={{ fontFamily: font.regular, fontSize: 16, lineHeight: 26, color: color.inkSoft }}>
                        {p}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            </>
          )}

          <View style={{ height: 1, backgroundColor: color.hairline }} />
          <Text style={{ fontFamily: font.regular, fontSize: 13, color: color.faint }}>© {year} Invitefolk</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
