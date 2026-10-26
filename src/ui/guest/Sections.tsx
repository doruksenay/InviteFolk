import * as Clipboard from 'expo-clipboard';
import { sportOf } from '@/core/event-types';
import { type ReactNode, useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import type { InvitationTheme } from '@/core/themes';
import type { GuestSettings, ProgramItem } from '@/core/types';
import type { TFn, TKey } from '@/i18n';
import type { Weather } from '@/lib/api-guest';
import { mapsUrl } from '@/ui/design/calendar';
import { Icon, type IconName } from '@/ui/Icon';
import { tapFeedback } from '@/ui/primitives';
import { QrCode } from '@/ui/QrCode';
import { themeProse, themeTitle } from '@/ui/theme/typography';
import { font } from '@/ui/tokens';

import { hairline, softSurface } from './colors';

/** Davetli sayfasında tema renkleriyle kart. */
export function SectionCard({ theme, kicker, icon, children, tone }: { theme: InvitationTheme; kicker?: string; icon?: IconName; children: ReactNode; tone?: 'accent' }) {
  return (
    <View
      style={{
        gap: 12,
        paddingVertical: 18,
        paddingHorizontal: 18,
        borderRadius: 22,
        backgroundColor: tone === 'accent' ? theme.shapeC : softSurface(theme.dark),
        boxShadow: `inset 0 0 0 1px ${hairline(theme.dark)}`,
      }}>
      {kicker ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {icon && <Icon name={icon} size={15} color={theme.key_} strokeWidth={2} />}
          <Text style={{ fontFamily: font.bold, fontSize: 11, letterSpacing: 1.4, color: theme.key_ }}>{kicker}</Text>
        </View>
      ) : null}
      {children}
    </View>
  );
}

