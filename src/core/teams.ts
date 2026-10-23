// Takım sporları: oyuncuları seviyelerine ve mevkilerine göre iki dengeli takıma böler.
// Kilit mevkiler (futbolda kaleci, basketbolda pivot/oyun kurucu, voleybolda pasör/libero) önce iki takıma ayrılır; sonra en yüksek seviyeden başlayarak her oyuncu toplamı düşük (eşitse kişi sayısı az) takıma gider.
// Sonuç küçük bir yer değiştirme turuyla iyileştirilir (toplam farkını azaltan ilk ikili takas).
import type { PlayerPosition } from './types';

export type Player = { id: string; skill: number; position: PlayerPosition | null };
export type Team = 1 | 2;

export function teamTotals(players: Player[], teams: Record<string, Team | null>) {
  let a = 0;
  let b = 0;
  for (const p of players) {
    if (teams[p.id] === 1) a += p.skill;
    else if (teams[p.id] === 2) b += p.skill;
  }
  return { a, b };
}

export function balanceTeams(players: Player[], rand: () => number = Math.random, spread: PlayerPosition[] = ['kaleci']): Record<string, Team> {
  // Aynı seviyedekiler arasında her seferinde farklı bir dağılım çıksın.
  const shuffled = [...players].map((p) => ({ p, r: rand() })).sort((x, y) => x.r - y.r).map((x) => x.p);
  const out: Record<string, Team> = {};
  const sum = { 1: 0, 2: 0 } as Record<Team, number>;
  const count = { 1: 0, 2: 0 } as Record<Team, number>;
  const half = Math.ceil(players.length / 2);
  const put = (p: Player, t: Team) => {
    out[p.id] = t;
    sum[t] += p.skill;
    count[t] += 1;
  };
  const weaker = (): Team => (sum[1] < sum[2] || (sum[1] === sum[2] && count[1] <= count[2]) ? 1 : 2);
  // Önce kilit mevkiler (kaleci; pivot ve oyun kurucu; pasör ve libero) iki takıma sırayla dağıtılır:
  // en iyisi o an zayıf olan takıma, ikincisi diğerine.
  const fixed = new Set<string>();
  for (const pos of spread) {
    const group = shuffled.filter((p) => p.position === pos).sort((x, y) => y.skill - x.skill);
    group.forEach((p) => {
      let t = weaker();
      const inA = group.filter((q) => out[q.id] === 1).length;
      const inB = group.filter((q) => out[q.id] === 2).length;
      if (inA !== inB) t = inA < inB ? 1 : 2;
      if (count[t] >= half) t = t === 1 ? 2 : 1;
      put(p, t);
      fixed.add(p.id);
    });
  }
  const rest = shuffled.filter((p) => !fixed.has(p.id)).sort((x, y) => y.skill - x.skill);
  for (const p of rest) {
    let t = weaker();
    if (count[t] >= half) t = t === 1 ? 2 : 1;
    put(p, t);
  }
  // İyileştirme: kişi sayısını bozmadan farkı azaltan takaslar.
  for (let round = 0; round < 20; round++) {
    const diff = sum[1] - sum[2];
    if (Math.abs(diff) <= 1) break;
    let swapped = false;
    const as = shuffled.filter((p) => out[p.id] === 1);
    const bs = shuffled.filter((p) => out[p.id] === 2);
    outer: for (const x of as) {
      for (const y of bs) {
        // Kilit mevkiler yalnızca aynı mevkideki oyuncuyla yer değiştirir (dağılım bozulmaz).
        if ((fixed.has(x.id) || fixed.has(y.id)) && !(fixed.has(x.id) && fixed.has(y.id) && x.position === y.position)) continue;
        const nd = diff - 2 * (x.skill - y.skill);
        if (Math.abs(nd) < Math.abs(diff)) {
          out[x.id] = 2;
          out[y.id] = 1;
          sum[1] += y.skill - x.skill;
          sum[2] += x.skill - y.skill;
          swapped = true;
          break outer;
        }
      }
    }
    if (!swapped) break;
  }
  return out;
}

/** Rastgele, kişi sayısı eşit iki takım. */
export function shuffleTeams(players: Player[], rand: () => number = Math.random): Record<string, Team> {
  const order = [...players].map((p) => ({ p, r: rand() })).sort((x, y) => x.r - y.r);
  return Object.fromEntries(order.map((x, i) => [x.p.id, (i % 2 === 0 ? 1 : 2) as Team]));
}
