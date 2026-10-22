import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { getEventType } from '@/core/event-types';
import { formatNumber, formatWhen } from '@/core/format';
import {
  autoAssign,
  buildQuickLayout,
  clampToHall,
  findFreeSpot,
  HALL_W,
  hallHeight,
  isHeadTable,
  nextTableLabel,
  nextTableNumber,
  objectName,
  objectSpec,
  type QuickSetup,
  seatingText,
  seatsFor,
  TABLE_CAPACITIES,
  tableLoads,
} from '@/core/seating';
import type { InvitationWithContact, SeatingItem, SeatingKind } from '@/core/types';
import { useI18n } from '@/i18n';
import { addSeatingItems, assignTables, deleteSeatingItems, getSeating, updateSeatingItem, useQuery } from '@/lib/api';
import { Icon } from '@/ui/Icon';
import { Body, Button, Caption, Display, DisplayItalic, EmptyState, IconButton, Notice, Skeleton, Surface, tapFeedback } from '@/ui/primitives';
import { Screen } from '@/ui/Screen';
import { Hall } from '@/ui/seating/Hall';
import type { Highlight } from '@/ui/seating/HallItemView';
import { Chip, GuestPool, type ItemPatch, ObjectInspector, ObjectMenu, SideLegend, TableInspector } from '@/ui/seating/Panels';
import { QuickSetupSheet } from '@/ui/seating/QuickSetupSheet';
import { color, font, radius, WIDE_BREAKPOINT } from '@/ui/tokens';

type NoticeState = { tone: 'success' | 'info' | 'warning' | 'error'; text: string } | null;
type Data = Awaited<ReturnType<typeof getSeating>>;

const PANEL_W = 380;

