import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, Linking, Pressable, Text, useWindowDimensions, View } from 'react-native';

import { publicUrl } from '@/core/format';
import { getTheme } from '@/core/themes';
import type { EventSettings, GuestbookEntry } from '@/core/types';
import { useI18n } from '@/i18n';
import { useQuery } from '@/lib/api';
import { getEventRow } from '@/lib/api-guests';
import { type AlbumItem, albumDownloadUrl, deleteAlbumPhoto, deleteGuestbookEntry, getEventLimits, listAlbum, listGuestbook, setAlbumApproved, setAlbumHidden, setGuestbookFlags } from '@/lib/api-tools';
import { Icon } from '@/ui/Icon';
import { ToolError, ToolHeader, ToolLoading } from '@/ui/event/ToolScreen';
import { Button, Caption, EmptyState, Notice, Surface } from '@/ui/primitives';
import { downloadAlbumZip, type ZipProgress } from '@/ui/album/zip';
import { buildQrCardsHtml } from '@/ui/print/qrCards';
import { QrCode } from '@/ui/QrCode';
import { Screen } from '@/ui/Screen';
import { printHtml } from '@/ui/seating/printCards';
import { color, font, radius } from '@/ui/tokens';

type Tab = 'album' | 'pending' | 'guestbook';

function Tabs({ value, onChange, items }: { value: Tab; onChange: (t: Tab) => void; items: { k: Tab; label: string; badge?: number }[] }) {
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
      {items.map((it) => {
        const on = it.k === value;
        return (
          <Pressable
            key={it.k}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(it.k)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              height: 40,
              paddingHorizontal: 16,
              borderRadius: 999,
              backgroundColor: on ? color.ink : 'transparent',
              boxShadow: on ? 'none' : `inset 0 0 0 1px ${color.hairline}`,
            }}>
            <Text style={{ fontFamily: font.semibold, fontSize: 14, color: on ? '#FFFFFF' : color.ink }}>{it.label}</Text>
            {it.badge ? (
              <View style={{ minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? '#FFFFFF' : color.lavenderTint }}>
                <Text style={{ fontFamily: font.bold, fontSize: 12, color: color.lavenderInk }}>{it.badge}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export default function AlbumScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useI18n();
  const { width } = useWindowDimensions();
  const ev = useQuery(() => getEventRow(id), [id]);
  const lim = useQuery(() => getEventLimits(id).catch(() => null), [id]);
  const photos = useQuery(() => listAlbum(id).catch(() => [] as AlbumItem[]), [id]);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const gb = useQuery(() => listGuestbook(id).catch(() => [] as GuestbookEntry[]), [id]);
  const [tab, setTab] = useState<Tab | null>(null);
  const [zip, setZip] = useState<ZipProgress | null>(null);

  if (ev.loading && !ev.data) return <ToolLoading />;
  if (ev.error || !ev.data) return <ToolError />;
  const event = ev.data;
  const s = (event.settings ?? {}) as EventSettings;
  const url = publicUrl('a', event.public_slug);
  const all = photos.data ?? [];
  const items = all.filter((p) => p.approved !== false);
  const pending = all.filter((p) => p.approved === false);
  const entries = gb.data ?? [];
  const albumOn = !!s.album?.enabled;
  const gbOn = !!s.guestbook?.enabled;
  const current: Tab = tab ?? (albumOn ? (pending.length ? 'pending' : 'album') : 'guestbook');
  const gbPending = entries.filter((e) => !e.approved).length;
  const fmt = (iso: string) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  const cols = width >= 1100 ? 5 : width >= 760 ? 4 : 2;
  const size = Math.floor((Math.min(width, 1180) - 48 - (cols - 1) * 10) / cols);

  if (!albumOn && !gbOn) {
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
      gb.reload();
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

  const tile = (p: AlbumItem, mode: 'album' | 'pending') => (
    <View key={p.id} style={{ width: size, gap: 6 }}>
      <Pressable
        accessibilityRole={p.kind === 'photo' ? 'image' : 'button'}
        accessibilityLabel={p.kind === 'video' ? t('tools.album.kindVideo') : p.kind === 'audio' ? t('tools.album.kindAudio') : t('tools.album.kindPhoto')}
        disabled={p.kind === 'photo' || !p.url}
        onPress={() => p.url && Linking.openURL(p.url)}
        style={{ width: size, height: size, borderRadius: radius.md, overflow: 'hidden', backgroundColor: color.surfaceSoft, opacity: p.hidden ? 0.45 : 1, alignItems: 'center', justifyContent: 'center' }}>
        {p.kind === 'photo' && p.url ? <Image source={{ uri: p.url }} style={{ width: size, height: size }} resizeMode="cover" accessibilityIgnoresInvertColors /> : null}
        {p.kind !== 'photo' && (
          <View style={{ alignItems: 'center', gap: 8 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: color.lavenderTint }}>
              <Icon name={p.kind === 'video' ? 'play' : 'mic'} size={24} color={color.lavenderInk} strokeWidth={2} />
            </View>
            <Text style={{ fontFamily: font.semibold, fontSize: 13, color: color.ink }}>{p.kind === 'video' ? t('tools.album.kindVideo') : t('tools.album.kindAudio')}</Text>
          </View>
        )}
        {p.hidden && (
          <View style={{ position: 'absolute', left: 8, top: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.6)' }}>
            <Text style={{ fontFamily: font.bold, fontSize: 11, color: '#FFFFFF' }}>{t('tools.album.hidden')}</Text>
          </View>
        )}
      </Pressable>
      <Caption numberOfLines={1}>{p.uploader ? t('tools.album.by', { name: p.uploader }) : ' '}</Caption>
      <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
        {mode === 'pending' ? (
          <Button label={t('tools.album.approve')} icon="check" onPress={() => act(() => setAlbumApproved([p.id], true))} />
        ) : (
          <Button label={p.hidden ? t('tools.album.show') : t('tools.album.hide')} variant="ghost" onPress={() => act(() => setAlbumHidden(p.id, !p.hidden))} />
        )}
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
  );

  const tabs: { k: Tab; label: string; badge?: number }[] = [];
  if (albumOn) tabs.push({ k: 'album', label: t('tools.album.tabAlbum') }, { k: 'pending', label: t('tools.album.tabPending'), badge: pending.length });
  if (gbOn) tabs.push({ k: 'guestbook', label: t('tools.album.tabGuestbook'), badge: gbPending });

  return (
    <Screen maxWidth={1180}>
      <ToolHeader eventId={event.id} eventTitle={event.title} title={t('tools.album.title')} accent={t('tools.album.titleAccent')} subtitle={t('tools.album.subtitle')} />

      <Surface style={{ flexDirection: width >= 700 ? 'row' : 'column', gap: 18, alignItems: width >= 700 ? 'center' : 'flex-start' }}>
        <View style={{ padding: 10, borderRadius: radius.lg, backgroundColor: '#FFFFFF', boxShadow: `inset 0 0 0 1px ${color.hairline}` }}>
          <QrCode value={url} size={132} />
        </View>
        <View style={{ flex: 1, gap: 8 }}>
          <Text style={{ fontFamily: font.display, fontSize: 26, color: color.ink }}>{albumOn ? t('tools.album.count', { count: items.length }) : t('tools.album.gbCount', { count: entries.length })}</Text>
          {albumOn && lim.data && <Caption>{t('tools.album.limit', { count: lim.data.limits.album_photos })}</Caption>}
          <Text selectable style={{ fontFamily: font.semibold, fontSize: 13, color: color.lavenderInk }}>
            {url}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
            <Button label={t('tools.album.poster')} icon="print" onPress={poster} />
            <Button label={t('tools.album.screen')} icon="monitor" variant="secondary" onPress={() => router.push({ pathname: '/etkinlik/[id]/ekran', params: { id: event.id } })} />
            {albumOn && items.length > 0 && (
              <Button
                label={zip ? t('tools.album.zipProgress', { done: zip.done, total: zip.total }) : t('tools.album.zip')}
                icon="download"
                variant="secondary"
                loading={!!zip}
                disabled={!!zip}
                onPress={async () => {
                  setMsg(null);
                  setZip({ done: 0, total: items.length, part: 1 });
                  try {
                    const fresh = await listAlbum(event.id);
                    const r = await downloadAlbumZip(
                      fresh.filter((p) => p.approved !== false),
                      `album-${event.public_slug}`,
                      setZip,
                    );
                    setMsg(r.failed ? { tone: 'error', text: t('tools.album.zipPartial', { saved: r.saved, failed: r.failed }) } : { tone: 'success', text: t('tools.album.zipDone', { count: r.saved }) });
                  } catch (e) {
                    setMsg({ tone: 'error', text: e instanceof Error ? e.message : String(e) });
                  } finally {
                    setZip(null);
                  }
                }}
              />
            )}
            <Button
              label={t('tools.album.copyLink')}
              icon="copy"
              variant="secondary"
              onPress={async () => {
                await Clipboard.setStringAsync(url);
                setMsg({ tone: 'success', text: t('tools.collector.copied') });
              }}
            />
            <Button
              label={t('tools.album.refresh')}
              variant="ghost"
              onPress={() => {
                photos.reload();
                gb.reload();
              }}
            />
          </View>
        </View>
      </Surface>

      {msg && <Notice tone={msg.tone} text={msg.text} />}

      {tabs.length > 1 && <Tabs value={current} onChange={setTab} items={tabs} />}

      {current === 'album' &&
        (items.length === 0 ? (
          <EmptyState title={t('tools.album.count', { count: 0 })} body={t('tools.album.empty')} />
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{items.map((p) => tile(p, 'album'))}</View>
        ))}

      {current === 'pending' &&
        (pending.length === 0 ? (
          <EmptyState title={t('tools.album.pendingEmptyTitle')} body={s.album?.moderate ? t('tools.album.pendingEmpty') : t('tools.album.moderateOff')} />
        ) : (
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row' }}>
              <Button
                label={t('tools.album.approveAll', { count: pending.length })}
                icon="check"
                onPress={() =>
                  act(() =>
                    setAlbumApproved(
                      pending.map((p) => p.id),
                      true,
                    ),
                  )
                }
              />
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{pending.map((p) => tile(p, 'pending'))}</View>
          </View>
        ))}

      {current === 'guestbook' &&
        (entries.length === 0 ? (
          <EmptyState title={t('tools.album.gbEmptyTitle')} body={t('tools.album.gbEmpty')} />
        ) : (
          <View style={{ gap: 10 }}>
            {gbPending > 0 && (
              <View style={{ flexDirection: 'row' }}>
                <Button
                  label={t('tools.album.approveAll', { count: gbPending })}
                  icon="check"
                  onPress={() =>
                    act(() =>
                      setGuestbookFlags(
                        entries.filter((e) => !e.approved).map((e) => e.id),
                        { approved: true },
                      ),
                    )
                  }
                />
              </View>
            )}
            {entries.map((e) => (
              <Surface key={e.id} style={{ gap: 8, opacity: e.hidden ? 0.55 : 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Text style={{ fontFamily: font.bold, fontSize: 15, color: color.ink }}>{e.name}</Text>
                  <Caption>{fmt(e.created_at)}</Caption>
                  {!e.approved && (
                    <Text style={{ fontFamily: font.bold, fontSize: 11, color: color.lavenderInk, backgroundColor: color.lavenderTint, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' }}>
                      {t('tools.album.awaiting')}
                    </Text>
                  )}
                  {e.hidden && (
                    <Text style={{ fontFamily: font.bold, fontSize: 11, color: '#FFFFFF', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' }}>
                      {t('tools.album.hidden')}
                    </Text>
                  )}
                </View>
                <Text selectable style={{ fontFamily: font.regular, fontSize: 15, lineHeight: 22, color: color.ink }}>
                  {e.message}
                </Text>
                <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
                  {!e.approved && <Button label={t('tools.album.approve')} icon="check" onPress={() => act(() => setGuestbookFlags([e.id], { approved: true }))} />}
                  <Button label={e.hidden ? t('tools.album.show') : t('tools.album.hide')} variant="ghost" onPress={() => act(() => setGuestbookFlags([e.id], { hidden: !e.hidden }))} />
                  {confirmId === e.id ? (
                    <Button label={t('tools.album.deleteConfirm')} variant="danger" onPress={() => act(() => deleteGuestbookEntry(e.id))} />
                  ) : (
                    <Button label={t('tools.album.delete')} variant="ghost" onPress={() => setConfirmId(e.id)} />
                  )}
                </View>
              </Surface>
            ))}
          </View>
        ))}
    </Screen>
  );
}
