import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, type ScrollViewInstance, Text, useWindowDimensions, View } from 'react-native';

import { EVENT_TYPE_ORDER, EVENT_TYPES, eventCopy } from '@/core/event-types';
import { getTheme, type ThemeKey } from '@/core/themes';
import { LANGS, type Lang, useI18n } from '@/i18n';
import { useQuery } from '@/lib/api';
import { getPlanCatalog, PAID_PLANS, type PaidPlan } from '@/lib/api-billing';
import { BrandMark, Wordmark } from '@/ui/BrandBar';
import { Icon } from '@/ui/Icon';
import { InvitationCard } from '@/ui/InvitationCard';
import { Body, Button, Display, DisplayAccent } from '@/ui/primitives';
import { AmbientEffect } from '@/ui/theme/Effects';
import { ThemeArt } from '@/ui/theme/ThemeArt';
import { color, font, radius, shadow } from '@/ui/tokens';

// Fiyat tablosu okunamazsa (ör. bağlantı yok) gösterilen değerler; asıl fiyat her zaman sunucudadır.
const FALLBACK_PRICES: Record<PaidPlan, number> = { temel: 500, otomatik: 750, tam: 1000 };
const SHOWCASE: ThemeKey[] = ['fildisi', 'sakura', 'sehzade', 'isilti', 'bulut', 'kep'];
const MAX = 1180;

type Section = 'features' | 'pricing' | 'faq';

function Kicker({ children, tone = color.lavenderInk }: { children: string; tone?: string }) {
  return <Text style={{ fontFamily: font.bold, fontSize: 12, letterSpacing: 1.6, color: tone }}>{children}</Text>;
}

function SectionHead({ kicker, title, accent, body, center, accentColor = color.lavender }: { kicker: string; title: string; accent: string; body?: string; center?: boolean; accentColor?: string }) {
  return (
    <View style={{ gap: 12, alignItems: center ? 'center' : 'flex-start', maxWidth: 720, alignSelf: center ? 'center' : 'flex-start' }}>
      <Kicker>{kicker}</Kicker>
      <Display size={50} center={center} accessibilityRole="header">
        {title} <DisplayAccent style={{ color: accentColor }}>{accent}</DisplayAccent>
      </Display>
      {body ? (
        <Body center={center} style={{ fontSize: 17, lineHeight: 26 }}>
          {body}
        </Body>
      ) : null}
    </View>
  );
}

