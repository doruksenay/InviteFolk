import { memo, useEffect, useRef, useState } from 'react';
import { PanResponder, Platform, Text, View, type ViewStyle } from 'react-native';

import { bodySize, CHAIR_SIZE, chairPositions, footprint, seatsFor, type TableLoad } from '@/core/seating';
import type { SeatingItem, Side } from '@/core/types';
import { color, font } from '@/ui/tokens';

export const SIDE_COLOR: Record<Side | 'none', string> = {
  gelin: color.coral,
  damat: color.lavender,
  ortak: color.sage,
  none: color.gold,
};

const OBJECT_STYLE: Record<string, { bg: string; fg: string; dashed?: string }> = {
  stage: { bg: color.ink, fg: '#FFFFFF' },
  dance: { bg: color.lavenderTint, fg: color.lavenderInk, dashed: color.lavender },
  bar: { bg: color.goldTint, fg: color.goldInk },
  dj: { bg: '#3E3B45', fg: '#FFFFFF' },
  cake: { bg: color.coralTint, fg: color.coralInk },
  photo: { bg: color.sageTint, fg: color.sageInk, dashed: color.sage },
  entrance: { bg: color.sage, fg: '#FFFFFF' },
};

export type Highlight = 'none' | 'fits' | 'full';

type Props = {
  item: SeatingItem;
  scale: number;
  load?: TableLoad;
  selected: boolean;
  editable: boolean;
  highlight: Highlight;
  onPress: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onDragState: (dragging: boolean) => void;
};

/** Webde fare imleci: sürüklenebilir öğede el. RN tipleri yalnızca auto/pointer tanır. */
function webCursor(editable: boolean, dragging: boolean): ViewStyle {
  if (Platform.OS !== 'web') return {};
  return { cursor: (editable ? (dragging ? 'grabbing' : 'grab') : 'pointer') as ViewStyle['cursor'] };
}

/** "Masa 7" → "7"; özel adlar olduğu gibi kalır. */
function shortLabel(label: string) {
  const m = /^masa\s*(\d+)$/i.exec(label.trim());
  return m ? m[1] : label;
}

/**
 * Salondaki tek bir öğe. Sürükleme RN'in PanResponder'ı ile yapılır; iOS, Android ve webde aynı çalışır.
 * Sürükleme sırasında yalnızca bu bileşen yeniden çizilir, bırakınca konum üst bileşene bildirilir.
 */
