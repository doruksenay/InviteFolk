import { Pressable, View } from 'react-native';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';

import { HALL_W, type TableLoad } from '@/core/seating';
import type { SeatingItem } from '@/core/types';
import { color } from '@/ui/tokens';

import { type Highlight, HallItemView } from './HallItemView';

type Props = {
  items: SeatingItem[];
  loads: Map<string, TableLoad>;
  hallH: number;
  scale: number;
  selectedId: string | null;
  editable: boolean;
  preview: boolean;
  highlightFor: (item: SeatingItem) => Highlight;
  onPressItem: (id: string) => void;
  onMoveItem: (id: string, x: number, y: number) => void;
  onBackgroundPress: () => void;
  onDragState: (dragging: boolean) => void;
};

/** Salon tuvali: noktalı zemin (düzenleme) ya da sıcak parke tonu (önizleme) üzerinde öğeler. */
export function Hall({ items, loads, hallH, scale, selectedId, editable, preview, highlightFor, onPressItem, onMoveItem, onBackgroundPress, onDragState }: Props) {
  const w = HALL_W * scale;
  const h = hallH * scale;
  const step = 40 * scale;
  return (
    <View
      style={{
        width: w,
        height: h,
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: preview ? '#F4EEE4' : '#FFFFFF',
        boxShadow: preview ? 'inset 0 0 0 1px rgba(120,90,50,0.10)' : `inset 0 0 0 1px ${color.hairline}`,
      }}>
      <Pressable accessibilityLabel="Seçimi kaldır" onPress={onBackgroundPress} style={{ position: 'absolute', left: 0, top: 0, width: w, height: h }}>
        <Svg width={w} height={h}>
          <Defs>
            <Pattern id="dots" x={0} y={0} width={step} height={step} patternUnits="userSpaceOnUse">
              <Circle cx={step / 2} cy={step / 2} r={Math.max(0.8, 1.4 * scale * 1.6)} fill={preview ? 'rgba(120,90,50,0.10)' : 'rgba(36,33,43,0.16)'} />
            </Pattern>
          </Defs>
          <Rect x={0} y={0} width={w} height={h} fill="url(#dots)" />
        </Svg>
      </Pressable>
      {items.map((it) => (
        <HallItemView
          key={it.id}
          item={it}
          scale={scale}
          load={loads.get(it.id)}
          selected={selectedId === it.id}
          editable={editable}
          highlight={highlightFor(it)}
          onPress={onPressItem}
          onMove={onMoveItem}
          onDragState={onDragState}
        />
      ))}
    </View>
  );
}
