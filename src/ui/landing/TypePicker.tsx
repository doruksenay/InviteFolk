import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { EVENT_TYPE_ORDER, EVENT_TYPES, type EventTypeKey, eventCopy } from '@/core/event-types';
import { getTheme } from '@/core/themes';
import { type Lang, makeT } from '@/i18n';
import { demoPreview } from '@/lib/demo';
import { Icon } from '@/ui/Icon';
import { InvitationCard } from '@/ui/InvitationCard';
import { Body, Button } from '@/ui/primitives';
import { color, font, shadow } from '@/ui/tokens';

// Tanıtım sayfası: solda tür düğmeleri, sağda telefon çerçevesinde o türün davetiyesi (tema ve hareketiyle).
// Ziyaretçi dokunana kadar popüler türler kendiliğinden döner; "hareketi azalt" açıksa dönmez.

const NATIVE = Platform.OS !== 'web';
const AUTO: EventTypeKey[] = ['dugun', 'sunnet', 'bebek', 'kina', 'saha', 'dogum'];
const AUTO_MS = 3800;

function FadeIn({ children }: { children: React.ReactNode }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }).start();
  }, [v]);
  return <Animated.View style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>{children}</Animated.View>;
}

function Phone({ type, lang, onOpen, label }: { type: EventTypeKey; lang: Lang; onOpen: () => void; label: string }) {
  const p = demoPreview(type, lang);
  const theme = getTheme(p.theme);
  const copy = eventCopy(type, lang);
  const t = makeT(lang);
  return (
    <View accessibilityLabel={label} style={{ width: 300, height: 600, borderRadius: 46, padding: 10, backgroundColor: '#1F1B2E', boxShadow: shadow.raised }}>
      <View style={{ flex: 1, borderRadius: 37, overflow: 'hidden', backgroundColor: theme.bg }}>
        <View style={{ position: 'absolute', top: 10, alignSelf: 'center', width: 86, height: 24, borderRadius: 12, backgroundColor: '#1F1B2E', zIndex: 2 }} />
        <FadeIn key={type}>
          <View style={{ paddingTop: 40, paddingHorizontal: 8 }}>
            <InvitationCard
              theme={theme}
              lang={lang}
              artHeight={140}
              effect={theme.effect}
              copy={{
                greet: t('rsvp.greet', { name: p.guest }),
                kicker: copy.sample.kicker,
                title: p.title,
                line: p.message,
                when: copy.sample.when,
                where: `${p.venue}, ${p.address.split(',')[0]}`,
                deadline: copy.sample.deadline,
                yes: copy.rsvp.yes,
                no: copy.rsvp.no,
              }}
              actions={
                <Pressable accessibilityRole="button" onPress={onOpen} style={{ height: 46, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.ink }}>
                  <Text style={{ fontFamily: font.semibold, fontSize: 15, color: theme.bg }}>{copy.rsvp.yes}</Text>
                </Pressable>
              }
            />
          </View>
        </FadeIn>
      </View>
    </View>
  );
}

export function TypePicker({ lang, wide, onOpen, labels }: { lang: Lang; wide: boolean; onOpen: (type: EventTypeKey) => void; labels: { open: string; pick: string; preview: string } }) {
  const [type, setType] = useState<EventTypeKey>('dugun');
  const [touched, setTouched] = useState(false);
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduce)
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (touched || reduce) return;
    const h = setInterval(() => setType((cur) => AUTO[(AUTO.indexOf(cur) + 1) % AUTO.length]), AUTO_MS);
    return () => clearInterval(h);
  }, [touched, reduce]);

  const pick = (k: EventTypeKey) => {
    setTouched(true);
    setType(k);
  };
  const copy = eventCopy(type, lang);
  const cfg = EVENT_TYPES[type];

  const chips = EVENT_TYPE_ORDER.map((k) => {
    const on = k === type;
    const c = EVENT_TYPES[k];
    return (
      <Pressable
        key={k}
        accessibilityRole="radio"
        accessibilityState={{ checked: on }}
        onPress={() => pick(k)}
        style={(st) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          height: 42,
          paddingLeft: 10,
          paddingRight: 14,
          borderRadius: 999,
          backgroundColor: on ? color.ink : (st as { hovered?: boolean }).hovered ? c.tint : color.surface,
          boxShadow: on ? shadow.button : `inset 0 0 0 1px ${color.hairline}`,
        })}>
        <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? 'rgba(255,255,255,0.14)' : c.iconBg }}>
          <Icon name={c.icon} size={15} color={on ? '#FFFFFF' : c.accent} strokeWidth={2} />
        </View>
        <Text style={{ fontFamily: font.semibold, fontSize: 14, color: on ? '#FFFFFF' : color.ink }}>{eventCopy(k, lang).name}</Text>
      </Pressable>
    );
  });

  const info = (
    <View style={{ gap: 12, padding: 20, borderRadius: 24, backgroundColor: cfg.tint }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: cfg.iconBg }}>
          <Icon name={cfg.icon} size={20} color={cfg.accent} strokeWidth={2} />
        </View>
        <Text style={{ flex: 1, fontFamily: font.display, fontSize: 20, color: color.ink }}>{copy.name}</Text>
      </View>
      <Body style={{ fontSize: 15, lineHeight: 22 }}>{copy.description}</Body>
      <View style={{ gap: 6 }}>
        {copy.features.slice(0, 3).map((f) => (
          <View key={f.title} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="check" size={15} color={cfg.accent} strokeWidth={2.4} />
            <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 14, color: color.inkSoft }}>{f.title}</Text>
          </View>
        ))}
      </View>
      <Button label={labels.open} iconRight="arrowRight" onPress={() => onOpen(type)} style={{ alignSelf: 'flex-start', marginTop: 4 }} />
    </View>
  );

  const phone = <Phone type={type} lang={lang} onOpen={() => onOpen(type)} label={labels.preview.replace('{name}', copy.name)} />;

  if (wide) {
    return (
      <View style={{ flexDirection: 'row', gap: 48, alignItems: 'center' }}>
        <View style={{ flex: 1, gap: 20 }}>
          <View accessibilityRole="radiogroup" accessibilityLabel={labels.pick} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {chips}
          </View>
          {info}
        </View>
        {phone}
      </View>
    );
  }
  return (
    <View style={{ gap: 20 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="radiogroup" accessibilityLabel={labels.pick} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
        {chips}
      </ScrollView>
      <View style={{ alignItems: 'center' }}>{phone}</View>
      {info}
    </View>
  );
}
