// Etkinlik tarih/saatleri Türkiye saatiyle (UTC+3) girilir ve saklanır.

/** "2027-06-12", "12.06.2027", "12/06/2027" ya da "12-06-2027" → "2027-06-12". Geçersizse null. */
export function normDate(s: string): string | null {
  const v = s.trim();
  let y: number, m: number, d: number;
  let r = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v);
  if (r) [y, m, d] = [+r[1], +r[2], +r[3]];
  else if ((r = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(v))) [d, m, y] = [+r[1], +r[2], +r[3]];
  else return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** "2027-06-12" → "12.06.2027" (uygulamada elle yazılan alanlar için). */
export function displayDate(iso: string): string {
  const r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  return r ? `${r[3]}.${r[2]}.${r[1]}` : iso;
}

/** "2027-06-12" + "19:00" → ISO. Geçersizse null. */
export function toIso(date: string, time: string): string | null {
  const day = normDate(date);
  if (!day) return null;
  const t = /^\d{1,2}[:.]\d{2}$/.test(time.trim()) ? time.trim().replace('.', ':').padStart(5, '0') : '19:00';
  const d = new Date(`${day}T${t}:00+03:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** ISO → { date: "2027-06-12", time: "19:00" } (İstanbul saatiyle). */
export function splitIso(iso: string | null | undefined): { date: string; time: string } {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: '', time: '' };
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const p = (k: string) => parts.find((x) => x.type === k)?.value ?? '';
  return { date: `${p('year')}-${p('month')}-${p('day')}`, time: `${p('hour')}:${p('minute')}` };
}

export const isDate = (s: string) => normDate(s) !== null;
