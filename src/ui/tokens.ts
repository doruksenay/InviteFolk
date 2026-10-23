// Tasarım tokenları: "Yeni etkinlik" ekranında onaylanan dil, Invitefolk renkleriyle.
// Sıcak kırık beyaz zemin, sert kenarlık yok, yumuşak gölge, tek yuvarlak sans.

// Invitefolk marka paleti (assets/brand/invitefolk-brand-identity.png):
// Deep Violet #6C5CE7 · Coral #FF6B6B · Golden Yellow #FBBF24 · Mint Green #22C55E · Soft Off-White #FFF9F4
// Yazı taşıyan zeminlerde *Ink tonları kullanılır (beyaz yazı mercan/sarı/yeşil üstünde okunmaz).
export const color = {
  bg: '#FFF9F4',
  surface: '#FFFFFF',
  surfaceSoft: '#F8F1EA',
  ink: '#1F1B2E',
  inkSoft: '#3A3548',
  muted: '#6E6A72',
  faint: '#9A968F',
  hairline: 'rgba(40,30,20,0.07)',
  ring: 'rgba(31,27,46,0.18)',
  onInk: '#FFFFFF',

  lavender: '#6C5CE7',
  lavenderInk: '#4A3BC2',
  lavenderTint: '#EEEBFD',
  coral: '#FF6B6B',
  coralInk: '#B42F2F',
  coralTint: '#FFE8E6',
  sage: '#22C55E',
  sageInk: '#166534',
  sageTint: '#E3F8EA',
  gold: '#FBBF24',
  goldInk: '#7A5000',
  goldTint: '#FFF6DB',
} as const;

/** Durum renkleri. Etiketler sözlükte: t(`status.rsvp.${key}`). */
export const status = {
  yes: { bg: color.sageTint, ink: color.sageInk, dot: color.sage },
  pending: { bg: color.goldTint, ink: color.goldInk, dot: color.gold },
  no: { bg: color.coralTint, ink: color.coralInk, dot: color.coral },
  maybe: { bg: color.lavenderTint, ink: color.lavenderInk, dot: color.lavender },
  waitlist: { bg: color.lavenderTint, ink: color.lavenderInk, dot: color.lavender },
} as const;

export const radius = { sm: 12, md: 16, lg: 22, xl: 28, pill: 999 } as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

// Marka yazısı: yuvarlak hatlı, samimi sans (Nunito). Başlıklar ExtraBold, vurgu renkle yapılır.
// Serif yalnızca davetiye temalarında (davetli sayfası, kart önizlemeleri, basılı masa kartları).
export const font = {
  regular: 'Nunito_400Regular',
  medium: 'Nunito_500Medium',
  semibold: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  display: 'Nunito_800ExtraBold',
  black: 'Nunito_900Black',
  serif: 'InstrumentSerif_400Regular',
  serifItalic: 'InstrumentSerif_400Regular_Italic',
} as const;

// React Native 0.76+ (New Architecture) boxShadow dizgesini tüm platformlarda destekler.
export const shadow = {
  card: '0px 1px 2px rgba(40,30,20,0.04), 0px 6px 18px rgba(40,30,20,0.05)',
  raised: '0px 2px 4px rgba(40,30,20,0.05), 0px 18px 40px rgba(40,30,20,0.09)',
  button: '0px 10px 24px rgba(36,33,43,0.20)',
} as const;

/** Ekran genişliği bu değeri aşınca iki sütunlu yerleşime geçilir (tablet ve web). */
export const WIDE_BREAKPOINT = 980;
