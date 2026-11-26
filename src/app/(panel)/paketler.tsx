import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Text, useWindowDimensions, View } from 'react-native';

import { formatNumber, formatShortDate, formatTry } from '@/core/format';
import type { MyPlan, Plan } from '@/core/types';
import { dict, useI18n } from '@/i18n';
import { getMyPlan, useQuery } from '@/lib/api';
import { getPlanCatalog, getQuotes, type PaidPlan, PAID_PLANS, type PlanLimits, type Purchasable, type Quote, startWebCheckout } from '@/lib/api-billing';
import { eventsPerk, hasSeating, sendingPerks } from '@/lib/plan-perks';
import { getStorePrices, IN_APP_PURCHASES, purchaseProduct, storeAvailability } from '@/lib/purchases';
import { useSession } from '@/lib/session';
import { Icon } from '@/ui/Icon';
import { Body, Button, Caption, Display, DisplayAccent, IconButton, Notice, Pill, Skeleton, Surface, Title } from '@/ui/primitives';
import { RichText } from '@/ui/RichText';
import { Screen } from '@/ui/Screen';
import { color, font, radius, shadow } from '@/ui/tokens';

const WEB_PAYMENTS = process.env.EXPO_PUBLIC_WEB_PAYMENTS === 'true';

const RANK: Record<Plan, number> = { free: 0, temel: 1, otomatik: 2, tam: 3, b2b: 9 };
const ACCENT: Record<'free' | PaidPlan, { bg: string; ink: string; dot: string }> = {
  free: { bg: color.surface, ink: color.ink, dot: color.faint },
  temel: { bg: color.surface, ink: color.ink, dot: color.sage },
  otomatik: { bg: color.ink, ink: '#FFFFFF', dot: color.coral },
  tam: { bg: color.surface, ink: color.ink, dot: color.gold },
};

type Banner = { tone: 'success' | 'info' | 'warning' | 'error'; text: string } | null;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const albumOpen = (p: MyPlan | null | undefined) => !!p?.album_until && new Date(p.album_until).getTime() > Date.now();

/** Ödeme sunucuda doğrulanıp paket (ya da albüm) tanımlanana kadar my_plan'ı yoklar (en fazla ~40 sn). */
async function waitForPurchase(target: Purchasable, before: MyPlan | null | undefined): Promise<MyPlan | null> {
  for (let i = 0; i < 20; i++) {
    const p = await getMyPlan().catch(() => null);
    if (p && target === 'album' && albumOpen(p) && p.album_until !== before?.album_until) return p;
    if (p && target !== 'album' && RANK[p.plan] >= RANK[target]) return p;
    await sleep(2000);
  }
  return null;
}

