// Etkinlik tarih/saatleri Türkiye saatiyle (UTC+3) girilir ve saklanır.

/** "2027-06-12" + "19:00" → ISO. Geçersizse null. */
export function toIso(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) return null;
  const t = /^\d{1,2}[:.]\d{2}$/.test(time.trim()) ? time.trim().replace('.', ':').padStart(5, '0') : '19:00';
  const d = new Date(`${date.trim()}T${t}:00+03:00`);
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

export const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s.trim());
