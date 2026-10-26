import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import type { InvitationTheme } from '@/core/themes';
import type { TFn } from '@/i18n';
import { Icon, type IconName } from '@/ui/Icon';
import { font } from '@/ui/tokens';

import { hairline } from './colors';

const MAX_SECONDS = 60;

/** Tarayıcının kaydedebildiği biçim (Chrome/Firefox webm, Safari mp4). Parametresiz MIME döner. */
function pickMime(): string | null {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') return null;
  for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m;
    } catch {
      // eski tarayıcı
    }
  }
  return null;
}

export const VOICE_SUPPORTED = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && pickMime() !== null;

function Pill({ theme, label, icon, onPress, filled, danger }: { theme: InvitationTheme; label: string; icon: IconName; onPress: () => void; filled?: boolean; danger?: boolean }) {
  const fg = filled ? (danger ? '#FFFFFF' : theme.bg) : theme.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        height: 44,
        paddingHorizontal: 16,
        borderRadius: 999,
        backgroundColor: filled ? (danger ? '#C2412D' : theme.ink) : 'transparent',
        boxShadow: filled ? 'none' : `inset 0 0 0 1px ${hairline(theme.dark)}`,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}>
      <Icon name={icon} size={16} color={fg} strokeWidth={2} />
      <Text style={{ fontFamily: font.semibold, fontSize: 14, color: fg }}>{label}</Text>
    </Pressable>
  );
}

type State = { k: 'idle' } | { k: 'rec'; secs: number } | { k: 'ready'; blob: Blob; mime: string; secs: number } | { k: 'sending' } | { k: 'sent' } | { k: 'denied' };

/** Sesli mesaj: en fazla 60 sn kayıt, dinle, gönder ya da sil. */
export function VoiceRecorder({ theme, t, onSend }: { theme: InvitationTheme; t: TFn; onSend: (blob: Blob, mime: string) => Promise<boolean> }) {
  const [st, setSt] = useState<State>({ k: 'idle' });
  const rec = useRef<{
    mr: MediaRecorder;
    stream: MediaStream;
    timer: ReturnType<typeof setInterval>;
    started: number;
  } | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const url = useRef<string | null>(null);

  const cleanup = () => {
    if (rec.current) {
      clearInterval(rec.current.timer);
      rec.current.stream.getTracks().forEach((tr) => tr.stop());
      rec.current = null;
    }
    audio.current?.pause();
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = null;
  };
  useEffect(() => cleanup, []);

  const start = async () => {
    const mimeFull = pickMime();
    if (!mimeFull) return;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      setSt({ k: 'denied' });
      return;
    }
    const mr = new MediaRecorder(stream, {
      mimeType: mimeFull,
      audioBitsPerSecond: 64000,
    });
    const chunks: Blob[] = [];
    const mime = mimeFull.split(';')[0];
    mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    mr.onstop = () => {
      const secs = rec.current ? Math.min(MAX_SECONDS, Math.round((Date.now() - rec.current.started) / 1000)) : 0;
      if (rec.current) {
        clearInterval(rec.current.timer);
        rec.current.stream.getTracks().forEach((tr) => tr.stop());
        rec.current = null;
      }
      const blob = new Blob(chunks, { type: mime });
      setSt(blob.size > 0 ? { k: 'ready', blob, mime, secs } : { k: 'idle' });
    };
    const started = Date.now();
    const timer = setInterval(() => {
      const secs = Math.round((Date.now() - started) / 1000);
      if (secs >= MAX_SECONDS) mr.state === 'recording' && mr.stop();
      else setSt({ k: 'rec', secs });
    }, 250);
    rec.current = { mr, stream, timer, started };
    mr.start(1000);
    setSt({ k: 'rec', secs: 0 });
  };

  const stop = () => rec.current?.mr.state === 'recording' && rec.current.mr.stop();

  const play = () => {
    if (st.k !== 'ready') return;
    audio.current?.pause();
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = URL.createObjectURL(st.blob);
    audio.current = new Audio(url.current);
    void audio.current.play().catch(() => {});
  };

  const send = async () => {
    if (st.k !== 'ready') return;
    const { blob, mime } = st;
    audio.current?.pause();
    setSt({ k: 'sending' });
    const ok = await onSend(blob, mime);
    setSt(ok ? { k: 'sent' } : { k: 'ready', blob, mime, secs: 0 });
  };

  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="mic" size={16} color={theme.key_} strokeWidth={2} />
        <Text style={{ fontFamily: font.semibold, fontSize: 15, color: theme.ink }}>{t('pub.voice.title')}</Text>
      </View>
      <Text
        style={{
          fontFamily: font.regular,
          fontSize: 13,
          lineHeight: 18,
          color: theme.soft,
        }}>
        {t('pub.voice.body', { max: MAX_SECONDS })}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 8,
        }}>
        {st.k === 'idle' || st.k === 'denied' || st.k === 'sent' ? (
          <Pill theme={theme} key={st.k === 'sent' ? t('pub.voice.again') : t('pub.voice.record')} label={st.k === 'sent' ? t('pub.voice.again') : t('pub.voice.record')} icon="mic" onPress={start} filled />
        ) : null}
        {st.k === 'rec' ? (
          <>
            <Pill theme={theme} key={t('pub.voice.stop')} label={t('pub.voice.stop')} icon="stop" onPress={stop} filled danger />
            <Text
              accessibilityLiveRegion="polite"
              style={{
                fontFamily: font.semibold,
                fontSize: 15,
                color: theme.ink,
                fontVariant: ['tabular-nums'],
              }}>
              {mmss(st.secs)} / {mmss(MAX_SECONDS)}
            </Text>
          </>
        ) : null}
        {st.k === 'ready' ? (
          <>
            <Pill theme={theme} key={t('pub.voice.listen')} label={t('pub.voice.listen')} icon="play" onPress={play} />
            <Pill theme={theme} key={t('pub.voice.send')} label={t('pub.voice.send')} icon="send" onPress={send} filled />
            <Pill theme={theme} key={t('pub.voice.discard')} label={t('pub.voice.discard')} icon="trash" onPress={() => setSt({ k: 'idle' })} />
          </>
        ) : null}
        {st.k === 'sending' ? <ActivityIndicator color={theme.ink} /> : null}
      </View>
      {st.k === 'denied' ? (
        <Text
          style={{
            fontFamily: font.medium,
            fontSize: 13,
            color: theme.dark ? '#FFB4A8' : '#A3332A',
          }}>
          {t('pub.voice.denied')}
        </Text>
      ) : null}
      {st.k === 'sent' ? <Text style={{ fontFamily: font.semibold, fontSize: 14, color: theme.key_ }}>{t('pub.voice.sent')}</Text> : null}
    </View>
  );
}