export default function SeatingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;
  const { t, locale } = useI18n();
  const q = useQuery(() => getSeating(id), [id]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [placingId, setPlacingId] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [zoom, setZoom] = useState(() => (width >= WIDE_BREAKPOINT ? 1 : 1.7));
  const [menu, setMenu] = useState<'table' | 'object' | null>(null);
  const [rectNew, setRectNew] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const items = useMemo(() => q.data?.items ?? [], [q.data]);
  // Silinmiş/bilinmeyen bir masaya işaret eden davet masasız sayılır (veritabanı zaten null'lar; bu yalnızca savunma).
  const invitations = useMemo(() => {
    const ids = new Set((q.data?.items ?? []).filter((i) => i.kind === 'table').map((i) => i.id));
    return (q.data?.invitations ?? []).map((i) => (i.table_id && !ids.has(i.table_id) ? { ...i, table_id: null } : i));
  }, [q.data]);
  const loads = useMemo(() => tableLoads(items, invitations), [items, invitations]);
  const hallH = hallHeight(items);

  const pool = invitations.filter((i) => seatsFor(i) > 0);
  const unseated = pool.filter((i) => !i.table_id);
  const tables = items.filter((i) => i.kind === 'table');
  const seatTotal = tables.reduce((a, tb) => a + tb.capacity, 0);
  const needed = pool.reduce((a, i) => a + seatsFor(i), 0);
  const seated = pool.filter((i) => i.table_id).reduce((a, i) => a + seatsFor(i), 0);
  const overTables = tables.filter((tb) => (loads.get(tb.id)?.used ?? 0) > tb.capacity).length;

  const selected = items.find((i) => i.id === selectedId) ?? null;
  const placing = invitations.find((i) => i.id === placingId) ?? null;

  const hallBoxW = wide ? Math.min(width, 1360) - 40 - PANEL_W - 24 : width - 40;
  const fit = hallBoxW / HALL_W;
  const scale = fit * zoom;
  const scrollsX = HALL_W * scale > hallBoxW + 1;

  // ---------------------------------------------------------------------------
  // Yardımcılar
  // ---------------------------------------------------------------------------
  const mutate = (fn: (d: Data) => Data) => q.setData((d) => (d ? fn(d) : d));

  const fail = (e: unknown) => {
    setNotice({ tone: 'error', text: t('seating.notices.saveFailed', { error: e instanceof Error ? e.message : String(e) }) });
    q.reload();
  };

  async function run(label: string, task: () => Promise<void>) {
    setBusy(label);
    setNotice(null);
    try {
      await task();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Eylemler
  // ---------------------------------------------------------------------------
  function addTable(capacity: number) {
    const probe = { kind: 'table' as const, shape: rectNew ? ('rect' as const) : ('round' as const), capacity, width: 0, height: 0, rotation: 0 };
    const spot = findFreeSpot(items, probe);
    run('add', async () => {
      const [created] = await addSeatingItems(id, [{ ...probe, label: nextTableLabel(items, t), x: spot.x, y: spot.y }]);
      mutate((d) => ({ ...d, items: [...d.items, created] }));
      setSelectedId(created.id);
      setMenu(null);
    });
  }

  function addObject(kind: Exclude<SeatingKind, 'table'>) {
    const spec = objectSpec(kind)!;
    const probe = { kind, shape: spec.round ? ('round' as const) : ('rect' as const), capacity: 0, width: spec.w, height: spec.h, rotation: 0 };
    const spot = findFreeSpot(items, probe);
    run('add', async () => {
      const [created] = await addSeatingItems(id, [{ ...probe, label: objectName(kind, t), x: spot.x, y: spot.y }]);
      mutate((d) => ({ ...d, items: [...d.items, created] }));
      setSelectedId(created.id);
      setMenu(null);
    });
  }

  function moveItem(itemId: string, x: number, y: number) {
    const it = items.find((i) => i.id === itemId);
    if (!it) return;
    const p = clampToHall(it, x, y, hallH);
    mutate((d) => ({ ...d, items: d.items.map((i) => (i.id === itemId ? { ...i, ...p } : i)) }));
    setSelectedId(itemId);
    updateSeatingItem(itemId, p).catch(fail);
  }

  function updateItem(itemId: string, patch: ItemPatch) {
    mutate((d) => ({ ...d, items: d.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) }));
    updateSeatingItem(itemId, patch).catch(fail);
  }

  function deleteItem(itemId: string) {
    setSelectedId(null);
    run('delete', async () => {
      await deleteSeatingItems([itemId]);
      mutate((d) => ({
        ...d,
        items: d.items.filter((i) => i.id !== itemId),
        invitations: d.invitations.map((i) => (i.table_id === itemId ? { ...i, table_id: null } : i)),
      }));
    });
  }

  function assign(inv: InvitationWithContact, tableId: string | null) {
    if (tableId) {
      const tb = items.find((i) => i.id === tableId);
      const l = loads.get(tableId);
      const need = seatsFor(inv);
      if (!tb || !l) return;
      if (l.used + need > tb.capacity) {
        setNotice({
          tone: 'warning',
          text: t('seating.notices.tableFull', { table: tb.label, used: l.used, capacity: tb.capacity, name: inv.contacts.name, count: need }),
        });
        return;
      }
    }
    setNotice(null);
    mutate((d) => ({ ...d, invitations: d.invitations.map((i) => (i.id === inv.id ? { ...i, table_id: tableId } : i)) }));
    assignTables([{ id: inv.id, table_id: tableId }]).catch(fail);
  }

  function pressItem(itemId: string) {
    tapFeedback();
    setMenu(null);
    if (placing) {
      const it = items.find((i) => i.id === itemId);
      if (it?.kind !== 'table') return;
      assign(placing, it.id);
      setPlacingId(null);
      setSelectedId(it.id);
      return;
    }
    setSelectedId(itemId);
  }

  function autoPlace() {
    const { assignments, unplaced } = autoAssign(items, invitations);
    if (!assignments.length) {
      setNotice({ tone: 'info', text: unplaced ? t('seating.notices.noRoom', { count: unplaced }) : t('seating.notices.nobodyLeft') });
      return;
    }
    run('auto', async () => {
      await assignTables(assignments);
      const map = new Map(assignments.map((a) => [a.id, a.table_id]));
      mutate((d) => ({ ...d, invitations: d.invitations.map((i) => (map.has(i.id) ? { ...i, table_id: map.get(i.id)! } : i)) }));
      setNotice({
        tone: unplaced ? 'warning' : 'success',
        text: unplaced
          ? t('seating.notices.placedPartial', { placed: assignments.length, left: unplaced })
          : t('seating.notices.placedAll', { count: assignments.length }),
      });
    });
  }

  function clearSeats() {
    const pairs = invitations.filter((i) => i.table_id).map((i) => ({ id: i.id, table_id: null }));
    if (!pairs.length) return;
    run('clear', async () => {
      await assignTables(pairs);
      mutate((d) => ({ ...d, invitations: d.invitations.map((i) => ({ ...i, table_id: null })) }));
      setNotice({ tone: 'info', text: t('seating.notices.cleared') });
    });
  }

  function quickSetup(setup: QuickSetup, replace: boolean) {
    run('quick', async () => {
      let layout = buildQuickLayout(setup, t);
      if (!replace && items.length) {
        const offset = hallH - 60;
        let n = nextTableNumber(items);
        layout = layout.map((l) => ({ ...l, y: l.y + offset, label: l.kind === 'table' && !isHeadTable(l.label) ? t('hall.tableLabel', { n: n++ }) : l.label }));
      }
      if (replace && items.length) await deleteSeatingItems(items.map((i) => i.id));
      const created = await addSeatingItems(id, layout);
      mutate((d) => ({
        ...d,
        items: replace ? created : [...d.items, ...created],
        invitations: replace ? d.invitations.map((i) => ({ ...i, table_id: null })) : d.invitations,
      }));
      setSelectedId(null);
      setQuickOpen(false);
      const count = created.filter((c) => c.kind === 'table').length;
      setNotice({ tone: 'success', text: t('seating.notices.setupDone', { count }) });
    });
  }

  async function copyList() {
    await Clipboard.setStringAsync(seatingText(q.data?.event.title ?? t('seating.fallbackTitle'), items, invitations, t));
    setNotice({ tone: 'success', text: t('seating.notices.listCopied') });
  }

  const highlightFor = (it: SeatingItem): Highlight => {
    if (!placing || it.kind !== 'table') return 'none';
    const l = loads.get(it.id);
    return l && l.used + seatsFor(placing) <= it.capacity ? 'fits' : 'full';
  };

  // ---------------------------------------------------------------------------
  // Durumlar
  // ---------------------------------------------------------------------------
  if (q.loading && !q.data) {
    return (
      <Screen>
        <Skeleton height={48} width={320} radius={14} />
        <View style={{ flexDirection: wide ? 'row' : 'column', gap: 24 }}>
          <View style={{ flex: 1 }}>
            <Skeleton height={wide ? 620 : 320} radius={24} />
          </View>
          {wide && <Skeleton height={620} width={PANEL_W} radius={28} />}
        </View>
      </Screen>
    );
  }
  if (q.error || !q.data) {
    return (
      <Screen>
        <EmptyState
          title={t('seating.loadErrorTitle')}
          body={q.error ?? t('seating.eventNotFound')}
          action={<Button label={t('common.retry')} variant="secondary" onPress={q.reload} />}
        />
      </Screen>
    );
  }

  const event = q.data.event;
  const cfg = getEventType(event.type);
  const isWedding = event.type === 'dugun' || event.type === 'nisan';

  // ---------------------------------------------------------------------------
  // Parçalar
  // ---------------------------------------------------------------------------
  const header = (
    <View style={{ flexDirection: wide ? 'row' : 'column', alignItems: wide ? 'flex-end' : 'flex-start', justifyContent: 'space-between', gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flexShrink: 1 }}>
        <IconButton
          icon="arrowLeft"
          label={t('seating.backToEvent')}
          onPress={() => (router.canGoBack() ? router.back() : router.replace({ pathname: '/etkinlik/[id]', params: { id } }))}
        />
        <View style={{ gap: 2, flexShrink: 1 }}>
          <Display size={wide ? 46 : 36}>
            {t('seating.title')} <DisplayItalic style={{ color: color.lavender }}>{t('seating.titleAccent')}</DisplayItalic>
          </Display>
          <Caption numberOfLines={1}>
            {event.title}
            {event.starts_at ? ` · ${formatWhen(event.starts_at, locale)}` : ''}
            {event.venue_name ? ` · ${event.venue_name}` : ''}
          </Caption>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        <Button
          label={preview ? t('seating.backToEdit') : t('seating.preview')}
          icon={preview ? 'layout' : 'eye'}
          variant="secondary"
          onPress={() => {
            setPreview((p) => !p);
            setPlacingId(null);
            setMenu(null);
          }}
        />
        <Button label={t('seating.copyList')} icon="copy" variant="secondary" onPress={copyList} disabled={!tables.length} />
      </View>
    </View>
  );

  const stats = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      <Stat
        value={formatNumber(tables.length, locale)}
        label={t('seating.stats.tables')}
        sub={t('seating.stats.chairs', { count: seatTotal })}
        bg={color.lavenderTint}
        ink={color.lavenderInk}
      />
      <Stat
        value={`${seated}/${needed}`}
        label={t('seating.stats.seated')}
        sub={needed > seatTotal ? t('seating.stats.missingChairs', { count: needed - seatTotal }) : t('seating.stats.freeChairs', { count: seatTotal - needed })}
        bg={color.sageTint}
        ink={color.sageInk}
      />
      <Stat
        value={formatNumber(unseated.length, locale)}
        label={t('seating.stats.unseated')}
        sub={unseated.length ? t('seating.stats.unseatedWaiting') : t('seating.stats.allSeated')}
        bg={color.goldTint}
        ink={color.goldInk}
      />
      {overTables > 0 && <Stat value={formatNumber(overTables, locale)} label={t('seating.stats.over')} sub={t('seating.stats.overSub')} bg={color.coralTint} ink={color.coralInk} />}
    </View>
  );

  const toolbar = !preview && (
    <View style={{ gap: 12 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8, alignItems: 'center' }}>
        <Chip label={t('seating.toolbar.addTable')} icon="table" active={menu === 'table'} onPress={() => setMenu((m) => (m === 'table' ? null : 'table'))} tone="ink" />
        <Chip label={t('seating.toolbar.addObject')} icon="sparkle" active={menu === 'object'} onPress={() => setMenu((m) => (m === 'object' ? null : 'object'))} />
        <Chip
          label={t('seating.toolbar.quickSetup')}
          icon="layout"
          onPress={() => {
            setMenu(null);
            setQuickOpen(true);
          }}
        />
        <Chip label={busy === 'auto' ? t('seating.toolbar.autoPlacing') : t('seating.toolbar.autoPlace')} icon="wand" onPress={autoPlace} disabled={!tables.length || !unseated.length || !!busy} />
        <View style={{ width: 1, height: 24, backgroundColor: color.hairline, marginHorizontal: 4 }} />
        <ZoomControl zoom={zoom} onChange={setZoom} />
      </ScrollView>
      {menu === 'table' && (
        <Surface style={{ padding: 16, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <Text style={{ fontFamily: font.semibold, fontSize: 14, color: color.ink }}>{t('seating.tableMenu.question')}</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Chip label={t('seating.tableMenu.round')} small active={!rectNew} onPress={() => setRectNew(false)} />
              <Chip label={t('seating.tableMenu.long')} small active={rectNew} onPress={() => setRectNew(true)} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {TABLE_CAPACITIES.map((c) => (
              <Pressable
                key={c}
                accessibilityRole="button"
                accessibilityLabel={t('seating.tableMenu.addA11y', { count: c })}
                disabled={!!busy}
                onPress={() => addTable(c)}
                style={({ pressed }) => ({
                  width: 64,
                  height: 64,
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: c === 10 ? color.ink : color.surfaceSoft,
                  transform: [{ scale: pressed ? 0.95 : 1 }],
                })}>
                <Text style={{ fontFamily: font.serif, fontSize: 28, lineHeight: 30, color: c === 10 ? '#FFFFFF' : color.ink }}>{c}</Text>
                <Text style={{ fontFamily: font.semibold, fontSize: 10, color: c === 10 ? 'rgba(255,255,255,0.75)' : color.muted }}>{t('seating.tableMenu.people')}</Text>
              </Pressable>
            ))}
          </View>
          <Caption>{t('seating.tableMenu.hint')}</Caption>
        </Surface>
      )}
      {menu === 'object' && <ObjectMenu onPick={addObject} disabled={!!busy} />}
    </View>
  );

  const placingBanner = placing && (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: color.lavenderTint, borderRadius: radius.lg, paddingVertical: 12, paddingHorizontal: 16 }}>
      <Icon name="table" size={20} color={color.lavenderInk} />
      <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 14, lineHeight: 20, color: color.lavenderInk }}>
        {t('seating.placing.banner', { name: placing.contacts.name, count: seatsFor(placing) })}
      </Text>
      <Button label={t('common.cancel')} variant="ghost" onPress={() => setPlacingId(null)} />
    </View>
  );

  const hall = (
    <View style={{ gap: 12 }}>
      {placingBanner}
      <View>
        <ScrollView horizontal scrollEnabled={scrollsX && !dragging} showsHorizontalScrollIndicator={scrollsX} contentContainerStyle={{ paddingBottom: scrollsX ? 8 : 0 }}>
          <Hall
            items={items}
            loads={loads}
            hallH={hallH}
            scale={scale}
            selectedId={selectedId}
            editable={!preview && !placing}
            preview={preview}
            highlightFor={highlightFor}
            onPressItem={pressItem}
            onMoveItem={moveItem}
            onBackgroundPress={() => {
              setSelectedId(null);
              setMenu(null);
            }}
            onDragState={setDragging}
          />
        </ScrollView>
        {!items.length && (
          <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <Surface style={{ alignItems: 'center', gap: 10, maxWidth: 420, boxShadow: '0px 18px 50px rgba(40,30,20,0.12)' }}>
              <Display size={32} center>
                {t('seating.empty.title')} <DisplayItalic style={{ color: color.coral }}>{t('seating.empty.titleAccent')}</DisplayItalic>
              </Display>
              <Body center>{t('seating.empty.body')}</Body>
              <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
                <Button label={t('seating.toolbar.quickSetup')} icon="layout" variant="accent" onPress={() => setQuickOpen(true)} />
                <Button label={t('seating.empty.single')} icon="plus" variant="secondary" onPress={() => setMenu('table')} />
              </View>
            </Surface>
          </View>
        )}
      </View>
      <SideLegend />
    </View>
  );

  const selectedLoad = selected ? loads.get(selected.id) : undefined;
  const panel = (
    <View style={{ gap: 16 }}>
      {notice && <Notice tone={notice.tone} text={notice.text} />}
      {selected && selected.kind === 'table' && selectedLoad ? (
        <TableInspector
          key={selected.id}
          item={selected}
          load={selectedLoad}
          unseated={unseated}
          readOnly={preview}
          onUpdate={(patch) => updateItem(selected.id, patch)}
          onDelete={() => deleteItem(selected.id)}
          onAssign={(inv) => assign(inv, selected.id)}
          onUnassign={(inv) => assign(inv, null)}
          onClose={() => setSelectedId(null)}
        />
      ) : selected ? (
        <ObjectInspector
          key={selected.id}
          item={selected}
          readOnly={preview}
          onUpdate={(patch) => updateItem(selected.id, patch)}
          onDelete={() => deleteItem(selected.id)}
          onClose={() => setSelectedId(null)}
        />
      ) : (
        <GuestPool
          unseated={unseated}
          placingId={placingId}
          hasTables={tables.length > 0}
          seatedCount={pool.length - unseated.length}
          onPick={(inv) => {
            setPlacingId((cur) => (cur === inv.id ? null : inv.id));
            setPreview(false);
          }}
          onClear={clearSeats}
          onAddGuests={() => router.push({ pathname: '/etkinlik/[id]', params: { id } })}
        />
      )}
      {!cfg.tools.seating && <Caption>{t('seating.optional')}</Caption>}
    </View>
  );

  return (
    <Screen scrollEnabled={!dragging} contentStyle={{ gap: 22 }}>
      {header}
      {stats}
      {toolbar}
      {wide ? (
        <View style={{ flexDirection: 'row', gap: 24, alignItems: 'flex-start' }}>
          <View style={{ flex: 1, minWidth: 0 }}>{hall}</View>
          <View style={{ width: PANEL_W }}>{panel}</View>
        </View>
      ) : (
        <>
          {hall}
          {panel}
        </>
      )}
      <QuickSetupSheet
        open={quickOpen}
        busy={busy === 'quick'}
        defaultPeople={needed || 100}
        hasItems={items.length > 0}
        isWedding={isWedding}
        onClose={() => setQuickOpen(false)}
        onSubmit={quickSetup}
      />
    </Screen>
  );
}