export default function PlansScreen() {
  const { t, lang, locale } = useI18n();
  const { width } = useWindowDimensions();
  const wide = width >= 980;
  const { profile, refreshProfile } = useSession();
  const params = useLocalSearchParams<{ durum?: string; paket?: string; secim?: string }>();

  const catalog = useQuery(getPlanCatalog, []);
  const mine = useQuery(getMyPlan, []);
  // Kullanıcıya özel teklif: yükseltmede yalnızca fark, albüm eklentisi (sunucu hesaplar).
  const quotes = useQuery(getQuotes, []);
  const [storePrices, setStorePrices] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Purchasable | null>(null);

  const availability = storeAvailability();
  const planName = (p: Plan) => t(`status.plan.${p}`);

  // Mağaza fiyatları (yerel para birimi ve vergiler dahil) varsa onları göster.
  useEffect(() => {
    if (!IN_APP_PURCHASES || !profile) return;
    let alive = true;
    getStorePrices(profile.id)
      .then((p) => alive && setStorePrices(p))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [profile]);

  // iyzico dönüşü: /paketler?durum=basarili&paket=otomatik
  const durum = params.durum;
  const returned = params.paket;
  const [banner, setBanner] = useState<Banner>(() =>
    durum === 'hata' ? { tone: 'error', text: t('billing.failed') } : durum === 'basarili' ? { tone: 'info', text: t('billing.waiting') } : null,
  );
  useEffect(() => {
    if (durum !== 'basarili') return;
    let alive = true;
    const target: Purchasable = returned === 'album' ? 'album' : (PAID_PLANS as string[]).includes(returned ?? '') ? (returned as PaidPlan) : 'temel';
    waitForPurchase(target, null).then((p) => {
      if (!alive) return;
      if (p) {
        mine.setData(p);
        quotes.reload();
        refreshProfile();
        setBanner({ tone: 'success', text: target === 'album' ? t('billing.album.success') : t('billing.success', { plan: t(`status.plan.${p.plan}`) }) });
      } else setBanner({ tone: 'warning', text: t('billing.pending') });
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durum, returned]);

  const buy = async (plan: Purchasable) => {
    if (!profile) return;
    const quote = quotes.data?.[plan];
    if (!quote?.available) return;
    setBanner(null);
    setBusy(plan);
    try {
      if (Platform.OS === 'web') {
        // Şirket kurulana kadar web'de ödeme alınmaz; paket uygulamadan alınır (EXPO_PUBLIC_WEB_PAYMENTS=true açar).
        if (!WEB_PAYMENTS) {
          setBanner({ tone: 'info', text: t('billing.webUseApp') });
          return;
        }
        const url = await startWebCheckout(plan, lang);
        window.location.assign(url);
        return; // sayfa iyzico'ya gidiyor
      }
      if (availability === 'expo-go') {
        setBanner({ tone: 'warning', text: t('billing.expoGo') });
        return;
      }
      if (availability !== 'ready') {
        setBanner({ tone: 'warning', text: t('billing.notConfigured') });
        return;
      }
      const before = mine.data;
      const outcome = await purchaseProduct(profile.id, quote.product);
      if (outcome === 'cancelled') {
        setBanner({ tone: 'info', text: t('billing.cancelled') });
        return;
      }
      setBanner({ tone: 'info', text: t('billing.waiting') });
      const p = await waitForPurchase(plan, before);
      if (p) {
        mine.setData(p);
        quotes.reload();
        await refreshProfile();
        setBanner({ tone: 'success', text: plan === 'album' ? t('billing.album.success') : t('billing.success', { plan: planName(p.plan) }) });
      } else setBanner({ tone: 'warning', text: t('billing.pending') });
    } catch {
      setBanner({ tone: 'error', text: Platform.OS === 'web' ? t('billing.checkoutFailed') : t('billing.failed') });
    } finally {
      setBusy(null);
    }
  };

  const current: Plan = mine.data?.plan ?? 'free';
  const limitsFor = (p: Plan): PlanLimits | undefined => catalog.data?.limits.find((l) => l.plan === p);
  const quoteFor = (p: Purchasable): Quote | undefined => quotes.data?.[p];
  /** Gösterilen fiyat: teklif varsa (yükseltmede fark) mağazanın yerel fiyatı ya da teklif tutarı; yoksa liste fiyatı. */
  const priceFor = (p: PaidPlan) => {
    const q = quoteFor(p);
    if (q?.available) return storePrices[q.product] ?? formatTry(q.amount, locale);
    if (storePrices[`invitefolk_${p}`]) return storePrices[`invitefolk_${p}`];
    const row = catalog.data?.prices.find((x) => x.plan === p);
    return row ? formatTry(row.amount_try, locale) : '—';
  };

  const features = (p: Plan) => {
    const l = limitsFor(p);
    if (!l) return [] as string[];
    const n = (v: number) => formatNumber(v, locale);
    return [
      eventsPerk(t, l),
      t('billing.included.guests', { count: n(l.max_guests_per_event) }),
      ...sendingPerks(t, l, n),
      t('billing.included.email', { count: n(l.email_per_day) }),
      t('billing.included.rsvp'),
      ...(hasSeating(l) ? [t('billing.included.seating')] : []),
      t('billing.included.design'),
      t('billing.included.import'),
      t('billing.included.page'),
      t('billing.included.export'),
      ...(l.max_gallery > 0 ? [t('billing.included.gallery', { count: l.max_gallery })] : []),
      ...(l.music ? [t('billing.included.music')] : []),
      ...(l.video ? [t('billing.included.video')] : []),
      ...(l.max_cohosts > 0 ? [t('billing.included.cohosts', { count: l.max_cohosts })] : []),
      ...(l.collector ? [t('billing.included.collector')] : []),
      ...(l.checkin ? [t('billing.included.checkin')] : []),
      ...(l.album_photos > 0 ? [t('billing.included.album', { count: n(l.album_photos) })] : []),
      ...(l.sms_per_day > 0 ? [t('billing.included.sms', { count: n(l.sms_per_day) })] : []),
    ];
  };

  const card = (p: 'free' | PaidPlan) => {
    const a = ACCENT[p];
    const dark = p === 'otomatik';
    const isCurrent = current === p;
    const lower = RANK[p] < RANK[current];
    const q = p === 'free' ? undefined : quoteFor(p);
    const upgrade = q?.available && q.kind === 'upgrade' ? q : null;
    return (
      <View
        key={p}
        style={{
          flexGrow: wide ? 1 : 0,
          flexBasis: wide ? 0 : 'auto',
          minWidth: wide ? 220 : undefined,
          backgroundColor: a.bg,
          borderRadius: radius.xl,
          padding: 24,
          gap: 16,
          boxShadow: params.secim === p ? `inset 0 0 0 3px ${color.coral}, ${shadow.raised}` : dark ? '0px 24px 50px rgba(36,33,43,0.28)' : isCurrent ? `inset 0 0 0 2px ${color.lavender}, ${shadow.card}` : shadow.card,
          transform: [{ translateY: dark && wide ? -8 : 0 }],
        }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 26 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: a.dot }} />
            <Text style={{ fontFamily: font.bold, fontSize: 13, letterSpacing: 1.2, textTransform: 'uppercase', color: dark ? 'rgba(255,255,255,0.75)' : color.muted }}>
              {p === 'free' ? t('billing.free') : planName(p)}
            </Text>
          </View>
          {params.secim === p && !isCurrent ? (
            <Pill label={t('billing.yourChoice')} bg={color.coralTint} fg={color.coralInk} />
          ) : isCurrent ? (
            <Pill label={t('billing.yourPlan')} bg={dark ? 'rgba(255,255,255,0.16)' : color.lavenderTint} fg={dark ? '#FFFFFF' : color.lavenderInk} />
          ) : dark ? (
            <Pill label={t('billing.popular')} bg={color.coralInk} fg="#FFFFFF" />
          ) : null}
        </View>

        <View style={{ gap: 2 }}>
          <Text style={{ fontFamily: font.display, fontSize: 37, lineHeight: 41, color: a.ink }}>{p === 'free' ? t('billing.freePrice') : priceFor(p)}</Text>
          {p !== 'free' && (
            <Caption color={dark ? 'rgba(255,255,255,0.7)' : color.muted}>
              {upgrade ? t('billing.upgradeNote', { full: formatTry(upgrade.full, locale) }) : t('billing.perYear')}
            </Caption>
          )}
        </View>
        <Text style={{ fontFamily: font.medium, fontSize: 14, lineHeight: 20, color: dark ? 'rgba(255,255,255,0.85)' : color.inkSoft }}>{t(`billing.planBlurb.${p}`)}</Text>

        <View style={{ gap: 10, flexGrow: 1 }}>
          {features(p).map((f) => (
            <View key={f} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <View style={{ width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: dark ? 'rgba(255,255,255,0.14)' : color.sageTint, marginTop: 1 }}>
                <Icon name="check" size={12} color={dark ? '#FFFFFF' : color.sageInk} strokeWidth={2.4} />
              </View>
              <Text style={{ flex: 1, fontFamily: font.regular, fontSize: 14, lineHeight: 20, color: dark ? '#FFFFFF' : color.ink }}>{f}</Text>
            </View>
          ))}
        </View>

        {p !== 'free' && (
          <Button
            label={busy === p ? t('billing.buying') : upgrade ? t('billing.upgrade') : isCurrent ? t('billing.renew') : t('billing.choose')}
            variant={dark ? 'accent' : 'primary'}
            size="lg"
            loading={busy === p}
            disabled={!!busy || lower || !catalog.data || !q?.available}
            onPress={() => buy(p)}
          />
        )}
      </View>
    );
  };

  // Anı albümü eklentisi: Düğün Tam ve İşletme paketinde dahil; diğer paketlere sonradan eklenir.
  const albumCard = () => {
    const q = quoteFor('album');
    if (!q) return null;
    const open = albumOpen(mine.data);
    const included = !q.available && q.reason === 'included';
    return (
      <Surface style={{ flexDirection: wide ? 'row' : 'column', alignItems: wide ? 'center' : 'flex-start', gap: 16 }}>
        <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: color.coralTint, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="camera" size={22} color={color.coralInk} />
        </View>
        <View style={{ flex: wide ? 1 : undefined, gap: 4 }}>
          <Title>{t('billing.album.title')}</Title>
          <Body>{t('billing.album.body')}</Body>
          <Caption>
            {open && mine.data?.album_until
              ? t('billing.album.until', { date: formatShortDate(mine.data.album_until, locale) })
              : included
                ? t('billing.album.included')
                : t('billing.album.validity')}
          </Caption>
        </View>
        {q.available && !open && (
          <View style={{ gap: 8, alignItems: wide ? 'flex-end' : 'flex-start' }}>
            <Text style={{ fontFamily: font.display, fontSize: 30, lineHeight: 34, color: color.ink }}>{storePrices[q.product] ?? formatTry(q.amount, locale)}</Text>
            <Button
              label={busy === 'album' ? t('billing.buying') : t('billing.album.buy')}
              variant="secondary"
              loading={busy === 'album'}
              disabled={!!busy}
              onPress={() => buy('album')}
            />
          </View>
        )}
      </Surface>
    );
  };

  const terms = { label: t('billing.terms'), href: '/yasal/kosullar' };
  const privacy = { label: t('billing.privacy'), href: '/yasal/gizlilik' };
  const faq = dict(lang).billing.faq;

  return (
    <Screen maxWidth={1240}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <IconButton icon="arrowLeft" label={t('billing.back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/etkinlikler'))} />
        <Pill label={t('billing.kicker')} bg={color.lavenderTint} fg={color.lavenderInk} />
      </View>

      <View style={{ gap: 10, maxWidth: 720 }}>
        <Display size={wide ? 60 : 44}>
          {t('billing.title')} <DisplayAccent style={{ color: color.coral }}>{t('billing.titleItalic')}</DisplayAccent>
        </Display>
        <Body>{t('billing.subtitle')}</Body>
      </View>

      {banner && <Notice tone={banner.tone} text={banner.text} />}

      {mine.data && (
        <Surface style={{ flexDirection: wide ? 'row' : 'column', alignItems: wide ? 'center' : 'flex-start', gap: 16, backgroundColor: color.lavenderTint, boxShadow: 'none' }}>
          <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="star" size={22} color={color.lavender} />
          </View>
          <View style={{ flex: wide ? 1 : undefined, gap: 2 }}>
            <Caption color={color.lavenderInk}>{t('billing.current')}</Caption>
            <Title color={color.lavenderInk}>
              {planName(mine.data.plan)}
              {mine.data.plan !== 'free' ? ` · ${mine.data.expires_at ? t('billing.currentUntil', { date: formatShortDate(mine.data.expires_at, locale) }) : t('billing.currentForever')}` : ''}
            </Title>
          </View>
          <Caption color={color.lavenderInk}>
            {t('billing.usage', {
              events: mine.data.usage.events,
              maxEvents: mine.data.limits.max_events,
              contacts: formatNumber(mine.data.usage.contacts, locale),
              maxContacts: formatNumber(mine.data.limits.max_contacts, locale),
            })}
          </Caption>
        </Surface>
      )}

      {catalog.error ? (
        <View style={{ gap: 10 }}>
          <Notice tone="error" text={t('billing.loadFailed')} />
          <Button label={t('common.retry')} variant="secondary" onPress={catalog.reload} style={{ alignSelf: 'flex-start' }} />
        </View>
      ) : !catalog.data ? (
        <View style={{ flexDirection: wide ? 'row' : 'column', gap: 16 }}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ flex: wide ? 1 : undefined }}>
              <Skeleton height={460} radius={28} />
            </View>
          ))}
        </View>
      ) : (
        <View style={{ flexDirection: wide ? 'row' : 'column', gap: 16, alignItems: 'stretch', paddingTop: wide ? 8 : 0 }}>
          {card('free')}
          {PAID_PLANS.map(card)}
        </View>
      )}

      {albumCard()}

      <View style={{ gap: 8, maxWidth: 760 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="lock" size={16} color={color.sage} />
          <Caption>
            {Platform.OS === 'web' ? (WEB_PAYMENTS ? t('billing.webSecure') : t('billing.webUseApp')) : t('billing.storeSecure', { store: Platform.OS === 'ios' ? t('billing.appStore') : t('billing.playStore') })}
          </Caption>
        </View>
        {Platform.OS !== 'web' && availability === 'expo-go' && <Notice tone="warning" text={t('billing.expoGo')} />}
        <RichText template={t('billing.legalNote')} links={{ terms, privacy }} />
      </View>

      <Surface style={{ gap: 16 }}>
        <Title>{t('billing.faqTitle')}</Title>
        <View style={{ flexDirection: wide ? 'row' : 'column', flexWrap: 'wrap', gap: 20 }}>
          {faq.map((f) => (
            <View key={f.q} style={{ flexBasis: wide ? '45%' : 'auto', flexGrow: 1, gap: 4 }}>
              <Text style={{ fontFamily: font.semibold, fontSize: 15, color: color.ink }}>{f.q}</Text>
              <Body>{f.a}</Body>
            </View>
          ))}
        </View>
      </Surface>
    </Screen>
  );
}
