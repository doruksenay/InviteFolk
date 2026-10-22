import { type ReactNode, useState } from 'react';
import { type LayoutChangeEvent, View, type ViewStyle } from 'react-native';

import type { InvitationTheme } from '@/core/themes';
import type { DesignOverlay } from '@/core/types';

import { DesignView } from './DesignView';

/**
 * Davetlinin gördüğü kişiye özel davetiye: yüklenen tasarım + üzerine isim, altında temanın renklerinde
 * cevap alanı. Hem davetli sayfası hem organizatörün "davetli gözünden" önizlemesi bunu kullanır.
 */
export function GuestDesignCard({
  theme,
  uri,
  naturalWidth,
  naturalHeight,
  overlay,
  name,
  children,
  style,
}: {
  theme: InvitationTheme;
  uri: string;
  naturalWidth: number;
  naturalHeight: number;
  overlay: DesignOverlay;
  name: string;
  children?: ReactNode;
  style?: ViewStyle;
}) {
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setW(Math.round(e.nativeEvent.layout.width));
  return (
    <View
      onLayout={onLayout}
      style={[
        { width: '100%', maxWidth: 420, alignSelf: 'center', borderRadius: 28, overflow: 'hidden', backgroundColor: theme.bg, boxShadow: '0px 26px 56px rgba(30,20,10,0.20)' },
        style,
      ]}>
      {w > 0 && <DesignView uri={uri} naturalWidth={naturalWidth} naturalHeight={naturalHeight} overlay={overlay} name={name} width={w} />}
      {children ? <View style={{ paddingHorizontal: 22, paddingTop: 20, paddingBottom: 22, gap: 12 }}>{children}</View> : null}
    </View>
  );
}
