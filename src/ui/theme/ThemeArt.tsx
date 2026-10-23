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

  // Balonlar
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
};
