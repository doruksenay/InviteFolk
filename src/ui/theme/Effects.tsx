import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, type LayoutChangeEvent, Platform, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { InvitationTheme, ThemeEffect } from '@/core/themes';

// Davetiye görselinin üstünde süzülen hareket ("hareketli şablon") ve "Katılacağım" kutlaması.
// Hafif tutulur: az sayıda parçacık, yalnızca transform/opacity animasyonu; "hareketi azalt" açıksa hiç çizilmez.

const NATIVE = Platform.OS !== 'web';

type Particle = { x: number; size: number; delay: number; duration: number; rot: number; color: string; drift: number; y: number };

/** Tohumlu sözde-rastgele: aynı tema her açılışta aynı düzende başlar. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setReduce(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v: boolean) => setReduce(v));
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);
  return reduce;
}

const HEART = 'M12 21s-7.5-4.6-9.5-9.2C1.2 8.6 3.3 5 6.8 5c2.1 0 3.7 1.2 5.2 3 1.5-1.8 3.1-3 5.2-3 3.5 0 5.6 3.6 4.3 6.8C19.5 16.4 12 21 12 21z';
const SPARK = 'M12 2 Q 13.6 10.4 22 12 Q 13.6 13.6 12 22 Q 10.4 13.6 2 12 Q 10.4 10.4 12 2 Z';
const STAR = 'M12 2.5l2.8 6.2 6.7.6-5.1 4.4 1.6 6.6L12 16.8l-6 3.5 1.6-6.6-5.1-4.4 6.7-.6z';

function Shape({ kind, size, color }: { kind: Exclude<ThemeEffect, 'none'>; size: number; color: string }) {
  if (kind === 'confetti') return <View style={{ width: size * 0.55, height: size, borderRadius: 2, backgroundColor: color }} />;
  if (kind === 'petals') return <View style={{ width: size, height: size * 0.62, borderTopLeftRadius: size, borderBottomRightRadius: size, backgroundColor: color, opacity: 0.9 }} />;
  if (kind === 'bubbles') return <View style={{ width: size, height: size, borderRadius: size, borderWidth: 1.5, borderColor: color, backgroundColor: 'rgba(255,255,255,0.25)' }} />;
  const d = kind === 'hearts' ? HEART : kind === 'stars' ? STAR : SPARK;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={d} fill={color} />
    </Svg>
  );
}

/** Tek parçacık: düşen (yaprak, konfeti, kalp), yükselen (baloncuk) ya da yerinde parlayan (parıltı, yıldız). */
function Mote({ kind, p, w, h }: { kind: Exclude<ThemeEffect, 'none'>; p: Particle; w: number; h: number }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(p.delay),
        Animated.timing(v, { toValue: 1, duration: p.duration, easing: Easing.linear, useNativeDriver: NATIVE }),
        Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: NATIVE }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [v, p.delay, p.duration]);

  const twinkle = kind === 'sparkles' || kind === 'stars';
  const rising = kind === 'bubbles';
  const translateY = twinkle
    ? p.y * h
    : v.interpolate({ inputRange: [0, 1], outputRange: rising ? [h + p.size, -p.size * 2] : [-p.size * 2, h + p.size] });
  const translateX = twinkle ? p.x * w : v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [p.x * w, p.x * w + p.drift, p.x * w] });
  const rotate = v.interpolate({ inputRange: [0, 1], outputRange: [`${p.rot}deg`, `${p.rot + (kind === 'confetti' ? 540 : 180)}deg`] });
  const opacity = twinkle ? v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 0] }) : rising ? 0.8 : 0.95;
  const scale = twinkle ? v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.4, 1, 0.4] }) : 1;
  return (
    <Animated.View style={{ position: 'absolute', left: 0, top: 0, opacity, transform: [{ translateX }, { translateY }, { rotate }, { scale }] }}>
      <Shape kind={kind} size={p.size} color={p.color} />
    </Animated.View>
  );
}

function particles(kind: Exclude<ThemeEffect, 'none'>, theme: InvitationTheme, count: number, seed: number): Particle[] {
  const r = rng(seed);
  const colors =
    kind === 'confetti' ? theme.palette.concat(theme.shapeB)
    : kind === 'sparkles' || kind === 'stars' ? [theme.dark ? '#FFF4D6' : theme.shapeB, theme.shapeA, '#FFFFFF']
    : kind === 'bubbles' ? [theme.dark ? '#FFFFFF' : theme.key_, theme.shapeB]
    : [theme.shapeA, theme.shapeB, theme.palette[0]];
  const base = kind === 'confetti' ? 10 : kind === 'bubbles' ? 14 : kind === 'hearts' ? 14 : kind === 'petals' ? 13 : 12;
  return Array.from({ length: count }, (_, i) => ({
    x: r(),
    y: r(),
    size: base * (0.6 + r() * 0.8),
    delay: Math.floor(r() * 6000),
    duration: (kind === 'sparkles' || kind === 'stars' ? 2600 : 7000) + Math.floor(r() * 5000),
    rot: Math.floor(r() * 360),
    color: colors[i % colors.length],
    drift: (r() - 0.5) * 60,
  }));
}

/** Görsel alanının üstüne yerleşir (absolute fill), dokunmayı engellemez. */
export function AmbientEffect({ kind, theme, count = 12 }: { kind: ThemeEffect; theme: InvitationTheme; count?: number }) {
  const reduce = useReduceMotion();
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const list = useMemo(() => (kind === 'none' ? [] : particles(kind, theme, count, theme.key.length * 97 + kind.length)), [kind, theme, count]);
  if (kind === 'none' || reduce) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} onLayout={(e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {size ? list.map((p, i) => <Mote key={i} kind={kind} p={p} w={size.w} h={size.h} />) : null}
    </View>
  );
}

/** "Katılacağım" deyince ekranın üstünden bir kez konfeti yağar (2,5 sn). `trigger` her değiştiğinde yeniden oynar. */
export function CelebrationBurst({ trigger, theme }: { trigger: number; theme: InvitationTheme }) {
  const reduce = useReduceMotion();
  const [v] = useState(() => new Animated.Value(0));
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const list = useMemo(() => particles('confetti', theme, 36, trigger + 7), [theme, trigger]);
  useEffect(() => {
    if (!trigger) return;
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: 2600, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }).start();
  }, [trigger, v]);
  if (!trigger || reduce) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={(e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {size
        ? list.map((p, i) => {
            const startX = size.w / 2;
            const endX = p.x * size.w;
            const peak = size.h * (0.15 + p.y * 0.25);
            return (
              <Animated.View
                key={i}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  opacity: v.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
                  transform: [
                    { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [startX, endX] }) },
                    { translateY: v.interpolate({ inputRange: [0, 0.35, 1], outputRange: [size.h * 0.55, peak, size.h * 0.95] }) },
                    { rotate: v.interpolate({ inputRange: [0, 1], outputRange: [`${p.rot}deg`, `${p.rot + 720}deg`] }) },
                  ],
                }}>
                <Shape kind="confetti" size={p.size * 1.1} color={p.color} />
              </Animated.View>
            );
          })
        : null}
    </View>
  );
}
