import { type AudioPlayer, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';

import type { InvitationTheme } from '@/core/themes';
import type { DesignOverlay } from '@/core/types';
import type { TFn } from '@/i18n';
import { Icon } from '@/ui/Icon';
import { tapFeedback } from '@/ui/primitives';
import { font } from '@/ui/tokens';

import { SectionCard } from './Sections';

const OVERLAY_FONTS: Record<DesignOverlay['font'], string> = {
  serif: font.serif,
  serifItalic: font.serifItalic,
  sans: font.medium,
  sansBold: font.bold,
};

// Oynatıcı nesneleri yerel modül nesneleridir; özellik atamaları bu yardımcılarla yapılır.
function setLoop(p: { loop: boolean }, v: boolean) {
  p.loop = v;
}
function setMuted(p: { muted: boolean }, v: boolean) {
  p.muted = v;
}

// ---------------------------------------------------------------------------
// Fon müziği
// ---------------------------------------------------------------------------
/** Davetli sayfasının müzik çalarını kurar (kaynak gelince yüklenir, döngüde çalar). */
export function useInvitationMusic(url: string | null) {
  const player = useAudioPlayer(url ?? null);
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);
  useEffect(() => {
    if (url) setLoop(player, true);
  }, [player, url]);
  return player;
}

/** Sağ altta yüzen çal/durdur düğmesi. */
export function MusicButton({ theme, player, title, t }: { theme: InvitationTheme; player: AudioPlayer; title: string | null; t: TFn }) {
  const status = useAudioPlayerStatus(player);
  const playing = status.playing;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={playing ? t('guest.music.pause') : t('guest.music.play')}
      accessibilityHint={title ? t('guest.music.nowPlaying', { title }) : undefined}
      onPress={() => {
        tapFeedback();
        if (playing) player.pause();
        else player.play();
      }}
      style={({ pressed }) => ({
        position: 'absolute',
        right: 18,
        bottom: 22,
        zIndex: 20,
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.ink,
        boxShadow: '0px 10px 24px rgba(0,0,0,0.25)',
        transform: [{ scale: pressed ? 0.94 : 1 }],
      })}>
      <Icon name={playing ? 'volume' : 'volumeOff'} size={22} color={theme.bg} strokeWidth={2} />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Video davetiye (sessiz başlar, döngüde; isim alanı videonun üstünde)
// ---------------------------------------------------------------------------
export function VideoInvite({
  theme,
  url,
  width,
  height,
  overlay,
  name,
  t,
}: {
  theme: InvitationTheme;
  url: string;
  width: number;
  height: number;
  overlay: DesignOverlay | null;
  name: string;
  t: TFn;
}) {
  const { width: screen } = useWindowDimensions();
  const boxW = Math.min(420, screen - 40);
  const ratio = width > 0 && height > 0 ? height / width : 16 / 9;
  const boxH = Math.min(boxW * ratio, 720);
  const player = useVideoPlayer(url, (p) => {
    setLoop(p, true);
    setMuted(p, true);
    p.play();
  });
  const [muted, setMutedState] = useState(true);
  const o = overlay;
  return (
    <View style={{ width: boxW, height: boxH, alignSelf: 'center', borderRadius: 24, overflow: 'hidden', backgroundColor: '#000', boxShadow: '0px 26px 56px rgba(30,20,10,0.20)' }}>
      <VideoView player={player} style={{ width: boxW, height: boxH }} contentFit="cover" nativeControls={false} />
      {o ? (
        <Text
          pointerEvents="none"
          numberOfLines={2}
          style={{
            position: 'absolute',
            left: o.x * boxW,
            width: o.width * boxW,
            top: o.y * boxH - o.size * boxW * 0.75,
            fontFamily: OVERLAY_FONTS[o.font] ?? font.serif,
            fontSize: o.size * boxW,
            lineHeight: o.size * boxW * 1.2,
            color: o.color,
            textAlign: o.align,
          }}>
          {`${o.prefix}${name}`}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={muted ? t('guest.video.unmute') : t('guest.video.mute')}
        onPress={() => {
          setMuted(player, !muted);
          setMutedState(!muted);
        }}
        style={{ position: 'absolute', right: 12, top: 12, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' }}>
        <Icon name={muted ? 'volumeOff' : 'volume'} size={18} color="#FFFFFF" strokeWidth={2} />
      </Pressable>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, backgroundColor: theme.shapeB, opacity: 0.8 }} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Galeri: yatay şerit + büyük görüntüleme
// ---------------------------------------------------------------------------
export function Gallery({ theme, photos, t }: { theme: InvitationTheme; photos: { url: string; width: number; height: number }[]; t: TFn }) {
  const [open, setOpen] = useState<number | null>(null);
  const { width, height } = useWindowDimensions();
  if (!photos.length) return null;
  return (
    <SectionCard theme={theme} kicker={t('guest.gallery.kicker')} icon="image">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        {photos.map((p, i) => {
          const h = 180;
          const w = Math.round(Math.min(260, Math.max(120, (p.width && p.height ? p.width / p.height : 1) * h)));
          return (
            <Pressable key={p.url} accessibilityRole="imagebutton" accessibilityLabel={t('guest.gallery.photo', { n: i + 1 })} onPress={() => setOpen(i)}>
              <Image source={{ uri: p.url }} style={{ width: w, height: h, borderRadius: 16, backgroundColor: theme.shapeC }} resizeMode="cover" />
            </Pressable>
          );
        })}
      </ScrollView>
      <Modal visible={open !== null} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(10,8,6,0.94)' }}>
          <ScrollView
            horizontal
            pagingEnabled
            contentOffset={{ x: (open ?? 0) * width, y: 0 }}
            showsHorizontalScrollIndicator={false}
            style={{ flex: 1 }}>
            {photos.map((p, i) => (
              <View key={p.url} style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
                <Image source={{ uri: p.url }} accessibilityLabel={t('guest.gallery.photo', { n: i + 1 })} style={{ width: width - 24, height: height - 120 }} resizeMode="contain" />
              </View>
            ))}
          </ScrollView>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('guest.gallery.close')}
            onPress={() => setOpen(null)}
            style={{ position: 'absolute', right: 18, top: 40, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' }}>
            <Icon name="close" size={20} color="#FFFFFF" strokeWidth={2} />
          </Pressable>
        </View>
      </Modal>
    </SectionCard>
  );
}
