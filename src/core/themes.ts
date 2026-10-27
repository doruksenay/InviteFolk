// Davetiye temaları. Davetlinin gördüğü sayfa, önizlemeler ve basılı kartlar bu değerlerle çizilir.
// Tema adları sözlükte: t(`themes.${key}`). Motifler src/ui/theme/ThemeArt.tsx içinde çizilir.
// Veritabanı yalnızca anahtarın biçimini denetler (events_theme_format); yeni tema eklemek için migration gerekmez.

export type ThemeKey =
  | 'adacayi' | 'lavanta' | 'mercan' | 'altin' | 'gece'
  | 'fildisi' | 'gul' | 'zumrut' | 'lacivert' | 'okaliptus' | 'sampanya' | 'bordo' | 'beyaz' | 'pudra' | 'zeytin'
  | 'kina_kirmizi' | 'mor_gece'
  | 'konfeti' | 'limon' | 'deniz' | 'pembe' | 'gokkusagi' | 'kurumsal' | 'saha_yesil' | 'parke' | 'file'
  | 'sakura' | 'lale' | 'sehzade' | 'nur' | 'bulut' | 'pamuk' | 'kep' | 'isilti'
  | 'siyah_altin' | 'osmanli' | 'cini'
  | 'suluboya' | 'mavi_suluboya' | 'boho' | 'kil' | 'mermer' | 'akdeniz' | 'retro' | 'neon' | 'tropik' | 'kis' | 'ask' | 'simli' | 'cizgi';

/** Görsel alandaki desen. */
export type Motif =
  | 'arch' | 'botanical' | 'frame' | 'deco' | 'confetti' | 'waves' | 'stars' | 'sun' | 'rainbow' | 'petals'
  | 'ottoman' | 'minimal' | 'pitch' | 'balloons' | 'court' | 'net'
  | 'sakura' | 'tulips' | 'crown' | 'geometric' | 'clouds' | 'caps' | 'disco'
  | 'luxe' | 'rumi' | 'tiles'
  | 'watercolor' | 'boho' | 'marble' | 'citrus' | 'retro' | 'neon' | 'tropical' | 'winter' | 'hearts' | 'foil' | 'lineart';

/** Davetiye görselinin üstünde süzülen hareket (davetli sayfası ve önizleme). */
export type ThemeEffect = 'none' | 'petals' | 'confetti' | 'sparkles' | 'stars' | 'bubbles' | 'hearts';
export const THEME_EFFECTS: ThemeEffect[] = ['petals', 'confetti', 'sparkles', 'stars', 'bubbles', 'hearts', 'none'];
/** Kartın düzeni: klasik (üstte görsel), sade (ortalı yazı), kapak (görselin üstünde başlık), çerçeveli. */
export type ThemeLayout = 'classic' | 'minimal' | 'cover' | 'framed';
export const THEME_LAYOUTS: ThemeLayout[] = ['classic', 'minimal', 'cover', 'framed'];

/** Başlık yazısı: serif (Instrument Serif), formal (Playfair Display), script (Great Vibes), sans (Nunito). */
export type ThemeFont = 'serif' | 'formal' | 'script' | 'sans';

export type ThemeGroup = 'wedding' | 'tradition' | 'celebration' | 'everyday';

export type InvitationTheme = {
  key: ThemeKey;
  bg: string;      // kâğıt zemini
  shapeA: string;  // ana şekil
  shapeB: string;  // ikinci şekil / vurgu
  shapeC: string;  // açık zemin şekli
  ink: string;     // ana yazı
  soft: string;    // ikincil yazı
  key_: string;    // vurgu yazısı (üst başlık); zeminde okunur (≥ 4.5:1)
  chip: string;    // görsel üstündeki etiket zemini
  dark: boolean;
  motif: Motif;
  font: ThemeFont;
  group: ThemeGroup;
  /** Konfeti, gökkuşağı ve balon gibi çok renkli desenler için (yazı için kullanılmaz). */
  palette: string[];
  /** Varsayılan hareket (organizatör davetiye sayfasında değiştirebilir). */
  effect: ThemeEffect;
};

type Def = Omit<InvitationTheme, 'key' | 'chip' | 'effect'> & { chip?: string; effect?: ThemeEffect };

