import { Pressable, type PressableStateCallbackType, StyleSheet, Text, View } from 'react-native';

import { eventCopy, getEventType } from '@/core/event-types';
import { dateBadge, formatWhen } from '@/core/format';
import { getTheme } from '@/core/themes';
import type { EventRow, EventSummary } from '@/core/types';
import { useI18n } from '@/i18n';

import { Icon } from './Icon';
import { color, font, shadow } from './tokens';

type PressState = PressableStateCallbackType & { hovered?: boolean };

export function EventCard({ event, summary, onPress, width }: { event: EventRow; summary: EventSummary | null; onPress: () => void; width: number | `${number}%` }) {
  const { t, lang, locale } = useI18n();
  const cfg = getEventType(event.type);
  const typeName = eventCopy(event.type, lang).name;
  const theme = getTheme(event.theme);
  const badge = dateBadge(event.starts_at, locale);
  const total = summary?.households ?? 0;
  const yes = summary?.yes_households ?? 0;
  const no = summary?.no_households ?? 0;
  const pending = summary?.pending_households ?? 0;
  const pct = (n: number) => (total ? `${Math.round((n / total) * 100)}%` : '0%') as `${number}%`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${event.title}, ${typeName}`}
      onPress={onPress}
      style={(s: PressState) => [styles.card, { width }, event.status === 'archived' && { opacity: 0.72 }, s.hovered && { transform: [{ translateY: -3 }], boxShadow: shadow.raised }, s.pressed && { transform: [{ scale: 0.99 }] }]}>
      <View style={[styles.art, { backgroundColor: theme.bg }]}>
        <View style={{ position: 'absolute', right: -30, top: -40, width: 140, height: 140, borderRadius: 70, backgroundColor: theme.shapeA }} />
        <View style={{ position: 'absolute', right: 110, bottom: -36, width: 80, height: 80, borderRadius: 40, backgroundColor: theme.shapeB, opacity: 0.85 }} />
        {badge ? (
          <View style={styles.date}>
            <Text style={styles.day}>{badge.day}</Text>
            <Text style={styles.mon}>{badge.mon}</Text>
          </View>
        ) : (
          <View style={styles.date}>
            <Icon name="calendar" size={20} color={color.muted} />
          </View>
        )}
        <View style={[styles.type, { backgroundColor: '#FFFFFF' }]}>
          <Icon name={cfg.icon} size={14} color={cfg.accent} strokeWidth={2} />
          <Text style={[styles.typeText, { color: color.ink }]}>{typeName}</Text>
        </View>
        {(event.status === 'draft' || event.status === 'archived') && (
          <View style={styles.draft}>
            <Text style={styles.draftText}>{t(`status.event.${event.status}`)}</Text>
          </View>
        )}
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {event.title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {[formatWhen(event.starts_at, locale), event.venue_name].filter(Boolean).join(' · ') || t('home.card.noDetails')}
        </Text>
        <View style={styles.bar} accessibilityLabel={t('home.card.barLabel', { total, yes, no, pending })}>
          <View style={{ width: pct(yes), backgroundColor: color.sage }} />
          <View style={{ width: pct(no), backgroundColor: color.coral }} />
          <View style={{ width: pct(pending), backgroundColor: '#EAD9A8' }} />
        </View>
        <Text style={styles.summary}>
          {total === 0
            ? t('home.card.noGuests')
            : `${t('home.card.attending', { count: summary?.attending_people ?? 0 })} · ${t('home.card.pending', { count: pending })}`}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: color.surface, borderRadius: 26, overflow: 'hidden', boxShadow: shadow.card },
  art: { height: 124, overflow: 'hidden' },
  date: { position: 'absolute', left: 16, top: 16, minWidth: 56, alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#FFFFFF', boxShadow: '0px 6px 16px rgba(30,20,10,0.10)' },
  day: { fontFamily: font.bold, fontSize: 24, lineHeight: 26, color: color.ink },
  mon: { fontFamily: font.bold, fontSize: 11, letterSpacing: 0.8, color: color.muted },
  type: { position: 'absolute', right: 16, top: 16, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  typeText: { fontFamily: font.bold, fontSize: 12 },
  draft: { position: 'absolute', right: 16, bottom: 14, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(36,33,43,0.78)' },
  draftText: { fontFamily: font.bold, fontSize: 11, color: '#FFFFFF' },
  body: { padding: 18, gap: 10 },
  title: { fontFamily: font.bold, fontSize: 19, lineHeight: 24, color: color.ink },
  meta: { fontFamily: font.regular, fontSize: 13, color: color.muted },
  bar: { height: 8, borderRadius: 4, overflow: 'hidden', flexDirection: 'row', backgroundColor: '#F1EEE8' },
  summary: { fontFamily: font.semibold, fontSize: 13, color: color.inkSoft },
});
