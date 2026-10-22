// Tasarım tokenları: "Yeni etkinlik" ekranında onaylanan dil.
// Sıcak kırık beyaz zemin, sert kenarlık yok, yumuşak gölge, tek sans + ölçülü serif.

export const color = {
  bg: '#FAF7F2',
  surface: '#FFFFFF',
  surfaceSoft: '#F6F2EB',
  ink: '#24212B',
  inkSoft: '#3E3B45',
  muted: '#6E6A72',
  faint: '#9A968F',
  hairline: 'rgba(40,30,20,0.07)',
  ring: 'rgba(36,33,43,0.18)',
  onInk: '#FFFFFF',

  lavender: '#7E66DE',
  lavenderInk: '#5B47C2',
  lavenderTint: '#EFEAFB',
  coral: '#E8664F',
  coralInk: '#A3332A',
  coralTint: '#FFE9E4',
  sage: '#5E8F73',
  sageInk: '#2F5A43',
  sageTint: '#E6F0EA',
  gold: '#C99327',
  goldInk: '#6B4A00',
  goldTint: '#FFF4D6',
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

export const font = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
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