/** Desene göre varsayılan hareket. */
const MOTIF_EFFECT: Record<Motif, ThemeEffect> = {
  arch: 'sparkles', botanical: 'petals', frame: 'sparkles', deco: 'sparkles', confetti: 'confetti', waves: 'bubbles', stars: 'stars',
  sun: 'sparkles', rainbow: 'confetti', petals: 'petals', ottoman: 'sparkles', minimal: 'none', pitch: 'none', balloons: 'bubbles',
  court: 'none', net: 'none', sakura: 'petals', tulips: 'petals', crown: 'sparkles', geometric: 'stars', clouds: 'bubbles', caps: 'confetti', disco: 'sparkles',
  luxe: 'sparkles', rumi: 'none', tiles: 'none',
  watercolor: 'petals', boho: 'petals', marble: 'sparkles', citrus: 'sparkles', retro: 'confetti', neon: 'sparkles', tropical: 'petals',
  winter: 'sparkles', hearts: 'hearts', foil: 'sparkles', lineart: 'none',
};

const LIGHT_CHIP = 'rgba(255,255,255,0.82)';

const DEFS: Record<ThemeKey, Def> = {
  // İlk beş tema: mevcut etkinliklerin görünümü değişmesin.
  adacayi: { bg: '#EEF4EF', shapeA: '#9CC3AB', shapeB: '#EBC08F', shapeC: '#D3E6D9', ink: '#20332A', soft: '#4F6358', key_: '#3F7559', dark: false, motif: 'arch', font: 'serif', group: 'wedding', palette: ['#9CC3AB', '#EBC08F', '#D3E6D9'] },
  lavanta: { bg: '#F2EDFC', shapeA: '#A08CEB', shapeB: '#F6D38E', shapeC: '#E0D6FA', ink: '#2A2440', soft: '#5E5873', key_: '#5B47C2', dark: false, motif: 'arch', font: 'serif', group: 'wedding', palette: ['#A08CEB', '#F6D38E', '#E0D6FA'] },
  mercan: { bg: '#FFF1EC', shapeA: '#F2846F', shapeB: '#F6D38E', shapeC: '#FFD8CC', ink: '#3A211B', soft: '#6E5048', key_: '#B5432F', dark: false, motif: 'arch', font: 'serif', group: 'celebration', palette: ['#F2846F', '#F6D38E', '#FFD8CC'] },
  altin: { bg: '#FBF4E3', shapeA: '#E2B04A', shapeB: '#F2846F', shapeC: '#F3E1B3', ink: '#33280F', soft: '#6A5B3B', key_: '#8A6414', dark: false, motif: 'arch', font: 'serif', group: 'celebration', palette: ['#E2B04A', '#F2846F', '#F3E1B3'] },
  gece: { bg: '#24223A', shapeA: '#A08CEB', shapeB: '#F2846F', shapeC: '#3A3757', ink: '#F7F1E7', soft: '#CCC5D8', key_: '#F6D38E', chip: 'rgba(36,34,58,0.6)', dark: true, motif: 'arch', font: 'serif', group: 'everyday', palette: ['#A08CEB', '#F2846F', '#F6D38E'] },

  // Düğün, nişan, kına
  fildisi: { bg: '#FBF7EF', shapeA: '#E9DCC3', shapeB: '#C9A86A', shapeC: '#F4ECDD', ink: '#2B2620', soft: '#655B4C', key_: '#86652E', dark: false, motif: 'frame', font: 'formal', group: 'wedding', palette: ['#C9A86A', '#E9DCC3'] },
  gul: { bg: '#FBF0EE', shapeA: '#E8B4B0', shapeB: '#C98B8B', shapeC: '#F6DCD8', ink: '#3B2526', soft: '#6F5455', key_: '#9A4F53', dark: false, motif: 'petals', font: 'script', group: 'wedding', palette: ['#E8B4B0', '#C98B8B', '#F6DCD8'] },
  zumrut: { bg: '#123B32', shapeA: '#2F6B5A', shapeB: '#D9B76E', shapeC: '#1C4A3F', ink: '#F6F0E3', soft: '#C9D6CC', key_: '#E2C27E', chip: 'rgba(18,59,50,0.65)', dark: true, motif: 'frame', font: 'formal', group: 'wedding', palette: ['#D9B76E', '#2F6B5A'] },
  lacivert: { bg: '#16213E', shapeA: '#2C3E66', shapeB: '#D4AF6A', shapeC: '#22305A', ink: '#F4EFE6', soft: '#C3C9D9', key_: '#E0BE7C', chip: 'rgba(22,33,62,0.65)', dark: true, motif: 'deco', font: 'formal', group: 'wedding', palette: ['#D4AF6A', '#2C3E66'] },
  okaliptus: { bg: '#EFF3EE', shapeA: '#8FAE9B', shapeB: '#C8D8C8', shapeC: '#DDE7DC', ink: '#22332B', soft: '#52645A', key_: '#3E6A52', dark: false, motif: 'botanical', font: 'serif', group: 'wedding', palette: ['#8FAE9B', '#6E9580', '#C8D8C8'] },
  sampanya: { bg: '#F8F1E6', shapeA: '#E7D2B0', shapeB: '#D2B48C', shapeC: '#F1E4CF', ink: '#3A2E22', soft: '#6C5C4A', key_: '#866438', dark: false, motif: 'sun', font: 'script', group: 'wedding', palette: ['#E7D2B0', '#D2B48C'] },
  bordo: { bg: '#F7EEEC', shapeA: '#7B2D3B', shapeB: '#E3B5B0', shapeC: '#EDD5D1', ink: '#3A1E24', soft: '#6E4C51', key_: '#7B2D3B', dark: false, motif: 'botanical', font: 'formal', group: 'wedding', palette: ['#7B2D3B', '#A9545F', '#E3B5B0'] },
  beyaz: { bg: '#FFFFFF', shapeA: '#E8E4DD', shapeB: '#BFB6A8', shapeC: '#F4F1EC', ink: '#222222', soft: '#626262', key_: '#6B6459', dark: false, motif: 'minimal', font: 'serif', group: 'wedding', palette: ['#BFB6A8', '#E8E4DD'] },
  pudra: { bg: '#FDF1F3', shapeA: '#F3C6D0', shapeB: '#F7E1B8', shapeC: '#FBE3E8', ink: '#3A2A30', soft: '#6D5960', key_: '#A4566D', dark: false, motif: 'arch', font: 'script', group: 'wedding', palette: ['#F3C6D0', '#F7E1B8', '#FBE3E8'] },
  zeytin: { bg: '#F3F2E8', shapeA: '#7E8B5A', shapeB: '#C9C29A', shapeC: '#E3E3D0', ink: '#2C2F1E', soft: '#5E6249', key_: '#566238', dark: false, motif: 'botanical', font: 'serif', group: 'wedding', palette: ['#7E8B5A', '#A3AE7C', '#C9C29A'] },
  kina_kirmizi: { bg: '#FBEFE6', shapeA: '#B8322A', shapeB: '#E2B354', shapeC: '#F4D9C6', ink: '#3B1612', soft: '#6F3E36', key_: '#9E2A22', dark: false, motif: 'ottoman', font: 'formal', group: 'wedding', palette: ['#B8322A', '#E2B354', '#F4D9C6'] },
  mor_gece: { bg: '#2A1B3D', shapeA: '#6C5CE7', shapeB: '#F2C46D', shapeC: '#3B2A57', ink: '#F6F1FF', soft: '#CFC6E3', key_: '#F2C46D', chip: 'rgba(42,27,61,0.65)', dark: true, motif: 'stars', font: 'script', group: 'wedding', palette: ['#F2C46D', '#6C5CE7', '#FFFFFF'] },

  // Doğum günü, kutlama
  konfeti: { bg: '#FFF9F4', shapeA: '#6C5CE7', shapeB: '#FF6B6B', shapeC: '#FBBF24', ink: '#1F1B2E', soft: '#5B566A', key_: '#5A49D6', dark: false, motif: 'confetti', font: 'sans', group: 'celebration', palette: ['#6C5CE7', '#FF6B6B', '#FBBF24', '#22C55E'] },
  limon: { bg: '#FFFBEA', shapeA: '#FFD95A', shapeB: '#7CC6E8', shapeC: '#FFF0B3', ink: '#2A2A1A', soft: '#5F5E45', key_: '#7A5900', dark: false, motif: 'sun', font: 'sans', group: 'celebration', palette: ['#FFD95A', '#7CC6E8'] },
  deniz: { bg: '#EEF6FA', shapeA: '#5BA4CF', shapeB: '#F3D9A4', shapeC: '#CFE6F2', ink: '#12324A', soft: '#45627A', key_: '#1C6591', dark: false, motif: 'waves', font: 'serif', group: 'celebration', palette: ['#5BA4CF', '#8CC3E2', '#F3D9A4'] },
  pembe: { bg: '#FFF1F7', shapeA: '#FF8FC2', shapeB: '#8FD3FF', shapeC: '#FFD6E9', ink: '#3A1F2E', soft: '#6E5161', key_: '#B0306F', dark: false, motif: 'balloons', font: 'sans', group: 'celebration', palette: ['#FF8FC2', '#8FD3FF', '#FFD166', '#B39DFF'] },
  gokkusagi: { bg: '#FFF9F4', shapeA: '#6C5CE7', shapeB: '#FF6B6B', shapeC: '#FBBF24', ink: '#1F1B2E', soft: '#5B566A', key_: '#5A49D6', dark: false, motif: 'rainbow', font: 'sans', group: 'celebration', palette: ['#6C5CE7', '#FF6B6B', '#FBBF24', '#22C55E'] },

  // İş, yemek, spor
  kurumsal: { bg: '#F4F5F7', shapeA: '#4E5A72', shapeB: '#A9B4C8', shapeC: '#E3E6EE', ink: '#1E2430', soft: '#586174', key_: '#3D4A63', dark: false, motif: 'deco', font: 'sans', group: 'everyday', palette: ['#4E5A72', '#A9B4C8'], effect: 'none' },
  saha_yesil: { bg: '#EEF6EF', shapeA: '#3F8F55', shapeB: '#358049', shapeC: '#D4EAD9', ink: '#183223', soft: '#4A6555', key_: '#2A6B3C', dark: false, motif: 'pitch', font: 'sans', group: 'everyday', palette: ['#3F8F55', '#358049'] },
  parke: { bg: '#FBF3EA', shapeA: '#D9A066', shapeB: '#CF955A', shapeC: '#F4DFC6', ink: '#3A2414', soft: '#6E5240', key_: '#A84D17', dark: false, motif: 'court', font: 'sans', group: 'everyday', palette: ['#E8772E', '#2F4B7C'] },
  file: { bg: '#EEF4FB', shapeA: '#2F6DB5', shapeB: '#2A63A6', shapeC: '#D6E4F5', ink: '#14263D', soft: '#4A5E78', key_: '#1F5598', dark: false, motif: 'net', font: 'sans', group: 'everyday', palette: ['#F2C230', '#2F6DB5'] },
  // Düğün: süzülen yapraklarla
  sakura: { bg: '#FFF5F7', shapeA: '#F4B6C6', shapeB: '#E68AA5', shapeC: '#FDE3EA', ink: '#3A1F28', soft: '#6B4C57', key_: '#A8466A', dark: false, motif: 'sakura', font: 'serif', group: 'wedding', palette: ['#F4B6C6', '#E68AA5', '#FDE3EA'] },
  lale: { bg: '#FBF4EE', shapeA: '#C8414B', shapeB: '#3F7A4F', shapeC: '#F3E0D4', ink: '#2E1A16', soft: '#614A44', key_: '#A3313A', dark: false, motif: 'tulips', font: 'formal', group: 'wedding', palette: ['#C8414B', '#E8A13A', '#F3E0D4'] },
  // Sünnet, mevlüt ve gelenek
  sehzade: { bg: '#EEF3FB', shapeA: '#2E4C8C', shapeB: '#D4A93C', shapeC: '#D8E3F5', ink: '#13213F', soft: '#4B5876', key_: '#2E4C8C', dark: false, motif: 'crown', font: 'formal', group: 'tradition', palette: ['#2E4C8C', '#D4A93C', '#D8E3F5'] },
  nur: { bg: '#F2F6F1', shapeA: '#2F6B57', shapeB: '#C9A44C', shapeC: '#DCE9E1', ink: '#17302A', soft: '#4E625B', key_: '#2F6B57', dark: false, motif: 'geometric', font: 'formal', group: 'tradition', palette: ['#2F6B57', '#C9A44C', '#DCE9E1'] },
  // Kutlama: bebek, mezuniyet, bekârlığa veda
  bulut: { bg: '#EEF6FC', shapeA: '#BFDDF2', shapeB: '#F9D976', shapeC: '#FFFFFF', ink: '#1E3247', soft: '#4F6375', key_: '#2E6E9E', dark: false, motif: 'clouds', font: 'sans', group: 'celebration', palette: ['#9CCBEA', '#F9D976', '#F7B6C8'] },
  pamuk: { bg: '#FDF0F4', shapeA: '#F6C9D8', shapeB: '#BFDDF2', shapeC: '#FFFFFF', ink: '#3B2230', soft: '#6E5361', key_: '#A8406B', dark: false, motif: 'clouds', font: 'sans', group: 'celebration', palette: ['#F6B3C9', '#9CCBEA', '#F9D976'], effect: 'hearts' },
  kep: { bg: '#EEF0F7', shapeA: '#1F2A55', shapeB: '#E3B341', shapeC: '#D7DCEE', ink: '#141B38', soft: '#4D5470', key_: '#2B3A78', dark: false, motif: 'caps', font: 'sans', group: 'celebration', palette: ['#E3B341', '#1F2A55', '#E86A5A', '#5BB3A0'] },
  // Lüks ve geleneksel
  siyah_altin: { bg: '#121014', shapeA: '#2A2620', shapeB: '#D4AF5A', shapeC: '#1C1A17', ink: '#F5EEDC', soft: '#C9BFA8', key_: '#E2C27A', chip: 'rgba(18,16,20,0.7)', dark: true, motif: 'luxe', font: 'formal', group: 'wedding', palette: ['#D4AF5A', '#F5EEDC'] },
  osmanli: { bg: '#FAF3E6', shapeA: '#7A1F2B', shapeB: '#C9A044', shapeC: '#F1E3C8', ink: '#33140F', soft: '#674A40', key_: '#7A1F2B', dark: false, motif: 'rumi', font: 'formal', group: 'wedding', palette: ['#7A1F2B', '#C9A044', '#F1E3C8'] },
  cini: { bg: '#F5F8FC', shapeA: '#1F4E8C', shapeB: '#2BA3A6', shapeC: '#E3ECF7', ink: '#132744', soft: '#4A5C78', key_: '#1F4E8C', dark: false, motif: 'tiles', font: 'formal', group: 'tradition', palette: ['#1F4E8C', '#2BA3A6', '#C8414B'] },
  isilti: { bg: '#1D1430', shapeA: '#B57BE8', shapeB: '#F5C86A', shapeC: '#2E2148', ink: '#F8F1FF', soft: '#CDBEDF', key_: '#F5C86A', chip: 'rgba(29,20,48,0.6)', dark: true, motif: 'disco', font: 'script', group: 'celebration', palette: ['#B57BE8', '#F5C86A', '#FF8FB1'] },
  // Yeni tarzlar: suluboya, boho, mermer, akdeniz, retro, neon, tropik, kış, aşk, simli, çizgi
  suluboya: { bg: '#FFF6F2', shapeA: '#F4B7B0', shapeB: '#F7CBA4', shapeC: '#FBE1DA', ink: '#3A2422', soft: '#6E514D', key_: '#A44E4A', dark: false, motif: 'watercolor', font: 'serif', group: 'wedding', palette: ['#F4B7B0', '#F7CBA4', '#E9A9B8', '#FBE1DA'] },
  mavi_suluboya: { bg: '#F2F6F8', shapeA: '#A9C3D6', shapeB: '#B9CDB5', shapeC: '#DCE7EE', ink: '#1D2D3A', soft: '#4C5D6A', key_: '#3E6584', dark: false, motif: 'watercolor', font: 'serif', group: 'wedding', palette: ['#A9C3D6', '#B9CDB5', '#C3CCE6', '#DCE7EE'] },
  boho: { bg: '#F8F0E6', shapeA: '#C8734F', shapeB: '#E3C9A6', shapeC: '#F0E0CC', ink: '#35231A', soft: '#6A5242', key_: '#9C4A2B', dark: false, motif: 'boho', font: 'script', group: 'wedding', palette: ['#C8734F', '#D9A77E', '#E3C9A6', '#9A7B5A'] },
  kil: { bg: '#F4E0D2', shapeA: '#A9472C', shapeB: '#E6B48C', shapeC: '#E6C2A6', ink: '#3A1E14', soft: '#674236', key_: '#8E3B24', dark: false, motif: 'boho', font: 'serif', group: 'celebration', palette: ['#A9472C', '#E39A6E', '#F3D3B5', '#6E3A26'] },
  mermer: { bg: '#FAFAF8', shapeA: '#CFCFCB', shapeB: '#C6A35A', shapeC: '#EEEEEB', ink: '#232323', soft: '#5E5E5E', key_: '#7F6328', dark: false, motif: 'marble', font: 'formal', group: 'wedding', palette: ['#C6A35A', '#BDBDB9', '#E5E5E2'] },
  akdeniz: { bg: '#F5F8FC', shapeA: '#F4CF3C', shapeB: '#2F6FA8', shapeC: '#DDE8F4', ink: '#132A44', soft: '#46597A', key_: '#235C95', dark: false, motif: 'citrus', font: 'serif', group: 'wedding', palette: ['#F4CF3C', '#5E8F4A', '#2F6FA8', '#FFFFFF'] },
  retro: { bg: '#FBF1DE', shapeA: '#E0A030', shapeB: '#D9622B', shapeC: '#8A4B2A', ink: '#2E1C10', soft: '#634A36', key_: '#A3461A', dark: false, motif: 'retro', font: 'sans', group: 'celebration', palette: ['#E0A030', '#D9622B', '#8A4B2A', '#F0C98A'] },
  neon: { bg: '#120E24', shapeA: '#FF3EA5', shapeB: '#2CE6F2', shapeC: '#1E1838', ink: '#F7F2FF', soft: '#C9C0E0', key_: '#2CE6F2', chip: 'rgba(18,14,36,0.65)', dark: true, motif: 'neon', font: 'sans', group: 'celebration', palette: ['#FF3EA5', '#2CE6F2', '#B26BFF', '#FFE14D'] },
  tropik: { bg: '#F1F7F0', shapeA: '#2F7A4F', shapeB: '#F28C6B', shapeC: '#D6EAD9', ink: '#15301F', soft: '#46604F', key_: '#2B6A44', dark: false, motif: 'tropical', font: 'sans', group: 'celebration', palette: ['#2F7A4F', '#4E9A62', '#7DBB7F', '#F28C6B'] },
  kis: { bg: '#F2F7FB', shapeA: '#A9CBE3', shapeB: '#3F6E5A', shapeC: '#DCEAF4', ink: '#152638', soft: '#475B6E', key_: '#2F5D82', dark: false, motif: 'winter', font: 'formal', group: 'wedding', palette: ['#A9CBE3', '#3F6E5A', '#FFFFFF'] },
  ask: { bg: '#FFF2F3', shapeA: '#E2425C', shapeB: '#F7A1B0', shapeC: '#FDDDE2', ink: '#3A1820', soft: '#6E4851', key_: '#B02741', dark: false, motif: 'hearts', font: 'script', group: 'wedding', palette: ['#E2425C', '#F7A1B0', '#C9184A', '#FDDDE2'] },
  simli: { bg: '#FCF8F0', shapeA: '#EADCBF', shapeB: '#C8A048', shapeC: '#F5ECDA', ink: '#2C2416', soft: '#655843', key_: '#83631F', dark: false, motif: 'foil', font: 'formal', group: 'wedding', palette: ['#C8A048', '#E2C77E', '#A88232'] },
  cizgi: { bg: '#FAF8F3', shapeA: '#2B2B2B', shapeB: '#C9B79C', shapeC: '#EFEBE2', ink: '#222120', soft: '#5F5C57', key_: '#4A4744', dark: false, motif: 'lineart', font: 'serif', group: 'wedding', palette: ['#2B2B2B', '#C9B79C'] },
};

