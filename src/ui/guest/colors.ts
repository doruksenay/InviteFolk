// Tema renkleriyle okunaklı yazı rengi seçimi (mühür, rozet gibi küçük yüzeyler için).
function lum(hex: string) {
  const h = hex.replace('#', '');
  if (h.length !== 6) return 1;
  const c = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export function contrast(a: string, b: string) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Zeminde daha okunaklı olan: koyu kahve ya da beyaz. */
export function readableOn(bg: string) {
  return contrast(bg, '#2A1F14') >= contrast(bg, '#FFFFFF') ? '#2A1F14' : '#FFFFFF';
}

/** Kart içi yumuşak yüzey. */
export function softSurface(dark: boolean) {
  return dark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.78)';
}

export function hairline(dark: boolean) {
  return dark ? 'rgba(255,255,255,0.16)' : 'rgba(120,100,80,0.18)';
}
