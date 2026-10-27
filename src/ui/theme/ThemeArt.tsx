import type { ReactElement } from 'react';
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';

import type { InvitationTheme } from '@/core/themes';

/**
 * Davetiye temasının görsel deseni (kartın üst alanı, tema küçük resmi, zarf, açık sayfalar).
 * 360×240'lık bir tuvale çizilir; verilen boyuta "kırparak" yerleşir. Rastgelelik tohumlu: her çizim aynı.
 */
export function ThemeArt({
  theme,
  width,
  height,
  align = 'xMidYMid',
}: {
  theme: InvitationTheme;
  width: number | `${number}%`;
  height: number | `${number}%`;
  align?: 'xMidYMid' | 'xMidYMin' | 'xMinYMin' | 'xMaxYMin';
}) {
  return (
    <Svg width={width} height={height} viewBox="0 0 360 240" preserveAspectRatio={`${align} slice`} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Rect x={0} y={0} width={360} height={240} fill={theme.bg} />
      {MOTIFS[theme.motif](theme)}
    </Svg>
  );
}

type Draw = (t: InvitationTheme) => ReactElement;

/** Tohumlu sözde-rastgele (aynı tema her yerde aynı görünsün). */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const LEAF = 'M0 0 C 7 -8 19 -8 26 0 C 19 8 7 8 0 0 Z';

/** İkinci dereceden eğri boyunca yapraklar (dal). */
function branch(key: string, p0: [number, number], p1: [number, number], p2: [number, number], n: number, size: number, colors: string[], stroke: string) {
  const items: ReactElement[] = [];
  items.push(<Path key={`${key}-s`} d={`M${p0[0]} ${p0[1]} Q ${p1[0]} ${p1[1]} ${p2[0]} ${p2[1]}`} stroke={stroke} strokeWidth={1.6} fill="none" strokeLinecap="round" />);
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    const x = (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0];
    const y = (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1];
    const dx = 2 * (1 - t) * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]);
    const dy = 2 * (1 - t) * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]);
    const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
    const side = i % 2 ? 48 : -48;
    const s = size * (0.75 + 0.35 * Math.sin(t * Math.PI));
    items.push(
      <Path key={`${key}-l${i}`} d={LEAF} fill={colors[i % colors.length]} transform={`translate(${x} ${y}) rotate(${ang + side}) scale(${s / 26})`} />,
    );
  }
  // uçta bir yaprak
  const ex = p2[0] - p1[0];
  const ey = p2[1] - p1[1];
  items.push(
    <Path key={`${key}-tip`} d={LEAF} fill={colors[0]} transform={`translate(${p2[0]} ${p2[1]}) rotate(${(Math.atan2(ey, ex) * 180) / Math.PI}) scale(${size / 26})`} />,
  );
  return items;
}

