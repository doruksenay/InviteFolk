import { Text, useWindowDimensions, View } from 'react-native';

import { EVENT_TYPE_ORDER, getEventType } from '@/core/event-types';
import { formatTry } from '@/core/format';
import { adminRecentEvents, adminRecentUsers, adminStats, useQuery } from '@/lib/api';
import { BrandBar } from '@/ui/BrandBar';
import { Avatar, Body, Button, Caption, Display, DisplayItalic, Notice, Pill, Skeleton, Surface, Title } from '@/ui/primitives';
import { Screen } from '@/ui/Screen';
import { color, font, radius } from '@/ui/tokens';

const dateFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
const num = (n: number) => n.toLocaleString('tr-TR');
const PLAN_LABEL: Record<string, string> = { free: 'Ücretsiz', temel: 'Temel', otomatik: 'Otomatik', tam: 'Tam', b2b: 'İşletme' };

/** Platform yönetim paneli: kullanıcılar, etkinlikler, mesaj sağlığı ve gelir. Yalnızca admin rolü açar. */
export default function AdminHome() {
  const { width } = useWindowDimensions();
  const wide = width >= 980;
  const stats = useQuery(adminStats, []);
  const users = useQuery(() => adminRecentUsers(12), []);
  const events = useQuery(() => adminRecentEvents(12), []);

  const s = stats.data;
  const responseRate = s && s.invitations ? Math.round((s.responses / s.invitations) * 100) : 0;
  const failRate = s && s.messages_sent + s.messages_failed ? Math.round((s.messages_failed / (s.messages_sent + s.messages_failed)) * 100) : 0;
  const maxType = s ? Math.max(1, ...Object.values(s.events_by_type ?? {})) : 1;

  const card = (label: string, value: string, sub: string, bg: string, ink: string) => (
    <View key={label} style={{ flexGrow: 1, flexBasis: wide ? 0 : '45%', minWidth: 150, backgroundColor: bg, borderRadius: radius.xl, padding: 20, gap: 4 }}>
      <Text style={{ fontFamily: font.semibold, fontSize: 13, color: ink }}>{label}</Text>
      <Text style={{ fontFamily: font.serif, fontSize: 42, lineHeight: 44, color: ink }}>{value}</Text>
      <Text style={{ fontFamily: font.medium, fontSize: 13, color: ink, opacity: 0.85 }}>{sub}</Text>
    </View>
  );

  return (
    <Screen>
      <BrandBar area="admin" />
      <View style={{ gap: 8 }}>
        <Display size={wide ? 56 : 42}>
          Platform <DisplayItalic style={{ color: color.lavender }}>özeti</DisplayItalic>
        </Display>
        <Body>Kullanıcılar, etkinlikler ve WhatsApp teslim sağlığı tek bakışta.</Body>
      </View>

      {stats.error && (
        <View style={{ gap: 10 }}>
          <Notice tone="error" text="İstatistikler alınamadı. Hesabının admin rolü olduğundan emin ol." />
          <Button label="Tekrar dene" variant="secondary" onPress={stats.reload} style={{ alignSelf: 'flex-start' }} />
        </View>
      )}

      {!s && stats.loading ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ flexGrow: 1, flexBasis: wide ? 0 : '45%' }}>
              <Skeleton height={120} radius={28} />
            </View>
          ))}
        </View>
      ) : s ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          {card('Kullanıcı', num(s.users), `son 7 günde +${num(s.users_7d)}`, color.lavenderTint, color.lavenderInk)}
          {card('Etkinlik', num(s.events), `${num(s.active_events)} aktif`, color.coralTint, color.coralInk)}
          {card('Cevap oranı', `%${responseRate}`, `${num(s.responses)} / ${num(s.invitations)} davet`, color.sageTint, color.sageInk)}
          {card('WhatsApp', num(s.messages_sent), `%${failRate} ulaşmadı`, color.goldTint, color.goldInk)}
          {card('Gelir', formatTry(Number(s.revenue_try)), 'ödenmiş paketler', color.surface, color.ink)}
        </View>
      ) : null}

      <View style={{ flexDirection: wide ? 'row' : 'column', gap: 20, alignItems: 'flex-start' }}>
        <Surface style={{ width: wide ? 360 : '100%', gap: 14 }}>
          <Title>Etkinlik türleri</Title>
          {EVENT_TYPE_ORDER.map((k) => {
            const t = getEventType(k);
            const n = s?.events_by_type?.[k] ?? 0;
            return (
              <View key={k} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontFamily: font.semibold, fontSize: 14, color: color.ink }}>{t.name}</Text>
                  <Text style={{ fontFamily: font.bold, fontSize: 14, color: color.ink }}>{n}</Text>
                </View>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: '#F1EEE8', overflow: 'hidden' }}>
                  <View style={{ height: 8, width: `${Math.round((n / maxType) * 100)}%`, backgroundColor: t.accent, borderRadius: 4 }} />
                </View>
              </View>
            );
          })}
        </Surface>

        <View style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%', gap: 20 }}>
          <Surface style={{ gap: 4 }}>
            <Title style={{ marginBottom: 8 }}>Son kullanıcılar</Title>
            {(users.data ?? []).map((u, i) => (
              <View key={u.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: color.hairline }}>
                <Avatar text={(u.full_name ?? '?').charAt(0).toLocaleUpperCase('tr-TR')} index={i} size={36} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: font.semibold, fontSize: 14, color: color.ink }}>{u.full_name ?? 'İsimsiz'}</Text>
                  <Caption>{dateFmt.format(new Date(u.created_at))}</Caption>
                </View>
                {u.role === 'admin' && <Pill label="Admin" bg={color.ink} fg="#FFFFFF" />}
                <Pill label={PLAN_LABEL[u.plan] ?? u.plan} bg={u.plan === 'free' ? color.surfaceSoft : color.sageTint} fg={u.plan === 'free' ? color.inkSoft : color.sageInk} />
              </View>
            ))}
            {users.data?.length === 0 && <Caption>Henüz kullanıcı yok.</Caption>}
          </Surface>

          <Surface style={{ gap: 4 }}>
            <Title style={{ marginBottom: 8 }}>Son etkinlikler</Title>
            {(events.data ?? []).map((e, i) => {
              const t = getEventType(e.type);
              return (
                <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: color.hairline }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.accent }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: font.semibold, fontSize: 14, color: color.ink }} numberOfLines={1}>
                      {e.title}
                    </Text>
                    <Caption>
                      {t.name} · {e.summary?.households ?? 0} hane · {e.summary?.attending_people ?? 0} kişi geliyor
                    </Caption>
                  </View>
                  <Pill
                    label={e.status === 'active' ? 'Aktif' : e.status === 'draft' ? 'Taslak' : 'Arşiv'}
                    bg={e.status === 'active' ? color.sageTint : color.surfaceSoft}
                    fg={e.status === 'active' ? color.sageInk : color.inkSoft}
                  />
                </View>
              );
            })}
            {events.data?.length === 0 && <Caption>Henüz etkinlik yok.</Caption>}
          </Surface>
        </View>
      </View>
    </Screen>
  );
}
