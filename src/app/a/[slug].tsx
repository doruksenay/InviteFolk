import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, TextInput, useWindowDimensions, View } from 'react-native';

import { getTheme } from '@/core/themes';
import { makeT } from '@/i18n';
import { useQuery } from '@/lib/api';
import { getPublicEvent, listPublicAlbum, uploadAlbumPhoto } from '@/lib/api-guest';
import { pickPhotos } from '@/lib/media-pick';
import { hairline } from '@/ui/guest/colors';
import { PublicLoading, PublicNotFound, PublicPanel, PublicShell } from '@/ui/guest/PublicShell';
import { Icon } from '@/ui/Icon';
import { font } from '@/ui/tokens';

const MAX_AT_ONCE = 20;

/** Davetlilerin fotoğraf albümü: masadaki karekodla açılır, giriş gerekmez. */
export default function AlbumPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const q = useQuery(() => getPublicEvent(slug), [slug]);
  const isPublic = !!q.data?.album_public;
  const photosQ = useQuery(() => (isPublic ? listPublicAlbum(slug) : Promise.resolve([])), [slug, isPublic]);
  const [name, setName] = useState('');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ ok: number; failed: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const { width } = useWindowDimensions();

  if (q.loading && !q.data) return <PublicLoading />;
  const ev = q.data;
  const t = makeT(ev?.lang === 'en' ? 'en' : 'tr');
  if (!ev || !ev.album) return <PublicNotFound title={t('pub.notFoundTitle')} body={t('pub.notFoundBody')} />;
  const theme = getTheme(ev.theme);

  const pick = async () => {
    setErr(null);
    setResult(null);
    let photos;
    try {
      photos = await pickPhotos(MAX_AT_ONCE);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      return;
    }
    if (!photos.length) return;
    let ok = 0;
    let failed = 0;
    setProgress({ done: 0, total: photos.length });
    for (const p of photos) {
      try {
        await uploadAlbumPhoto(slug, p, name.trim() || null);
        ok++;
      } catch (e) {
        failed++;
        setErr(e instanceof Error ? e.message : String(e));
      }
      setProgress({ done: ok + failed, total: photos.length });
    }
    setProgress(null);
    setResult({ ok, failed });
    if (isPublic) photosQ.reload();
  };

  const tile = Math.floor((Math.min(440, width - 40) - 16) / 3);

  return (
    <PublicShell themeKey={ev.theme} kicker={t('pub.album.kicker')} title={ev.title} subtitle={t('pub.album.body')}>
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
        {result && result.ok > 0 && <Text style={{ fontFamily: font.semibold, fontSize: 15, color: theme.key_ }}>{t('pub.album.done', { count: result.ok })}</Text>}
        {result && result.failed > 0 && <Text style={{ fontFamily: font.medium, fontSize: 13, color: theme.dark ? '#FFB4A8' : '#A3332A' }}>{t('pub.album.failed', { count: result.failed })}</Text>}
        {err && !result && <Text style={{ fontFamily: font.medium, fontSize: 13, color: theme.dark ? '#FFB4A8' : '#A3332A' }}>{err}</Text>}
        <Text style={{ fontFamily: font.regular, fontSize: 12, lineHeight: 17, color: theme.soft }}>{t('pub.album.privacy')}</Text>
      </PublicPanel>
      {isPublic && (photosQ.data?.length ?? 0) > 0 && (
        <View style={{ gap: 10 }}>
          <Text style={{ fontFamily: font.bold, fontSize: 12, letterSpacing: 1.4, color: theme.key_ }}>{t('pub.album.galleryTitle').toLocaleUpperCase()}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {photosQ.data!.map((p) => (
              <Image key={p.url} source={{ uri: p.url }} style={{ width: tile, height: tile, borderRadius: 12, backgroundColor: theme.shapeC }} resizeMode="cover" />
            ))}
          </View>
        </View>
      )}
    </PublicShell>
  );
}
