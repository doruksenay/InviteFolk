import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, Linking, Text, useWindowDimensions, View } from 'react-native';

import { publicUrl } from '@/core/format';
import { getTheme } from '@/core/themes';
import type { EventSettings } from '@/core/types';
import { useI18n } from '@/i18n';
import { useQuery } from '@/lib/api';
import { getEventRow } from '@/lib/api-guests';
import { type AlbumItem, albumDownloadUrl, deleteAlbumPhoto, getEventLimits, listAlbum, setAlbumHidden } from '@/lib/api-tools';
import { ToolError, ToolHeader, ToolLoading } from '@/ui/event/ToolScreen';
import { Button, Caption, EmptyState, Notice, Surface } from '@/ui/primitives';
import { buildQrCardsHtml } from '@/ui/print/qrCards';
import { QrCode } from '@/ui/QrCode';
import { Screen } from '@/ui/Screen';
import { printHtml } from '@/ui/seating/printCards';
import { color, font, radius } from '@/ui/tokens';

export default function AlbumScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const ev = useQuery(() => getEventRow(id), [id]);
  const lim = useQuery(() => getEventLimits(id).catch(() => null), [id]);
  const photos = useQuery(() => listAlbum(id).catch(() => [] as AlbumItem[]), [id]);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (ev.loading && !ev.data) return <ToolLoading />;
  if (ev.error || !ev.data) return <ToolError />;
  const event = ev.data;
  const s = (event.settings ?? {}) as EventSettings;
  const url = publicUrl('a', event.public_slug);
  const items = photos.data ?? [];
  const cols = width >= 1100 ? 5 : width >= 760 ? 4 : 2;
  const size = Math.floor((Math.min(width, 1180) - 48 - (cols - 1) * 10) / cols);

  if (!s.album?.enabled) {
    return (
      <Screen maxWidth={720}>
        <ToolHeader eventId={event.id} eventTitle={event.title} title={t('tools.album.title')} accent={t('tools.album.titleAccent')} />
        <Notice tone="info" text={t('tools.album.disabled')} />
        <Button label={t('tools.checkin.enable')} variant="secondary" onPress={() => router.replace({ pathname: '/etkinlik/[id]/sayfa', params: { id: event.id } })} style={{ alignSelf: 'flex-start' }} />
      </Screen>
    );
  }

  const act = async (fn: () => Promise<unknown>) => {
    setMsg(null);
    try {
      await fn();
      photos.reload();
      lim.reload();
    } catch (e) {
      setMsg({ tone: 'error', text: e instanceof Error ? e.message : String(e) });
    }
  };

  const poster = () =>
    printHtml(
      buildQrCardsHtml({
        theme: getTheme(event.theme),
        eventTitle: event.title,
        heading: t('tools.album.posterTitle'),
        body: t('tools.album.posterBody'),
        url,
        docTitle: t('tools.album.posterTitle'),
      }),
    );

  return (
    <Screen maxWidth={1180}>
      <ToolHeader eventId={event.id} eventTitle={event.title} title={t('tools.album.title')} accent={t('tools.album.titleAccent')} subtitle={t('tools.album.subtitle')} />

      <Surface style={{ flexDirection: width >= 700 ? 'row' : 'column', gap: 18, alignItems: width >= 700 ? 'center' : 'flex-start' }}>
        <View style={{ padding: 10, borderRadius: radius.lg, backgroundColor: '#FFFFFF', boxShadow: `inset 0 0 0 1px ${color.hairline}` }}>
          <QrCode value={url} size={132} />
        </View>
        <View style={{ flex: 1, gap: 8 }}>
          <Text style={{ fontFamily: font.display, fontSize: 26, color: color.ink }}>{t('tools.album.count', { count: items.length })}</Text>
          {lim.data && <Caption>{t('tools.album.limit', { count: lim.data.limits.album_photos })}</Caption>}
          <Text selectable style={{ fontFamily: font.semibold, fontSize: 13, color: color.lavenderInk }}>
            {url}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
            <Button label={t('tools.album.poster')} icon="print" onPress={poster} />
            <Button
              label={t('tools.album.copyLink')}
              icon="copy"
              variant="secondary"
              onPress={async () => {
                await Clipboard.setStringAsync(url);
                setMsg({ tone: 'success', text: t('tools.collector.copied') });
              }}
            />
            <Button label={t('tools.album.refresh')} variant="ghost" onPress={() => photos.reload()} />
          </View>
        </View>
      </Surface>

      {msg && <Notice tone={msg.tone} text={msg.text} />}

      {items.length === 0 ? (
        <EmptyState title={t('tools.album.count', { count: 0 })} body={t('tools.album.empty')} />
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {items.map((p) => (
            <View key={p.id} style={{ width: size, gap: 6 }}>
              <View style={{ width: size, height: size, borderRadius: radius.md, overflow: 'hidden', backgroundColor: color.surfaceSoft, opacity: p.hidden ? 0.45 : 1 }}>
                {p.url ? <Image source={{ uri: p.url }} style={{ width: size, height: size }} resizeMode="cover" accessibilityIgnoresInvertColors /> : null}
                {p.hidden && (
                  <View style={{ position: 'absolute', left: 8, top: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.6)' }}>
                    <Text style={{ fontFamily: font.bold, fontSize: 11, color: '#FFFFFF' }}>{t('tools.album.hidden')}</Text>
                  </View>
                )}
              </View>
              <Caption numberOfLines={1}>{p.uploader ? t('tools.album.by', { name: p.uploader }) : ' '}</Caption>
              <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
                <Button label={p.hidden ? t('tools.album.show') : t('tools.album.hide')} variant="ghost" onPress={() => act(() => setAlbumHidden(p.id, !p.hidden))} />
                <Button
                  label={t('tools.album.download')}
                  variant="ghost"
                  onPress={() =>
                    act(async () => {
                      const u = await albumDownloadUrl(p.path);
                      await Linking.openURL(u);
                    })
                  }
                />
                {confirmId === p.id ? (
                  <Button label={t('tools.album.deleteConfirm')} variant="danger" onPress={() => act(() => deleteAlbumPhoto(p))} />
                ) : (
                  <Button label={t('tools.album.delete')} variant="ghost" onPress={() => setConfirmId(p.id)} />
                )}
              </View>
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}
