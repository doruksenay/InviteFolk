import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Pressable, Text, useWindowDimensions, View } from 'react-native';

import { getEventType } from '@/core/event-types';
import { daysUntil, formatWhen, initials, normalizePhone, rsvpUrl, waMeLink } from '@/core/format';
import { getTheme } from '@/core/themes';
import type { InvitationWithContact, RsvpStatus, Side } from '@/core/types';
import { addGuest, getEvent, removeInvitation, sendInvitations, setInvitationStatus, useQuery } from '@/lib/api';
import { Icon } from '@/ui/Icon';
import { Avatar, Body, Button, Caption, Display, Field, IconButton, Label, Notice, Pill, Skeleton, StatusBadge, Surface, Title } from '@/ui/primitives';
import { Screen } from '@/ui/Screen';
import { color, font, radius, shadow, status as statusTokens } from '@/ui/tokens';

type Filter = 'all' | RsvpStatus | 'failed';

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const { data, loading, error, reload } = useQuery(() => getEvent(id), [id]);

  const [filter, setFilter] = useState<Filter>('all');
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [sending, setSending] = useState(false);

  // Davetli ekleme formu
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [side, setSide] = useState<Side | null>(null);
  const [maxParty, setMaxParty] = useState('2');
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const invitations = useMemo(() => data?.invitations ?? [], [data]);
  const filtered = useMemo(
    () => invitations.filter((i) => filter === 'all' || (filter === 'failed' ? i.delivery === 'failed' : i.status === filter)),
    [invitations, filter],
  );

  if (loading && !data) {
    return (
      <Screen>
        <Skeleton height={44} width="50%" />
        <Skeleton height={120} radius={24} />
        <Skeleton height={320} radius={24} />
      </Screen>
    );
  }

  if (error || !data) {
    return (
      <Screen maxWidth={640}>
        <Notice tone="error" text="Etkinlik açılamadı. Silinmiş olabilir ya da bağlantı sorunu var." />
        <Button label="Etkinliklerime dön" variant="secondary" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  const { event, summary } = data;
  const cfg = getEventType(event.type);
  const theme = getTheme(event.theme);
  const days = daysUntil(event.starts_at);
  const counts = {
    all: invitations.length,
    yes: invitations.filter((i) => i.status === 'yes').length,
    pending: invitations.filter((i) => i.status === 'pending').length,
    no: invitations.filter((i) => i.status === 'no').length,
    failed: invitations.filter((i) => i.delivery === 'failed').length,
  };

  const inviteText = (inv: InvitationWithContact) =>
    `${inv.contacts.name}, ${event.title} davetiniz: ${[formatWhen(event.starts_at), event.venue_name].filter(Boolean).join(' · ')}\nKatılım durumunuzu buradan bildirebilirsiniz: ${rsvpUrl(inv.token)}`;

  const submitGuest = async () => {
    setFormError(null);
    if (!name.trim()) {
      setFormError('Davetlinin ya da hanenin adını yaz.');
      return;
    }
    const normalized = phone.trim() ? normalizePhone(phone) : null;
    if (phone.trim() && !normalized) {
      setFormError('Telefon numarası geçersiz görünüyor. Örnek: 0532 123 45 67');
      return;
    }
    setAdding(true);
    try {
      await addGuest(event.id, { name: name.trim(), phone: normalized, side, max_party: Math.min(20, Math.max(1, Number(maxParty) || 1)) });
      setName('');
      setPhone('');
      setFeedback({ tone: 'success', text: `${name.trim()} listeye eklendi.` });
      reload();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Davetli eklenemedi.');
    } finally {
      setAdding(false);
    }
  };

  const sendAll = async (kind: 'invite' | 'reminder') => {
    setSending(true);
    setFeedback({ tone: 'info', text: kind === 'invite' ? 'Davetler gönderiliyor…' : 'Hatırlatmalar gönderiliyor…' });
    try {
      const r = await sendInvitations(event.id, kind);
      setFeedback({
        tone: r.failed ? 'error' : 'success',
        text: `${r.sent} mesaj gönderildi${r.failed ? `, ${r.failed} mesaj ulaşmadı` : ''}${r.skipped ? `, ${r.skipped} davetlinin telefonu yok` : ''}.`,
      });
      reload();
    } catch {
      setFeedback({
        tone: 'error',
        text: 'Otomatik gönderim şu an kullanılamıyor. WhatsApp entegrasyonu kurulana kadar her davetlinin yanındaki WhatsApp butonunu kullanabilirsin.',
      });
    } finally {
      setSending(false);
    }
  };

  const setStatus = async (inv: InvitationWithContact, s: RsvpStatus) => {
    await setInvitationStatus(inv.id, s, s === 'yes' ? inv.party_size ?? 1 : 0);
    reload();
  };

  const stat = (label: string, value: string, tone: keyof typeof statusTokens | 'neutral') => {
    const t = tone === 'neutral' ? { bg: color.surface, ink: color.ink } : statusTokens[tone];
    return (
      <View key={label} style={{ flexGrow: 1, flexBasis: wide ? 0 : '45%', backgroundColor: t.bg, borderRadius: radius.xl, padding: 20, gap: 6, boxShadow: tone === 'neutral' ? shadow.card : 'none' }}>
        <Text style={{ fontFamily: font.serif, fontSize: 40, lineHeight: 42, color: t.ink }}>{value}</Text>
        <Text style={{ fontFamily: font.semibold, fontSize: 14, color: t.ink }}>{label}</Text>
      </View>
    );
  };

  return (
    <Screen>
      {/* Başlık */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14 }}>
        <IconButton icon="arrowLeft" label="Etkinliklerime dön" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <View style={{ flex: 1, minWidth: 240, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Pill label={cfg.name} bg={cfg.iconBg} fg={color.ink} />
            {event.status === 'draft' && <Pill label="Taslak" bg={color.ink} fg="#FFFFFF" />}
          </View>
          <Display size={wide ? 48 : 38}>{event.title}</Display>
          <Caption>{[formatWhen(event.starts_at), event.venue_name].filter(Boolean).join(' · ') || 'Tarih ve yer eklenmedi'}</Caption>
        </View>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          {counts.pending > 0 && invitations.some((i) => i.delivery !== 'not_sent') && (
            <Button label={`${counts.pending} haneye hatırlat`} variant="secondary" icon="send" loading={sending} onPress={() => sendAll('reminder')} />
          )}
          <Button label="WhatsApp ile davet et" variant="accent" icon="send" loading={sending} disabled={!invitations.length} onPress={() => sendAll('invite')} />
        </View>
      </View>

      {feedback && <Notice tone={feedback.tone} text={feedback.text} />}

      {/* Özet */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
        {stat('kişi geliyor', String(summary?.attending_people ?? 0), 'yes')}
        {stat('hane cevap bekliyor', String(counts.pending), 'pending')}
        {stat('hane gelmiyor', String(counts.no), 'no')}
        {days !== null && days >= 0
          ? stat('gün kaldı', String(days), 'neutral')
          : stat('hane davetli', String(counts.all), 'neutral')}
      </View>

      <View style={{ flexDirection: wide ? 'row' : 'column', gap: 20, alignItems: 'flex-start' }}>
        {/* Davetli ekle */}
        <Surface style={{ width: wide ? 360 : '100%', gap: 14 }}>
          <Title>Davetli ekle</Title>
          <Field label="Ad ya da hane" placeholder="Ahmet Yılmaz ve ailesi" value={name} onChangeText={setName} />
          <Field label="Telefon" placeholder="0532 123 45 67" keyboardType="phone-pad" value={phone} onChangeText={setPhone} hint="WhatsApp için. Boş bırakırsan linkle davet edebilirsin." />
          {cfg.tools.seating && (
            <View style={{ gap: 8 }}>
              <Label>Taraf</Label>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['gelin', 'damat', 'ortak'] as Side[]).map((s) => (
                  <Pressable
                    key={s}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: side === s }}
                    onPress={() => setSide(side === s ? null : s)}
                    style={{ paddingHorizontal: 14, height: 38, borderRadius: 999, justifyContent: 'center', backgroundColor: side === s ? color.ink : color.surfaceSoft }}>
                    <Text style={{ fontFamily: font.semibold, fontSize: 13, color: side === s ? '#FFFFFF' : color.inkSoft }}>
                      {s === 'gelin' ? 'Gelin tarafı' : s === 'damat' ? 'Damat tarafı' : 'Ortak'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
          {cfg.questions.partySize && <Field label="En fazla kaç kişi?" keyboardType="number-pad" value={maxParty} onChangeText={setMaxParty} />}
          {formError && <Notice tone="error" text={formError} />}
          <Button label="Listeye ekle" icon="plus" loading={adding} onPress={submitGuest} />
          <Caption>Excel’den toplu aktarma bir sonraki adımda geliyor.</Caption>
        </Surface>

        {/* Liste */}
        <Surface style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%', gap: 16 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <Display size={32}>Davetliler</Display>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(
                [
                  ['all', 'Tümü', counts.all],
                  ['yes', 'Geliyor', counts.yes],
                  ['pending', 'Bekliyor', counts.pending],
                  ['no', 'Gelmiyor', counts.no],
                  ['failed', 'Ulaşılamadı', counts.failed],
                ] as [Filter, string, number][]
              ).map(([k, label, n]) => {
                const on = filter === k;
                return (
                  <Pressable
                    key={k}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    onPress={() => setFilter(k)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 38, paddingLeft: 14, paddingRight: 8, borderRadius: 999, backgroundColor: on ? color.ink : color.surface, boxShadow: on ? 'none' : `inset 0 0 0 1px ${color.hairline}` }}>
                    <Text style={{ fontFamily: font.semibold, fontSize: 13, color: on ? '#FFFFFF' : color.inkSoft }}>{label}</Text>
                    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: on ? 'rgba(255,255,255,0.18)' : color.surfaceSoft }}>
                      <Text style={{ fontFamily: font.bold, fontSize: 12, color: on ? '#FFFFFF' : color.inkSoft }}>{n}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {invitations.length === 0 ? (
            <View style={{ paddingVertical: 40, alignItems: 'center', gap: 8, borderRadius: radius.lg, backgroundColor: color.surfaceSoft }}>
              <Text style={{ fontFamily: font.serif, fontSize: 28, color: color.ink }}>Liste henüz boş</Text>
              <Body center>Soldan ilk davetlini ekle. Her davetliye özel bir cevap linki oluşur.</Body>
            </View>
          ) : filtered.length === 0 ? (
            <View style={{ paddingVertical: 32, alignItems: 'center', gap: 6, borderRadius: radius.lg, backgroundColor: color.surfaceSoft }}>
              <Text style={{ fontFamily: font.serif, fontSize: 26, color: color.ink }}>Bu filtrede kimse yok</Text>
              <Body center>Başka bir durum seç.</Body>
            </View>
          ) : (
            filtered.map((inv, idx) => (
              <View key={inv.id} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: idx ? 1 : 0, borderTopColor: color.hairline }}>
                <Avatar text={initials(inv.contacts.name)} index={idx} />
                <View style={{ flex: 1, minWidth: 160, gap: 2 }}>
                  <Text style={{ fontFamily: font.semibold, fontSize: 15, color: color.ink }}>{inv.contacts.name}</Text>
                  <Caption>
                    {[inv.contacts.phone ?? 'Telefon yok', inv.status === 'yes' ? `${inv.party_size ?? 1} kişi` : `en fazla ${inv.contacts.max_party} kişi`, inv.menu].filter(Boolean).join(' · ')}
                  </Caption>
                  {inv.delivery === 'failed' && <Caption color={color.coralInk}>WhatsApp mesajı ulaşmadı</Caption>}
                </View>
                <StatusBadge status={inv.status} />
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <SmallAction icon="whatsapp" label="WhatsApp'tan gönder" onPress={() => Linking.openURL(waMeLink(inv.contacts.phone, inviteText(inv)))} />
                  <SmallAction
                    icon="copy"
                    label="Cevap linkini kopyala"
                    onPress={async () => {
                      await Clipboard.setStringAsync(rsvpUrl(inv.token));
                      setFeedback({ tone: 'success', text: `${inv.contacts.name} için cevap linki kopyalandı.` });
                    }}
                  />
                  <SmallAction icon="check" label="Geliyor olarak işaretle" onPress={() => setStatus(inv, 'yes')} />
                  <SmallAction icon="close" label="Gelmiyor olarak işaretle" onPress={() => setStatus(inv, 'no')} />
                  <SmallAction
                    icon="trash"
                    tone="danger"
                    label="Listeden çıkar"
                    onPress={async () => {
                      await removeInvitation(inv.id);
                      reload();
                    }}
                  />
                </View>
              </View>
            ))
          )}
        </Surface>
      </View>

      <Surface style={{ flexDirection: wide ? 'row' : 'column', gap: 20, alignItems: wide ? 'center' : 'flex-start', backgroundColor: theme.bg }}>
        <View style={{ flex: wide ? 1 : undefined, gap: 6 }}>
          <Title color={theme.ink}>Davetlinin gördüğü sayfa</Title>
          <Body color={theme.soft}>Her davetliye özel link, giriş istemeden açılır ve cevap anında bu listeye düşer.</Body>
        </View>
        {invitations[0] && (
          <Button label="Örnek davetiyeyi aç" variant="secondary" iconRight="arrowRight" onPress={() => router.push({ pathname: '/r/[token]', params: { token: invitations[0].token } })} />
        )}
      </Surface>
    </Screen>
  );
}

function SmallAction({ icon, label, onPress, tone }: { icon: 'whatsapp' | 'copy' | 'check' | 'close' | 'trash'; label: string; onPress: () => void; tone?: 'danger' }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: tone === 'danger' ? color.coralTint : color.surfaceSoft }, pressed && { transform: [{ scale: 0.94 }] }]}>
      <Icon name={icon} size={16} color={tone === 'danger' ? color.coralInk : color.ink} strokeWidth={2} />
    </Pressable>
  );
}