function Stat({ value, label, sub, bg, ink }: { value: string; label: string; sub: string; bg: string; ink: string }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: 150, backgroundColor: bg, borderRadius: radius.lg, paddingVertical: 14, paddingHorizontal: 16, gap: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <Text style={{ fontFamily: font.serif, fontSize: 32, lineHeight: 36, color: ink }}>{value}</Text>
        <Text style={{ fontFamily: font.semibold, fontSize: 14, color: ink }}>{label}</Text>
      </View>
      <Text style={{ fontFamily: font.medium, fontSize: 12, color: ink, opacity: 0.85 }}>{sub}</Text>
    </View>
  );
}

const ZOOMS = [0.75, 1, 1.35, 1.7, 2.2, 2.8];

function ZoomControl({ zoom, onChange }: { zoom: number; onChange: (z: number) => void }) {
  const { t } = useI18n();
  const idx = ZOOMS.findIndex((z) => z >= zoom - 0.01);
  const i = idx < 0 ? ZOOMS.length - 1 : idx;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: color.surface, borderRadius: radius.pill, boxShadow: '0px 1px 2px rgba(40,30,20,0.04), 0px 6px 18px rgba(40,30,20,0.05)' }}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('seating.toolbar.zoomOut')} disabled={i === 0} onPress={() => onChange(ZOOMS[Math.max(0, i - 1)])} style={{ padding: 11, opacity: i === 0 ? 0.35 : 1 }}>
        <Icon name="minus" size={16} color={color.ink} strokeWidth={2} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('seating.toolbar.zoomFit')} onPress={() => onChange(1)}>
        <Text style={{ fontFamily: font.semibold, fontSize: 13, color: color.inkSoft, minWidth: 44, textAlign: 'center' }}>{t('seating.toolbar.zoomValue', { value: Math.round(zoom * 100) })}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('seating.toolbar.zoomIn')}
        disabled={i === ZOOMS.length - 1}
        onPress={() => onChange(ZOOMS[Math.min(ZOOMS.length - 1, i + 1)])}
        style={{ padding: 11, opacity: i === ZOOMS.length - 1 ? 0.35 : 1 }}>
        <Icon name="plus" size={16} color={color.ink} strokeWidth={2} />
      </Pressable>
    </View>
  );
}
