import { memo, useEffect, useRef, useState } from 'react';
import { PanResponder, Platform, Text, View, type ViewStyle } from 'react-native';

import type { DesignOverlay } from '@/core/types';
import { color, font } from '@/ui/tokens';

import { DesignView, OVERLAY_FONTS, overlayBox, overlayText } from './DesignView';

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

function webCursor(c: 'grab' | 'grabbing' | 'ew-resize'): ViewStyle {
  return Platform.OS === 'web' ? { cursor: c as ViewStyle['cursor'] } : {};
}

/**
 * Tasarım üzerinde isim kutusunu sürükleyip genişletme.
 * Kutu taşınırken yalnızca bu bileşen çizilir; bırakınca yeni oranlar üst bileşene bildirilir.
 */
export const OverlayEditor = memo(function OverlayEditor({
  uri,
  naturalWidth,
  naturalHeight,
  overlay,
  name,
  width,
  onChange,
  onDragState,
  a11yMove,
  a11yResize,
}: {
  uri: string;
  naturalWidth: number;
  naturalHeight: number;
  overlay: DesignOverlay;
  name: string;
  width: number;
  onChange: (o: DesignOverlay) => void;
  onDragState?: (dragging: boolean) => void;
  a11yMove: string;
  a11yResize: string;
}) {
  const ratio = naturalWidth > 0 && naturalHeight > 0 ? naturalHeight / naturalWidth : 1.4;
  const w = Math.max(1, width);
  const h = w * ratio;
  const [drag, setDrag] = useState<{ dx: number; dy: number; dw: number; mode: 'move' | 'resize' } | null>(null);
  const latest = useRef({ overlay, w, h, onChange, onDragState });
  useEffect(() => {
    latest.current = { overlay, w, h, onChange, onDragState };
  });

  const [moveResponder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        const cb = latest.current.onDragState;
        if (cb) cb(true);
      },
      onPanResponderMove: (_, g) => setDrag({ dx: g.dx, dy: g.dy, dw: 0, mode: 'move' }),
      onPanResponderRelease: (_, g) => {
        const { overlay: o, w: W, h: H } = latest.current;
        setDrag(null);
        const end = latest.current.onDragState;
        if (end) end(false);
        const x = clamp(o.x + g.dx / W, -0.2, 1 - Math.min(o.width, 1) + 0.2);
        const y = clamp(o.y + g.dy / H, 0, 1);
        latest.current.onChange({ ...o, x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 });
      },
      onPanResponderTerminate: () => {
        setDrag(null);
        const end = latest.current.onDragState;
        if (end) end(false);
      },
    }),
  );
  const [resizeResponder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        const cb = latest.current.onDragState;
        if (cb) cb(true);
      },
      onPanResponderMove: (_, g) => setDrag({ dx: 0, dy: 0, dw: g.dx, mode: 'resize' }),
      onPanResponderRelease: (_, g) => {
        const { overlay: o, w: W } = latest.current;
        setDrag(null);
        const end = latest.current.onDragState;
        if (end) end(false);
        const width2 = clamp(o.width + g.dx / W, 0.15, 1.2);
        latest.current.onChange({ ...o, width: Math.round(width2 * 1000) / 1000 });
      },
      onPanResponderTerminate: () => {
        setDrag(null);
        const end = latest.current.onDragState;
        if (end) end(false);
      },
    }),
  );

  const box = overlayBox(overlay, w, h);
  const left = box.left + (drag?.dx ?? 0);
  const top = box.top + (drag?.dy ?? 0);
  const bw = Math.max(30, box.width + (drag?.dw ?? 0));

  return (
    <DesignView uri={uri} naturalWidth={naturalWidth} naturalHeight={naturalHeight} overlay={overlay} name={name} width={w} hideText style={{ borderRadius: 18 }}>
      <View
        {...moveResponder.panHandlers}
        accessibilityRole="adjustable"
        accessibilityLabel={a11yMove}
        style={{
          position: 'absolute',
          left,
          top,
          width: bw,
          height: box.height,
          justifyContent: 'center',
          borderRadius: 8,
          borderWidth: 1.5,
          borderStyle: 'dashed',
          borderColor: drag ? color.lavender : 'rgba(126,102,222,0.85)',
          backgroundColor: drag ? 'rgba(126,102,222,0.12)' : 'rgba(255,255,255,0.10)',
          ...webCursor(drag?.mode === 'move' ? 'grabbing' : 'grab'),
        }}>
        <Text
          numberOfLines={2}
          style={{
            fontFamily: OVERLAY_FONTS[overlay.font] ?? font.serif,
            fontSize: box.fontSize,
            lineHeight: box.lineHeight,
            color: overlay.color,
            textAlign: overlay.align,
          }}>
          {overlayText(overlay, name)}
        </Text>
        <View
          {...resizeResponder.panHandlers}
          accessibilityRole="adjustable"
          accessibilityLabel={a11yResize}
          hitSlop={12}
          style={{
            position: 'absolute',
            right: -9,
            top: box.height / 2 - 14,
            width: 18,
            height: 28,
            borderRadius: 9,
            backgroundColor: color.lavender,
            boxShadow: '0px 2px 6px rgba(36,33,43,0.25)',
            alignItems: 'center',
            justifyContent: 'center',
            ...webCursor('ew-resize'),
          }}>
          <View style={{ width: 2, height: 12, borderRadius: 1, backgroundColor: '#FFFFFF' }} />
        </View>
      </View>
    </DesignView>
  );
});