export const HallItemView = memo(function HallItemView({ item, scale, load, selected, editable, highlight, onPress, onMove, onDragState }: Props) {
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);
  const latest = useRef({ item, scale, editable, onPress, onMove, onDragState });
  useEffect(() => {
    latest.current = { item, scale, editable, onPress, onMove, onDragState };
  });

  const [responder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        if (latest.current.editable) latest.current.onDragState(true);
      },
      onPanResponderMove: (_, g) => {
        if (!latest.current.editable) return;
        if (Math.abs(g.dx) + Math.abs(g.dy) > 3) setDrag({ dx: g.dx, dy: g.dy });
      },
      onPanResponderRelease: (_, g) => {
        const { item: it, scale: s, editable: canEdit } = latest.current;
        setDrag(null);
        latest.current.onDragState(false);
        if (canEdit && Math.abs(g.dx) + Math.abs(g.dy) > 4) latest.current.onMove(it.id, it.x + g.dx / s, it.y + g.dy / s);
        else latest.current.onPress(it.id);
      },
      onPanResponderTerminate: () => {
        setDrag(null);
        latest.current.onDragState(false);
      },
    }),
  );

  const box = footprint({ ...item, rotation: 0 });
  const body = bodySize(item);
  const isTable = item.kind === 'table';
  const over = !!load && load.used > load.capacity;

  // Sandalyeleri hane sırasıyla, tarafına göre boya.
  const chairColors: (string | null)[] = [];
  if (isTable && load) {
    for (const g of load.guests) for (let k = 0; k < seatsFor(g); k++) chairColors.push(SIDE_COLOR[g.contacts.side ?? 'none']);
  }

  const ring = selected
    ? `0 0 0 ${Math.max(2, 3 * scale * 2)}px ${color.lavender}`
    : highlight === 'fits'
      ? `0 0 0 ${Math.max(2, 4 * scale * 2)}px rgba(94,143,115,0.55)`
      : over
        ? `0 0 0 2px ${color.coral}`
        : null;
  const lift = drag ? '0px 16px 30px rgba(36,33,43,0.22)' : '0px 2px 6px rgba(36,33,43,0.10)';

  const left = (item.x - box.w / 2) * scale + (drag?.dx ?? 0);
  const top = (item.y - box.h / 2) * scale + (drag?.dy ?? 0);
  const bodyLeft = ((box.w - body.w) / 2) * scale;
  const bodyTop = ((box.h - body.h) / 2) * scale;

  const objStyle = OBJECT_STYLE[item.kind];
  const round = isTable ? item.shape === 'round' : item.kind === 'cake';
  // Masa numarası büyük serif; uzun adlar (ör. "Gelin & Damat") gövdeye sığacak kadar küçülür.
  const shown = isTable ? shortLabel(item.label) : item.label;
  const fitWidth = (body.w * scale * 0.86) / Math.max(1, shown.length * 0.52);
  const fontMain = Math.max(9, Math.min(26, 34 * scale, fitWidth));
  const fontObj = Math.max(9, Math.min(15, 22 * scale, (body.w * scale * 0.9) / Math.max(1, item.label.length * 0.62)));
  const fontSub = Math.max(8, 13 * scale * 1.4);

  return (
    <View
      {...responder.panHandlers}
      accessibilityRole="button"
      accessibilityLabel={isTable && load ? `${item.label}, ${load.used} / ${item.capacity} kişi` : item.label}
      style={{
        position: 'absolute',
        left,
        top,
        width: box.w * scale,
        height: box.h * scale,
        transform: [{ rotate: `${item.rotation}deg` }],
        zIndex: drag ? 50 : selected ? 20 : isTable ? 10 : 1,
        opacity: highlight === 'full' ? 0.45 : 1,
        ...webCursor(editable, !!drag),
      }}>
      {isTable &&
        chairPositions(item).map((p, i) => {
          const fill = chairColors[i] ?? null;
          return (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: (box.w / 2 + p.x - CHAIR_SIZE / 2) * scale,
                top: (box.h / 2 + p.y - CHAIR_SIZE / 2) * scale,
                width: CHAIR_SIZE * scale,
                height: CHAIR_SIZE * scale,
                borderRadius: (CHAIR_SIZE * scale) / 2,
                backgroundColor: fill ?? '#FFFFFF',
                boxShadow: fill ? 'none' : `inset 0 0 0 ${Math.max(1, 1.5 * scale * 2)}px ${color.ring}`,
              }}
            />
          );
        })}

      <View
        style={{
          position: 'absolute',
          left: bodyLeft,
          top: bodyTop,
          width: body.w * scale,
          height: body.h * scale,
          borderRadius: round ? (body.w * scale) / 2 : Math.max(4, (isTable ? 14 : 12) * scale * 1.4),
          backgroundColor: isTable ? '#FFFFFF' : objStyle?.bg,
          borderWidth: objStyle?.dashed ? 1.5 : 0,
          borderStyle: objStyle?.dashed ? 'dashed' : 'solid',
          borderColor: objStyle?.dashed,
          boxShadow: [ring, isTable ? lift : drag ? lift : null].filter(Boolean).join(', ') || undefined,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 4,
        }}>
        {isTable ? (
          <>
            <Text numberOfLines={1} style={{ fontFamily: font.serif, fontSize: fontMain, lineHeight: fontMain * 1.05, color: color.ink }}>
              {shown}
            </Text>
            {load && scale >= 0.22 && (
              <Text style={{ fontFamily: font.semibold, fontSize: fontSub, color: over ? color.coralInk : color.muted }}>
                {load.used}/{item.capacity}
              </Text>
            )}
          </>
        ) : (
          <Text
            numberOfLines={1}
            style={{
              fontFamily: font.bold,
              fontSize: fontObj,
              letterSpacing: item.kind === 'stage' || item.kind === 'entrance' ? 2 * scale * 2 : 0.2,
              textTransform: item.kind === 'stage' || item.kind === 'entrance' ? 'uppercase' : 'none',
              color: objStyle?.fg ?? color.ink,
            }}>
            {item.label}
          </Text>
        )}
      </View>
    </View>
  );
});
