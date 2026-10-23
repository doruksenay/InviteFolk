import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';

import { formatNumber, initials } from '@/core/format';
import type { EventSettings, InvitationWithContact } from '@/core/types';
import { useI18n } from '@/i18n';
import { getEvent, useQuery } from '@/lib/api';
import { findByCheckinCode, parseCheckinCode, setCheckin, tableLabels } from '@/lib/api-tools';
import { prepareScanner } from '@/lib/scanner';
import { ToolError, ToolHeader, ToolLoading } from '@/ui/event/ToolScreen';
import { NumberStepper, SearchField } from '@/ui/guests/common';
import { Icon } from '@/ui/Icon';
import { Avatar, Button, Caption, Field, Notice, Surface, Title } from '@/ui/primitives';
import { Screen } from '@/ui/Screen';
import { color, font, radius } from '@/ui/tokens';

const timeFmt = (iso: string, locale: string) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' });

/** Kapıda giriş: karekod okut, elle kod yaz ya da listeden işaretle. */
export default function CheckinScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useI18n();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const q = useQuery(() => getEvent(id), [id]);
  const tables = useQuery(() => tableLabels(id).catch(() => ({}) as Record<string, string>), [id]);
  const [perm, requestPerm] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [code, setCode] = useState('');
  const [search, setSearch] = useState('');
  const [current, setCurrent] = useState<InvitationWithContact | null>(null);
  const [people, setPeople] = useState(1);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error' | 'info' | 'warning'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // Aynı karekod kamerada birkaç kez okunur: son okunanı ve zamanını hatırla.
  const lastScan = useRef<{ code: string; at: number } | null>(null);

  const invitations = useMemo(() => q.data?.invitations ?? [], [q.data]);
  const coming = useMemo(() => invitations.filter((i) => i.status === 'yes'), [invitations]);
  const list = useMemo(() => {
    const s = search.trim().toLocaleLowerCase(locale);
    const base = s ? invitations.filter((i) => i.status !== 'no' && i.contacts.name.toLocaleLowerCase(locale).includes(s)) : coming;
    return [...base].sort((a, b) => Number(!!a.checked_in_at) - Number(!!b.checked_in_at) || a.contacts.name.localeCompare(b.contacts.name, locale)).slice(0, 200);
  }, [invitations, coming, search, locale]);

  if (q.loading && !q.data) return <ToolLoading />;
  if (q.error || !q.data) return <ToolError />;
  const event = q.data.event;
  const settings = (event.settings ?? {}) as EventSettings;
  const expected = coming.reduce((n, i) => n + (i.party_size || 1), 0);
  const arrived = invitations.reduce((n, i) => n + (i.checked_in_at ? (i.checked_in_people ?? i.party_size ?? 1) : 0), 0);
  const arrivedHouseholds = invitations.filter((i) => i.checked_in_at).length;

  const open = (inv: InvitationWithContact) => {
    setCurrent(inv);
    setPeople(inv.checked_in_people ?? (inv.party_size || 1));
    if (inv.checked_in_at) setMsg({ tone: 'warning', text: t('tools.checkin.already', { name: inv.contacts.name, time: timeFmt(inv.checked_in_at, locale) }) });
    else setMsg(null);
  };

  const lookup = async (raw: string) => {
    const c = parseCheckinCode(raw);
    if (!c) return setMsg({ tone: 'error', text: t('tools.checkin.notFound') });
    const local = invitations.find((i) => i.checkin_code?.toUpperCase() === c);
    const inv = local ?? (await findByCheckinCode(event.id, c).catch(() => null));
    if (!inv) {
      setCurrent(null);
      return setMsg({ tone: 'error', text: t('tools.checkin.notFound') });
    }
    open(inv);
  };

  const onScan = ({ data }: { data: string }) => {
    const now = Date.now();
    if (lastScan.current && lastScan.current.code === data && now - lastScan.current.at < 4000) return;
    lastScan.current = { code: data, at: now };
    lookup(data);
  };

  const mark = async (inv: InvitationWithContact, n: number | null) => {
    setBusy(true);
    try {
      await setCheckin(inv.id, n);
      setMsg(n === null ? null : { tone: 'success', text: t('tools.checkin.welcome', { name: inv.contacts.name }) });
      setCurrent(null);
      q.reload();
    } catch (e) {
      setMsg({ tone: 'error', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  const startCamera = async () => {
    await prepareScanner();
    if (!perm?.granted) {
      const r = await requestPerm();
      if (!r.granted) return setMsg({ tone: 'error', text: t('tools.checkin.camera') });
    }
    setScanning(true);
  };

  const stat = (label: string, value: string, bg: string, ink: string) => (
    <View style={{ flexGrow: 1, flexBasis: 0, minWidth: 130, backgroundColor: bg, borderRadius: radius.xl, padding: 18, gap: 4 }}>
      <Text style={{ fontFamily: font.display, fontSize: 30, lineHeight: 33, color: ink }}>{value}</Text>
      <Text style={{ fontFamily: font.semibold, fontSize: 13, color: ink }}>{label}</Text>
    </View>
  );

  if (!settings.checkin) {
    return (
      <Screen maxWidth={720}>
        <ToolHeader eventId={event.id} eventTitle={event.title} title={t('tools.checkin.title')} accent={t('tools.checkin.titleAccent')} />
        <Notice tone="info" text={t('tools.checkin.disabled')} />
        <Button label={t('tools.checkin.enable')} variant="secondary" onPress={() => router.replace({ pathname: '/etkinlik/[id]/sayfa', params: { id: event.id } })} style={{ alignSelf: 'flex-start' }} />
      </Screen>
    );
  }

  const tableOf = (inv: InvitationWithContact) => (inv.table_id ? tables.data?.[inv.table_id] : null);

  return (
    <Screen maxWidth={1100}>
      <ToolHeader eventId={event.id} eventTitle={event.title} title={t('tools.checkin.title')} accent={t('tools.checkin.titleAccent')} subtitle={t('tools.checkin.subtitle')} />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {stat(t('tools.checkin.arrivedPeople'), `${formatNumber(arrived, locale)}/${formatNumber(expected, locale)}`, color.sageTint, color.sageInk)}
        {stat(t('tools.checkin.arrivedHouseholds'), `${arrivedHouseholds}/${coming.length}`, color.lavenderTint, color.lavenderInk)}
      </View>

      <View style={{ flexDirection: wide ? 'row' : 'column', gap: 20, alignItems: 'flex-start' }}>
        {/* Okuyucu */}
        <View style={{ width: wide ? 420 : '100%', gap: 14 }}>
          <Surface style={{ gap: 12 }}>
            {scanning ? (
              <View style={{ gap: 10 }}>
                <View style={{ width: '100%', aspectRatio: 1, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#000' }}>
                  <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={current ? undefined : onScan} />
                  <View pointerEvents="none" style={{ position: 'absolute', left: '18%', top: '18%', right: '18%', bottom: '18%', borderRadius: 24, borderWidth: 3, borderColor: 'rgba(255,255,255,0.85)' }} />
                </View>
                <Button label={t('tools.checkin.stopScan')} icon="close" variant="ghost" onPress={() => setScanning(false)} />
              </View>
            ) : (
              <Button label={t('tools.checkin.scan')} icon="scan" size="lg" onPress={startCamera} />
            )}
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
              <Field style={{ flex: 1 }} label={t('tools.checkin.manual')} placeholder="A1B2C3D4E5F6" value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} maxLength={40} onSubmitEditing={() => lookup(code)} />
              <View style={{ paddingBottom: 2 }}>
                <Button label={t('tools.checkin.find')} variant="secondary" disabled={!code.trim()} onPress={() => lookup(code)} />
              </View>
            </View>
          </Surface>

          {msg && <Notice tone={msg.tone} text={msg.text} />}

          {current && (
            <Surface style={{ gap: 12, backgroundColor: current.checked_in_at ? color.goldTint : color.sageTint }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Avatar text={initials(current.contacts.name)} size={48} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Title>{current.contacts.name}</Title>
                  <Caption>
                    {[t('tools.checkin.people', { count: current.party_size || 1 }), tableOf(current) ? (/^\d+$/.test(tableOf(current) as string) ? t('tools.checkin.table', { table: tableOf(current) as string }) : tableOf(current)) : null, current.menu].filter(Boolean).join(' · ')}
                  </Caption>
                  {current.status !== 'yes' && <Caption color={color.coralInk}>{t(`status.rsvp.${current.status}`)}</Caption>}
                </View>
              </View>
              {current.checked_in_at ? (
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  <Button label={t('tools.checkin.undo')} variant="secondary" loading={busy} onPress={() => mark(current, null)} />
                  <Button label={t('common.close')} variant="ghost" onPress={() => setCurrent(null)} />
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  <NumberStepper value={people} min={1} max={20} onChange={setPeople} label={t('tools.checkin.people', { count: people })} />
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    <Button label={t('tools.checkin.mark')} icon="check" size="lg" loading={busy} onPress={() => mark(current, people)} />
                    <Button label={t('common.cancel')} variant="ghost" onPress={() => setCurrent(null)} />
                  </View>
                </View>
              )}
            </Surface>
          )}
        </View>

        {/* Liste */}
        <Surface style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%', gap: 10 }}>
          <SearchField value={search} onChange={setSearch} placeholder={t('tools.checkin.search')} />
          {list.map((inv, idx) => {
            const inside = !!inv.checked_in_at;
            return (
              <Pressable
                key={inv.id}
                accessibilityRole="button"
                accessibilityLabel={inv.contacts.name}
                onPress={() => open(inv)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: idx ? 1 : 0, borderTopColor: color.hairline }}>
                <Avatar text={initials(inv.contacts.name)} index={idx} size={36} />
                <View style={{ flex: 1, gap: 1 }}>
                  <Text style={{ fontFamily: font.semibold, fontSize: 15, color: color.ink }}>{inv.contacts.name}</Text>
                  <Caption numberOfLines={1}>{[t('tools.checkin.people', { count: inv.party_size || 1 }), tableOf(inv)].filter(Boolean).join(' · ')}</Caption>
                </View>
                {inside ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 28, borderRadius: 999, backgroundColor: color.sageTint }}>
                    <Icon name="check" size={12} color={color.sageInk} strokeWidth={2.4} />
                    <Text style={{ fontFamily: font.semibold, fontSize: 12, color: color.sageInk }}>{timeFmt(inv.checked_in_at as string, locale)}</Text>
                  </View>
                ) : (
                  <Button label={t('tools.checkin.mark')} variant="secondary" onPress={() => mark(inv, inv.party_size || 1)} />
                )}
              </Pressable>
            );
          })}
        </Surface>
      </View>
    </Screen>
  );
}
