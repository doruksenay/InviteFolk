// GET ?token=<davet anahtarı>  →  text/calendar (.ics)
// Davetlinin takvimine abonelik: etkinlik (ve programdaki törenler); haftalık maçlarda tekrar kuralıyla.
// Takvim uygulamaları bu adresi düzenli aralıklarla yeniden okur; saat ya da yer değişirse takvim de güncellenir.
//
// Güvenlik: girişsiz (verify_jwt = false; takvim uygulamaları başlık gönderemez), tek yetki davet anahtarıdır.
// İçerikte davetlinin kendi adı ve davet linki dışında kişisel veri yoktur.

import { adminClient, TOKEN } from '../_shared/supabase.ts';

const APP = () => (Deno.env.get('APP_WEB_URL') ?? '').replace(/\/+$/, '');

function esc(s: string) {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function stamp(d: Date) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** RFC 5545: 75 sekizlikten uzun satırlar katlanır. */
function fold(line: string) {
  const out: string[] = [];
  let cur = '';
  for (const ch of line) {
    if (new TextEncoder().encode(cur + ch).length > 73) {
      out.push(cur);
      cur = ' ' + ch;
    } else cur += ch;
  }
  out.push(cur);
  return out.join('\r\n');
}

Deno.serve(async (req) => {
  if (req.method !== 'GET') return new Response('method_not_allowed', { status: 405 });
  const token = new URL(req.url).searchParams.get('token') ?? '';
  if (!TOKEN.test(token)) return new Response('not_found', { status: 404 });

  const db = adminClient();
  const { data: inv } = await db
    .from('invitations')
    .select('id, events!inner(id, title, status, starts_at, venue_name, venue_address, type, settings)')
    .eq('token', token)
    .maybeSingle();
  // deno-lint-ignore no-explicit-any
  const ev = (inv as any)?.events as
    | { id: string; title: string; status: string; starts_at: string | null; venue_name: string | null; venue_address: string | null; type: string; settings: Record<string, unknown> }
    | undefined;
  if (!ev || ev.status === 'archived') return new Response('not_found', { status: 404 });

  const link = APP() ? `${APP()}/r/${token}` : '';
  const hours = ev.type === 'saha' ? 1 : ev.type === 'basket' ? 1.5 : ev.type === 'voleybol' ? 2 : 4;
  const now = stamp(new Date());
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Invitefolk//Invitations//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${esc(ev.title)}`, 'REFRESH-INTERVAL;VALUE=DURATION:PT12H'];

  const add = (uid: string, title: string, at: string | null | undefined, where: string) => {
    if (!at) return;
    const start = new Date(at);
    if (Number.isNaN(start.getTime())) return;
    const end = new Date(start.getTime() + hours * 3600_000);
    lines.push('BEGIN:VEVENT', `UID:${uid}@invitefolk`, `DTSTAMP:${now}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`, `SUMMARY:${esc(title)}`);
    if (where) lines.push(`LOCATION:${esc(where)}`);
    if (link) lines.push(`URL:${link}`, `DESCRIPTION:${esc(link)}`);
    if (ev.settings?.recurring === 'weekly' && uid === ev.id) lines.push('RRULE:FREQ=WEEKLY');
    lines.push('END:VEVENT');
  };

  const where = [ev.venue_name, ev.venue_address].filter(Boolean).join(', ');
  add(ev.id, ev.title, ev.starts_at, where);
  const program = Array.isArray(ev.settings?.program) ? (ev.settings.program as { id?: string; title?: string; at?: string; venue?: string; address?: string }[]) : [];
  for (const p of program.slice(0, 8)) {
    if (!p?.id || !p.at) continue;
    add(`${ev.id}-${p.id}`, `${ev.title} · ${String(p.title ?? '').slice(0, 80)}`, p.at, [p.venue, p.address].filter(Boolean).join(', ') || where);
  }
  lines.push('END:VCALENDAR');

  return new Response(lines.map(fold).join('\r\n') + '\r\n', {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="invitefolk.ics"',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});
