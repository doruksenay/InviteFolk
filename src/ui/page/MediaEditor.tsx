import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, TextInput, View } from 'react-native';

import type { EventSettings, PlanLimits } from '@/core/types';
import { useI18n } from '@/i18n';
import { useQuery } from '@/lib/api';
import { addGalleryPhotos, patchSettings, removeMusic, removeVideo, setGallery, setMusic, setVideo, signedMediaUrls } from '@/lib/api-page';
import { pickAudio, pickPhotos, pickVideo } from '@/lib/media-pick';
import { Icon } from '@/ui/Icon';
import { Button, Caption, Notice } from '@/ui/primitives';
import { color, font, radius } from '@/ui/tokens';

import { SectionHead } from './Editors';

/** Müzik, galeri ve video: seçilince hemen yüklenir ve etkinliğe bağlanır (Kaydet beklenmez). */
export function MediaEditor({ eventId, settings, limits, onChanged, lockedLabel }: { eventId: string; settings: EventSettings; limits: PlanLimits | null; onChanged: () => void; lockedLabel: (plan: string) => string }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState<'music' | 'gallery' | 'video' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [musicTitle, setMusicTitle] = useState(settings.music?.title ?? '');
  const gallery = settings.gallery ?? [];
  const paths = gallery.map((g) => g.path);
  const thumbs = useQuery(() => signedMediaUrls(paths).catch(() => ({}) as Record<string, string>), [paths.join(',')]);
  const maxGallery = limits?.max_gallery ?? 0;

  const run = async (kind: 'music' | 'gallery' | 'video', fn: () => Promise<unknown>) => {
    setErr(null);
    setBusy(kind);
    try {
      await fn();
      onChanged();
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setErr(m === 'too-large' ? t('tools.page.media.tooLarge') : m === 'unsupported-type' ? t('tools.page.media.unsupported') : m);
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ gap: 22 }}>
      {err && <Notice tone="error" text={err} />}

      {/* Müzik */}
      <View style={{ gap: 10 }}>
        <SectionHead title={t('tools.page.media.music')} hint={t('tools.page.media.musicHint')} />
        {limits && !limits.music ? (
          <Caption color={color.lavenderInk}>{lockedLabel('Temel')}</Caption>
        ) : settings.music ? (
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.lg, backgroundColor: color.lavenderTint }}>
              <Icon name="music" size={20} color={color.lavenderInk} />
              <TextInput
                value={musicTitle}
                onChangeText={setMusicTitle}
                onBlur={() => {
                  // Yalnızca başlık değiştiyse dosya aynı kalır.
                  if (settings.music && (settings.music.title ?? '') !== musicTitle.trim()) {
                    const path = settings.music.path;
                    run('music', () => patchSettings(eventId, { music: { path, ...(musicTitle.trim() ? { title: musicTitle.trim().slice(0, 80) } : {}) } }));
                  }
                }}
                placeholder={t('tools.page.media.musicTitle')}
                placeholderTextColor={color.faint}
                maxLength={80}
                accessibilityLabel={t('tools.page.media.musicTitle')}
                style={{ flex: 1, fontFamily: font.semibold, fontSize: 14, color: color.ink }}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Button
                label={t('tools.page.media.musicReplace')}
                icon="upload"
                variant="secondary"
                loading={busy === 'music'}
                onPress={() =>
                  run('music', async () => {
                    const f = await pickAudio();
                    if (f) await setMusic(eventId, f, musicTitle.trim() || f.name.replace(/\.[^.]+$/, '').slice(0, 80));
                  })
                }
              />
              <Button label={t('tools.page.media.musicRemove')} icon="trash" variant="ghost" onPress={() => run('music', () => removeMusic(eventId))} />
            </View>
          </View>
        ) : (
          <Button
            label={busy === 'music' ? t('tools.page.media.uploading') : t('tools.page.media.musicPick')}
            icon="music"
            variant="secondary"
            loading={busy === 'music'}
            onPress={() =>
              run('music', async () => {
                const f = await pickAudio();
                if (f) {
                  const title = f.name.replace(/\.[^.]+$/, '').slice(0, 80);
                  setMusicTitle(title);
                  await setMusic(eventId, f, title);
                }
              })
            }
            style={{ alignSelf: 'flex-start' }}
          />
        )}
      </View>

      {/* Galeri */}
      <View style={{ gap: 10 }}>
        <SectionHead title={t('tools.page.media.gallery')} hint={t('tools.page.media.galleryHint', { count: maxGallery })} />
        {gallery.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {gallery.map((g) => {
              const url = thumbs.data?.[g.path];
              return (
                <View key={g.path} style={{ width: 86, height: 86, borderRadius: 14, overflow: 'hidden', backgroundColor: color.surfaceSoft }}>
                  {url ? <Image source={{ uri: url }} style={{ width: 86, height: 86 }} resizeMode="cover" /> : <ActivityIndicator style={{ marginTop: 32 }} color={color.muted} />}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('tools.page.media.galleryRemove')}
                    onPress={() =>
                      run('gallery', () =>
                        setGallery(
                          eventId,
                          gallery.filter((x) => x.path !== g.path),
                          [g],
                        ),
                      )
                    }
                    style={{ position: 'absolute', right: 4, top: 4, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)' }}>
                    <Icon name="close" size={12} color="#FFFFFF" strokeWidth={2.4} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}
        {gallery.length < maxGallery ? (
          <Button
            label={busy === 'gallery' ? t('tools.page.media.uploading') : t('tools.page.media.galleryAdd')}
            icon="image"
            variant="secondary"
            loading={busy === 'gallery'}
            onPress={() =>
              run('gallery', async () => {
                const photos = await pickPhotos(maxGallery - gallery.length);
                if (photos.length) await addGalleryPhotos(eventId, gallery, photos);
              })
            }
            style={{ alignSelf: 'flex-start' }}
          />
        ) : maxGallery === 0 ? (
          <Caption color={color.lavenderInk}>{lockedLabel('Temel')}</Caption>
        ) : null}
      </View>

      {/* Video */}
      <View style={{ gap: 10 }}>
        <SectionHead title={t('tools.page.media.video')} hint={t('tools.page.media.videoHint')} />
        {settings.video ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: radius.lg, backgroundColor: color.coralTint }}>
              <Icon name="video" size={18} color={color.coralInk} />
              <Text style={{ fontFamily: font.semibold, fontSize: 14, color: color.coralInk }}>
                {settings.video.width}×{settings.video.height}
              </Text>
            </View>
            <Button label={t('tools.page.media.videoRemove')} icon="trash" variant="ghost" loading={busy === 'video'} onPress={() => run('video', () => removeVideo(eventId))} />
          </View>
        ) : limits && !limits.video ? (
          <Caption color={color.lavenderInk}>{lockedLabel('Tam')}</Caption>
        ) : (
          <Button
            label={busy === 'video' ? t('tools.page.media.uploading') : t('tools.page.media.videoPick')}
            icon="video"
            variant="secondary"
            loading={busy === 'video'}
            onPress={() =>
              run('video', async () => {
                const f = await pickVideo();
                if (f) await setVideo(eventId, f, settings.design?.overlay);
              })
            }
            style={{ alignSelf: 'flex-start' }}
          />
        )}
      </View>
    </View>
  );
}