export const THEMES = Object.fromEntries(
  (Object.keys(DEFS) as ThemeKey[]).map((k) => [k, { ...DEFS[k], key: k, chip: DEFS[k].chip ?? LIGHT_CHIP, effect: DEFS[k].effect ?? MOTIF_EFFECT[DEFS[k].motif] }]),
) as Record<ThemeKey, InvitationTheme>;

/** Seçicideki sıra: düğüne uygunlar önce. */
export const THEME_ORDER: ThemeKey[] = [
  'fildisi', 'siyah_altin', 'mermer', 'simli', 'osmanli', 'suluboya', 'sakura', 'adacayi', 'gul', 'mavi_suluboya', 'okaliptus', 'boho', 'cizgi', 'pudra', 'ask', 'sampanya', 'beyaz', 'akdeniz', 'lale', 'zeytin', 'bordo', 'kis', 'zumrut', 'lacivert', 'lavanta', 'mor_gece', 'kina_kirmizi',
  'sehzade', 'nur', 'cini',
  'konfeti', 'gokkusagi', 'retro', 'neon', 'pembe', 'tropik', 'bulut', 'pamuk', 'kep', 'isilti', 'limon', 'deniz', 'kil', 'mercan', 'altin',
  'kurumsal', 'gece', 'saha_yesil', 'parke', 'file',
];

export function getTheme(key: string | null | undefined): InvitationTheme {
  return THEMES[(key as ThemeKey) ?? 'adacayi'] ?? THEMES.adacayi;
}

export function isThemeKey(key: string): key is ThemeKey {
  return key in DEFS;
}
