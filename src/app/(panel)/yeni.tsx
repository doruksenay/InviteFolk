import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, type PressableStateCallbackType, Switch, Text, useWindowDimensions, View } from 'react-native';

import { EVENT_TYPE_ORDER, EVENT_TYPES, type EventTypeKey } from '@/core/event-types';
import { formatWhen } from '@/core/format';
import { THEME_ORDER, THEMES, type ThemeKey } from '@/core/themes';
import { createEvent } from '@/lib/api';
import { Icon } from '@/ui/Icon';
import { InvitationCard } from '@/ui/InvitationCard';
import { Body, Button, Caption, Display, DisplayItalic, Field, IconButton, Label, Notice, Pill, Surface, tapFeedback, Title } from '@/ui/primitives';
import { Screen } from '@/ui/Screen';
import { Stepper } from '@/ui/Stepper';
import { color, font, shadow, WIDE_BREAKPOINT } from '@/ui/tokens';
import { WhatsAppPreview } from '@/ui/WhatsAppPreview';

type PressState = PressableStateCallbackType & { hovered?: boolean };

const STEPS = ['Tür ve tema', 'Bilgiler', 'Davetliler', 'Gönderim'];

/** "2027-06-12" + "19:00" -> Türkiye saatiyle ISO (UTC+3) */
function toIso(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const t = /^\d{1,2}:\d{2}$/.test(time) ? time.padStart(5, '0') : '19:00';
  const d = new Date(`${date}T${t}:00+03:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export default function NewEvent() {
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;

  const [step, setStep] = useState(0);
  const [type, setType] = useState<EventTypeKey>('dugun');
  const [theme, setTheme] = useState<ThemeKey>(EVENT_TYPES.dugun.suggestedTheme);
  const [themeTouched, setThemeTouched] = useState(false);
  const [view, setView] = useState<'page' | 'wa'>('page');

  const [title, setTitle] = useState('');
  const [hosts, setHosts] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [venue, setVenue] = useState('');
  const [address, setAddress] = useState('');
  const [deadline, setDeadline] = useState('');
  const [rosterSize, setRosterSize] = useState('14');
  const [weekly, setWeekly] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cfg = EVENT_TYPES[type];
  const th = THEMES[theme];
  const startsAt = toIso(date, time);

  const copy = useMemo(
    () => ({
      greet: cfg.sample.greet,
      kicker: cfg.sample.kicker,
      title: title.trim() ? title.trim() : cfg.sample.title,
      line: cfg.sample.line,
      when: formatWhen(startsAt) ?? cfg.sample.when,
      where: venue.trim() || cfg.sample.where,
      deadline: deadline.trim() || cfg.sample.deadline,
      yes: cfg.rsvp.yes,
      no: cfg.rsvp.no,
    }),
    [cfg, title, startsAt, venue, deadline],
  );

  const pickType = (k: EventTypeKey) => {
    tapFeedback();
    setType(k);
    if (!themeTouched) setTheme(EVENT_TYPES[k].suggestedTheme);
  };

  const save = async () => {
    setError(null);
    if (!title.trim()) {
      setError('Etkinliğe bir başlık ver; davetiyede büyük yazı olarak görünecek.');
      return;
    }
    if (date && !startsAt) {
      setError('Tarihi YYYY-AA-GG biçiminde yaz, örneğin 2027-06-12.');
      return;
    }
    setSaving(true);
    try {
      const settings: Record<string, unknown> = {};
      if (cfg.questions.roster) settings.roster_size = Math.max(2, Number(rosterSize) || 14);
      if (cfg.tools.recurring) settings.recurring = weekly ? 'weekly' : null;
      if (cfg.questions.menu) settings.menu = cfg.questions.menu;
      const ev = await createEvent({
        type,
        theme,
        title: title.trim(),
        host_names: hosts.trim() || null,
        starts_at: startsAt,
        venue_name: venue.trim() || null,
        venue_address: address.trim() || null,
        rsvp_deadline: /^\d{4}-\d{2}-\d{2}$/.test(deadline) ? deadline : null,
        settings,
      });
      router.replace({ pathname: '/etkinlik/[id]', params: { id: ev.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Etkinlik kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  // ------------------------------------------------------------------ önizleme
  const preview = (
    <Surface soft style={{ gap: 18, padding: 20, borderRadius: 34 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color.sage }} />
          <Label>Canlı önizleme</Label>
        </View>
        <View accessibilityRole="tablist" style={{ flexDirection: 'row', padding: 4, borderRadius: 999, backgroundColor: '#F1ECE4' }}>
          {(['page', 'wa'] as const).map((v) => (
            <Pressable
              key={v}
              accessibilityRole="tab"
              accessibilityState={{ selected: view === v }}
              onPress={() => setView(v)}
              style={{ height: 34, paddingHorizontal: 14, borderRadius: 999, justifyContent: 'center', backgroundColor: view === v ? '#FFFFFF' : 'transparent', boxShadow: view === v ? '0px 1px 3px rgba(40,30,20,0.12)' : 'none' }}>
              <Text style={{ fontFamily: font.semibold, fontSize: 13, color: view === v ? color.ink : color.muted }}>{v === 'page' ? 'Davetiye' : 'WhatsApp'}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={{ paddingVertical: 24, paddingHorizontal: 16, borderRadius: 26, backgroundColor: th.dark ? '#3A3757' : th.shapeC }}>
        {view === 'page' ? (
          <InvitationCard theme={th} copy={copy} />
        ) : (
          <WhatsAppPreview theme={th} title={copy.title} text={cfg.sample.wa} when={copy.when} yes={cfg.rsvp.yes} no={cfg.rsvp.no} ask={cfg.rsvp.askParty} host={cfg.sample.host} />
        )}
      </View>
      <View style={{ gap: 14, paddingHorizontal: 4 }}>
        <Label>Bu türle hazır gelenler</Label>
        {cfg.features.map((f) => (
          <View key={f.title} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: cfg.iconBg, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="check" size={14} color={cfg.accent} strokeWidth={3} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: font.semibold, fontSize: 15, color: color.ink }}>{f.title}</Text>
              <Caption>{f.detail}</Caption>
            </View>
          </View>
        ))}
        <Caption style={{ paddingTop: 12, borderTopWidth: 1, borderTopColor: color.hairline }}>
          Davetliler uygulama indirmeden, tek dokunuşla cevap verir. Liste kendiliğinden güncellenir.
        </Caption>
      </View>
    </Surface>
  );

  // ------------------------------------------------------------------ adım 1
  const typeCols = width >= 1280 ? 2 : width >= 640 ? 2 : 1;
  const stepOne = (
    <View style={{ gap: 40 }}>
      <View style={{ gap: 16 }}>
        <Title>Etkinlik türü</Title>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          {EVENT_TYPE_ORDER.map((k) => {
            const c = EVENT_TYPES[k];
            const on = k === type;
            return (
              <Pressable
                key={k}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${c.name}. ${c.description}`}
                onPress={() => pickType(k)}
                style={(s: PressState) => [
                  {
                    width: typeCols === 1 ? '100%' : '48.6%',
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: 16,
                    padding: 18,
                    borderRadius: 22,
                    backgroundColor: on ? c.tint : color.surface,
                    boxShadow: on ? `0 0 0 1.5px ${c.accent}, 0px 14px 32px ${c.glow}` : shadow.card,
                  },
                  s.hovered && !on && { transform: [{ translateY: -2 }] },
                  s.pressed && { transform: [{ scale: 0.99 }] },
                ]}>
                <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: c.iconBg, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={c.icon} size={24} color={c.accent} />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ fontFamily: font.semibold, fontSize: 16, color: color.ink }}>{c.name}</Text>
                  <Text style={{ fontFamily: font.regular, fontSize: 14, lineHeight: 21, color: color.muted }}>{c.description}</Text>
                </View>
                <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.accent : 'transparent', boxShadow: on ? 'none' : `inset 0 0 0 1.5px ${color.ring}` }}>
                  {on && <Icon name="check" size={12} color="#FFFFFF" strokeWidth={3.5} />}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ gap: 16 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <Title>Davetiye teması</Title>
          <Caption>Renkler ve yazılar sonradan değişebilir</Caption>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
          {THEME_ORDER.map((k) => {
            const t = THEMES[k];
            const on = k === theme;
            return (
              <Pressable
                key={k}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${t.name} teması`}
                onPress={() => {
                  tapFeedback();
                  setTheme(k);
                  setThemeTouched(true);
                }}
                style={(s: PressState) => [{ width: 104, gap: 10 }, s.hovered && { transform: [{ translateY: -3 }] }]}>
                <View
                  style={{
                    width: 104,
                    height: 130,
                    borderRadius: 18,
                    overflow: 'hidden',
                    backgroundColor: t.bg,
                    boxShadow: on ? `0 0 0 2px ${color.bg}, 0 0 0 4px ${color.ink}, 0px 12px 26px rgba(40,30,20,0.14)` : shadow.card,
                  }}>
                  <View style={{ position: 'absolute', left: -22, top: -22, width: 80, height: 80, borderRadius: 40, backgroundColor: t.shapeA }} />
                  <View style={{ position: 'absolute', right: 12, top: 30, width: 36, height: 60, borderTopLeftRadius: 18, borderTopRightRadius: 18, backgroundColor: t.shapeB }} />
                  <Text style={{ position: 'absolute', left: 12, bottom: 12, fontFamily: font.serif, fontSize: 20, color: t.ink }}>A & M</Text>
                  {on && (
                    <View style={{ position: 'absolute', right: 8, top: 8, width: 22, height: 22, borderRadius: 11, backgroundColor: color.ink, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="check" size={11} color="#FFFFFF" strokeWidth={3.5} />
                    </View>
                  )}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                  <Text style={{ fontFamily: font.semibold, fontSize: 14, color: color.ink }}>{t.name}</Text>
                  {k === cfg.suggestedTheme && !on && <Pill label="Önerilen" bg={color.lavenderTint} fg={color.lavenderInk} style={{ paddingHorizontal: 7, paddingVertical: 2 }} />}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );

  // ------------------------------------------------------------------ adım 2
  const half = wide || width >= 640 ? '48.5%' : '100%';
  const stepTwo = (
    <Surface style={{ gap: 18 }}>
      <Field label="Davetiye başlığı" placeholder={cfg.sample.title.replace('\n', ' ')} value={title} onChangeText={setTitle} hint="Davetiyede büyük yazı olarak görünür. Satır atlamak için Enter'a bas." multiline={false} />
      <Field label="Davet edenler" placeholder="Yılmaz ve Kaya aileleri" value={hosts} onChangeText={setHosts} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        <Field style={{ width: half }} label="Tarih" placeholder="2027-06-12" value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" hint="YYYY-AA-GG" />
        <Field style={{ width: half }} label="Saat" placeholder="19:00" value={time} onChangeText={setTime} keyboardType="numbers-and-punctuation" />
      </View>
      <Field label="Mekân" placeholder="Kalamış Davet Salonu" value={venue} onChangeText={setVenue} />
      <Field label="Adres" placeholder="Fenerbahçe Mah., Kadıköy / İstanbul" value={address} onChangeText={setAddress} />
      <Field label="Cevap için son gün" placeholder="2027-05-01" value={deadline} onChangeText={setDeadline} keyboardType="numbers-and-punctuation" hint="Cevap vermeyenlere bu tarihten önce hatırlatma gider." />
      {cfg.questions.roster && <Field label="Kadro kaç kişi?" value={rosterSize} onChangeText={setRosterSize} keyboardType="number-pad" hint="Kadro dolunca gelen cevaplar yedek listesine girer." />}
      {cfg.tools.recurring && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Label>Her hafta tekrarla</Label>
            <Caption>Davet her hafta aynı gün kendiliğinden gönderilir.</Caption>
          </View>
          <Switch value={weekly} onValueChange={setWeekly} trackColor={{ true: cfg.accent, false: '#DDD6CC' }} />
        </View>
      )}
    </Surface>
  );

  // ------------------------------------------------------------------ yerleşim
  const summaryBar = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16, padding: 16, paddingLeft: 20, borderRadius: 26, backgroundColor: color.surface, boxShadow: shadow.raised }}>
      <View style={{ width: 44, height: 44, borderRadius: 14, overflow: 'hidden', backgroundColor: th.bg }}>
        <View style={{ position: 'absolute', right: -10, bottom: -10, width: 34, height: 34, borderRadius: 17, backgroundColor: th.shapeA }} />
      </View>
      <View style={{ flex: 1, minWidth: 160 }}>
        <Caption>Seçimin</Caption>
        <Text style={{ fontFamily: font.semibold, fontSize: 16, color: color.ink }}>
          {cfg.name} · {th.name} teması
        </Text>
      </View>
      {step === 1 && <Button label="Geri" variant="ghost" onPress={() => setStep(0)} />}
      <Button label={step === 0 ? 'Devam et' : 'Etkinliği oluştur'} size="lg" iconRight="arrowRight" loading={saving} onPress={step === 0 ? () => setStep(1) : save} />
    </View>
  );

  return (
    <Screen>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <IconButton icon="arrowLeft" label="Etkinliklerime dön" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <Stepper steps={STEPS} current={step} />
        <View style={{ width: 42 }} />
      </View>

      <View style={{ flexDirection: wide ? 'row' : 'column', gap: wide ? 56 : 28, alignItems: 'flex-start' }}>
        <View style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%', gap: 32 }}>
          <View style={{ gap: 12 }}>
            <Pill label={`ADIM ${step + 1} / 4`} bg={color.lavenderTint} fg={color.lavenderInk} />
            {step === 0 ? (
              <Display size={wide ? 64 : 46}>
                Ne <DisplayItalic style={{ color: color.lavender }}>kutluyoruz?</DisplayItalic>
              </Display>
            ) : (
              <Display size={wide ? 64 : 46}>
                Biraz <DisplayItalic style={{ color: color.lavender }}>ayrıntı.</DisplayItalic>
              </Display>
            )}
            <Body style={{ maxWidth: 540, fontSize: 17, lineHeight: 27 }}>
              {step === 0
                ? 'Türü seç; davetiye, cevap seçenekleri ve araçlar ona göre hazırlansın. Her şeyi sonra değiştirebilirsin.'
                : 'Yazdıkça sağdaki davetiye güncellenir. Boş bıraktıklarını sonra tamamlayabilirsin.'}
            </Body>
          </View>
          {step === 0 ? stepOne : stepTwo}
          {error && <Notice tone="error" text={error} />}
          {wide && summaryBar}
        </View>
        <View style={{ width: wide ? 460 : '100%' }}>{preview}</View>
        {!wide && <View style={{ width: '100%' }}>{summaryBar}</View>}
      </View>
    </Screen>
  );
}