function SmallButton({ theme, icon, label, onPress, filled }: { theme: InvitationTheme; icon?: IconName; label: string; onPress: () => void; filled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: 42,
        paddingHorizontal: 16,
        borderRadius: 999,
        backgroundColor: filled ? theme.ink : 'transparent',
        boxShadow: filled ? 'none' : `inset 0 0 0 1px ${hairline(theme.dark)}`,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}>
      {icon && <Icon name={icon} size={15} color={filled ? theme.bg : theme.ink} strokeWidth={2} />}
      <Text style={{ fontFamily: font.semibold, fontSize: 14, color: filled ? theme.bg : theme.ink }}>{label}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Geri sayım
// ---------------------------------------------------------------------------
export function Countdown({ theme, startsAt, t }: { theme: InvitationTheme; startsAt: string; t: TFn }) {
  const target = new Date(startsAt).getTime();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!Number.isFinite(target)) return null;
  const left = Math.max(0, target - now);
  if (left <= 0 && now - target > 12 * 3600_000) return null;
  const d = Math.floor(left / 86400_000);
  const h = Math.floor((left % 86400_000) / 3600_000);
  const m = Math.floor((left % 3600_000) / 60_000);
  const s = Math.floor((left % 60_000) / 1000);
  const cells: [number, TKey][] = [
    [d, 'guest.countdown.days'],
    [h, 'guest.countdown.hours'],
    [m, 'guest.countdown.minutes'],
    [s, 'guest.countdown.seconds'],
  ];
  return (
    <SectionCard theme={theme} kicker={t('guest.countdown.kicker')} icon="clock">
      {left <= 0 ? (
        <Text style={[themeTitle(theme, 36), { color: theme.ink }]}>{t('guest.countdown.today')}</Text>
      ) : (
        <View accessibilityRole="timer" style={{ flexDirection: 'row', gap: 8 }}>
          {cells.map(([v, k]) => (
            <View key={k} style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 16, backgroundColor: theme.dark ? 'rgba(255,255,255,0.06)' : theme.bg }}>
              <Text style={[themeTitle(theme, 34), { color: theme.ink, fontVariant: ['tabular-nums'] }]}>{String(v).padStart(k === 'guest.countdown.days' ? 1 : 2, '0')}</Text>
              <Text style={{ fontFamily: font.medium, fontSize: 11, color: theme.soft }}>{t(k)}</Text>
            </View>
          ))}
        </View>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Program (kına, nikâh, düğün…)
// ---------------------------------------------------------------------------
export function ProgramList({ theme, items, t, locale }: { theme: InvitationTheme; items: ProgramItem[]; t: TFn; locale: string }) {
  const sorted = [...items].sort((a, b) => (a.at ?? '9').localeCompare(b.at ?? '9'));
  const [mapErr, setMapErr] = useState(false);
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' }).format(new Date(iso));
  return (
    <SectionCard theme={theme} kicker={t('guest.program.kicker')} icon="list">
      {sorted.map((p, i) => {
        const where = [p.venue, p.address].filter(Boolean).join(', ');
        return (
          <View key={p.id} style={{ flexDirection: 'row', gap: 14, paddingTop: i ? 12 : 0, borderTopWidth: i ? 1 : 0, borderTopColor: hairline(theme.dark) }}>
            <View style={{ alignItems: 'center', paddingTop: 6 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: theme.shapeB }} />
              {i < sorted.length - 1 && <View style={{ width: 2, flex: 1, marginTop: 4, backgroundColor: hairline(theme.dark) }} />}
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[themeTitle(theme, 28), { color: theme.ink }]}>{p.title}</Text>
              {p.at ? <Text style={{ fontFamily: font.semibold, fontSize: 14, color: theme.ink }}>{fmt(p.at)}</Text> : null}
              {where ? <Text style={{ fontFamily: font.regular, fontSize: 14, lineHeight: 20, color: theme.soft }}>{where}</Text> : null}
              {where ? (
                <View style={{ flexDirection: 'row', marginTop: 4 }}>
                  <SmallButton theme={theme} icon="map" label={t('guest.program.map')} onPress={() => Linking.openURL(mapsUrl(where)).catch(() => setMapErr(true))} />
                </View>
              ) : null}
            </View>
          </View>
        );
      })}
      {mapErr ? <Text style={{ fontFamily: font.medium, fontSize: 13, color: theme.dark ? '#FFB4A8' : '#A3332A' }}>{t('rsvp.openFailed')}</Text> : null}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Takı / hediye / ödeme bilgisi
// ---------------------------------------------------------------------------
export function formatIban(iban: string) {
  return iban.replace(/(.{4})/g, '$1 ').trim();
}

export function GiftCard({ theme, gift, type, t }: { theme: InvitationTheme; gift: NonNullable<GuestSettings['gift']>; type: string; t: TFn }) {
  const [copied, setCopied] = useState(false);
  const sport = !!sportOf(type);
  const kickerKey = (sport ? 'saha' : ['dugun', 'nisan', 'kina', 'sunnet'].includes(type) ? (type === 'sunnet' ? 'dugun' : type) : 'other') as 'dugun';
  return (
    <SectionCard theme={theme} kicker={t(`guest.gift.kicker.${kickerKey}`)} icon={sport ? 'creditCard' : 'gift'}>
      {gift.note ? <Text style={[themeProse(theme, 20), { color: theme.ink }]}>{gift.note}</Text> : null}
      <View style={{ gap: 6, padding: 14, borderRadius: 16, backgroundColor: theme.dark ? 'rgba(255,255,255,0.06)' : theme.bg }}>
        <Row label={t('guest.gift.holder')} value={gift.holder} theme={theme} />
        <Row label={t('guest.gift.iban')} value={formatIban(gift.iban)} theme={theme} mono />
        {gift.bank ? <Row label={t('guest.gift.bank')} value={gift.bank} theme={theme} /> : null}
      </View>
      <View style={{ flexDirection: 'row' }}>
        <SmallButton
          theme={theme}
          filled
          icon={copied ? 'check' : 'copy'}
          label={copied ? t('guest.gift.copied') : t('guest.gift.copy')}
          onPress={async () => {
            await Clipboard.setStringAsync(gift.iban);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
          }}
        />
      </View>
    </SectionCard>
  );
}

function Row({ label, value, theme, mono }: { label: string; value: string; theme: InvitationTheme; mono?: boolean }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ fontFamily: font.medium, fontSize: 11, letterSpacing: 0.8, color: theme.soft }}>{label.toLocaleUpperCase()}</Text>
      <Text selectable style={{ fontFamily: mono ? font.bold : font.semibold, fontSize: mono ? 16 : 15, letterSpacing: mono ? 1 : 0, color: theme.ink }}>
        {value}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Duyuru
// ---------------------------------------------------------------------------
export function AnnouncementCard({ theme, body, at, t, locale }: { theme: InvitationTheme; body: string; at: string; t: TFn; locale: string }) {
  const when = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' }).format(new Date(at));
  return (
    <SectionCard theme={theme} kicker={t('guest.announcement.kicker')} icon="megaphone" tone="accent">
      <Text style={{ fontFamily: font.semibold, fontSize: 16, lineHeight: 23, color: theme.ink }}>{body}</Text>
      <Text style={{ fontFamily: font.regular, fontSize: 12, color: theme.soft }}>{when}</Text>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Hava durumu
// ---------------------------------------------------------------------------
function weatherKind(code: number): { icon: IconName; key: 'clear' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm' } {
  if (code === 0 || code === 1) return { icon: 'sun', key: 'clear' };
  if (code === 2 || code === 3) return { icon: 'cloud', key: 'cloudy' };
  if (code === 45 || code === 48) return { icon: 'cloud', key: 'fog' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { icon: 'cloud', key: 'snow' };
  if (code >= 95) return { icon: 'rain', key: 'storm' };
  return { icon: 'rain', key: 'rain' };
}

export function WeatherCard({ theme, w, t }: { theme: InvitationTheme; w: Extract<Weather, { available: true }>; t: TFn }) {
  const k = weatherKind(w.code);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 18, backgroundColor: softSurface(theme.dark) }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.shapeC, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={k.icon} size={20} color={theme.ink} strokeWidth={2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: font.medium, fontSize: 12, color: theme.soft }}>{t('guest.weather.title', { place: w.place })}</Text>
        <Text style={{ fontFamily: font.semibold, fontSize: 15, color: theme.ink }}>
          {[t(`guest.weather.codes.${k.key}`), t('guest.weather.line', { tmax: w.tmax, tmin: w.tmin }), w.rain !== null && w.rain >= 10 ? t('guest.weather.rain', { rain: w.rain }) : null]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Giriş kartı (kapıda karekod)
// ---------------------------------------------------------------------------
export function CheckinPass({ theme, code, checkedIn, t }: { theme: InvitationTheme; code: string; checkedIn: boolean; t: TFn }) {
  return (
    <SectionCard theme={theme} kicker={t('guest.checkin.kicker')} icon="qr">
      {checkedIn ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icon name="check" size={20} color={theme.key_} strokeWidth={2.4} />
          <Text style={{ fontFamily: font.semibold, fontSize: 15, color: theme.ink }}>{t('guest.checkin.done')}</Text>
        </View>
      ) : (
        <>
          <Text style={{ fontFamily: font.regular, fontSize: 14, lineHeight: 20, color: theme.soft }}>{t('guest.checkin.body')}</Text>
          <View style={{ alignSelf: 'center', padding: 12, borderRadius: 18, backgroundColor: '#FFFFFF' }}>
            <QrCode value={`IF1:${code}`} size={176} />
          </View>
          <Text selectable style={{ alignSelf: 'center', fontFamily: font.bold, fontSize: 14, letterSpacing: 2, color: theme.ink }}>
            {t('guest.checkin.code', { code: code.replace(/(.{4})/g, '$1 ').trim() })}
          </Text>
        </>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Fotoğraf albümü bağlantısı
// ---------------------------------------------------------------------------
export function AlbumCard({ theme, onOpen, t }: { theme: InvitationTheme; onOpen: () => void; t: TFn }) {
  return (
    <SectionCard theme={theme} kicker={t('guest.album.kicker')} icon="camera">
      <Text style={{ fontFamily: font.regular, fontSize: 14, lineHeight: 20, color: theme.soft }}>{t('guest.album.body')}</Text>
      <View style={{ flexDirection: 'row' }}>
        <SmallButton theme={theme} filled icon="upload" label={t('guest.album.open')} onPress={onOpen} />
      </View>
    </SectionCard>
  );
}

export { SmallButton };
