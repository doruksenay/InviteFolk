import { useVideoPlayer, VideoView } from 'expo-video';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Platform, Pressable, StatusBar, Text, useWindowDimensions, View } from 'react-native';

import { publicUrl } from '@/core/format';
import { getTheme } from '@/core/themes';
import type { EventSettings, GuestbookEntry } from '@/core/types';
import { useI18n } from '@/i18n';
import { useQuery } from '@/lib/api';
import { getEventRow } from '@/lib/api-guests';
import { type AlbumItem, listAlbumForScreen, listGuestbook } from '@/lib/api-tools';
import { ToolError, ToolLoading } from '@/ui/event/ToolScreen';
import { Icon } from '@/ui/Icon';
import { QrCode } from '@/ui/QrCode';
import { themeProse, themeTitle } from '@/ui/theme/typography';
import { font } from '@/ui/tokens';

const PHOTO_MS = 7000;
const NOTE_MS = 9000;
const VIDEO_MAX_MS = 30000;
const POLL_MS = 20000;
const NATIVE = Platform.OS !== 'web';

type Slide = { key: string; kind: 'photo'; item: AlbumItem } | { key: string; kind: 'video'; item: AlbumItem } | { key: string; kind: 'note'; entry: GuestbookEntry };

/** Her üç fotoğraf/videodan sonra bir anı defteri mesajı araya girer. */
function buildSlides(media: AlbumItem[], notes: GuestbookEntry[]): Slide[] {
  const out: Slide[] = [];
  const m = media.filter((x) => x.url);
  const n = notes.filter((x) => x.approved && !x.hidden).slice(0, 60);
  let j = 0;
  m.forEach((it, i) => {
    out.push({
      key: it.id,
      kind: it.kind === 'video' ? 'video' : 'photo',
      item: it,
    });
    if ((i + 1) % 3 === 0 && j < n.length) out.push({ key: n[j].id, kind: 'note', entry: n[j++] });
  });
  while (j < n.length) out.push({ key: n[j].id, kind: 'note', entry: n[j++] });
  return out;
}

function VideoSlide({ url, onEnd }: { url: string; onEnd: () => void }) {
  const player = useVideoPlayer(url, (p) => {
    p.muted = true;
    p.loop = false;
    p.play();
  });
  useEffect(() => {
    const sub = player.addListener('playToEnd', onEnd);
    const cap = setTimeout(onEnd, VIDEO_MAX_MS);
    return () => {
      sub.remove();
      clearTimeout(cap);
    };
  }, [player, onEnd]);
  return <VideoView player={player} style={{ width: '100%', height: '100%' }} contentFit="contain" nativeControls={false} />;
}

