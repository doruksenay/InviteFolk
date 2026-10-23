import type { TextStyle } from 'react-native';

import type { InvitationTheme } from '@/core/themes';
import { font } from '@/ui/tokens';

/**
 * Davetiye başlığı temanın yazısıyla. `size` Instrument Serif ölçeğinde verilir; diğer yazılar
 * aynı satır uzunluğunu koruyacak şekilde ölçeklenir (Playfair geniş, el yazısı küçük göründüğü için büyük).
 */
export function themeTitle(theme: InvitationTheme, size: number): TextStyle {
  switch (theme.font) {
    case 'formal': {
      const s = Math.round(size * 0.8);
      return { fontFamily: font.formal, fontSize: s, lineHeight: Math.round(s * 1.16), letterSpacing: -0.3 };
    }
    case 'script': {
      const s = Math.round(size * 1.05);
      return { fontFamily: font.script, fontSize: s, lineHeight: Math.round(s * 1.18), letterSpacing: 0 };
    }
    case 'sans': {
      const s = Math.round(size * 0.72);
      return { fontFamily: font.display, fontSize: s, lineHeight: Math.round(s * 1.16), letterSpacing: -0.02 * s };
    }
    default:
      return { fontFamily: font.serif, fontSize: size, lineHeight: Math.round(size * 0.98), letterSpacing: -0.4 };
  }
}

/** Davetiyedeki uzun metin (davet cümlesi, ev sahibinden not). El yazılı temalarda okunaklı kalması için serif. */
export function themeProse(theme: InvitationTheme, size: number): TextStyle {
  switch (theme.font) {
    case 'formal':
      return { fontFamily: font.formalItalic, fontSize: Math.round(size * 0.82), lineHeight: Math.round(size * 0.82 * 1.45) };
    case 'sans':
      return { fontFamily: font.medium, fontSize: Math.round(size * 0.72), lineHeight: Math.round(size * 0.72 * 1.5) };
    default:
      return { fontFamily: font.serif, fontSize: size, lineHeight: Math.round(size * 1.3) };
  }
}
