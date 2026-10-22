import type { ReactNode } from 'react';
import { Image, Text, View, type ViewStyle } from 'react-native';

import type { DesignOverlay } from '@/core/types';
import { font } from '@/ui/tokens';

export const OVERLAY_FONTS: Record<DesignOverlay['font'], string> = {
  serif: font.serif,
  serifItalic: font.serifItalic,
  sans: font.medium,
  sansBold: font.bold,
};

/** Yazı satırının görsel üzerindeki kutusu (piksel). Hem çizim hem düzenleyici aynı hesabı kullanır. */
export function overlayBox(o: DesignOverlay, w: number, h: number) {
  const fontSize = Math.max(6, o.size * w);
  const lineHeight = fontSize * 1.18;
  // İki satıra kadar sığsın; dikey merkez overlay.y.
  const boxH = lineHeight * 2;
  return { left: o.x * w, top: o.y * h - boxH / 2, width: o.width * w, height: boxH, fontSize, lineHeight };
}

export function overlayText(o: DesignOverlay, name: string) {
  return `${o.prefix ?? ''}${name}`;
}

/**
 * Yüklenen davetiye görseli + üzerine kişiye özel isim.
 * `width` verilen genişlikte çizilir; yükseklik görselin oranından gelir.
 */
export function DesignView({
  uri,
  naturalWidth,
  naturalHeight,
  overlay,
  name,
  width,
  style,
  children,
  hideText,
}: {
  uri: string;
  naturalWidth: number;
  naturalHeight: number;
  overlay: DesignOverlay;
  name: string;
  width: number;
  style?: ViewStyle;
  children?: ReactNode;
  hideText?: boolean;
}) {
  const ratio = naturalWidth > 0 && naturalHeight > 0 ? naturalHeight / naturalWidth : 1.4;
  const w = Math.max(1, width);
  const h = w * ratio;
  const box = overlayBox(overlay, w, h);
  return (
    <View style={[{ width: w, height: h, overflow: 'hidden', backgroundColor: '#F1ECE4' }, style]}>
      <Image source={{ uri }} style={{ width: w, height: h }} resizeMode="cover" accessibilityIgnoresInvertColors />
      {!hideText && (
        <View pointerEvents="none" style={{ position: 'absolute', left: box.left, top: box.top, width: box.width, height: box.height, justifyContent: 'center' }}>
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
        </View>
      )}
      {children}
    </View>
  );
}