/** Salon ekranı: projeksiyona ya da TV'ye yansıtılan, kendiliğinden dönen canlı albüm. */
export default function VenueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useI18n();
  const { width, height } = useWindowDimensions();
  const ev = useQuery(() => getEventRow(id), [id]);
  const [media, setMedia] = useState<AlbumItem[]>([]);
  const [notes, setNotes] = useState<GuestbookEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [idx, setIdx] = useState(0);
  const [chrome, setChrome] = useState(true);
  const [fade] = useState(() => new Animated.Value(1));
  const seen = useRef<Set<string>>(new Set());
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  // İlk yükleme ve 20 sn'de bir yenileme; yeni gelenler sıradaki slayt olur.
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [m, g] = await Promise.all([listAlbumForScreen(id).catch(() => null), listGuestbook(id).catch(() => null)]);
      if (!alive) return;
      if (m) setMedia(m);
      if (g) setNotes(g);
      const ids = [...(m ?? []).map((x) => x.id), ...(g ?? []).map((x) => x.id)];
      if (seen.current.size) {
        const nw = ids.filter((x) => !seen.current.has(x));
        if (nw.length) setFresh((f) => new Set([...f, ...nw]));
      }
      ids.forEach((x) => seen.current.add(x));
      setLoaded(true);
    };
    void load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [id]);

  // Ekran kararmasın (web: Wake Lock).
  useEffect(() => {
    if (NATIVE || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    let lock: { release: () => Promise<void> } | null = null;
    const req = () =>
      (
        navigator as unknown as {
          wakeLock: {
            request: (k: string) => Promise<{ release: () => Promise<void> }>;
          };
        }
      ).wakeLock
        .request('screen')
        .then((l) => (lock = l))
        .catch(() => {});
    void req();
    const onVis = () => document.visibilityState === 'visible' && void req();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      void lock?.release().catch(() => {});
    };
  }, []);

  // Fare/dokunuş yoksa düğmeler 4 sn sonra gizlenir.
  useEffect(() => {
    if (!chrome) return;
    const h = setTimeout(() => setChrome(false), 4000);
    return () => clearTimeout(h);
  }, [chrome]);

  const base = useMemo(() => buildSlides(media, notes), [media, notes]);
  // Yeni gelenler öne alınır (bir kez gösterilince sıradan akar).
  const slides = useMemo(() => {
    if (!fresh.size) return base;
    const first = base.filter((s) => fresh.has(s.key));
    return [...first, ...base.filter((s) => !fresh.has(s.key))];
  }, [base, fresh]);
  const count = slides.length;
  const cur = count ? slides[idx % count] : null;

  const nextRef = useRef<() => void>(() => {});
  useEffect(() => {
    nextRef.current = () => {
      if (!count) return;
      Animated.timing(fade, {
        toValue: 0,
        duration: 450,
        useNativeDriver: NATIVE,
      }).start(() => {
        if (cur && fresh.has(cur.key)) {
          setFresh((f) => {
            const n = new Set(f);
            n.delete(cur.key);
            return n;
          });
          setIdx(0);
        } else setIdx((i) => (i + 1) % Math.max(1, count));
        Animated.timing(fade, {
          toValue: 1,
          duration: 650,
          useNativeDriver: NATIVE,
        }).start();
      });
    };
  });
  const [onEnd] = useState(() => () => nextRef.current());

  useEffect(() => {
    if (!cur || cur.kind === 'video') return;
    const h = setTimeout(() => nextRef.current(), cur.kind === 'note' ? NOTE_MS : PHOTO_MS);
    return () => clearTimeout(h);
  }, [cur, idx]);

  if (ev.loading && !ev.data) return <ToolLoading />;
  if (ev.error || !ev.data) return <ToolError />;
  const event = ev.data;
  const s = (event.settings ?? {}) as EventSettings;
  const theme = getTheme(event.theme);
  const url = publicUrl('a', event.public_slug);
  const short = url.replace(/^https?:\/\//, '');
  const big = Math.min(width, height);
  const qrSize = Math.max(96, Math.min(170, Math.round(big * 0.16)));
  const fullscreen = () => {
    if (NATIVE || typeof document === 'undefined') return;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  };
  const enabled = !!s.album?.enabled || !!s.guestbook?.enabled;

  return (
    <Pressable
      accessibilityLabel={t('tools.screen.title')}
      onPress={() => setChrome(true)}
      // @ts-expect-error onMouseMove yalnızca web'de var
      onMouseMove={() => !chrome && setChrome(true)}
      style={
        {
          flex: 1,
          backgroundColor: '#0B0A10',
          cursor: chrome ? 'auto' : 'none',
        } as never
      }>
      <StatusBar hidden />
      <Animated.View style={{ flex: 1, opacity: fade }}>
        {cur?.kind === 'photo' && cur.item.url ? (
          <>
            <Image source={{ uri: cur.item.url }} blurRadius={40} style={{ position: 'absolute', inset: 0, opacity: 0.35 } as never} resizeMode="cover" />
            <Image source={{ uri: cur.item.url }} style={{ flex: 1 }} resizeMode="contain" accessibilityIgnoresInvertColors />
          </>
        ) : null}
        {cur?.kind === 'video' && cur.item.url ? <VideoSlide key={cur.key} url={cur.item.url} onEnd={onEnd} /> : null}
        {cur?.kind === 'note' ? (
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: '10%',
              gap: 28,
              backgroundColor: theme.dark ? theme.bg : '#16131F',
            }}>
            <Text
              style={[
                themeTitle(theme, Math.round(big * 0.12)),
                {
                  color: theme.dark ? theme.key_ : theme.shapeB,
                  lineHeight: Math.round(big * 0.1),
                },
              ]}>
              “
            </Text>
            <Text style={[themeProse(theme, Math.max(28, Math.round(big * 0.07))), { color: '#FFF9F2', textAlign: 'center' }]} numberOfLines={8}>
              {cur.entry.message}
            </Text>
            <Text
              style={{
                fontFamily: font.semibold,
                fontSize: Math.max(18, Math.round(big * 0.032)),
                letterSpacing: 1,
                color: 'rgba(255,249,242,0.75)',
              }}>
              — {cur.entry.name}
            </Text>
          </View>
        ) : null}
        {!cur && loaded ? (
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 22,
              padding: 32,
            }}>
            <Text style={[themeTitle(theme, Math.max(36, Math.round(big * 0.08))), { color: '#FFF9F2', textAlign: 'center' }]}>{event.title}</Text>
            <View
              style={{
                padding: 16,
                borderRadius: 24,
                backgroundColor: '#FFFFFF',
              }}>
              <QrCode value={url} size={Math.round(big * 0.34)} />
            </View>
            <Text
              style={{
                fontFamily: font.semibold,
                fontSize: Math.max(18, Math.round(big * 0.035)),
                color: '#FFF9F2',
                textAlign: 'center',
              }}>
              {enabled ? t('tools.screen.emptyBody') : t('tools.album.disabled')}
            </Text>
          </View>
        ) : null}
      </Animated.View>

      {cur && cur.kind !== 'note' && cur.item.uploader ? (
        <View
          style={{
            position: 'absolute',
            left: 28,
            bottom: 28,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 999,
            backgroundColor: 'rgba(11,10,16,0.62)',
          }}>
          <Text
            style={{
              fontFamily: font.semibold,
              fontSize: Math.max(15, Math.round(big * 0.024)),
              color: '#FFFFFF',
            }}>
            {t('tools.screen.by', { name: cur.item.uploader })}
          </Text>
        </View>
      ) : null}

      {cur ? (
        <View
          style={{
            position: 'absolute',
            right: 24,
            bottom: 24,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            padding: 12,
            borderRadius: 22,
            backgroundColor: 'rgba(255,255,255,0.94)',
          }}>
          <QrCode value={url} size={qrSize} />
          {width > 700 && (
            <View style={{ gap: 4, maxWidth: 220 }}>
              <Text
                style={{
                  fontFamily: font.bold,
                  fontSize: 18,
                  color: '#1F1B2E',
                }}>
                {t('tools.screen.cta')}
              </Text>
              <Text
                style={{
                  fontFamily: font.medium,
                  fontSize: 13,
                  color: '#4A4458',
                }}
                numberOfLines={2}>
                {short}
              </Text>
            </View>
          )}
        </View>
      ) : null}

      {cur && fresh.has(cur.key) ? (
        <View
          style={{
            position: 'absolute',
            left: 28,
            top: 28,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 999,
            backgroundColor: theme.key_,
          }}>
          <Text
            style={{
              fontFamily: font.bold,
              fontSize: 14,
              letterSpacing: 1.2,
              color: '#FFFFFF',
            }}>
            {t('tools.screen.new')}
          </Text>
        </View>
      ) : null}

      {chrome && (
        <View
          style={{
            position: 'absolute',
            right: 20,
            top: 20,
            flexDirection: 'row',
            gap: 10,
          }}>
          {!NATIVE && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('tools.screen.fullscreen')}
              onPress={fullscreen}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                height: 44,
                paddingHorizontal: 16,
                borderRadius: 999,
                backgroundColor: 'rgba(255,255,255,0.14)',
              }}>
              <Icon name="maximize" size={18} color="#FFFFFF" strokeWidth={2} />
              <Text
                style={{
                  fontFamily: font.semibold,
                  fontSize: 14,
                  color: '#FFFFFF',
                }}>
                {t('tools.screen.fullscreen')}
              </Text>
            </Pressable>
          )}
          {count > 1 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('tools.screen.next')}
              onPress={() => nextRef.current()}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255,255,255,0.14)',
              }}>
              <Icon name="arrowRight" size={18} color="#FFFFFF" strokeWidth={2} />
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('tools.screen.exit')}
            onPress={() => {
              if (!NATIVE && typeof document !== 'undefined' && document.fullscreenElement) void document.exitFullscreen().catch(() => {});
              if (router.canGoBack()) router.back();
              else
                router.replace({
                  pathname: '/etkinlik/[id]/album',
                  params: { id: event.id },
                });
            }}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255,255,255,0.14)',
            }}>
            <Icon name="close" size={18} color="#FFFFFF" strokeWidth={2} />
          </Pressable>
        </View>
      )}
      {chrome && count > 0 && (
        <View
          style={{
            position: 'absolute',
            left: 28,
            top: 28,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 999,
            backgroundColor: 'rgba(255,255,255,0.14)',
          }}>
          <Text
            style={{
              fontFamily: font.semibold,
              fontSize: 13,
              color: '#FFFFFF',
            }}>
            {t('tools.screen.counter', { n: (idx % count) + 1, total: count })} ·{' '}
            {new Intl.DateTimeFormat(locale, {
              hour: '2-digit',
              minute: '2-digit',
            }).format(new Date())}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
