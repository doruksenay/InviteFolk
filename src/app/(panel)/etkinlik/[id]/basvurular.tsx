import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Text, useWindowDimensions, View } from 'react-native';

import { formatShortDate, publicUrl, waMeLink } from '@/core/format';
import { getTheme } from '@/core/themes';
import type { EventSettings, GuestRequest } from '@/core/types';
import { useI18n } from '@/i18n';
import { useQuery } from '@/lib/api';
import { getEventRow } from '@/lib/api-guests';
import { listGuestRequests, reviewGuestRequests, rotatePublicLink } from '@/lib/api-tools';
import { ToolError, ToolHeader, ToolLoading } from '@/ui/event/ToolScreen';
import { OptionChip } from '@/ui/guests/common';
import { Button, Caption, EmptyState, Notice, Surface, Title } from '@/ui/primitives';
import { buildQrCardsHtml } from '@/ui/print/qrCards';
import { QrCode } from '@/ui/QrCode';
import { Screen } from '@/ui/Screen';
import { printHtml } from '@/ui/seating/printCards';
import { color, font, radius } from '@/ui/tokens';

/** Bilgi toplama linki ve gelen başvurular (onaylanınca davetli listesine eklenir). */
export default function CollectorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useI18n();
  const { width } = useWindowDimensions();
  const ev = useQuery(() => getEventRow(id), [id]);
  const reqs = useQuery(() => listGuestRequests(id).catch(() => [] as GuestRequest[]), [id]);
  const [tab, setTab] = useState<'pending' | 'done'>('pending');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [confirmRotate, setConfirmRotate] = useState(false);

  if (ev.loading && !ev.data) return <ToolLoading />;
  if (ev.error || !ev.data) return <ToolError />;
  const event = ev.data;
  const s = (event.settings ?? {}) as EventSettings;
  const url = publicUrl('k', event.public_slug);
  const all = reqs.data ?? [];
  const pending = all.filter((r) => r.status === 'pending');
  const done = all.filter((r) => r.status !== 'pending');
  const shown = tab === 'pending' ? pending : done;

  if (!s.collector) {
    return (
      <Screen maxWidth={720}>
        <ToolHeader eventId={event.id} eventTitle={event.title} title={t('tools.collector.title')} accent={t('tools.collector.titleAccent')} />
        <Notice tone="info" text={t('tools.collector.disabled')} />
        <Button label={t('tools.checkin.enable')} variant="secondary" onPress={() => router.replace({ pathname: '/etkinlik/[id]/sayfa', params: { id: event.id } })} style={{ alignSelf: 'flex-start' }} />
      </Screen>
    );
  }

  const review = async (ids: string[], approve: boolean, key: string) => {
    if (!ids.length) return;
    setBusy(key);
    setMsg(null);
    try {
      const r = await reviewGuestRequests(ids, approve);
      setMsg(approve ? { tone: 'success', text: t('tools.collector.added', { count: r.added }) } : { tone: 'info', text: t('tools.collector.rejected') });
      reqs.reload();
    } catch (e) {
      setMsg({ tone: 'error', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  };

  const rotate = async () => {
    setBusy('rotate');
    try {
      await rotatePublicLink(event.id);
      setConfirmRotate(false);
      ev.reload();
    } catch (e) {
      setMsg({ tone: 'error', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  };

  const printQr = () =>
    printHtml(
      buildQrCardsHtml({
        theme: getTheme(event.theme),
        eventTitle: event.title,
        heading: t('tools.collector.title') + ' ' + t('tools.collector.titleAccent'),
        body: t('tools.collector.subtitle'),
        url,
        docTitle: event.title,
      }),
    );

  return (
    <Screen maxWidth={980}>
      <ToolHeader eventId={event.id} eventTitle={event.title} title={t('tools.collector.title')} accent={t('tools.collector.titleAccent')} subtitle={t('tools.collector.subtitle')} />

      <Surface style={{ flexDirection: width >= 700 ? 'row' : 'column', gap: 18, alignItems: width >= 700 ? 'center' : 'flex-start' }}>
        <View style={{ padding: 10, borderRadius: radius.lg, backgroundColor: '#FFFFFF', boxShadow: `inset 0 0 0 1px ${color.hairline}` }}>
          <QrCode value={url} size={132} />
        </View>
        <View style={{ flex: 1, gap: 10 }}>
          <Text selectable style={{ fontFamily: font.semibold, fontSize: 14, color: color.lavenderInk }}>
            {url}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Button
              label={t('tools.collector.copyLink')}
              icon="copy"
              onPress={async () => {
                await Clipboard.setStringAsync(url);
                setMsg({ tone: 'success', text: t('tools.collector.copied') });
              }}
            />
            <Button label={t('tools.collector.shareWa')} icon="whatsapp" variant="secondary" onPress={() => Linking.openURL(waMeLink(null, t('tools.collector.shareText', { title: event.title, link: url })))} />
            <Button label={t('tools.collector.printQr')} icon="print" variant="secondary" onPress={printQr} />
          </View>
          <View style={{ gap: 4 }}>
            {confirmRotate ? (
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <Button label={t('tools.collector.rotate')} variant="danger" loading={busy === 'rotate'} onPress={rotate} />
                <Button label={t('common.cancel')} variant="ghost" onPress={() => setConfirmRotate(false)} />
              </View>
            ) : (
              <Button label={t('tools.collector.rotate')} variant="ghost" onPress={() => setConfirmRotate(true)} style={{ alignSelf: 'flex-start' }} />
            )}
            <Caption>{t('tools.collector.rotateHint')}</Caption>
          </View>
        </View>
      </Surface>

      {msg && <Notice tone={msg.tone} text={msg.text} />}

      <Surface style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <OptionChip label={`${t('tools.collector.pending')} (${pending.length})`} on={tab === 'pending'} onPress={() => setTab('pending')} />
            <OptionChip label={`${t('tools.collector.done')} (${done.length})`} on={tab === 'done'} onPress={() => setTab('done')} />
          </View>
          {tab === 'pending' && pending.length > 1 && (
            <Button label={t('tools.collector.approveAll')} icon="check" loading={busy === 'all'} onPress={() => review(pending.map((r) => r.id), true, 'all')} />
          )}
        </View>

        {shown.length === 0 ? (
          <EmptyState title={t('tools.collector.empty')} body={t('tools.collector.subtitle')} />
        ) : (
          shown.map((r, idx) => (
            <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: idx ? 1 : 0, borderTopColor: color.hairline, flexWrap: 'wrap' }}>
              <View style={{ flex: 1, minWidth: 200, gap: 2 }}>
                <Title>{r.name}</Title>
                <Caption>{[r.phone, r.email, t('tools.collector.party', { count: r.party }), formatShortDate(r.created_at, locale)].filter(Boolean).join(' · ')}</Caption>
                {r.note ? <Caption color={color.inkSoft}>{`“${r.note}”`}</Caption> : null}
              </View>
              {r.status === 'pending' ? (
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <Button label={t('tools.collector.approve')} icon="check" variant="secondary" loading={busy === r.id} onPress={() => review([r.id], true, r.id)} />
                  <Button label={t('tools.collector.reject')} variant="ghost" onPress={() => review([r.id], false, r.id + 'x')} />
                </View>
              ) : (
                <Caption color={r.status === 'approved' ? color.sageInk : color.coralInk}>{r.status === 'approved' ? t('tools.collector.approved') : t('tools.collector.rejected')}</Caption>
              )}
            </View>
          ))
        )}
      </Surface>
    </Screen>
  );
}
