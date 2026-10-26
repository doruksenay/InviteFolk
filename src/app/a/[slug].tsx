import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, Text, TextInput, useWindowDimensions, View } from 'react-native';

import { getTheme } from '@/core/themes';
import { makeT } from '@/i18n';
import { useQuery } from '@/lib/api';
import { getPublicEvent, listPublicAlbum, uploadAlbumItem } from '@/lib/api-guest';
import { pickAlbumMedia } from '@/lib/media-pick';
import { hairline } from '@/ui/guest/colors';
import { GuestbookCard } from '@/ui/guest/Guestbook';
import { PublicLoading, PublicNotFound, PublicPanel, PublicShell } from '@/ui/guest/PublicShell';
import { VOICE_SUPPORTED, VoiceRecorder } from '@/ui/guest/VoiceRecorder';
import { Icon } from '@/ui/Icon';
import { font } from '@/ui/tokens';

const MAX_AT_ONCE = 20;

type Result = { ok: number; failed: number; skipped: number; pending: number };

/** Masadaki karekodla açılan ortak albüm: fotoğraf, video, sesli mesaj ve anı defteri. Giriş gerekmez. */
export default function AlbumPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const q = useQuery(() => getPublicEvent(slug), [slug]);
  const isPublic = !!q.data?.album_public;
  const itemsQ = useQuery(() => (isPublic ? listPublicAlbum(slug) : Promise.resolve([])), [slug, isPublic]);
  const [name, setName] = useState('');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const { width } = useWindowDimensions();

  if (q.loading && !q.data) return <PublicLoading />;
  const ev = q.data;
  const t = makeT(ev?.lang === 'en' ? 'en' : 'tr');
  const locale = ev?.lang === 'en' ? 'en-GB' : 'tr-TR';
  if (!ev || (!ev.album && !ev.guestbook)) return <PublicNotFound title={t('pub.notFoundTitle')} body={t('pub.notFoundBody')} />;
  const theme = getTheme(ev.theme);
  const errColor = theme.dark ? '#FFB4A8' : '#A3332A';

  const pick = async () => {
    setErr(null);
    setResult(null);
    let picked;
    try {
      picked = await pickAlbumMedia(MAX_AT_ONCE);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      return;
    }
    const { items, skipped } = picked;
    if (!items.length) {
      if (skipped) setResult({ ok: 0, failed: 0, skipped, pending: 0 });
      return;
    }
    const r: Result = { ok: 0, failed: 0, skipped, pending: 0 };
    setProgress({ done: 0, total: items.length });
    for (const it of items) {
      try {
        const u = await uploadAlbumItem(slug, it, name.trim() || null);
        r.ok++;
        if (u.pending) r.pending++;
      } catch (e) {
        r.failed++;
        setErr(e instanceof Error ? e.message : String(e));
      }
      setProgress({ done: r.ok + r.failed, total: items.length });
    }
    setProgress(null);
    setResult(r);
    if (isPublic) itemsQ.reload();
  };

  const sendVoice = async (blob: Blob, mime: string) => {
    setErr(null);
    try {
      await uploadAlbumItem(slug, { data: blob, mime }, name.trim() || null);
      if (isPublic) itemsQ.reload();
      return true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      return false;
    }
  };

  const tile = Math.floor((Math.min(440, width - 40) - 16) / 3);
  const items = itemsQ.data ?? [];

  return (
    <PublicShell themeKey={ev.theme} kicker={ev.album ? t('pub.album.kicker') : t('guest.guestbook.kicker')} title={ev.title} subtitle={ev.album ? t('pub.album.body') : t('guest.guestbook.body')}>
      {ev.album && (
        <PublicPanel theme={theme}>
          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: font.semibold, fontSize: 14, color: theme.ink }}>{t('pub.album.nameLabel')}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t('pub.album.namePlaceholder')}
              placeholderTextColor={theme.dark ? 'rgba(247,241,231,0.45)' : '#A49C90'}
              maxLength={60}
              accessibilityLabel={t('pub.album.nameLabel')}
              style={{ height: 50, borderRadius: 16, paddingHorizontal: 16, fontFamily: font.regular, fontSize: 15, color: theme.ink, backgroundColor: theme.dark ? 'rgba(255,255,255,0.06)' : '#F7F3EE', boxShadow: `inset 0 0 0 1px ${hairline(theme.dark)}` }}
            />
          </View>
          {progress ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }}>
              <ActivityIndicator color={theme.ink} />
              <Text style={{ fontFamily: font.semibold, fontSize: 15, color: theme.ink }}>{t('pub.album.uploading', progress)}</Text>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={pick}
              style={({ pressed }) => ({ height: 58, borderRadius: 999, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.ink, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
              <Icon name="camera" size={20} color={theme.bg} strokeWidth={2} />
              <Text style={{ fontFamily: font.semibold, fontSize: 16, color: theme.bg }}>{result ? t('pub.album.more') : t('pub.album.pick')}</Text>
            </Pressable>
          )}
          <Text style={{ fontFamily: font.regular, fontSize: 12, color: theme.soft, textAlign: 'center' }}>{t('pub.album.limits')}</Text>
          {result && result.ok > 0 && (
            <Text style={{ fontFamily: font.semibold, fontSize: 15, color: theme.key_ }}>
              {result.pending ? t('pub.album.donePending', { count: result.ok }) : t('pub.album.done', { count: result.ok })}
            </Text>
          )}
          {result && result.failed > 0 && <Text style={{ fontFamily: font.medium, fontSize: 13, color: errColor }}>{t('pub.album.failed', { count: result.failed })}</Text>}
          {result && result.skipped > 0 && <Text style={{ fontFamily: font.medium, fontSize: 13, color: errColor }}>{t('pub.album.skipped', { count: result.skipped })}</Text>}
          {err && !result && <Text style={{ fontFamily: font.medium, fontSize: 13, color: errColor }}>{err}</Text>}
          {VOICE_SUPPORTED && (
            <View style={{ paddingTop: 14, borderTopWidth: 1, borderTopColor: hairline(theme.dark) }}>
              <VoiceRecorder theme={theme} t={t} onSend={sendVoice} />
            </View>
          )}
          <Text style={{ fontFamily: font.regular, fontSize: 12, lineHeight: 17, color: theme.soft }}>{ev.album_moderate ? t('pub.album.privacyModerated') : t('pub.album.privacy')}</Text>
        </PublicPanel>
      )}
      {ev.guestbook && <GuestbookCard theme={theme} t={t} locale={locale} source={{ slug }} isPublic={!!ev.guestbook_public} />}
      {isPublic && items.length > 0 && (
        <View style={{ gap: 10 }}>
          <Text style={{ fontFamily: font.bold, fontSize: 12, letterSpacing: 1.4, color: theme.key_ }}>{t('pub.album.galleryTitle').toLocaleUpperCase()}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {items.map((p, i) =>
              p.kind === 'photo' ? (
                <Image key={p.url} source={{ uri: p.url }} accessibilityLabel={t('guest.gallery.photo', { n: i + 1 })} accessibilityIgnoresInvertColors style={{ width: tile, height: tile, borderRadius: 12, backgroundColor: theme.shapeC }} resizeMode="cover" />
              ) : (
                <Pressable
                  key={p.url}
                  accessibilityRole="link"
                  accessibilityLabel={p.kind === 'video' ? t('pub.album.video') : t('pub.album.voice')}
                  onPress={() => Linking.openURL(p.url)}
                  style={{ width: tile, height: tile, borderRadius: 12, backgroundColor: theme.shapeC, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Icon name={p.kind === 'video' ? 'play' : 'mic'} size={26} color={theme.ink} strokeWidth={2} />
                  <Text style={{ fontFamily: font.semibold, fontSize: 12, color: theme.ink }}>{p.kind === 'video' ? t('pub.album.video') : t('pub.album.voice')}</Text>
                </Pressable>
              ),
            )}
          </View>
        </View>
      )}
    </PublicShell>
  );
}
