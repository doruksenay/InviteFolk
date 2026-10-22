// Davetli sayfası: "Takvime ekle" (.ics ve Google Takvim) ve "Haritada aç" bağlantıları.
import { Linking, Platform } from 'react-native';

type CalEvent = { title: string; start: Date; end: Date; location?: string; description?: string };

/** 20270612T160000Z */
function utc(d: Date) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** RFC 5545 metin kaçışı: ters bölü, noktalı virgül, virgül ve satır sonu. */
export function icsEscape(s: string) {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** 75 karakterden uzun satırları katlar (RFC 5545 §3.1). */
function fold(line: string) {
  if (line.length <= 74) return line;
  const parts: string[] = [];
  for (let i = 0; i < line.length; i += 73) parts.push((i ? ' ' : '') + line.slice(i, i + 73));
  return parts.join('\r\n');
}

export function buildIcs(ev: CalEvent) {
  const uid = `${utc(ev.start)}-${Math.random().toString(36).slice(2, 10)}@davet`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Invitefolk//Invitations//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${utc(new Date())}`,
    `DTSTART:${utc(ev.start)}`,
    `DTEND:${utc(ev.end)}`,
    `SUMMARY:${icsEscape(ev.title)}`,
    ev.location ? `LOCATION:${icsEscape(ev.location)}` : '',
    ev.description ? `DESCRIPTION:${icsEscape(ev.description)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return lines.map(fold).join('\r\n') + '\r\n';
}

export function googleCalendarUrl(ev: CalEvent) {
  const p = new URLSearchParams({ action: 'TEMPLATE', text: ev.title, dates: `${utc(ev.start)}/${utc(ev.end)}` });
  if (ev.location) p.set('location', ev.location);
  if (ev.description) p.set('details', ev.description);
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

export function mapsUrl(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function safeFileName(s: string) {
  return (s.replace(/[^\p{L}\p{N} _-]+/gu, '').trim().slice(0, 60) || 'davet').replace(/\s+/g, '-');
}

/** Web'de .ics indirir (Apple Takvim, Outlook, Google içe aktarma); telefonda Google Takvim'i açar. */
export async function addToCalendar(ev: CalEvent) {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const blob = new Blob([buildIcs(ev)], { type: 'text/calendar;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = `${safeFileName(ev.title)}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
    return;
  }
  await Linking.openURL(googleCalendarUrl(ev));
}

export type { CalEvent };
