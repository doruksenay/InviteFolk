// Davetiye temaları. Davetlinin gördüğü sayfa ve önizleme bu değerlerle çizilir.
// Tema adları sözlükte: t(`themes.${key}`).

export type ThemeKey = 'adacayi' | 'lavanta' | 'mercan' | 'altin' | 'gece';

export type InvitationTheme = {
  key: ThemeKey;
  bg: string;      // kâğıt zemini
  shapeA: string;  // büyük daire
  shapeB: string;  // kemer
  shapeC: string;  // küçük daire / sahne zemini
  ink: string;     // ana yazı
  soft: string;    // ikincil yazı
  key_: string;    // vurgu (üst başlık)
  chip: string;    // görsel üstündeki etiket zemini
  dark: boolean;
};

export const THEMES: Record<ThemeKey, InvitationTheme> = {
  adacayi: { key: 'adacayi', bg: '#EEF4EF', shapeA: '#9CC3AB', shapeB: '#EBC08F', shapeC: '#D3E6D9', ink: '#20332A', soft: '#4F6358', key_: '#3F7559', chip: 'rgba(255,255,255,0.82)', dark: false },
  lavanta: { key: 'lavanta', bg: '#F2EDFC', shapeA: '#A08CEB', shapeB: '#F6D38E', shapeC: '#E0D6FA', ink: '#2A2440', soft: '#5E5873', key_: '#5B47C2', chip: 'rgba(255,255,255,0.82)', dark: false },
  mercan: { key: 'mercan', bg: '#FFF1EC', shapeA: '#F2846F', shapeB: '#F6D38E', shapeC: '#FFD8CC', ink: '#3A211B', soft: '#6E5048', key_: '#B5432F', chip: 'rgba(255,255,255,0.82)', dark: false },
  altin: { key: 'altin', bg: '#FBF4E3', shapeA: '#E2B04A', shapeB: '#F2846F', shapeC: '#F3E1B3', ink: '#33280F', soft: '#6A5B3B', key_: '#8A6414', chip: 'rgba(255,255,255,0.82)', dark: false },
  gece: { key: 'gece', bg: '#24223A', shapeA: '#A08CEB', shapeB: '#F2846F', shapeC: '#3A3757', ink: '#F7F1E7', soft: '#CCC5D8', key_: '#F6D38E', chip: 'rgba(36,34,58,0.6)', dark: true },
};

export const THEME_ORDER: ThemeKey[] = ['adacayi', 'lavanta', 'mercan', 'altin', 'gece'];

export function getTheme(key: string | null | undefined): InvitationTheme {
  return THEMES[(key as ThemeKey) ?? 'adacayi'] ?? THEMES.adacayi;
}
