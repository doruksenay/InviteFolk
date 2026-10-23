import { useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { InvitationTheme } from '@/core/themes';
import type { TFn } from '@/i18n';
import { ThemeArt } from '@/ui/theme/ThemeArt';
import { themeTitle } from '@/ui/theme/typography';
import { font } from '@/ui/tokens';

import { readableOn } from './colors';

const native = Platform.OS !== 'web';

/**
 * Zarf açılışı: davetli sayfayı ilk açtığında mühürlü zarf görür; dokununca kapak açılır, kart yükselir.
 * `onOpen` dokunma anında (aynı olay içinde) çağrılır: tarayıcılar sesi yalnızca kullanıcı hareketiyle başlatır.
 */
export function Envelope({ theme, seal, name, t, onOpen, onDone }: { theme: InvitationTheme; seal: string; name: string; t: TFn; onOpen: () => void; onDone: () => void }) {
  const { width } = useWindowDimensions();
  const W = Math.min(340, width - 48);
  const H = Math.round(W * 0.66);
  const [flap] = useState(() => new Animated.Value(0));
  const [lift] = useState(() => new Animated.Value(0));
  const [fade] = useState(() => new Animated.Value(1));
  const [opening, setOpening] = useState(false);
  const [flapBehind, setFlapBehind] = useState(false);

  const paper = theme.dark ? theme.shapeC : '#FFFFFF';
  const pocket = theme.shapeC;
  const sealInk = readableOn(theme.shapeB);

  const open = () => {
    if (opening) return;
    setOpening(true);
    onOpen();
    Animated.timing(flap, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.cubic), useNativeDriver: native }).start(() => {
      setFlapBehind(true);
      Animated.parallel([
        Animated.timing(lift, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: native }),
        Animated.timing(fade, { toValue: 0, duration: 520, delay: 380, useNativeDriver: native }),
      ]).start(() => onDone());
    });
  };

  const rotate = flap.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const sealOpacity = flap.interpolate({ inputRange: [0, 0.25], outputRange: [1, 0], extrapolate: 'clamp' });
  const cardY = lift.interpolate({ inputRange: [0, 1], outputRange: [0, -H * 0.75] });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: theme.bg, opacity: fade }]}>
      <View style={[StyleSheet.absoluteFill, { opacity: 0.35 }]} pointerEvents="none">
        <ThemeArt theme={theme} width="100%" height="45%" />
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={t('guest.envelope.a11y')} onPress={open} style={styles.center}>
        <Text style={[themeTitle(theme, 34), { color: theme.ink, textAlign: 'center', marginBottom: 26, paddingHorizontal: 24 }]} numberOfLines={2}>
          {t('guest.envelope.forYou', { name })}
        </Text>
        <View style={{ width: W, height: H }}>
          {/* arka yüz */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: pocket, borderRadius: 10, boxShadow: '0px 24px 50px rgba(30,20,10,0.22)' }]} />
          {/* içteki kart */}
          <Animated.View style={{ position: 'absolute', left: 14, right: 14, top: 12, height: H - 24, borderRadius: 8, backgroundColor: paper, transform: [{ translateY: cardY }], alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: '70%', height: 2, backgroundColor: theme.shapeB, opacity: 0.6, marginBottom: 10 }} />
            <View style={{ width: '50%', height: 2, backgroundColor: theme.shapeB, opacity: 0.35 }} />
          </Animated.View>
          {/* ön cep */}
          <Svg width={W} height={H} style={StyleSheet.absoluteFill} pointerEvents="none">
            <Path d={`M0 0 L${W / 2} ${H * 0.56} L0 ${H} Z`} fill={pocket} />
            <Path d={`M${W} 0 L${W / 2} ${H * 0.56} L${W} ${H} Z`} fill={pocket} />
            <Path d={`M0 0 L${W / 2} ${H * 0.56} L0 ${H} Z`} fill={theme.shapeA} opacity={0.22} />
            <Path d={`M${W} 0 L${W / 2} ${H * 0.56} L${W} ${H} Z`} fill={theme.shapeA} opacity={0.3} />
            <Path d={`M0 ${H} L${W / 2} ${H * 0.5} L${W} ${H} Z`} fill={pocket} />
            <Path d={`M0 ${H} L${W / 2} ${H * 0.5} L${W} ${H} Z`} fill={theme.shapeA} opacity={0.14} />
          </Svg>
          {/* kapak */}
          <Animated.View
            pointerEvents="none"
            style={{ position: 'absolute', left: 0, top: 0, width: W, height: H * 0.6, zIndex: flapBehind ? -1 : 2, transformOrigin: 'top', transform: [{ perspective: 900 }, { rotateX: rotate }] }}>
            <Svg width={W} height={H * 0.6}>
              <Path d={`M0 0 L${W} 0 L${W / 2} ${H * 0.58} Z`} fill={pocket} />
              <Path d={`M0 0 L${W} 0 L${W / 2} ${H * 0.58} Z`} fill={theme.shapeA} opacity={0.4} />
            </Svg>
          </Animated.View>
          {/* mühür */}
          <Animated.View
            pointerEvents="none"
            style={{ position: 'absolute', zIndex: 3, left: W / 2 - 30, top: H * 0.56 - 30, width: 60, height: 60, borderRadius: 30, backgroundColor: theme.shapeB, alignItems: 'center', justifyContent: 'center', opacity: sealOpacity, boxShadow: '0px 4px 10px rgba(0,0,0,0.22)' }}>
            <View style={{ position: 'absolute', left: 5, top: 5, right: 5, bottom: 5, borderRadius: 25, borderWidth: 1, borderColor: sealInk, opacity: 0.35 }} />
            <Text style={{ fontFamily: font.formal, fontSize: seal.length > 3 ? 13 : 18, color: sealInk }} numberOfLines={1}>
              {seal}
            </Text>
          </Animated.View>
        </View>
        <Text style={{ fontFamily: font.semibold, fontSize: 14, color: theme.soft, marginTop: 30, letterSpacing: 0.3 }}>{t('guest.envelope.tap')}</Text>
      </Pressable>
    </Animated.View>
  );
}

/** Mühür için baş harfler: "Ayşe & Mehmet" → "A&M", "Deniz 30 yaşında" → "D". */
export function sealFrom(title: string, hosts: string | null, locale: string) {
  const parts = title.split(/\s*(?:&|\+|ve|and)\s*/i).map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) return parts.slice(0, 2).map((p) => p.charAt(0).toLocaleUpperCase(locale)).join('&');
  const src = parts[0] || hosts || '';
  return src.charAt(0).toLocaleUpperCase(locale);
}

const styles = StyleSheet.create({
  overlay: { zIndex: 50, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', padding: 24 },
});
