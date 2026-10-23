// Halı saha: oyuncuları seviyelerine göre iki dengeli takıma böler.
// Kaleciler önce iki takıma ayrılır; sonra en yüksek seviyeden başlayarak her oyuncu toplamı düşük (eşitse kişi sayısı az) takıma gider.
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

export function balanceTeams(players: Player[], rand: () => number = Math.random): Record<string, Team> {
  // Aynı seviyedekiler arasında her seferinde farklı bir dağılım çıksın.
  const shuffled = [...players].map((p) => ({ p, r: rand() })).sort((x, y) => x.r - y.r).map((x) => x.p);
  const keepers = shuffled.filter((p) => p.position === 'kaleci').sort((x, y) => y.skill - x.skill);
  const rest = shuffled.filter((p) => p.position !== 'kaleci').sort((x, y) => y.skill - x.skill);
  const out: Record<string, Team> = {};
  const sum = { 1: 0, 2: 0 } as Record<Team, number>;
  const count = { 1: 0, 2: 0 } as Record<Team, number>;
  const put = (p: Player, t: Team) => {
    out[p.id] = t;
    sum[t] += p.skill;
    count[t] += 1;
  };
  keepers.forEach((k, i) => put(k, i % 2 === 0 ? 1 : 2));
  const half = Math.ceil(players.length / 2);
  for (const p of rest) {
    let t: Team = sum[1] < sum[2] || (sum[1] === sum[2] && count[1] <= count[2]) ? 1 : 2;
    if (count[t] >= half) t = t === 1 ? 2 : 1;
    put(p, t);
  }
  // İyileştirme: kişi sayısını bozmadan farkı azaltan takaslar (kaleciler yerinde kalır).
  for (let round = 0; round < 20; round++) {
    const diff = sum[1] - sum[2];
    if (Math.abs(diff) <= 1) break;
    let swapped = false;
    const as = rest.filter((p) => out[p.id] === 1);
    const bs = rest.filter((p) => out[p.id] === 2);
    outer: for (const x of as) {
      for (const y of bs) {
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
