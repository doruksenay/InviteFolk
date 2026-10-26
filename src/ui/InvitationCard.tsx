import type { ReactNode } from 'react';
import { Image, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import type { InvitationTheme, ThemeEffect, ThemeLayout } from '@/core/themes';
import { type Lang, LOCALE_TAG, makeT } from '@/i18n';

import { Icon } from './Icon';
import { AmbientEffect } from './theme/Effects';
import { ThemeArt } from './theme/ThemeArt';
import { themeTitle } from './theme/typography';
import { font } from './tokens';

export type InvitationCopy = {
  greet: string;
  kicker: string;
  title: string;
  line: string;
  when: string;
  where: string;
  deadline?: string | null;
  yes: string;
  no: string;
};

/**
 * Davetlinin gördüğü editoryal davetiye kartı. Dört düzen:
 *  - classic: üstte görsel (tema deseni ya da kapak fotoğrafı), altta metin
 *  - minimal: ortalı, sade yazı; fotoğraf varsa üstte yuvarlak
 *  - cover:   uzun görsel, başlık görselin üstünde (fotoğraflı davetiyeye en uygun)
 *  - framed:  ince çift çerçeve içinde ortalı, klasik davetiye
 * Organizatör önizlemesinde butonlar görsel; LCV sayfasında `actions` ile gerçek butonlar verilir.
 * `lang` davetiyenin dilidir (arayüz dili değil): büyük harf ve "son gün" satırı ona göre yazılır.
 */
export function InvitationCard({
  theme,
  copy,
  actions,
  style,
  artHeight = 196,
  lang = 'tr',
  effect,
  layout = 'classic',
  photoUri,
}: {
  theme: InvitationTheme;
  copy: InvitationCopy;
  actions?: ReactNode;
  style?: ViewStyle;
  artHeight?: number;
  lang?: Lang;
  /** Görsel alanındaki hareket (verilmezse hareketsiz; davetli sayfası ve önizlemeler verir). */
  effect?: ThemeEffect;
  layout?: ThemeLayout;
  /** Kapak fotoğrafı (çiftin fotoğrafı gibi); verilirse tema deseninin yerine geçer. */
  photoUri?: string | null;
}) {
  const t = makeT(lang);
  const center = layout === 'minimal' || layout === 'framed';
  const align = center ? ('center' as const) : undefined;

  const visual = (h: number, children?: ReactNode, round?: boolean) => (
    <View style={{ height: h, overflow: 'hidden', borderRadius: round ? 18 : 0 }}>
      <View style={StyleSheet.absoluteFill}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" accessibilityIgnoresInvertColors />
        ) : (
          <ThemeArt theme={theme} width="100%" height="100%" />
        )}
      </View>
      {effect ? <AmbientEffect kind={effect} theme={theme} /> : null}
      {children}
    </View>
  );

  const greetChip = (
    <View style={[styles.greet, { backgroundColor: theme.chip }]}>
      <Text style={[styles.greetText, { color: theme.ink }]} numberOfLines={1}>
        {copy.greet}
      </Text>
    </View>
  );

  const ornament = (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <View style={{ width: 36, height: 1, backgroundColor: theme.key_, opacity: 0.6 }} />
      <View style={{ width: 7, height: 7, backgroundColor: theme.key_, transform: [{ rotate: '45deg' }] }} />
      <View style={{ width: 36, height: 1, backgroundColor: theme.key_, opacity: 0.6 }} />
    </View>
  );

  const kicker = <Text style={[styles.kicker, { color: theme.key_, textAlign: align }]}>{copy.kicker.toLocaleUpperCase(LOCALE_TAG[lang])}</Text>;
  const title = (size: number, color = theme.ink) => <Text style={[themeTitle(theme, size), { color, textAlign: align }]}>{copy.title}</Text>;
  const line = <Text style={[styles.line, { color: theme.soft, textAlign: align }]}>{copy.line}</Text>;
  const details = (
    <View style={{ gap: 8, paddingTop: 4, alignItems: center ? 'center' : 'stretch' }}>
      <View style={[styles.row, center && { justifyContent: 'center' }]}>
        <Icon name="calendar" size={16} color={theme.ink} />
        <Text style={[styles.rowText, { color: theme.ink, textAlign: align }]}>{copy.when}</Text>
      </View>
      <View style={[styles.row, center && { justifyContent: 'center' }]}>
        <Icon name="pin" size={16} color={theme.ink} />
        <Text style={[styles.rowText, { color: theme.ink, textAlign: align }]}>{copy.where}</Text>
      </View>
    </View>
  );
  const buttons = actions ? <View style={{ alignSelf: 'stretch' }}>{actions}</View> : (
    <View style={{ gap: 10, paddingTop: 8, alignSelf: 'stretch' }}>
      <View style={[styles.btn, { backgroundColor: theme.ink }]}>
        <Text style={[styles.btnText, { color: theme.bg }]}>{copy.yes}</Text>
      </View>
      <View style={[styles.btn, { boxShadow: `inset 0 0 0 1.5px ${theme.ink}` }]}>
        <Text style={[styles.btnText, { color: theme.ink }]}>{copy.no}</Text>
      </View>
    </View>
  );
  const foot = copy.deadline ? <Text style={[styles.foot, { color: theme.soft }]}>{t('wizard.card.deadline', { date: copy.deadline })}</Text> : null;

  if (layout === 'minimal') {
    return (
      <View style={[styles.card, { backgroundColor: theme.bg }, style]}>
        <View style={[styles.body, { alignItems: 'center', paddingTop: 30 }]}>
          {photoUri ? (
            <View style={{ width: 124, height: 124, borderRadius: 62, overflow: 'hidden', boxShadow: `0 0 0 3px ${theme.bg}, 0 0 0 4.5px ${theme.key_}` }}>
              <Image source={{ uri: photoUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" accessibilityIgnoresInvertColors />
            </View>
          ) : null}
          <Text style={[styles.greetText, { color: theme.soft, textAlign: 'center', fontSize: 13 }]}>{copy.greet}</Text>
          {kicker}
          {title(52)}
          {ornament}
          {line}
          {details}
          {buttons}
          {foot}
        </View>
      </View>
    );
  }

  if (layout === 'cover') {
    const h = Math.round(artHeight * 1.75);
    return (
      <View style={[styles.card, { backgroundColor: theme.bg }, style]}>
        {visual(
          h,
          <>
            <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 10 10" pointerEvents="none">
              <Defs>
                <LinearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0.35" stopColor="#000000" stopOpacity="0" />
                  <Stop offset="1" stopColor="#000000" stopOpacity="0.72" />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="10" height="10" fill="url(#shade)" />
            </Svg>
            <View style={{ position: 'absolute', left: 22, right: 22, bottom: 20, gap: 6 }}>
              <Text style={[styles.greetText, { color: 'rgba(255,255,255,0.9)' }]} numberOfLines={1}>
                {copy.greet}
              </Text>
              <Text style={[styles.kicker, { color: 'rgba(255,255,255,0.85)' }]}>{copy.kicker.toLocaleUpperCase(LOCALE_TAG[lang])}</Text>
              <Text style={[themeTitle(theme, 50), { color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 12 }]}>{copy.title}</Text>
            </View>
          </>,
        )}
        <View style={styles.body}>
          {line}
          {details}
          {buttons}
          {foot}
        </View>
      </View>
    );
  }

  if (layout === 'framed') {
    return (
      <View style={[styles.card, { backgroundColor: theme.bg, padding: 12 }, style]}>
        <View style={{ borderRadius: 20, padding: 5, boxShadow: `inset 0 0 0 1.5px ${theme.key_}` }}>
          <View style={{ borderRadius: 16, overflow: 'hidden', boxShadow: `inset 0 0 0 0.75px ${theme.key_}` }}>
            <View style={{ padding: 10, paddingBottom: 0 }}>{visual(Math.round(artHeight * 0.62), undefined, true)}</View>
            <View style={[styles.body, { alignItems: 'center', paddingHorizontal: 20 }]}>
              <Text style={[styles.greetText, { color: theme.soft, textAlign: 'center', fontSize: 13 }]}>{copy.greet}</Text>
              {kicker}
              {title(46)}
              {ornament}
              {line}
              {details}
              {buttons}
              {foot}
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.bg }, style]}>
      {visual(artHeight, greetChip)}
      <View style={styles.body}>
        {kicker}
        {title(48)}
        {line}
        {details}
        {buttons}
        {foot}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', maxWidth: 360, alignSelf: 'center', borderRadius: 28, overflow: 'hidden', boxShadow: '0px 26px 56px rgba(30,20,10,0.20)' },
  greet: { position: 'absolute', left: 18, bottom: 16, maxWidth: '86%', paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999 },
  greetText: { fontFamily: font.semibold, fontSize: 12 },
  body: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 24, gap: 14 },
  kicker: { fontFamily: font.bold, fontSize: 12, letterSpacing: 1.6 },
  line: { fontFamily: font.regular, fontSize: 15, lineHeight: 23 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowText: { fontFamily: font.medium, fontSize: 14, flexShrink: 1 },
  btn: { height: 50, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: font.semibold, fontSize: 15 },
  foot: { fontFamily: font.regular, fontSize: 12, textAlign: 'center' },
});