/** Sekiz köşeli yıldız (iki kare). */
function star8(cx: number, cy: number, r: number) {
  const pts: string[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (Math.PI / 8) * i - Math.PI / 2;
    const rr = i % 2 ? r * 0.72 : r;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)} ${(cy + rr * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join(' L')} Z`;
}

/** Dört köşeli parıltı. */
function sparkle(cx: number, cy: number, r: number) {
  const k = r * 0.22;
  return `M${cx} ${cy - r} Q ${cx + k} ${cy - k} ${cx + r} ${cy} Q ${cx + k} ${cy + k} ${cx} ${cy + r} Q ${cx - k} ${cy + k} ${cx - r} ${cy} Q ${cx - k} ${cy - k} ${cx} ${cy - r} Z`;
}

type Pt = [number, number];

/** İkinci dereceden eğride t noktası ve oradaki yön (derece). */
function qAt(p0: Pt, p1: Pt, p2: Pt, t: number): [number, number, number] {
  const u = 1 - t;
  const dx = 2 * u * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]);
  const dy = 2 * u * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]);
  return [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1], (Math.atan2(dy, dx) * 180) / Math.PI];
}

/** Yumuşak kenarlı, düzensiz leke (suluboya, mermer bulutu). */
function blob(cx: number, cy: number, r: number, seed: number, n = 9) {
  const rr = rng(seed);
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n;
    const k = 0.74 + rr() * 0.45;
    pts.push([cx + r * k * Math.cos(a), cy + r * k * 0.86 * Math.sin(a)]);
  }
  const mid = (a: Pt, b: Pt) => `${((a[0] + b[0]) / 2).toFixed(1)} ${((a[1] + b[1]) / 2).toFixed(1)}`;
  let d = `M${mid(pts[n - 1], pts[0])}`;
  for (let i = 0; i < n; i++) d += ` Q ${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)} ${mid(pts[i], pts[(i + 1) % n])}`;
  return `${d} Z`;
}

/** Kalp (merkez ve ölçek). */
function heart(cx: number, cy: number, s: number) {
  return `M${cx} ${cy + 9 * s} C ${cx - 14 * s} ${cy - 1 * s} ${cx - 11 * s} ${cy - 12 * s} ${cx - 5.5 * s} ${cy - 12 * s} C ${cx - 2 * s} ${cy - 12 * s} ${cx} ${cy - 9 * s} ${cx} ${cy - 7 * s} C ${cx} ${cy - 9 * s} ${cx + 2 * s} ${cy - 12 * s} ${cx + 5.5 * s} ${cy - 12 * s} C ${cx + 11 * s} ${cy - 12 * s} ${cx + 14 * s} ${cy - 1 * s} ${cx} ${cy + 9 * s} Z`;
}

/** Kar tanesi: altı kol ve uçlarda çatallar, tek yol. */
function snowflake(cx: number, cy: number, r: number) {
  let d = '';
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    d += `M${cx} ${cy} L${(cx + r * c).toFixed(1)} ${(cy + r * s).toFixed(1)} `;
    const bx = cx + r * 0.58 * c;
    const by = cy + r * 0.58 * s;
    for (const side of [-1, 1]) {
      const b = a + side * 0.7;
      d += `M${bx.toFixed(1)} ${by.toFixed(1)} L${(bx + r * 0.32 * Math.cos(b)).toFixed(1)} ${(by + r * 0.32 * Math.sin(b)).toFixed(1)} `;
    }
  }
  return d;
}

const MOTIFS: Record<InvitationTheme['motif'], Draw> = {
  // Büyük daire + kemer + küçük daire (ilk temaların görünümü)
  arch: (t) => (
    <G>
      <Circle cx={54} cy={40} r={110} fill={t.shapeA} />
      <Path d="M228 106 A52 52 0 0 1 332 106 V214 H228 Z" fill={t.shapeB} />
      <Circle cx={212} cy={154} r={28} fill={t.dark ? t.shapeC : '#FFFFFF'} opacity={t.dark ? 1 : 0.75} />
    </G>
  ),

  // Yapraklı dallar
  botanical: (t) => (
    <G>
      <Circle cx={312} cy={26} r={118} fill={t.shapeC} />
      <Circle cx={30} cy={236} r={70} fill={t.shapeC} opacity={0.7} />
      {branch('a', [-6, 214], [80, 170], [150, 54], 9, 26, t.palette, t.shapeA)}
      {branch('b', [370, 40], [300, 70], [250, 176], 8, 24, [...t.palette].reverse(), t.shapeA)}
      {branch('c', [40, 236], [110, 226], [168, 190], 5, 18, t.palette, t.shapeA)}
      <Circle cx={162} cy={46} r={5} fill={t.shapeB} />
      <Circle cx={172} cy={58} r={3.5} fill={t.shapeB} />
      <Circle cx={244} cy={186} r={4.5} fill={t.shapeB} />
    </G>
  ),

  // Klasik çerçeve: çift çizgili kemer pencere, süs elmasları
  frame: (t) => (
    <G>
      <Rect x={0} y={0} width={360} height={240} fill={t.shapeC} opacity={t.dark ? 1 : 0.6} />
      <Path d="M108 250 V128 A72 72 0 0 1 252 128 V250" fill={t.dark ? t.bg : '#FFFFFF'} opacity={t.dark ? 0.6 : 0.7} />
      <Path d="M108 250 V128 A72 72 0 0 1 252 128 V250" stroke={t.shapeB} strokeWidth={2} fill="none" />
      <Path d="M118 250 V130 A62 62 0 0 1 242 130 V250" stroke={t.shapeB} strokeWidth={0.9} fill="none" />
      <Path d="M180 40 l7 9 l-7 9 l-7 -9 Z" fill={t.shapeB} />
      <Line x1={40} y1={30} x2={150} y2={30} stroke={t.shapeB} strokeWidth={0.9} />
      <Line x1={210} y1={30} x2={320} y2={30} stroke={t.shapeB} strokeWidth={0.9} />
      <Path d="M26 30 l5 -5 l5 5 l-5 5 Z M324 30 l5 -5 l5 5 l-5 5 Z" fill={t.shapeB} />
      {branch('l', [62, 236], [58, 190], [96, 150], 5, 16, [t.shapeB, t.shapeA], t.shapeB)}
      {branch('r', [298, 236], [302, 190], [264, 150], 5, 16, [t.shapeB, t.shapeA], t.shapeB)}
      <Circle cx={180} cy={170} r={22} stroke={t.shapeB} strokeWidth={1.2} fill="none" />
      <Circle cx={180} cy={170} r={3} fill={t.shapeB} />
    </G>
  ),

  // Art deco yelpaze
  deco: (t) => {
    const rays: ReactElement[] = [];
    for (let a = 0; a <= 180; a += 10) {
      const r = (a * Math.PI) / 180;
      rays.push(<Line key={a} x1={180} y1={250} x2={180 - 170 * Math.cos(r)} y2={250 - 170 * Math.sin(r)} stroke={t.shapeB} strokeWidth={a % 30 ? 0.8 : 1.6} />);
    }
    const diamonds: ReactElement[] = [];
    for (let x = 18; x < 360; x += 36) diamonds.push(<Path key={x} d={`M${x} 22 l8 8 l-8 8 l-8 -8 Z`} fill={x % 72 === 18 ? t.shapeB : 'none'} stroke={t.shapeB} strokeWidth={1} />);
    return (
      <G>
        <Rect x={0} y={0} width={360} height={240} fill={t.shapeA} opacity={t.dark ? 0.55 : 0.18} />
        <Circle cx={180} cy={250} r={170} fill={t.shapeC} opacity={0.8} />
        {rays}
        <Path d="M60 250 A120 120 0 0 1 300 250" stroke={t.shapeB} strokeWidth={1.4} fill="none" />
        <Path d="M100 250 A80 80 0 0 1 260 250" stroke={t.shapeB} strokeWidth={1.4} fill="none" />
        <Circle cx={180} cy={250} r={44} fill={t.shapeB} />
        {diamonds}
        <Line x1={0} y1={52} x2={360} y2={52} stroke={t.shapeB} strokeWidth={0.8} />
      </G>
    );
  },

  // Konfeti
  confetti: (t) => {
    const r = rng(7);
    const items: ReactElement[] = [];
    for (let i = 0; i < 34; i++) {
      const x = r() * 360;
      const y = r() * 220 + 6;
      const c = t.palette[i % t.palette.length];
      const kind = i % 4;
      if (kind === 0) items.push(<Circle key={i} cx={x} cy={y} r={4 + r() * 6} fill={c} />);
      else if (kind === 1) items.push(<Rect key={i} x={x} y={y} width={7} height={16} rx={2} fill={c} transform={`rotate(${r() * 180} ${x + 3} ${y + 8})`} />);
      else if (kind === 2) items.push(<Path key={i} d={`M${x} ${y} q 6 -9 12 0 t 12 0 t 12 0`} stroke={c} strokeWidth={4} strokeLinecap="round" fill="none" transform={`rotate(${r() * 90 - 45} ${x} ${y})`} />);
      else items.push(<Path key={i} d={`M${x} ${y} l9 -15 l9 15 Z`} fill={c} transform={`rotate(${r() * 120} ${x + 9} ${y - 5})`} />);
    }
    return <G>{items}</G>;
  },

  // Dalgalar ve güneş
  waves: (t) => (
    <G>
      <Circle cx={268} cy={78} r={42} fill={t.shapeB} />
      <Path d="M0 150 C 60 128 120 172 180 150 S 300 128 360 150 V240 H0 Z" fill={t.shapeC} />
      <Path d="M0 176 C 60 154 120 198 180 176 S 300 154 360 176 V240 H0 Z" fill={t.palette[1] ?? t.shapeA} />
      <Path d="M0 204 C 60 184 120 224 180 204 S 300 184 360 204 V240 H0 Z" fill={t.shapeA} />
      <Path d="M54 70 q 8 -6 16 0 q 8 -6 16 0" stroke={t.ink} strokeWidth={1.6} fill="none" opacity={0.35} />
      <Path d="M100 50 q 6 -5 12 0 q 6 -5 12 0" stroke={t.ink} strokeWidth={1.4} fill="none" opacity={0.3} />
    </G>
  ),

  // Gece: hilal ve yıldızlar
  stars: (t) => {
    const r = rng(11);
    const dots: ReactElement[] = [];
    for (let i = 0; i < 40; i++) dots.push(<Circle key={i} cx={r() * 360} cy={r() * 170} r={0.8 + r() * 1.6} fill={t.ink} opacity={0.35 + r() * 0.5} />);
    return (
      <G>
        <Circle cx={60} cy={260} r={150} fill={t.shapeC} />
        <Circle cx={330} cy={300} r={170} fill={t.shapeA} opacity={0.35} />
        {dots}
        <Circle cx={262} cy={76} r={40} fill={t.shapeB} />
        <Circle cx={280} cy={64} r={36} fill={t.bg} />
        <Path d={sparkle(118, 64, 12)} fill={t.shapeB} />
        <Path d={sparkle(200, 132, 8)} fill={t.shapeB} />
        <Path d={sparkle(48, 112, 7)} fill={t.ink} opacity={0.8} />
        <Path d={sparkle(312, 160, 6)} fill={t.ink} opacity={0.7} />
      </G>
    );
  },

  // Güneş ışınları
  sun: (t) => {
    const rays: ReactElement[] = [];
    for (let i = 0; i < 14; i++) {
      const a0 = Math.PI + (Math.PI / 14) * i;
      const a1 = a0 + Math.PI / 28;
      const R = 420;
      rays.push(
        <Path key={i} d={`M180 240 L ${180 + R * Math.cos(a0)} ${240 + R * Math.sin(a0)} L ${180 + R * Math.cos(a1)} ${240 + R * Math.sin(a1)} Z`} fill={t.shapeC} />,
      );
    }
    return (
      <G>
        {rays}
        <Circle cx={180} cy={240} r={92} fill={t.shapeA} />
        <Circle cx={180} cy={240} r={62} fill={t.shapeB} opacity={0.85} />
        <Circle cx={60} cy={60} r={6} fill={t.shapeB} />
        <Circle cx={300} cy={44} r={4} fill={t.shapeB} />
      </G>
    );
  },

  // Gökkuşağı yayları
  rainbow: (t) => {
    const arcs = t.palette.map((c, i) => {
      const R = 190 - i * 30;
      return <Path key={c + i} d={`M${130 - R} 250 A${R} ${R} 0 0 1 ${130 + R} 250`} stroke={c} strokeWidth={24} fill="none" strokeLinecap="round" />;
    });
    return (
      <G>
        {arcs}
        <Circle cx={300} cy={60} r={30} fill={t.palette[2] ?? t.shapeC} />
        <Ellipse cx={270} cy={140} rx={34} ry={14} fill="#FFFFFF" />
        <Ellipse cx={292} cy={130} rx={24} ry={14} fill="#FFFFFF" />
      </G>
    );
  },

  // Gül yaprakları
  petals: (t) => {
    const flower = (cx: number, cy: number, s: number, k: string) => {
      const ps: ReactElement[] = [];
      for (let i = 0; i < 6; i++) {
        ps.push(<Ellipse key={`${k}${i}`} cx={cx + 26 * s} cy={cy} rx={28 * s} ry={15 * s} fill={i % 2 ? t.shapeA : t.shapeB} opacity={0.9} transform={`rotate(${i * 60} ${cx} ${cy})`} />);
      }
      ps.push(<Circle key={`${k}c`} cx={cx} cy={cy} r={11 * s} fill={t.shapeC} />);
      ps.push(<Circle key={`${k}d`} cx={cx} cy={cy} r={5 * s} fill={t.shapeB} />);
      return ps;
    };
    const r = rng(3);
    const loose: ReactElement[] = [];
    for (let i = 0; i < 9; i++) {
      const x = 40 + r() * 280;
      const y = 40 + r() * 170;
      loose.push(<Ellipse key={i} cx={x} cy={y} rx={9} ry={5} fill={i % 2 ? t.shapeA : t.shapeB} opacity={0.75} transform={`rotate(${r() * 180} ${x} ${y})`} />);
    }
    return (
      <G>
        <Circle cx={300} cy={40} r={110} fill={t.shapeC} />
        {flower(296, 58, 1.25, 'a')}
        {flower(64, 196, 0.85, 'b')}
        {loose}
      </G>
    );
  },

  // Osmanlı: sekiz köşeli yıldızlar ve lale
  ottoman: (t) => {
    const stars: ReactElement[] = [];
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 8; col++) {
        const cx = 24 + col * 46 + (row % 2) * 23;
        const cy = 22 + row * 40;
        stars.push(<Path key={`${row}-${col}`} d={star8(cx, cy, 14)} fill="none" stroke={t.shapeB} strokeWidth={1.2} opacity={0.9} />);
      }
    }
    return (
      <G>
        <Rect x={0} y={0} width={360} height={118} fill={t.shapeA} />
        {stars}
        <Path d="M0 118 Q 30 140 60 118 T 120 118 T 180 118 T 240 118 T 300 118 T 360 118 V124 H0 Z" fill={t.shapeA} />
        <Path d={star8(290, 176, 34)} fill={t.shapeC} stroke={t.shapeB} strokeWidth={1.5} />
        <Path d={star8(290, 176, 18)} fill={t.shapeA} />
        {/* lale */}
        <Path d="M74 230 C 74 200 72 186 74 170" stroke={t.shapeA} strokeWidth={2.4} fill="none" />
        <Path d="M74 172 C 58 166 52 146 58 132 C 64 142 70 144 74 136 C 78 144 84 142 90 132 C 96 146 90 166 74 172 Z" fill={t.shapeA} />
        <Path d="M74 206 C 62 202 56 192 54 184 C 64 186 72 194 74 206 Z" fill={t.shapeB} />
        <Path d="M76 214 C 88 210 94 200 96 192 C 86 194 78 202 76 214 Z" fill={t.shapeB} />
      </G>
    );
  },

  // Sade: ince yay ve küçük daire
  minimal: (t) => (
    <G>
      <Path d="M-10 210 C 90 120 220 230 370 70" stroke={t.shapeB} strokeWidth={1.4} fill="none" />
      <Path d="M-10 222 C 96 138 226 244 370 86" stroke={t.shapeA} strokeWidth={1} fill="none" />
      <Circle cx={292} cy={66} r={22} fill={t.shapeC} />
      <Circle cx={292} cy={66} r={4} fill={t.shapeB} />
    </G>
  ),

  // Halı saha
  pitch: (t) => {
    const stripes: ReactElement[] = [];
    for (let i = 0; i < 9; i++) stripes.push(<Rect key={i} x={i * 40} y={0} width={40} height={240} fill={i % 2 ? t.shapeA : t.shapeB} />);
    const W = 'rgba(255,255,255,0.85)';
    return (
      <G>
        {stripes}
        <Rect x={14} y={14} width={332} height={212} stroke={W} strokeWidth={2.4} fill="none" />
        <Line x1={180} y1={14} x2={180} y2={226} stroke={W} strokeWidth={2.4} />
        <Circle cx={180} cy={120} r={38} stroke={W} strokeWidth={2.4} fill="none" />
        <Circle cx={180} cy={120} r={4} fill={W} />
        <Rect x={14} y={70} width={44} height={100} stroke={W} strokeWidth={2.4} fill="none" />
        <Rect x={302} y={70} width={44} height={100} stroke={W} strokeWidth={2.4} fill="none" />
        <Circle cx={236} cy={150} r={11} fill="#FFFFFF" />
        <Path d="M236 144 l5 3.5 l-2 6 h-6 l-2 -6 Z" fill="#2A2A2A" />
      </G>
    );
  },

  // Basketbol sahası (parke): derzler, çizgiler, pota ve top
  court: (t) => {
    const planks: ReactElement[] = [];
    for (let i = 0; i < 18; i++) planks.push(<Rect key={i} x={i * 20} y={0} width={20} height={240} fill={i % 2 ? t.shapeA : t.shapeB} />);
    const L = 'rgba(255,255,255,0.9)';
    const sw = 2.4;
    return (
      <G>
        {planks}
        <Rect x={14} y={14} width={332} height={212} stroke={L} strokeWidth={sw} fill="none" />
        <Line x1={180} y1={14} x2={180} y2={226} stroke={L} strokeWidth={sw} />
        <Circle cx={180} cy={120} r={30} stroke={L} strokeWidth={sw} fill="none" />
        <Rect x={14} y={88} width={72} height={64} stroke={L} strokeWidth={sw} fill="rgba(255,255,255,0.14)" />
        <Rect x={274} y={88} width={72} height={64} stroke={L} strokeWidth={sw} fill="rgba(255,255,255,0.14)" />
        <Path d="M86 92 A28 28 0 0 1 86 148" stroke={L} strokeWidth={sw} fill="none" />
        <Path d="M274 92 A28 28 0 0 0 274 148" stroke={L} strokeWidth={sw} fill="none" />
        <Path d="M14 34 H44 A92 92 0 0 1 44 206 H14" stroke={L} strokeWidth={sw} fill="none" />
        <Path d="M346 34 H316 A92 92 0 0 0 316 206 H346" stroke={L} strokeWidth={sw} fill="none" />
        <Line x1={22} y1={108} x2={22} y2={132} stroke={L} strokeWidth={3} />
        <Circle cx={29} cy={120} r={6} stroke={t.palette[0]} strokeWidth={2.4} fill="none" />
        <Circle cx={238} cy={156} r={15} fill={t.palette[0]} />
        <Path d="M223 156 H253 M238 141 V171 M227.5 145.5 C233 151 233 161 227.5 166.5 M248.5 145.5 C243 151 243 161 248.5 166.5" stroke="#3A2414" strokeWidth={1.4} fill="none" />
      </G>
    );
  },

  // Voleybol sahası: zemin, hücum çizgileri, file ve top
  net: (t) => {
    const L = 'rgba(255,255,255,0.9)';
    const sw = 2.4;
    const mesh: ReactElement[] = [];
    for (let y = 10; y <= 230; y += 10) mesh.push(<Line key={`h${y}`} x1={172} y1={y} x2={188} y2={y} stroke="#FFFFFF" strokeWidth={0.8} opacity={0.75} />);
    for (let x = 172; x <= 188; x += 8) mesh.push(<Line key={`v${x}`} x1={x} y1={6} x2={x} y2={234} stroke="#FFFFFF" strokeWidth={0.8} opacity={0.75} />);
    return (
      <G>
        <Rect x={0} y={0} width={360} height={240} fill={t.shapeB} />
        <Rect x={30} y={22} width={300} height={196} fill={t.shapeA} />
        <Rect x={30} y={22} width={300} height={196} stroke={L} strokeWidth={sw} fill="none" />
        <Line x1={120} y1={22} x2={120} y2={218} stroke={L} strokeWidth={sw} />
        <Line x1={240} y1={22} x2={240} y2={218} stroke={L} strokeWidth={sw} />
        <Rect x={172} y={6} width={16} height={228} fill="rgba(20,38,61,0.35)" />
        {mesh}
        <Rect x={170} y={4} width={20} height={6} rx={2} fill="#FFFFFF" />
        <Circle cx={180} cy={4} r={4} fill={t.palette[0]} />
        <Circle cx={180} cy={236} r={4} fill={t.palette[0]} />
        <Circle cx={262} cy={78} r={16} fill="#FFFFFF" />
        <Path d="M262 62 C255 72 255 84 262 94 M246.5 74 C256 76 266 74 277 69 M250 89 C258 84 268 84 276 88" stroke={t.palette[0]} strokeWidth={3} fill="none" />
        <Circle cx={262} cy={78} r={16} stroke="#1F5598" strokeWidth={1.4} fill="none" />
      </G>
    );
  },

  // Kiraz çiçeği dalı
  sakura: (t) => {
    const blossom = (cx: number, cy: number, s: number, k: string, c: string) => {
      const ps: ReactElement[] = [];
      for (let i = 0; i < 5; i++) {
        ps.push(<Ellipse key={`${k}${i}`} cx={cx} cy={cy - 9 * s} rx={6 * s} ry={9 * s} fill={c} transform={`rotate(${i * 72} ${cx} ${cy})`} />);
      }
      ps.push(<Circle key={`${k}c`} cx={cx} cy={cy} r={3 * s} fill={t.shapeB} />);
      return ps;
    };
    const r = rng(19);
    const loose: ReactElement[] = [];
    for (let i = 0; i < 10; i++) {
      const x = 20 + r() * 320;
      const y = 30 + r() * 190;
      loose.push(<Ellipse key={`l${i}`} cx={x} cy={y} rx={5} ry={3} fill={i % 2 ? t.shapeA : t.shapeB} opacity={0.7} transform={`rotate(${r() * 180} ${x} ${y})`} />);
    }
    return (
      <G>
        <Circle cx={70} cy={60} r={90} fill={t.shapeC} />
        <Path d="M370 18 C 300 30 250 60 200 70 S 120 90 80 130" stroke="#7A5560" strokeWidth={4} fill="none" strokeLinecap="round" />
        <Path d="M260 52 C 250 80 236 96 214 110" stroke="#7A5560" strokeWidth={2.6} fill="none" strokeLinecap="round" />
        <Path d="M160 82 C 150 66 150 50 158 36" stroke="#7A5560" strokeWidth={2.2} fill="none" strokeLinecap="round" />
        {blossom(300, 34, 1.3, 'a', t.shapeA)}
        {blossom(232, 64, 1.1, 'b', t.shapeB)}
        {blossom(214, 110, 1.2, 'c', t.shapeA)}
        {blossom(158, 36, 1, 'd', t.shapeB)}
        {blossom(120, 102, 1.25, 'e', t.shapeA)}
        {blossom(84, 130, 0.9, 'f', t.shapeB)}
        {loose}
      </G>
    );
  },

  // Laleler
  tulips: (t) => {
    const tulip = (x: number, base: number, h: number, s: number, c: string, k: string) => (
      <G key={k}>
        <Path d={`M${x} ${base} C ${x - 4} ${base - h * 0.4} ${x + 4} ${base - h * 0.7} ${x} ${base - h}`} stroke={t.shapeB} strokeWidth={2.6} fill="none" />
        <Path d={`M${x} ${base - h * 0.35} C ${x - 22 * s} ${base - h * 0.45} ${x - 26 * s} ${base - h * 0.75} ${x - 20 * s} ${base - h * 0.85} C ${x - 12 * s} ${base - h * 0.62} ${x - 6 * s} ${base - h * 0.5} ${x} ${base - h * 0.35} Z`} fill={t.shapeB} />
        <Path
          d={`M${x} ${base - h + 2} C ${x - 18 * s} ${base - h - 2} ${x - 20 * s} ${base - h - 26 * s} ${x - 14 * s} ${base - h - 40 * s} C ${x - 8 * s} ${base - h - 30 * s} ${x - 4 * s} ${base - h - 30 * s} ${x} ${base - h - 42 * s} C ${x + 4 * s} ${base - h - 30 * s} ${x + 8 * s} ${base - h - 30 * s} ${x + 14 * s} ${base - h - 40 * s} C ${x + 20 * s} ${base - h - 26 * s} ${x + 18 * s} ${base - h - 2} ${x} ${base - h + 2} Z`}
          fill={c}
        />
      </G>
    );
    return (
      <G>
        <Circle cx={300} cy={70} r={100} fill={t.shapeC} />
        <Path d={star8(300, 70, 30)} fill="none" stroke={t.palette[1]} strokeWidth={1.4} opacity={0.8} />
        {tulip(250, 250, 110, 1.15, t.shapeA, 'a')}
        {tulip(296, 250, 140, 1.3, t.palette[1], 'b')}
        {tulip(340, 250, 96, 1, t.shapeA, 'c')}
        {tulip(40, 250, 80, 0.9, t.shapeA, 'd')}
      </G>
    );
  },

  // Şehzade: taç, yıldızlar ve kemer
  crown: (t) => {
    const r = rng(23);
    const dots: ReactElement[] = [];
    for (let i = 0; i < 16; i++) dots.push(<Path key={i} d={sparkle(20 + r() * 320, 14 + r() * 120, 3 + r() * 5)} fill={t.shapeB} opacity={0.85} />);
    return (
      <G>
        <Rect x={0} y={0} width={360} height={240} fill={t.shapeC} />
        <Path d="M60 240 V140 C 60 70 120 30 180 30 C 240 30 300 70 300 140 V240 Z" fill={t.bg} />
        <Path d="M74 240 V142 C 74 80 128 44 180 44 C 232 44 286 80 286 142 V240" stroke={t.shapeB} strokeWidth={2} fill="none" />
        {dots}
        {/* taç */}
        <Path d="M128 162 L 136 112 L 158 136 L 180 98 L 202 136 L 224 112 L 232 162 Z" fill={t.shapeB} />
        <Rect x={126} y={160} width={108} height={14} rx={4} fill={t.shapeA} />
        <Circle cx={136} cy={110} r={6} fill={t.shapeA} />
        <Circle cx={180} cy={95} r={7} fill={t.shapeA} />
        <Circle cx={224} cy={110} r={6} fill={t.shapeA} />
        <Circle cx={180} cy={146} r={6} fill={t.shapeC} />
        <Path d={star8(180, 210, 16)} fill={t.shapeA} opacity={0.9} />
      </G>
    );
  },

  // Geometrik desen (sekiz köşeli yıldız örgüsü) ve hilal
  geometric: (t) => {
    const tiles: ReactElement[] = [];
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 9; col++) {
        const cx = 20 + col * 42;
        const cy = 20 + row * 42;
        tiles.push(<Path key={`${row}-${col}`} d={star8(cx, cy, 15)} fill="none" stroke={t.shapeA} strokeWidth={1} opacity={0.35} />);
        tiles.push(<Rect key={`r${row}-${col}`} x={cx + 15} y={cy + 15} width={12} height={12} fill="none" stroke={t.shapeB} strokeWidth={0.8} opacity={0.45} transform={`rotate(45 ${cx + 21} ${cy + 21})`} />);
      }
    }
    return (
      <G>
        {tiles}
        <Circle cx={180} cy={112} r={70} fill={t.bg} />
        <Circle cx={180} cy={112} r={70} fill="none" stroke={t.shapeB} strokeWidth={2} />
        <Circle cx={180} cy={112} r={62} fill="none" stroke={t.shapeA} strokeWidth={1} />
        <Path d="M196 72 A 42 42 0 1 0 196 152 A 34 34 0 1 1 196 72 Z" fill={t.shapeA} />
        <Path d={sparkle(214, 100, 10)} fill={t.shapeB} />
      </G>
    );
  },

  // Bulutlar, yıldızlar ve ay (bebek)
  clouds: (t) => {
    const cloud = (x: number, y: number, s: number, c: string, k: string) => (
      <G key={k}>
        <Ellipse cx={x} cy={y} rx={46 * s} ry={22 * s} fill={c} />
        <Circle cx={x - 22 * s} cy={y - 10 * s} r={20 * s} fill={c} />
        <Circle cx={x + 8 * s} cy={y - 20 * s} r={26 * s} fill={c} />
        <Circle cx={x + 30 * s} cy={y - 6 * s} r={16 * s} fill={c} />
      </G>
    );
    const r = rng(29);
    const stars: ReactElement[] = [];
    for (let i = 0; i < 10; i++) stars.push(<Path key={i} d={sparkle(20 + r() * 320, 16 + r() * 110, 3 + r() * 4)} fill={t.shapeB} />);
    return (
      <G>
        <Rect x={0} y={0} width={360} height={240} fill={t.shapeA} />
        {stars}
        <Path d="M300 40 A 26 26 0 1 0 312 88 A 20 20 0 1 1 300 40 Z" fill={t.shapeB} />
        {cloud(80, 200, 1.4, t.shapeC, 'a')}
        {cloud(250, 214, 1.7, t.shapeC, 'b')}
        {cloud(170, 120, 0.8, t.bg, 'c')}
        {/* çıngırak */}
        <Circle cx={176} cy={176} r={16} fill={t.palette[2] ?? t.shapeB} />
        <Rect x={173} y={190} width={6} height={30} rx={3} fill={t.palette[2] ?? t.shapeB} />
        <Circle cx={176} cy={176} r={6} fill={t.shapeC} />
      </G>
    );
  },

  // Mezuniyet kepleri ve konfeti
  caps: (t) => {
    const cap = (x: number, y: number, s: number, rot: number, k: string) => (
      <G key={k} transform={`rotate(${rot} ${x} ${y})`}>
        <Path d={`M${x - 40 * s} ${y} L ${x} ${y - 18 * s} L ${x + 40 * s} ${y} L ${x} ${y + 18 * s} Z`} fill={t.shapeA} />
        <Path d={`M${x - 22 * s} ${y + 9 * s} V ${y + 26 * s} C ${x - 10 * s} ${y + 34 * s} ${x + 10 * s} ${y + 34 * s} ${x + 22 * s} ${y + 26 * s} V ${y + 9 * s}`} fill={t.shapeA} />
        <Path d={`M${x} ${y} L ${x + 30 * s} ${y + 10 * s} V ${y + 32 * s}`} stroke={t.shapeB} strokeWidth={2} fill="none" />
        <Rect x={x + 26 * s} y={y + 30 * s} width={8 * s} height={12 * s} rx={2} fill={t.shapeB} />
      </G>
    );
    const r = rng(31);
    const bits: ReactElement[] = [];
    for (let i = 0; i < 26; i++) {
      const x = r() * 360;
      const y = r() * 240;
      bits.push(<Rect key={i} x={x} y={y} width={6} height={10} rx={1.5} fill={t.palette[i % t.palette.length]} opacity={0.85} transform={`rotate(${r() * 180} ${x} ${y})`} />);
    }
    return (
      <G>
        <Circle cx={180} cy={120} r={92} fill={t.shapeC} />
        {bits}
        {cap(150, 110, 1.3, -14, 'a')}
        {cap(250, 70, 0.8, 18, 'b')}
        {cap(80, 60, 0.7, -24, 'c')}
      </G>
    );
  },

  // Disko topu ve şampanya (bekârlığa veda)
  disco: (t) => {
    const tiles: ReactElement[] = [];
    for (let i = -4; i <= 4; i++) {
      for (let j = -4; j <= 4; j++) {
        if (i * i + j * j > 18) continue;
        tiles.push(<Rect key={`${i}${j}`} x={250 + i * 10 - 4.5} y={80 + j * 10 - 4.5} width={9} height={9} fill={(i + j) % 3 === 0 ? t.shapeB : (i + j) % 2 ? t.shapeA : '#E9DFF7'} opacity={0.95} />);
      }
    }
    const r = rng(37);
    const glints: ReactElement[] = [];
    for (let i = 0; i < 18; i++) glints.push(<Path key={i} d={sparkle(r() * 360, r() * 240, 2 + r() * 6)} fill={i % 2 ? t.shapeB : t.palette[2]} opacity={0.9} />);
    return (
      <G>
        <Line x1={250} y1={0} x2={250} y2={38} stroke={t.soft} strokeWidth={1.5} />
        <Circle cx={250} cy={80} r={44} fill={t.shapeC} />
        {tiles}
        {glints}
        {/* kadehler */}
        <Path d="M70 120 L 100 120 L 92 160 C 90 168 80 168 78 160 Z" fill="none" stroke={t.shapeB} strokeWidth={2.4} />
        <Line x1={85} y1={166} x2={85} y2={206} stroke={t.shapeB} strokeWidth={2.4} />
        <Line x1={70} y1={206} x2={100} y2={206} stroke={t.shapeB} strokeWidth={2.4} />
        <Path d="M112 112 L 142 116 L 129 154 C 126 162 116 160 116 152 Z" fill="none" stroke={t.shapeA} strokeWidth={2.4} />
        <Line x1={122} y1={160} x2={118} y2={200} stroke={t.shapeA} strokeWidth={2.4} />
        <Line x1={104} y1={198} x2={132} y2={202} stroke={t.shapeA} strokeWidth={2.4} />
        <Circle cx={88} cy={104} r={3} fill={t.shapeB} />
        <Circle cx={98} cy={92} r={2} fill={t.shapeB} />
        <Circle cx={124} cy={96} r={2.5} fill={t.shapeA} />
      </G>
    );
  },

  // Balonlar
  // Lüks: siyah zeminde altın art deco (çift çerçeve, ışın yelpazesi, basamaklı köşeler)
  luxe: (t) => {
    const rays: ReactElement[] = [];
    for (let i = -9; i <= 9; i++) rays.push(<Line key={i} x1={180} y1={-30} x2={180 + i * 24} y2={150} stroke={t.shapeB} strokeWidth={i % 3 ? 0.5 : 1.1} opacity={0.75} />);
    const corner = (sx: number, sy: number, k: string) => (
      <Path key={k} d={`M${sx} ${sy + 46 * Math.sign(120 - sy)} V${sy + 24 * Math.sign(120 - sy)} H${sx + 24 * Math.sign(180 - sx)} V${sy} H${sx + 46 * Math.sign(180 - sx)}`} stroke={t.shapeB} strokeWidth={1.4} fill="none" />
    );
    return (
      <G>
        <Rect x={0} y={0} width={360} height={240} fill={t.shapeC} />
        {rays}
        <Rect x={0} y={150} width={360} height={90} fill={t.bg} />
        <Line x1={30} y1={150} x2={330} y2={150} stroke={t.shapeB} strokeWidth={1.2} />
        <Path d="M110 150 L180 104 L250 150" stroke={t.shapeB} strokeWidth={1.4} fill="none" />
        <Path d="M136 150 L180 121 L224 150" stroke={t.shapeB} strokeWidth={1.1} fill="none" />
        <Path d={`M180 150 l-9 -14 l9 -14 l9 14 Z`} fill={t.shapeB} />
        <Rect x={12} y={12} width={336} height={216} fill="none" stroke={t.shapeB} strokeWidth={1.2} />
        <Rect x={18} y={18} width={324} height={204} fill="none" stroke={t.shapeB} strokeWidth={0.5} />
        {corner(18, 18, 'a')}
        {corner(342, 18, 'b')}
        {corner(18, 222, 'c')}
        {corner(342, 222, 'd')}
      </G>
    );
  },

  // Osmanlı: üstte rumi kenar bordürü, ortada şemse (madalyon)
  rumi: (t) => {
    const scallops: ReactElement[] = [];
    for (let x = 0; x < 360; x += 30) {
      scallops.push(<Path key={x} d={`M${x} 34 Q ${x + 15} 62 ${x + 30} 34 Z`} fill={t.shapeA} />);
      scallops.push(<Circle key={`d${x}`} cx={x + 15} cy={44} r={2.6} fill={t.shapeB} />);
      scallops.push(<Path key={`l${x}`} d={`M${x + 4} 17 C ${x + 10} 6 ${x + 20} 6 ${x + 26} 17 C ${x + 20} 28 ${x + 10} 28 ${x + 4} 17 Z`} fill="none" stroke={t.shapeB} strokeWidth={1} />);
    }
    const tips = [0, 90, 180, 270].map((a) => (
      <Path key={a} d="M180 66 L172 80 L188 80 Z" fill={t.shapeB} transform={`rotate(${a} 180 130)`} />
    ));
    return (
      <G>
        <Rect x={0} y={0} width={360} height={34} fill={t.shapeA} />
        {scallops}
        {tips}
        <Ellipse cx={180} cy={130} rx={66} ry={50} fill={t.shapeC} stroke={t.shapeB} strokeWidth={2} />
        <Ellipse cx={180} cy={130} rx={56} ry={41} fill="none" stroke={t.shapeA} strokeWidth={1} />
        <Path d={star8(180, 130, 26)} fill={t.shapeA} />
        <Path d={star8(180, 130, 13)} fill={t.shapeB} />
        <Path d="M40 236 C 40 200 60 186 78 192 C 64 200 58 214 60 236 Z" fill={t.shapeA} opacity={0.85} />
        <Path d="M320 236 C 320 200 300 186 282 192 C 296 200 302 214 300 236 Z" fill={t.shapeA} opacity={0.85} />
      </G>
    );
  },

  // Çini: İznik karoları, her karoda çiçek rozeti
  tiles: (t) => {
    const items: ReactElement[] = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) {
        const x = c * 90;
        const y = r * 80;
        const cx = x + 45;
        const cy = y + 40;
        items.push(<Rect key={`t${r}${c}`} x={x} y={y} width={90} height={80} fill={t.shapeC} stroke={t.shapeA} strokeWidth={1.2} />);
        for (const [qx, qy, a] of [[x, y, 0], [x + 90, y, 90], [x + 90, y + 80, 180], [x, y + 80, 270]] as const) {
          items.push(<Circle key={`k${r}${c}${a}`} cx={qx} cy={qy} r={14} fill={t.shapeA} opacity={0.55} />);
        }
        for (let k = 0; k < 8; k++) {
          items.push(<Ellipse key={`p${r}${c}${k}`} cx={cx} cy={cy - 13} rx={5.5} ry={12} fill={k % 2 ? t.shapeB : t.shapeA} opacity={0.9} transform={`rotate(${k * 45} ${cx} ${cy})`} />);
        }
        items.push(<Circle key={`m${r}${c}`} cx={cx} cy={cy} r={6} fill={t.palette[2] ?? t.shapeB} />);
      }
    }
    return <G>{items}</G>;
  },

  balloons: (t) => {
    const b = (cx: number, cy: number, c: string, k: string, s = 1) => (
      <G key={k}>
        <Path d={`M${cx} ${cy + 34 * s} C ${cx - 10} ${cy + 70 * s} ${cx + 12} ${cy + 96 * s} ${cx - 4} ${cy + 150 * s}`} stroke={t.soft} strokeWidth={1.2} fill="none" opacity={0.6} />
        <Ellipse cx={cx} cy={cy} rx={26 * s} ry={32 * s} fill={c} />
        <Path d={`M${cx - 5} ${cy + 36 * s} L ${cx + 5} ${cy + 36 * s} L ${cx} ${cy + 30 * s} Z`} fill={c} />
        <Ellipse cx={cx - 9 * s} cy={cy - 12 * s} rx={5 * s} ry={9 * s} fill="#FFFFFF" opacity={0.45} transform={`rotate(25 ${cx - 9 * s} ${cy - 12 * s})`} />
      </G>
    );
    const r = rng(5);
    const dots: ReactElement[] = [];
    for (let i = 0; i < 14; i++) dots.push(<Circle key={i} cx={r() * 360} cy={r() * 230} r={2 + r() * 3} fill={t.palette[i % t.palette.length]} opacity={0.8} />);
    return (
      <G>
        {dots}
        {b(250, 70, t.palette[0], 'a', 1.1)}
        {b(304, 104, t.palette[1], 'b', 0.95)}
        {b(206, 116, t.palette[3] ?? t.shapeC, 'c', 0.85)}
        {b(60, 150, t.palette[2] ?? t.shapeB, 'd', 0.7)}
      </G>
    );
  },

  // Suluboya: üst üste binen saydam lekeler
  watercolor: (t) => {
    const spots: [number, number, number, number][] = [[300, 46, 92, 0], [214, 96, 58, 1], [336, 168, 66, 2], [52, 34, 66, 1], [148, 22, 38, 3], [258, 214, 40, 0]];
    const items: ReactElement[] = [];
    spots.forEach(([cx, cy, r, c], i) => {
      const col = t.palette[c % t.palette.length];
      // dış leke ve koyulaşan kenarı, içte giderek küçülen katmanlar (boya birikmesi)
      items.push(<Path key={`a${i}`} d={blob(cx, cy, r, 11 + i, 11)} fill={col} opacity={0.3} stroke={col} strokeWidth={1.6} strokeOpacity={0.9} />);
      items.push(<Path key={`b${i}`} d={blob(cx + 6, cy - 5, r * 0.8, 41 + i, 10)} fill={t.palette[(c + 1) % t.palette.length]} opacity={0.3} />);
      items.push(<Path key={`c${i}`} d={blob(cx - 4, cy + 3, r * 0.6, 71 + i)} fill={col} opacity={0.32} />);
      items.push(<Path key={`e${i}`} d={blob(cx + 3, cy + 6, r * 0.36, 91 + i, 7)} fill={t.palette[(c + 2) % t.palette.length]} opacity={0.35} />);
    });
    const r = rng(43);
    for (let i = 0; i < 16; i++) {
      const x = 120 + r() * 240;
      const y = r() * 200;
      items.push(<Circle key={`d${i}`} cx={x} cy={y} r={1 + r() * 3} fill={t.palette[i % 2]} opacity={0.55} />);
    }
    return (
      <G>
        {items}
        <G opacity={0.55}>{branch('w', [250, 150], [236, 110], [262, 70], 5, 15, [t.soft, t.key_], t.soft)}</G>
      </G>
    );
  },

  // Boho: gökkuşağı yayları, pampas otları ve kuru yapraklar
  boho: (t) => {
    const plume = (k: string, p0: Pt, p1: Pt, p2: Pt, len: number, c: string) => {
      // tüylü salkım: gövdeden kıvrılarak çıkan, boyu ve açısı değişen ince teller
      const r = rng(k.length * 97 + len);
      let d = '';
      for (let i = 0; i < 56; i++) {
        const tt = 0.34 + (0.66 * i) / 56;
        const [x, y, a] = qAt(p0, p1, p2, tt);
        const l = len * (0.55 + 0.6 * r()) * Math.pow(Math.sin(tt * Math.PI * 0.98), 0.6);
        const side = i % 2 ? 1 : -1;
        const b = ((a + side * (14 + r() * 26)) * Math.PI) / 180;
        const bend = ((a + side * 4) * Math.PI) / 180;
        d += `M${x.toFixed(1)} ${y.toFixed(1)} q${(l * 0.5 * Math.cos(b)).toFixed(1)} ${(l * 0.5 * Math.sin(b)).toFixed(1)} ${(l * Math.cos((b + bend) / 2)).toFixed(1)} ${(l * Math.sin((b + bend) / 2)).toFixed(1)} `;
      }
      return (
        <G key={k}>
          <Path d={`M${p0[0]} ${p0[1]} Q ${p1[0]} ${p1[1]} ${p2[0]} ${p2[1]}`} stroke={t.palette[3]} strokeWidth={1.4} fill="none" />
          <Path d={d} stroke={c} strokeWidth={1.4} strokeLinecap="round" fill="none" opacity={0.85} />
        </G>
      );
    };
    const arcs = [104, 80, 56].map((R, i) => (
      <Path key={R} d={`M${262 - R} 250 A${R} ${R} 0 0 1 ${262 + R} 250`} stroke={t.palette[i]} strokeWidth={20} fill="none" />
    ));
    return (
      <G>
        <Circle cx={60} cy={30} r={86} fill={t.shapeC} />
        {arcs}
        <Circle cx={262} cy={250} r={34} fill={t.palette[3]} />
        {plume('p1', [210, 250], [196, 150], [150, 58], 28, t.palette[2])}
        {plume('p2', [222, 250], [236, 140], [226, 40], 30, t.palette[1])}
        {plume('p3', [234, 250], [290, 160], [326, 70], 26, t.palette[2])}
        {branch('l', [-6, 120], [40, 60], [118, 30], 6, 18, [t.palette[0], t.palette[3]], t.palette[3])}
        <Circle cx={150} cy={130} r={4} fill={t.palette[0]} />
        <Circle cx={330} cy={30} r={6} fill={t.palette[0]} />
      </G>
    );
  },

  // Mermer: gri damarlar, bulutlar ve ince altın çizgiler
  marble: (t) => {
    const vein = (k: string, x0: number, y0: number, x1: number, y1: number, seed: number, w: number, c: string, o: number) => {
      const r = rng(seed);
      const n = 7;
      let d = `M${x0} ${y0}`;
      for (let i = 1; i <= n; i++) {
        const x = x0 + ((x1 - x0) * i) / n;
        const y = y0 + ((y1 - y0) * i) / n;
        d += ` Q ${(x - (x1 - x0) / n / 2 + (r() - 0.5) * 30).toFixed(1)} ${(y - (y1 - y0) / n / 2 + (r() - 0.5) * 34).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
      }
      return <Path key={k} d={d} stroke={c} strokeWidth={w} fill="none" opacity={o} strokeLinecap="round" />;
    };
    return (
      <G>
        <Path d={blob(290, 60, 110, 5)} fill={t.shapeC} opacity={0.9} />
        <Path d={blob(80, 150, 90, 9)} fill={t.shapeC} opacity={0.6} />
        {vein('g1', -10, 40, 370, 210, 3, 4, t.shapeA, 0.25)}
        {vein('g2', -10, 46, 370, 214, 3, 1.6, t.palette[1], 0.8)}
        {vein('g3', 120, -10, 380, 120, 8, 2.6, t.shapeA, 0.3)}
        {vein('g4', 120, -10, 380, 120, 8, 1, t.palette[1], 0.9)}
        {vein('g5', 200, 250, 360, 150, 12, 1.2, t.shapeA, 0.6)}
        {vein('g7', 60, -10, 250, 120, 31, 0.7, t.shapeA, 0.8)}
        {vein('g8', 260, -10, 300, 250, 33, 0.6, t.shapeA, 0.7)}
        {vein('g6', -10, 120, 160, -10, 14, 1, t.shapeA, 0.7)}
        {vein('a1', 140, -10, 370, 90, 21, 1.2, t.shapeB, 0.95)}
        {vein('a2', 230, 250, 370, 170, 25, 0.9, t.shapeB, 0.9)}
        <Circle cx={262} cy={110} r={56} fill="none" stroke={t.shapeB} strokeWidth={1.3} />
        <Circle cx={262} cy={110} r={50} fill="none" stroke={t.shapeB} strokeWidth={0.5} />
        <Path d={sparkle(304, 64, 7)} fill={t.shapeB} />
        <Circle cx={318} cy={78} r={1.8} fill={t.shapeB} />
      </G>
    );
  },

  // Akdeniz: limon dalı, limon dilimi ve mavi karo bordür
  citrus: (t) => {
    const lemon = (x: number, y: number, rot: number, s: number, k: string) => (
      <G key={k} transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
        <Ellipse cx={0} cy={0} rx={24} ry={17} fill={t.shapeA} />
        <Ellipse cx={24} cy={0} rx={5} ry={3.6} fill={t.shapeA} />
        <Ellipse cx={-24} cy={0} rx={3} ry={2.6} fill={t.shapeA} />
        <Ellipse cx={-7} cy={-7} rx={9} ry={3.5} fill="#FFFFFF" opacity={0.45} />
      </G>
    );
    const segs: ReactElement[] = [];
    for (let i = 0; i < 8; i++) segs.push(<Line key={i} x1={74} y1={74} x2={74 + 22 * Math.cos((i * Math.PI) / 4)} y2={74 + 22 * Math.sin((i * Math.PI) / 4)} stroke="#FFFFFF" strokeWidth={2} />);
    const tiles: ReactElement[] = [];
    for (let x = 0; x < 360; x += 24) tiles.push(<Path key={x} d={`M${x} 0 h24 v8 a12 12 0 0 1 -24 0 Z`} fill={t.shapeB} opacity={x % 48 ? 0.75 : 1} />);
    const leaf = [t.palette[1], '#7FAE5C'];
    return (
      <G>
        <Circle cx={290} cy={130} r={104} fill={t.shapeC} />
        {tiles}
        {branch('a', [370, 30], [290, 50], [196, 132], 8, 26, leaf, t.palette[1])}
        {branch('b', [300, 60], [300, 130], [338, 200], 5, 22, leaf, t.palette[1])}
        {lemon(250, 104, 30, 1.2, 'l1')}
        {lemon(304, 126, -60, 1.05, 'l2')}
        {lemon(214, 150, 70, 0.9, 'l3')}
        {lemon(330, 196, 10, 0.95, 'l4')}
        <Circle cx={74} cy={74} r={30} fill={t.shapeA} />
        <Circle cx={74} cy={74} r={25} fill="#FFF6C9" />
        <Circle cx={74} cy={74} r={22} fill={t.shapeA} opacity={0.7} />
        {segs}
      </G>
    );
  },

  // Retro: 70'ler yayları ve çizgili gün batımı
  retro: (t) => {
    const cols = [t.shapeC, t.shapeB, t.shapeA, t.palette[3]];
    const arcs = [214, 186, 158, 130, 102, 74].map((R, i) => (
      <Path key={R} d={`M${318 - R} 250 A${R} ${R} 0 0 1 ${318 + R} 250`} stroke={cols[i % 4]} strokeWidth={26} fill="none" />
    ));
    const cuts = [0, 1, 2, 3].map((i) => <Rect key={i} x={30} y={70 + i * 9} width={100} height={2.5 + i * 1.2} fill={t.bg} />);
    return (
      <G>
        {arcs}
        <Circle cx={80} cy={70} r={44} fill={t.shapeB} />
        <Circle cx={80} cy={70} r={44} fill={t.shapeA} opacity={0.5} />
        {cuts}
        <Path d="M20 138 q 15 -12 30 0 t 30 0 t 30 0" stroke={t.shapeC} strokeWidth={4} fill="none" strokeLinecap="round" />
        <Path d={sparkle(186, 46, 10)} fill={t.shapeC} />
        <Path d={sparkle(212, 76, 6)} fill={t.shapeB} />
      </G>
    );
  },

  // Neon: koyu zeminde parlayan çizgiler
  neon: (t) => {
    const glow = (k: string, d: string, c: string) => [
      <Path key={`${k}1`} d={d} stroke={c} strokeWidth={12} opacity={0.12} fill="none" strokeLinecap="round" strokeLinejoin="round" />,
      <Path key={`${k}2`} d={d} stroke={c} strokeWidth={6} opacity={0.3} fill="none" strokeLinecap="round" strokeLinejoin="round" />,
      <Path key={`${k}3`} d={d} stroke={c} strokeWidth={2.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />,
      <Path key={`${k}4`} d={d} stroke="#FFFFFF" strokeWidth={0.9} opacity={0.7} fill="none" strokeLinecap="round" strokeLinejoin="round" />,
    ];
    const r = rng(53);
    const dots: ReactElement[] = [];
    for (let i = 0; i < 18; i++) dots.push(<Circle key={i} cx={140 + r() * 220} cy={r() * 150} r={0.8 + r() * 1.4} fill={t.palette[i % 4]} opacity={0.8} />);
    return (
      <G>
        <Circle cx={262} cy={96} r={90} fill={t.shapeC} />
        {dots}
        {glow('ring', 'M262 46 A50 50 0 1 1 261.9 46', t.shapeB)}
        {glow('h', heart(262, 98, 2.2), t.shapeA)}
        {glow('z', 'M30 40 L54 22 L78 40 L102 22 L126 40 L150 22', t.shapeA)}
        {glow('w', 'M300 196 q 12 -14 24 0 t 24 0', t.shapeB)}
        {glow('tri', 'M60 92 L82 128 L38 128 Z', t.palette[2])}
        {glow('p', 'M176 170 v14 M169 177 h14', t.palette[3])}
        {glow('s', 'M150 82 v10 M145 87 h10', t.shapeB)}
      </G>
    );
  },

  // Tropik: palmiye yaprakları, deve tabanı ve mercan çiçeği
  tropical: (t) => {
    const LEAFLET = 'M0 0 C 12 -5 34 -5 48 0 C 34 4 12 4 0 0 Z';
    const frond = (k: string, p0: Pt, p1: Pt, p2: Pt, size: number, c: string) => {
      const items: ReactElement[] = [<Path key={`${k}s`} d={`M${p0[0]} ${p0[1]} Q ${p1[0]} ${p1[1]} ${p2[0]} ${p2[1]}`} stroke={c} strokeWidth={2.2} fill="none" />];
      for (let i = 2; i <= 12; i++) {
        const [x, y, a] = qAt(p0, p1, p2, i / 13);
        const s = (size * (0.5 + 0.5 * Math.sin((i / 13) * Math.PI))) / 48;
        for (const side of [-55, 55]) items.push(<Path key={`${k}${i}${side}`} d={LEAFLET} fill={c} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(a + side).toFixed(0)}) scale(${s.toFixed(2)})`} />);
      }
      return items;
    };
    const cuts: Pt[] = [[-62, -14], [-58, 18], [-40, 44], [56, -20], [52, 14], [34, 42]];
    return (
      <G>
        <Circle cx={250} cy={120} r={96} fill={t.shapeC} />
        <Circle cx={196} cy={60} r={26} fill={t.shapeB} opacity={0.85} />
        {frond('f1', [370, -10], [300, 40], [190, 126], 54, t.palette[1])}
        {frond('f2', [370, 60], [320, 120], [250, 200], 46, t.shapeA)}
        {frond('f3', [370, 140], [340, 190], [330, 250], 40, t.palette[2])}
        <G transform="translate(52 36) rotate(-35)">
          <Path d="M0 62 C -54 44 -76 -10 -44 -52 C -22 -74 -2 -66 0 -54 C 4 -70 40 -74 62 -40 C 80 -6 54 46 0 62 Z" fill={t.shapeA} />
          {cuts.map(([x, y], i) => <Line key={i} x1={x * 1.2} y1={y * 1.2} x2={x * 0.35} y2={y * 0.35 + 6} stroke={t.bg} strokeWidth={5} strokeLinecap="round" />)}
          <Path d="M0 62 Q 4 10 0 -50" stroke={t.palette[2]} strokeWidth={2} fill="none" />
        </G>
        <Path d={blob(228, 176, 12, 3, 6)} fill={t.shapeB} />
        <Circle cx={228} cy={176} r={4} fill="#FFFFFF" opacity={0.8} />
      </G>
    );
  },

  // Kış: çam dalları, kar taneleri, buzlu mavi
  winter: (t) => {
    const pine = (k: string, p0: Pt, p1: Pt, p2: Pt, len: number) => {
      let d = `M${p0[0]} ${p0[1]} Q ${p1[0]} ${p1[1]} ${p2[0]} ${p2[1]} `;
      for (let i = 1; i <= 22; i++) {
        const [x, y, a] = qAt(p0, p1, p2, i / 23);
        const l = len * (1 - (i / 23) * 0.45);
        for (const side of [-50, 50, -30, 30]) {
          const b = ((a + side) * Math.PI) / 180;
          d += `M${x.toFixed(1)} ${y.toFixed(1)} l${(l * Math.cos(b)).toFixed(1)} ${(l * Math.sin(b)).toFixed(1)} `;
        }
      }
      return <Path key={k} d={d} stroke={t.shapeB} strokeWidth={1.4} strokeLinecap="round" fill="none" />;
    };
    const r = rng(61);
    const snow: ReactElement[] = [];
    for (let i = 0; i < 26; i++) snow.push(<Circle key={i} cx={r() * 360} cy={r() * 160} r={1 + r() * 2.2} fill={i % 3 ? '#FFFFFF' : t.shapeA} opacity={0.95} />);
    return (
      <G>
        <Rect x={0} y={0} width={360} height={240} fill={t.shapeC} opacity={0.7} />
        <Path d="M0 200 C 80 176 160 214 240 190 S 330 176 360 186 V240 H0 Z" fill="#FFFFFF" opacity={0.85} />
        {snow}
        {pine('a', [370, -6], [300, 20], [214, 22], 13)}
        {pine('b', [340, -6], [326, 56], [280, 92], 11)}
        {pine('c', [-10, -6], [40, 20], [110, 16], 11)}
        <Circle cx={292} cy={22} r={5} fill={t.shapeA} />
        <Circle cx={302} cy={30} r={4} fill="#FFFFFF" stroke={t.shapeA} strokeWidth={1} />
        <Circle cx={56} cy={16} r={4} fill={t.shapeA} />
        <Path d={snowflake(240, 128, 26)} stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" fill="none" />
        <Path d={snowflake(240, 128, 26)} stroke={t.key_} strokeWidth={1.6} strokeLinecap="round" fill="none" opacity={0.85} />
        <Path d={snowflake(320, 160, 14)} stroke={t.key_} strokeWidth={1.3} strokeLinecap="round" fill="none" opacity={0.7} />
        <Path d={snowflake(150, 70, 12)} stroke={t.key_} strokeWidth={1.2} strokeLinecap="round" fill="none" opacity={0.65} />
        <Path d={snowflake(60, 104, 10)} stroke={t.key_} strokeWidth={1.1} strokeLinecap="round" fill="none" opacity={0.6} />
      </G>
    );
  },

  // Aşk: kalp deseni ve büyük kalpler
  hearts: (t) => {
    const items: ReactElement[] = [];
    const r = rng(67);
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 9; col++) {
        const x = 20 + col * 42 + (row % 2) * 21;
        const y = 16 + row * 42;
        if (x < 170 && y > 140) continue;
        items.push(<Path key={`${row}-${col}`} d={heart(x, y, 0.55 + r() * 0.35)} fill={(row + col) % 3 ? t.shapeB : t.shapeA} opacity={(row + col) % 3 ? 0.45 : 0.3} transform={`rotate(${(r() - 0.5) * 40} ${x} ${y})`} />);
      }
    }
    return (
      <G>
        {items}
        <Circle cx={262} cy={110} r={84} fill={t.shapeC} />
        <Path d={heart(236, 110, 4.6)} fill={t.shapeB} transform="rotate(-14 236 110)" />
        <Path d={heart(284, 118, 5.4)} fill={t.shapeA} transform="rotate(10 284 118)" />
        <Path d={heart(284, 118, 6.4)} fill="none" stroke={t.palette[2]} strokeWidth={1.2} transform="rotate(10 284 118)" />
        <Ellipse cx={262} cy={92} rx={8} ry={4} fill="#FFFFFF" opacity={0.4} transform="rotate(-30 262 92)" />
        <Path d={sparkle(206, 62, 8)} fill={t.shapeA} />
        <Path d={sparkle(334, 54, 5)} fill={t.shapeA} />
      </G>
    );
  },

  // Simli: köşeden dökülen altın sim ve ince altın halkalar
  foil: (t) => {
    const r = rng(71);
    const dots: ReactElement[] = [];
    let n = 0;
    while (dots.length < 110 && n < 2000) {
      n++;
      const x = r() * 380 - 10;
      const y = r() * 250 - 10;
      const d = Math.hypot(360 - x, y) / 300;
      if (r() > Math.exp(-d * d * 3.2)) continue;
      dots.push(<Circle key={n} cx={x} cy={y} r={0.6 + r() * (2.8 - d * 1.6)} fill={t.palette[n % 3]} opacity={0.65 + r() * 0.35} />);
    }
    return (
      <G>
        <Rect x={0} y={0} width={360} height={240} fill={t.shapeC} opacity={0.5} />
        <Circle cx={240} cy={112} r={70} fill={t.bg} />
        <Circle cx={240} cy={112} r={70} fill="none" stroke={t.shapeB} strokeWidth={1.4} />
        <Circle cx={240} cy={112} r={63} fill="none" stroke={t.shapeB} strokeWidth={0.5} />
        <Line x1={20} y1={30} x2={130} y2={30} stroke={t.shapeB} strokeWidth={0.8} />
        <Path d="M136 30 l4 -4 l4 4 l-4 4 Z" fill={t.shapeB} />
        {dots}
        <Path d={sparkle(204, 66, 9)} fill={t.shapeB} />
        <Path d={sparkle(286, 170, 6)} fill={t.palette[1]} />
        <Path d={sparkle(80, 60, 5)} fill={t.shapeB} />
      </G>
    );
  },

  // Çizgi: tek çizgi botanik dal, kâğıt üzerinde mürekkep
  lineart: (t) => {
    const p0: Pt = [196, 236];
    const p1: Pt = [214, 120];
    const p2: Pt = [312, 26];
    const items: ReactElement[] = [];
    for (let i = 1; i <= 7; i++) {
      const [x, y, a] = qAt(p0, p1, p2, i / 8);
      const s = 0.9 + 0.5 * Math.sin((i / 8) * Math.PI);
      const rot = a + (i % 2 ? 52 : -52);
      items.push(<Path key={`l${i}`} d={`M0 0 C 9 -11 25 -11 34 0 C 25 11 9 11 0 0 Z M3 0 H28`} stroke={t.shapeA} strokeWidth={1.3 / s} fill="none" strokeLinejoin="round" transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(0)}) scale(${s.toFixed(2)})`} />);
    }
    return (
      <G>
        <Path d={blob(268, 96, 70, 17)} fill={t.shapeC} />
        <Circle cx={300} cy={150} r={26} fill={t.shapeB} opacity={0.35} />
        <Path d={`M${p0[0]} ${p0[1]} Q ${p1[0]} ${p1[1]} ${p2[0]} ${p2[1]}`} stroke={t.shapeA} strokeWidth={1.4} fill="none" strokeLinecap="round" />
        {items}
        <Path d="M312 26 c 3 -9 12 -11 16 -4" stroke={t.shapeA} strokeWidth={1.3} fill="none" strokeLinecap="round" />
        <Path d="M40 62 Q 80 52 130 22" stroke={t.shapeA} strokeWidth={1.1} fill="none" strokeLinecap="round" opacity={0.75} />
        {[[70, 54, -50], [94, 44, 20], [112, 34, -60]].map(([x, y, a], i) => (
          <Path key={`s${i}`} d="M0 0 C 6 -7 16 -7 22 0 C 16 7 6 7 0 0 Z" stroke={t.shapeA} strokeWidth={1.1} fill="none" opacity={0.75} transform={`translate(${x} ${y}) rotate(${a})`} />
        ))}
        <Circle cx={132} cy={21} r={2.2} fill={t.shapeB} />
      </G>
    );
  },
};
