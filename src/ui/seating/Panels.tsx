import { type ReactNode, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { OBJECTS, objectName, objectSpec, seatsFor, type TableLoad } from '@/core/seating';
import type { InvitationWithContact, SeatingItem, SeatingKind } from '@/core/types';
import { useI18n } from '@/i18n';
import { Icon, type IconName } from '@/ui/Icon';
import { Body, Button, Caption, Label, Surface, Title } from '@/ui/primitives';
import { color, font, radius } from '@/ui/tokens';

import { SIDE_COLOR } from './HallItemView';

export type ItemPatch = Partial<Omit<SeatingItem, 'id' | 'event_id'>>;

const SIDE_KEYS = ['gelin', 'damat', 'ortak', 'none'] as const;

// ---------------------------------------------------------------------------
// Küçük yapı taşları
// ---------------------------------------------------------------------------
export function Chip({
  label,
  icon,
  active,
  onPress,
  disabled,
  small,
  tone,
}: {
  label: string;
  icon?: IconName;
  active?: boolean;
  onPress: () => void;
  disabled?: boolean;
  small?: boolean;
  tone?: 'ink';
}) {
  const strong = active || tone === 'ink';
  const bg = active ? color.lavender : tone === 'ink' ? color.ink : color.surface;
  const fg = strong ? '#FFFFFF' : color.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        height: small ? 34 : 42,
        paddingHorizontal: small ? 14 : 16,
        borderRadius: radius.pill,
        backgroundColor: bg,
        boxShadow: strong ? 'none' : '0px 1px 2px rgba(40,30,20,0.04), 0px 6px 18px rgba(40,30,20,0.05)',
        opacity: disabled ? 0.45 : 1,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}>
      {icon && <Icon name={icon} size={16} color={fg} strokeWidth={2} />}
      <Text style={{ fontFamily: font.semibold, fontSize: small ? 13 : 14, color: fg }}>{label}</Text>
    </Pressable>
  );
}