/** Web'de giriş yapmamış ziyaretçinin gördüğü tanıtım sayfası. */
export function Landing() {
  const { t, d, lang, setLang, locale } = useI18n();
  const L = d.landing;
  const { width } = useWindowDimensions();
  const wide = width >= 980;
  const mid = width >= 680;
  const pad = width >= 760 ? 32 : 16;
  const [scroll, setScroll] = useState<ScrollViewInstance | null>(null);
  const [pos, setPos] = useState<Partial<Record<Section, number>>>({});
  const at = (k: Section) => (e: { nativeEvent: { layout: { y: number } } }) => {
    const y = e.nativeEvent.layout.y;
    setPos((p) => (p[k] === y ? p : { ...p, [k]: y }));
  };
  const go = (k: Section) => scroll?.scrollTo({ y: Math.max(0, (pos[k] ?? 0) - 16), animated: true });
  const catalog = useQuery(() => getPlanCatalog().catch(() => null), []);
  const priceOf = (p: PaidPlan) => {
    const v = catalog.data?.prices.find((x) => x.plan === p)?.amount_try ?? FALLBACK_PRICES[p];
    return new Intl.NumberFormat(locale, { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(v);
  };
  const demo = (type: string) => router.push({ pathname: '/demo/[type]', params: lang === 'en' ? { type, lang: 'en' } : { type } });
  const start = () => router.push('/giris');
  const heroTheme = getTheme('fildisi');
  const year = new Date().getFullYear();

  const wrap = { width: '100%', maxWidth: MAX, alignSelf: 'center', paddingHorizontal: pad } as const;
  const cols = (n: number) => (width >= 1100 ? n : width >= 680 ? Math.min(n, 2) : 1);
  const tileW = (n: number, gap: number) => {
    const c = cols(n);
    const inner = Math.min(width, MAX) - pad * 2;
    return c === 1 ? inner : Math.floor((inner - gap * (c - 1)) / c);
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <ScrollView ref={setScroll} contentContainerStyle={{ paddingBottom: 0 }}>
        {/* Arka plan ışıltısı */}
        <View pointerEvents="none" style={{ position: 'absolute', left: -240, top: -260, width: 640, height: 640, borderRadius: 320, backgroundColor: 'rgba(160,140,235,0.16)' }} />
        <View pointerEvents="none" style={{ position: 'absolute', right: -260, top: 120, width: 560, height: 560, borderRadius: 280, backgroundColor: 'rgba(242,132,111,0.12)' }} />

        {/* Üst çubuk */}
        <View style={[wrap, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 18, gap: 12 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <BrandMark size={34} />
            <Wordmark size={20} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: mid ? 18 : 8 }}>
            {wide &&
              (['features', 'pricing', 'faq'] as const).map((k) => (
                <Pressable key={k} accessibilityRole="link" onPress={() => go(k)} hitSlop={8}>
                  <Text style={{ fontFamily: font.semibold, fontSize: 15, color: color.inkSoft }}>{L.nav[k]}</Text>
                </Pressable>
              ))}
            <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 2 }}>
              {LANGS.map((l: Lang) => (
                <Pressable
                  key={l}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: l === lang }}
                  onPress={() => setLang(l)}
                  hitSlop={6}
                  style={{ paddingHorizontal: 8, paddingVertical: 6, borderRadius: 999, backgroundColor: l === lang ? color.lavenderTint : 'transparent' }}>
                  <Text style={{ fontFamily: font.bold, fontSize: 12, letterSpacing: 1.2, color: l === lang ? color.lavenderInk : color.muted }}>{l.toUpperCase()}</Text>
                </Pressable>
              ))}
            </View>
            <Button label={L.nav.signIn} variant={mid ? 'secondary' : 'ghost'} onPress={start} />
          </View>
        </View>

        {/* Kahraman alanı */}
        <View style={[wrap, { flexDirection: wide ? 'row' : 'column', alignItems: wide ? 'center' : 'stretch', gap: wide ? 56 : 36, paddingTop: wide ? 48 : 20, paddingBottom: 72 }]}>
          <View style={{ flex: wide ? 1.1 : undefined, gap: 22 }}>
            <Kicker tone={color.coralInk}>{L.hero.kicker}</Kicker>
            <Display size={wide ? 86 : mid ? 70 : 54} accessibilityRole="header">
              {L.hero.title} <DisplayAccent style={{ color: color.lavender }}>{L.hero.titleAccent}</DisplayAccent>
            </Display>
            <Body style={{ fontSize: 18, lineHeight: 28, maxWidth: 560 }}>{L.hero.body}</Body>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 }}>
              <Button label={L.hero.primary} size="lg" iconRight="arrowRight" onPress={start} />
              <Button label={L.hero.secondary} size="lg" variant="secondary" icon="eye" onPress={() => demo('dugun')} />
            </View>
            <Text style={{ fontFamily: font.medium, fontSize: 14, color: color.muted }}>{L.hero.note}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
              {(['templates', 'types', 'langs'] as const).map((k, i) => (
                <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, height: 36, borderRadius: 999, backgroundColor: [color.lavenderTint, color.coralTint, color.sageTint][i] }}>
                  <Icon name={(['sparkle', 'calendar', 'check'] as const)[i]} size={14} color={[color.lavenderInk, color.coralInk, color.sageInk][i]} strokeWidth={2.2} />
                  <Text style={{ fontFamily: font.bold, fontSize: 13, color: [color.lavenderInk, color.coralInk, color.sageInk][i] }}>{L.hero.stats[k]}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={{ flex: wide ? 0.9 : undefined, alignItems: 'center' }}>
            <View style={{ width: '100%', maxWidth: 400, transform: wide ? [{ rotate: '1.5deg' }] : undefined }}>
              <InvitationCard
                theme={heroTheme}
                lang={lang}
                artHeight={220}
                effect="petals"
                style={{ boxShadow: shadow.raised }}
                copy={{
                  greet: L.hero.cardGreet,
                  kicker: L.hero.cardKicker,
                  title: L.hero.cardTitle,
                  line: L.hero.cardLine,
                  when: L.hero.cardWhen,
                  where: L.hero.cardWhere,
                  deadline: L.hero.cardDeadline,
                  yes: eventCopy('dugun', lang).rsvp.yes,
                  no: eventCopy('dugun', lang).rsvp.no,
                }}
                actions={
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => demo('dugun')}
                    style={({ pressed }) => ({ height: 52, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: heroTheme.ink, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
                    <Text style={{ fontFamily: font.semibold, fontSize: 16, color: heroTheme.bg }}>{eventCopy('dugun', lang).rsvp.yes}</Text>
                  </Pressable>
                }
              />
            </View>
            <View style={{ marginTop: -18, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 999, backgroundColor: color.surface, boxShadow: shadow.raised, transform: wide ? [{ translateX: -60 }] : undefined }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color.sage }} />
              <Text style={{ fontFamily: font.semibold, fontSize: 14, color: color.ink }}>{L.hero.live}</Text>
            </View>
          </View>
        </View>

        {/* Etkinlik türleri ve örnekler */}
        <View style={{ backgroundColor: color.surface, paddingVertical: 72 }}>
          <View style={[wrap, { gap: 32 }]}>
            <SectionHead kicker={L.types.kicker} title={L.types.title} accent={L.types.titleAccent} body={L.types.body} accentColor={color.coral} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {EVENT_TYPE_ORDER.map((k) => {
                const cfg = EVENT_TYPES[k];
                const copy = eventCopy(k, lang);
                const w = width >= 1100 ? tileW(5, 12) : width >= 680 ? Math.floor((Math.min(width, MAX) - pad * 2 - 24) / 3) : Math.floor((width - pad * 2 - 12) / 2);
                return (
                  <Pressable
                    key={k}
                    accessibilityRole="link"
                    accessibilityLabel={`${copy.name}: ${L.types.see}`}
                    onPress={() => demo(k)}
                    style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({
                      width: width >= 1100 ? Math.floor((Math.min(width, MAX) - pad * 2 - 48) / 5) : w,
                      gap: 10,
                      padding: 16,
                      borderRadius: radius.lg,
                      backgroundColor: cfg.tint,
                      boxShadow: hovered ? shadow.raised : 'none',
                      transform: [{ translateY: hovered ? -2 : 0 }, { scale: pressed ? 0.98 : 1 }],
                    })}>
                    <View style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: cfg.iconBg }}>
                      <Icon name={cfg.icon} size={22} color={cfg.accent} strokeWidth={2} />
                    </View>
                    <Text style={{ fontFamily: font.display, fontSize: 17, lineHeight: 22, color: color.ink, minHeight: 44 }} numberOfLines={2}>
                      {copy.name}
                    </Text>
                    <Text style={{ fontFamily: font.regular, fontSize: 13, lineHeight: 18, color: color.muted, minHeight: 36 }} numberOfLines={2}>
                      {copy.description}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontFamily: font.bold, fontSize: 13, color: color.ink }}>{L.types.see}</Text>
                      <Icon name="arrowRight" size={14} color={color.ink} strokeWidth={2.2} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
            {/* Şablon vitrini */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
              {SHOWCASE.map((k) => {
                const th = getTheme(k);
                const c = width >= 1100 ? 6 : width >= 680 ? 3 : 2;
                const w = Math.floor((Math.min(width, MAX) - pad * 2 - 12 * (c - 1)) / c);
                return (
                  <View key={k} style={{ width: w, gap: 8 }}>
                    <View style={{ width: w, height: Math.round(w * 0.68), borderRadius: radius.md, overflow: 'hidden', backgroundColor: th.bg }}>
                      <ThemeArt theme={th} width="100%" height="100%" />
                      <AmbientEffect kind={th.effect} theme={th} count={7} />
                    </View>
                    <Text style={{ fontFamily: font.semibold, fontSize: 13, color: color.inkSoft }}>{t(`themes.${k}` as never)}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* Özellikler */}
        <View onLayout={at('features')} style={[wrap, { gap: 36, paddingVertical: 80 }]}>
          <SectionHead kicker={L.features.kicker} title={L.features.title} accent={L.features.titleAccent} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
            {L.features.items.map((f, i) => {
              const tone = [
                [color.lavenderTint, color.lavenderInk],
                [color.coralTint, color.coralInk],
                [color.goldTint, color.goldInk],
                [color.sageTint, color.sageInk],
              ][i % 4];
              return (
                <View key={f.title} style={{ width: tileW(3, 16), gap: 12, padding: 22, borderRadius: radius.xl, backgroundColor: color.surface, boxShadow: shadow.card }}>
                  <View style={{ width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: tone[0] }}>
                    <Icon name={f.icon} size={22} color={tone[1]} strokeWidth={2} />
                  </View>
                  <Text style={{ fontFamily: font.display, fontSize: 19, color: color.ink }}>{f.title}</Text>
                  <Body style={{ fontSize: 15, lineHeight: 23 }}>{f.body}</Body>
                </View>
              );
            })}
          </View>
        </View>

        {/* Nasıl çalışır */}
        <View style={{ backgroundColor: color.ink, paddingVertical: 80 }}>
          <View style={[wrap, { gap: 36 }]}>
            <View style={{ gap: 12 }}>
              <Kicker tone="#C9C1FF">{L.steps.kicker}</Kicker>
              <Display size={50} color="#FFFFFF" accessibilityRole="header">
                {L.steps.title} <DisplayAccent style={{ color: color.gold }}>{L.steps.titleAccent}</DisplayAccent>
              </Display>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
              {L.steps.items.map((s, i) => (
                <View key={s.title} style={{ width: tileW(3, 16), gap: 12, padding: 22, borderRadius: radius.xl, backgroundColor: 'rgba(255,255,255,0.06)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.10)' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Text style={{ fontFamily: font.black, fontSize: 34, color: color.gold }}>{i + 1}</Text>
                    <Icon name={s.icon} size={22} color="#FFFFFF" strokeWidth={2} />
                  </View>
                  <Text style={{ fontFamily: font.display, fontSize: 19, color: '#FFFFFF' }}>{s.title}</Text>
                  <Text style={{ fontFamily: font.regular, fontSize: 15, lineHeight: 23, color: 'rgba(255,255,255,0.74)' }}>{s.body}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Fiyatlar */}
        <View onLayout={at('pricing')} style={[wrap, { gap: 36, paddingVertical: 80 }]}>
          <SectionHead kicker={L.pricing.kicker} title={L.pricing.title} accent={L.pricing.titleAccent} body={L.pricing.body} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
            {(['free', ...PAID_PLANS] as const).map((p) => {
              const popular = p === 'otomatik';
              const c = width >= 1100 ? 4 : width >= 680 ? 2 : 1;
              const w = c === 1 ? Math.min(width, MAX) - pad * 2 : Math.floor((Math.min(width, MAX) - pad * 2 - 14 * (c - 1)) / c);
              return (
                <View key={p} style={{ width: w, gap: 12, padding: 24, borderRadius: radius.xl, backgroundColor: popular ? color.ink : color.surface, boxShadow: popular ? shadow.raised : shadow.card }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <Text style={{ fontFamily: font.display, fontSize: 20, color: popular ? '#FFFFFF' : color.ink }}>{t(`status.plan.${p}` as never)}</Text>
                    {popular && (
                      <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: color.gold }}>
                        <Text style={{ fontFamily: font.bold, fontSize: 11, color: color.ink }}>{t('billing.popular')}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ fontFamily: font.black, fontSize: 38, letterSpacing: -1, color: popular ? '#FFFFFF' : color.ink }}>{p === 'free' ? t('billing.freePrice') : priceOf(p)}</Text>
                  <Text style={{ fontFamily: font.medium, fontSize: 13, color: popular ? 'rgba(255,255,255,0.7)' : color.muted }}>{p === 'free' ? ' ' : t('billing.perYear')}</Text>
                  <Text style={{ fontFamily: font.regular, fontSize: 15, lineHeight: 22, color: popular ? 'rgba(255,255,255,0.86)' : color.inkSoft, minHeight: 66 }}>{t(`billing.planBlurb.${p}` as never)}</Text>
                  <Button label={p === 'free' ? L.pricing.freeCta : L.pricing.cta} variant={popular ? 'accent' : 'secondary'} onPress={start} />
                </View>
              );
            })}
          </View>
        </View>

        {/* Sık sorulanlar */}
        <View onLayout={at('faq')} style={{ backgroundColor: color.surface, paddingVertical: 80 }}>
          <View style={[wrap, { gap: 28, maxWidth: 880 }]}>
            <SectionHead kicker={L.faq.kicker} title={L.faq.title} accent={L.faq.titleAccent} />
            <View style={{ gap: 10 }}>
              {L.faq.items.map((f) => (
                <Faq key={f.q} q={f.q} a={f.a} />
              ))}
            </View>
          </View>
        </View>

        {/* Son çağrı */}
        <View style={[wrap, { paddingVertical: 80 }]}>
          <View style={{ gap: 18, alignItems: 'center', padding: mid ? 48 : 28, borderRadius: 36, backgroundColor: color.lavenderTint }}>
            <Display size={52} center accessibilityRole="header">
              {L.cta.title} <DisplayAccent style={{ color: color.lavender }}>{L.cta.titleAccent}</DisplayAccent>
            </Display>
            <Body center style={{ fontSize: 17 }}>
              {L.cta.body}
            </Body>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
              <Button label={L.hero.primary} size="lg" iconRight="arrowRight" onPress={start} />
              <Button label={L.hero.secondary} size="lg" variant="secondary" icon="eye" onPress={() => demo('dugun')} />
            </View>
          </View>
        </View>

        {/* Alt bilgi */}
        <View style={{ borderTopWidth: 1, borderTopColor: color.hairline }}>
          <View style={[wrap, { flexDirection: mid ? 'row' : 'column', justifyContent: 'space-between', alignItems: mid ? 'center' : 'flex-start', gap: 16, paddingVertical: 28 }]}>
            <View style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <BrandMark size={26} />
                <Wordmark size={16} />
              </View>
              <Text style={{ fontFamily: font.medium, fontSize: 13, color: color.muted }}>{L.footer.tagline}</Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 18, alignItems: 'center' }}>
              {(['gizlilik', 'kosullar', 'kvkk'] as const).map((doc) => (
                <Pressable key={doc} accessibilityRole="link" onPress={() => router.push({ pathname: '/yasal/[doc]', params: { doc } })} hitSlop={6}>
                  <Text style={{ fontFamily: font.semibold, fontSize: 13, color: color.inkSoft }}>{t(`legal.nav.${doc}`)}</Text>
                </Pressable>
              ))}
              <Text style={{ fontFamily: font.medium, fontSize: 13, color: color.faint }}>{L.footer.rights.replace('{year}', String(year))}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ borderRadius: radius.lg, backgroundColor: color.bg, overflow: 'hidden' }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((o) => !o)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 18 }}>
        <Text style={{ flex: 1, fontFamily: font.bold, fontSize: 16, color: color.ink }}>{q}</Text>
        <Icon name={open ? 'minus' : 'plus'} size={18} color={color.inkSoft} strokeWidth={2} />
      </Pressable>
      {open && <Text style={{ paddingHorizontal: 20, paddingBottom: 18, fontFamily: font.regular, fontSize: 15, lineHeight: 23, color: color.inkSoft }}>{a}</Text>}
    </View>
  );
}