function Segment<T extends string | number>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: color.surfaceSoft, borderRadius: radius.pill, padding: 4 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={{ flex: 1, paddingVertical: 8, borderRadius: radius.pill, alignItems: 'center', backgroundColor: on ? color.surface : 'transparent', boxShadow: on ? '0px 2px 6px rgba(40,30,20,0.08)' : 'none' }}>
            <Text style={{ fontFamily: font.semibold, fontSize: 13, color: on ? color.ink : color.muted }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (v: number) => void; label: string }) {
  const { t } = useI18n();
  const btn = (icon: IconName, next: number, a11y: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      disabled={next < min || next > max}
      onPress={() => onChange(next)}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: color.surface,
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0px 2px 6px rgba(40,30,20,0.08)',
        opacity: next < min || next > max ? 0.35 : 1,
        transform: [{ scale: pressed ? 0.94 : 1 }],
      })}>
      <Icon name={icon} size={16} color={color.ink} strokeWidth={2} />
    </Pressable>
  );
  return (
    <View accessibilityLabel={`${label}: ${value}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: color.surfaceSoft, borderRadius: radius.pill, padding: 4, alignSelf: 'flex-start' }}>
      {btn('minus', value - 1, t('seating.inspector.decrease', { label }))}
      <Text style={{ fontFamily: font.display, fontSize: 22, lineHeight: 25, color: color.ink, minWidth: 34, textAlign: 'center' }}>{value}</Text>
      {btn('plus', value + 1, t('seating.inspector.increase', { label }))}
    </View>
  );
}

function LabelInput({ value, onCommit, readOnly }: { value: string; onCommit: (v: string) => void; readOnly?: boolean }) {
  const { t } = useI18n();
  const [text, setText] = useState(value);
  const commit = () => {
    const t = text.trim().slice(0, 40);
    if (t && t !== value) onCommit(t);
    else setText(value);
  };
  return (
    <TextInput
      value={text}
      editable={!readOnly}
      onChangeText={setText}
      onBlur={commit}
      onSubmitEditing={commit}
      returnKeyType="done"
      maxLength={40}
      accessibilityLabel={t('seating.inspector.nameA11y')}
      style={{
        fontFamily: font.display,
        fontSize: 26,
        lineHeight: 32,
        color: color.ink,
        paddingVertical: 2,
        paddingHorizontal: 0,
        borderBottomWidth: readOnly ? 0 : 1,
        borderBottomColor: color.hairline,
        outlineStyle: 'none',
      } as object}
    />
  );
}

function GuestRow({ inv, onPress, trailing, active }: { inv: InvitationWithContact; onPress?: () => void; trailing?: IconName; active?: boolean }) {
  const { t } = useI18n();
  const n = seatsFor(inv);
  const side = inv.contacts.side ?? 'none';
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        marginHorizontal: -12,
        borderRadius: radius.md,
        backgroundColor: active ? color.lavenderTint : pressed ? color.surfaceSoft : 'transparent',
      })}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: SIDE_COLOR[side] }} />
      <View style={{ flex: 1, gap: 1 }}>
        <Text numberOfLines={1} style={{ fontFamily: font.semibold, fontSize: 14, color: color.ink }}>
          {inv.contacts.name}
        </Text>
        <Caption>
          {t('seating.guest.party', { count: n })}
          {inv.status === 'yes' ? '' : t('seating.guest.awaiting')}
          {inv.menu ? ` · ${inv.menu}` : ''}
        </Caption>
      </View>
      {trailing && (
        <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? color.lavender : color.surfaceSoft }}>
          <Icon name={trailing} size={14} color={active ? '#FFFFFF' : color.inkSoft} strokeWidth={2.2} />
        </View>
      )}
    </Pressable>
  );
}

function PanelHeader({ kicker, onClose, children }: { kicker: string; onClose: () => void; children: ReactNode }) {
  const { t } = useI18n();
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: font.bold, fontSize: 11, letterSpacing: 1.6, color: color.muted, textTransform: 'uppercase' }}>{kicker}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={onClose} hitSlop={10}>
          <Icon name="close" size={18} color={color.muted} strokeWidth={2} />
        </Pressable>
      </View>
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Salon lejantı ve nesne menüsü
// ---------------------------------------------------------------------------
export function SideLegend() {
  const { t } = useI18n();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, paddingHorizontal: 4 }}>
      {SIDE_KEYS.map((k) => (
        <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: SIDE_COLOR[k] }} />
          <Caption>{t(`status.side.${k}`)}</Caption>
        </View>
      ))}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFFFFF', boxShadow: `inset 0 0 0 1.5px ${color.ring}` }} />
        <Caption>{t('seating.legend.empty')}</Caption>
      </View>
    </View>
  );
}

const OBJECT_ICON: Record<string, IconName> = { stage: 'sparkle', dance: 'users', bar: 'plate', dj: 'sparkle', cake: 'cake', photo: 'eye', entrance: 'arrowRight' };

export function ObjectMenu({ onPick, disabled }: { onPick: (k: Exclude<SeatingKind, 'table'>) => void; disabled?: boolean }) {
  const { t } = useI18n();
  return (
    <Surface style={{ padding: 16, gap: 12 }}>
      <Text style={{ fontFamily: font.semibold, fontSize: 14, color: color.ink }}>{t('seating.objectMenu.question')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {OBJECTS.map((o) => (
          <Chip key={o.kind} label={objectName(o.kind, t)} icon={OBJECT_ICON[o.kind]} onPress={() => onPick(o.kind)} disabled={disabled} small />
        ))}
      </View>
    </Surface>
  );
}

// ---------------------------------------------------------------------------
// Masası olmayan davetliler
// ---------------------------------------------------------------------------
export function GuestPool({
  unseated,
  placingId,
  hasTables,
  seatedCount,
  onPick,
  onClear,
  onAddGuests,
}: {
  unseated: InvitationWithContact[];
  placingId: string | null;
  hasTables: boolean;
  seatedCount: number;
  onPick: (inv: InvitationWithContact) => void;
  onClear: () => void;
  onAddGuests: () => void;
}) {
  const { t, locale } = useI18n();
  const [search, setSearch] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const term = search.trim().toLocaleLowerCase(locale);
  const list = term ? unseated.filter((i) => i.contacts.name.toLocaleLowerCase(locale).includes(term)) : unseated;
  const people = unseated.reduce((a, i) => a + seatsFor(i), 0);

  return (
    <Surface style={{ gap: 14 }}>
      <View style={{ gap: 4 }}>
        <Title>{t('seating.pool.title')}</Title>
        <Caption>
          {unseated.length
            ? t('seating.pool.summary', { households: t('common.households', { count: unseated.length }), people: t('common.people', { count: people }) })
            : seatedCount
              ? t('seating.pool.allSeated')
              : t('seating.pool.nobody')}
        </Caption>
      </View>

      {unseated.length > 6 && (
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={t('seating.pool.search')}
          placeholderTextColor={color.faint}
          accessibilityLabel={t('seating.pool.searchA11y')}
          style={{ height: 44, borderRadius: radius.pill, backgroundColor: color.surfaceSoft, paddingHorizontal: 16, fontFamily: font.medium, fontSize: 14, color: color.ink }}
        />
      )}

      <View>
        {list.slice(0, 80).map((inv) => (
          <GuestRow key={inv.id} inv={inv} onPress={hasTables ? () => onPick(inv) : undefined} trailing={hasTables ? 'table' : undefined} active={placingId === inv.id} />
        ))}
        {list.length > 80 && <Caption style={{ marginTop: 8 }}>{t('seating.pool.more', { count: list.length - 80 })}</Caption>}
      </View>

      {!unseated.length && !seatedCount && <Button label={t('seating.pool.addGuests')} icon="plus" variant="secondary" onPress={onAddGuests} />}
      {!hasTables && unseated.length > 0 && <Caption>{t('seating.pool.needTables')}</Caption>}

      {seatedCount > 0 && (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            if (confirmClear) {
              onClear();
              setConfirmClear(false);
            } else setConfirmClear(true);
          }}
          style={{ alignSelf: 'flex-start', paddingVertical: 6 }}>
          <Text style={{ fontFamily: font.semibold, fontSize: 13, color: confirmClear ? color.coralInk : color.muted }}>
            {confirmClear ? t('seating.pool.clearConfirm') : t('seating.pool.clearAll')}
          </Text>
        </Pressable>
      )}
    </Surface>
  );
}

// ---------------------------------------------------------------------------
// Masa denetçisi
// ---------------------------------------------------------------------------
export function TableInspector({
  item,
  load,
  unseated,
  readOnly,
  onUpdate,
  onDelete,
  onAssign,
  onUnassign,
  onClose,
}: {
  item: SeatingItem;
  load: TableLoad;
  unseated: InvitationWithContact[];
  readOnly?: boolean;
  onUpdate: (p: ItemPatch) => void;
  onDelete: () => void;
  onAssign: (inv: InvitationWithContact) => void;
  onUnassign: (inv: InvitationWithContact) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const free = item.capacity - load.used;
  const fits = unseated.filter((i) => seatsFor(i) <= free);
  const pct = Math.min(1, load.used / item.capacity);

  return (
    <Surface style={{ gap: 18 }}>
      <PanelHeader kicker={readOnly ? t('seating.inspector.table') : t('seating.inspector.editTable')} onClose={onClose}>
        <LabelInput value={item.label} readOnly={readOnly} onCommit={(label) => onUpdate({ label })} />
      </PanelHeader>

      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Label>{t('seating.inspector.load', { used: load.used, capacity: item.capacity })}</Label>
          <Caption color={free < 0 ? color.coralInk : color.muted}>
            {free < 0 ? t('seating.inspector.overBy', { count: -free }) : free === 0 ? t('seating.inspector.full') : t('seating.inspector.free', { count: free })}
          </Caption>
        </View>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: color.surfaceSoft, overflow: 'hidden' }}>
          <View style={{ height: 8, width: `${Math.round(pct * 100)}%`, borderRadius: 4, backgroundColor: free < 0 ? color.coral : color.sage }} />
        </View>
      </View>

      {!readOnly && (
        <View style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <Label>{t('seating.inspector.capacity')}</Label>
            <Stepper label={t('seating.inspector.capacity')} value={item.capacity} min={2} max={30} onChange={(capacity) => onUpdate({ capacity })} />
          </View>
          <Segment
            options={[
              { value: 'round', label: t('seating.inspector.round') },
              { value: 'rect', label: t('seating.inspector.long') },
            ]}
            value={item.shape}
            onChange={(shape) => onUpdate({ shape, rotation: shape === 'round' ? 0 : item.rotation })}
          />
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {item.shape === 'rect' && <Chip small label={t('seating.inspector.rotate')} icon="rotate" onPress={() => onUpdate({ rotation: (item.rotation + 90) % 360 })} />}
            <Chip
              small
              label={confirmDelete ? t('seating.inspector.tapToDelete') : t('seating.inspector.deleteTable')}
              icon="trash"
              onPress={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
            />
          </View>
          {confirmDelete && load.guests.length > 0 && <Caption color={color.coralInk}>{t('seating.inspector.returnsToPool', { count: load.guests.length })}</Caption>}
        </View>
      )}

      <View style={{ gap: 4 }}>
        <Label>{t('seating.inspector.atTable')}</Label>
        {load.guests.length ? (
          load.guests.map((g) => <GuestRow key={g.id} inv={g} trailing={readOnly ? undefined : 'close'} onPress={readOnly ? undefined : () => onUnassign(g)} />)
        ) : (
          <Caption>{t('seating.inspector.nobodyYet')}</Caption>
        )}
      </View>

      {!readOnly && free > 0 && unseated.length > 0 && (
        <View style={{ gap: 4 }}>
          <Label>{t('seating.inspector.addHere')}</Label>
          {fits.length ? (
            fits.slice(0, 30).map((g) => <GuestRow key={g.id} inv={g} trailing="plus" onPress={() => onAssign(g)} />)
          ) : (
            <Caption>{t('seating.inspector.noneFits', { count: free })}</Caption>
          )}
        </View>
      )}
    </Surface>
  );
}

// ---------------------------------------------------------------------------
// Nesne denetçisi (sahne, dans pisti, bar...)
// ---------------------------------------------------------------------------
const SIZES = [
  { value: 0.75, key: 'small' },
  { value: 1, key: 'medium' },
  { value: 1.35, key: 'large' },
] as const;

export function ObjectInspector({
  item,
  readOnly,
  onUpdate,
  onDelete,
  onClose,
}: {
  item: SeatingItem;
  readOnly?: boolean;
  onUpdate: (p: ItemPatch) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const spec = objectSpec(item.kind);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const sizeOptions = SIZES.map((s) => ({ value: s.value as number, label: t(`seating.inspector.sizes.${s.key}`) }));
  const factor = spec ? SIZES.reduce<number>((best, s) => (Math.abs(spec.w * s.value - item.width) < Math.abs(spec.w * best - item.width) ? s.value : best), 1) : 1;

  return (
    <Surface style={{ gap: 18 }}>
      <PanelHeader kicker={item.kind !== 'table' ? objectName(item.kind, t) : t('seating.inspector.object')} onClose={onClose}>
        <LabelInput value={item.label} readOnly={readOnly} onCommit={(label) => onUpdate({ label })} />
      </PanelHeader>
      {readOnly ? (
        <Body>{t('seating.inspector.previewLocked')}</Body>
      ) : (
        <>
          {spec && (
            <View style={{ gap: 8 }}>
              <Label>{t('seating.inspector.size')}</Label>
              <Segment options={sizeOptions} value={factor} onChange={(f) => onUpdate({ width: Math.round(spec.w * f), height: Math.round(spec.h * f) })} />
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {!spec?.round && <Chip small label={t('seating.inspector.rotate')} icon="rotate" onPress={() => onUpdate({ rotation: (item.rotation + 90) % 360 })} />}
            <Chip small label={confirmDelete ? t('seating.inspector.tapToDelete') : t('seating.inspector.remove')} icon="trash" onPress={() => (confirmDelete ? onDelete() : setConfirmDelete(true))} />
          </View>
          <Caption>{t('seating.inspector.dragHint')}</Caption>
        </>
      )}
    </Surface>
  );
}
