import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, type PressableStateCallbackType, Text, useWindowDimensions, View } from 'react-native';

import { EVENT_TYPE_ORDER, EVENT_TYPES, eventCopy, type EventTypeKey, SPORTS } from '@/core/event-types';
import { formatDayMonth, formatWhen } from '@/core/format';
import { THEMES, type ThemeKey } from '@/core/themes';
import type { EventRow } from '@/core/types';
import { type Lang, LOCALE_TAG, useI18n } from '@/i18n';
import { createEvent, getEvent, useQuery } from '@/lib/api';
import { normDate, toIso } from '@/ui/eventForm/dates';
import { LangPicker, ThemePicker } from '@/ui/eventForm/Pickers';
import { GuestAdder } from '@/ui/guests/GuestAdder';
import { Icon } from '@/ui/Icon';
import { InvitationCard } from '@/ui/InvitationCard';
import { Body, Button, Caption, Display, DisplayAccent, Field, IconButton, Label, Notice, Pill, Surface, tapFeedback, Title, ToggleRow } from '@/ui/primitives';
import { Screen } from '@/ui/Screen';
import { ThemeArt } from '@/ui/theme/ThemeArt';
import { SendPanel } from '@/ui/send/SendPanel';
import { Stepper } from '@/ui/Stepper';
import { color, font, shadow, WIDE_BREAKPOINT } from '@/ui/tokens';
import { WhatsAppPreview } from '@/ui/WhatsAppPreview';
import { DateField, TimeField } from '@/ui/eventForm/DateField';

type PressState = PressableStateCallbackType & { hovered?: boolean };

const STEP_COPY = [
  { title: 'wizard.step1Title', accent: 'wizard.step1Accent', body: 'wizard.step1Body' },
  { title: 'wizard.step2Title', accent: 'wizard.step2Accent', body: 'wizard.step2Body' },
  { title: 'wizard.step3Title', accent: 'wizard.step3Accent', body: 'wizard.step3Body' },
  { title: 'wizard.step4Title', accent: 'wizard.step4Accent', body: 'wizard.step4Body' },
] as const;

export default function NewEvent() {
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;
  const { t, lang: uiLang } = useI18n();
  const STEPS = [t('wizard.steps.type'), t('wizard.steps.details'), t('wizard.steps.guests'), t('wizard.steps.send')];

  const [step, setStep] = useState(0);
  const [type, setType] = useState<EventTypeKey>('dugun');
  const [theme, setTheme] = useState<ThemeKey>(EVENT_TYPES.dugun.suggestedTheme);
  const [themeTouched, setThemeTouched] = useState(false);
  const [view, setView] = useState<'page' | 'wa'>('page');
  // Davetiyenin dili: davetlinin göreceği metinler ve tarih biçimi buna göre.
  const [eventLang, setEventLang] = useState<Lang>(uiLang);

  const [title, setTitle] = useState('');
  const [hosts, setHosts] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [venue, setVenue] = useState('');
  const [address, setAddress] = useState('');
  const [deadline, setDeadline] = useState('');
  const [more, setMore] = useState(false);
  const [rosterSize, setRosterSize] = useState('14');
  const [weekly, setWeekly] = useState(true);
  const [message, setMessage] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 2. adımdan sonra etkinlik oluşur; 3-4. adımlar bu kayıt üzerinde çalışır.
  const [created, setCreated] = useState<EventRow | null>(null);
  const [sentAny, setSentAny] = useState(false);
  const guestsQ = useQuery(() => (created ? getEvent(created.id) : Promise.resolve(null)), [created?.id ?? '']);
  const invitations = guestsQ.data?.invitations ?? [];

  const cfg = EVENT_TYPES[type];
  const ec = eventCopy(type, eventLang); // davetliye görünen metinler
  const uiCopy = eventCopy(type, uiLang); // organizatöre görünen tür adı ve özellikler
  const th = THEMES[theme];
  const startsAt = date ? toIso(date, time) : null;
  const eventLocale = LOCALE_TAG[eventLang];
  const deadlineIso = normDate(deadline);
  const deadlineText = deadlineIso ? formatDayMonth(deadlineIso, eventLocale) : '';

  const copy = useMemo(
    () => ({
      greet: ec.sample.greet,
      kicker: ec.sample.kicker,
      title: title.trim() ? title.trim() : ec.sample.title,
      line: message.trim() || ec.sample.line,
      when: formatWhen(startsAt, eventLocale) ?? ec.sample.when,
      where: venue.trim() || ec.sample.where,
      deadline: deadlineText || ec.sample.deadline,
      yes: ec.rsvp.yes,
      no: ec.rsvp.no,
    }),
    [ec, title, startsAt, eventLocale, venue, deadlineText, message],
  );

  const goToEvent = () => {
    if (created) router.replace({ pathname: '/etkinlik/[id]', params: { id: created.id } });
  };

  const pickType = (k: EventTypeKey) => {
    tapFeedback();
    setType(k);
    if (!themeTouched) setTheme(EVENT_TYPES[k].suggestedTheme);
    const sp = EVENT_TYPES[k].sport;
    if (sp) setRosterSize(String(SPORTS[sp].defaultRoster));
  };

  const save = async () => {
    setError(null);
    if (!title.trim()) {
      setError(t('wizard.errors.title'));
      return;
    }
    if (date && !startsAt) {
      setError(t('wizard.errors.date'));
      return;
    }
    setSaving(true);
    try {
      const settings: Record<string, unknown> = { lang: eventLang };
      if (cfg.questions.roster) settings.roster_size = Math.max(2, Number(rosterSize) || 14);
      if (cfg.tools.recurring) settings.recurring = weekly ? 'weekly' : null;
      if (cfg.questions.menu && ec.menu) settings.menu = ec.menu;
      if (message.trim()) settings.message = message.trim().slice(0, 400);
      if (created) {
        setStep(2);
        return;
      }
      const ev = await createEvent({
        type,
        theme,
        title: title.trim(),
        host_names: hosts.trim() || null,
        starts_at: startsAt,
        venue_name: venue.trim() || null,
        venue_address: address.trim() || null,
        rsvp_deadline: deadlineIso,
        settings,
      });
      setCreated(ev);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('wizard.errors.save'));
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
          <Label>{t('wizard.preview')}</Label>
        </View>
        <View accessibilityRole="tablist" style={{ flexDirection: 'row', padding: 4, borderRadius: 999, backgroundColor: '#F1ECE4' }}>
          {(['page', 'wa'] as const).map((v) => (
            <Pressable
              key={v}
              accessibilityRole="tab"
              accessibilityState={{ selected: view === v }}
              onPress={() => setView(v)}
              style={{ height: 34, paddingHorizontal: 14, borderRadius: 999, justifyContent: 'center', backgroundColor: view === v ? '#FFFFFF' : 'transparent', boxShadow: view === v ? '0px 1px 3px rgba(40,30,20,0.12)' : 'none' }}>
              <Text style={{ fontFamily: font.semibold, fontSize: 13, color: view === v ? color.ink : color.muted }}>{v === 'page' ? t('wizard.tabInvitation') : t('wizard.tabWhatsApp')}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={{ paddingVertical: 24, paddingHorizontal: 16, borderRadius: 26, backgroundColor: th.dark ? '#3A3757' : th.shapeC }}>
        {view === 'page' ? (
          <InvitationCard theme={th} copy={copy} lang={eventLang} effect={th.effect} />
        ) : (
          <WhatsAppPreview
            theme={th}
            title={copy.title}
            text={ec.sample.wa}
            when={copy.when}
            yes={ec.rsvp.yes}
            no={ec.rsvp.no}
            ask={ec.rsvp.askParty}
            host={ec.sample.host}
            lang={eventLang}
          />
        )}
      </View>
      <View style={{ gap: 14, paddingHorizontal: 4 }}>
        <Label>{t('wizard.includes')}</Label>
        {uiCopy.features.map((f) => (
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
          {t('wizard.guestsNote')}
        </Caption>
      </View>
    </Surface>
  );

  // ------------------------------------------------------------------ adım 1
  const typeCols = width >= 1280 ? 2 : width >= 640 ? 2 : 1;
  const stepOne = (
    <View style={{ gap: 40 }}>
      <View style={{ gap: 16 }}>
        <Title>{t('wizard.eventType')}</Title>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          {EVENT_TYPE_ORDER.map((k) => {
            const c = EVENT_TYPES[k];
            const cc = eventCopy(k, uiLang);
            const on = k === type;
            return (
              <Pressable
                key={k}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${cc.name}. ${cc.description}`}
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
                  <Text style={{ fontFamily: font.semibold, fontSize: 16, color: color.ink }}>{cc.name}</Text>
                  <Text style={{ fontFamily: font.regular, fontSize: 14, lineHeight: 21, color: color.muted }}>{cc.description}</Text>
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
          <Title>{t('wizard.theme')}</Title>
          <Caption>{t('wizard.themeHint')}</Caption>
        </View>
        <ThemePicker
          value={theme}
          suggested={cfg.suggestedTheme}
          onChange={(k) => {
            setTheme(k);
            setThemeTouched(true);
          }}
        />
      </View>
    </View>
  );

  // ------------------------------------------------------------------ adım 2
  const half = wide || width >= 640 ? '48.5%' : '100%';
  const stepTwo = (
    <Surface style={{ gap: 18 }}>
      <View style={{ gap: 8 }}>
        <Label>{t('wizard.language')}</Label>
        <LangPicker value={eventLang} onChange={setEventLang} />
        <Caption>{t('wizard.languageHint')}</Caption>
      </View>
      <Field label={t('wizard.fields.title')} placeholder={ec.sample.title.replace('\n', ' ')} value={title} onChangeText={setTitle} hint={t('wizard.fields.titleHint')} multiline={false} />
      <Field label={t('wizard.fields.hosts')} placeholder={t('wizard.fields.hostsPlaceholder')} value={hosts} onChangeText={setHosts} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        <DateField style={{ width: half }} label={t('wizard.fields.date')} value={date} onChange={setDate} />
        <TimeField style={{ width: half }} label={t('wizard.fields.time')} value={time} onChange={setTime} />
      </View>
      <Field label={t('wizard.fields.venue')} placeholder={t('wizard.fields.venuePlaceholder')} value={venue} onChangeText={setVenue} />
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: more }}
        onPress={() => setMore((m) => !m)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingVertical: 4 }}>
        <Icon name={more ? 'minus' : 'plus'} size={16} color={color.lavenderInk} strokeWidth={2.2} />
        <Text style={{ fontFamily: font.bold, fontSize: 15, color: color.lavenderInk }}>{more ? t('wizard.lessDetails') : t('wizard.moreDetails')}</Text>
      </Pressable>
      {!more && <Caption style={{ marginTop: -10 }}>{t('wizard.moreDetailsHint')}</Caption>}
      {more && (
        <>
          <Field label={t('wizard.fields.address')} placeholder={t('wizard.fields.addressPlaceholder')} value={address} onChangeText={setAddress} />
          <DateField label={t('wizard.fields.deadline')} value={deadline} onChange={setDeadline} hint={t('wizard.fields.deadlineHint')} />
          <Field label={t('tools.page.message.title')} placeholder={ec.sample.line} value={message} onChangeText={setMessage} multiline maxLength={400} hint={t('tools.page.message.hint')} />
        </>
      )}
      {cfg.questions.roster && <Field label={t('wizard.fields.roster')} value={rosterSize} onChangeText={setRosterSize} keyboardType="number-pad" hint={t('wizard.fields.rosterHint')} />}
      {cfg.tools.recurring && <ToggleRow label={t('wizard.fields.weekly')} hint={t('wizard.fields.weeklyHint')} value={weekly} onChange={setWeekly} />}
    </Surface>
  );

  // ------------------------------------------------------------------ adım 3-4
  const guestCount = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 }}>
      <Icon name="users" size={18} color={color.lavender} strokeWidth={2} />
      <Text style={{ fontFamily: font.semibold, fontSize: 15, color: color.ink }}>
        {invitations.length ? t('wizard.addedCount', { count: invitations.length }) : t('wizard.noGuestsYet')}
      </Text>
    </View>
  );
  const stepThree = created && (
    <View style={{ gap: 16 }}>
      {guestCount}
      <GuestAdder event={created} onAdded={guestsQ.reload} />
    </View>
  );
  const stepFour = created && (
    <View style={{ gap: 16 }}>
      {guestCount}
      <SendPanel
        event={guestsQ.data?.event ?? created}
        invitations={invitations}
        onSent={() => {
          setSentAny(true);
          guestsQ.reload();
        }}
      />
    </View>
  );

  // ------------------------------------------------------------------ yerleşim
  const summaryBar = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16, padding: 16, paddingLeft: 20, borderRadius: 26, backgroundColor: color.surface, boxShadow: shadow.raised }}>
      <View style={{ width: 44, height: 44, borderRadius: 14, overflow: 'hidden', backgroundColor: th.bg }}>
        <ThemeArt theme={th} width={44} height={44} />
      </View>
      <View style={{ flex: 1, minWidth: 160 }}>
        <Caption>{t('wizard.yourChoice')}</Caption>
        <Text style={{ fontFamily: font.semibold, fontSize: 16, color: color.ink }}>
          {t('wizard.choiceLine', { type: uiCopy.name, theme: t(`themes.${theme}`) })}
        </Text>
      </View>
      {step === 1 && <Button label={t('common.back')} variant="ghost" onPress={() => setStep(0)} />}
      {step <= 1 && (
        <Button
          label={step === 0 ? t('common.continue') : created ? t('common.continue') : t('wizard.create')}
          size="lg"
          iconRight="arrowRight"
          loading={saving}
          onPress={step === 0 ? () => setStep(1) : save}
        />
      )}
      {step === 2 && <Button label={t('wizard.toSend')} size="lg" iconRight="arrowRight" onPress={() => setStep(3)} />}
      {step === 3 && !sentAny && <Button label={t('wizard.skipSend')} variant="ghost" onPress={goToEvent} />}
      {step === 3 && <Button label={t('wizard.goToEvent')} size="lg" iconRight="arrowRight" onPress={goToEvent} />}
    </View>
  );

  return (
    <Screen>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <IconButton
          icon="arrowLeft"
          label={created ? t('wizard.goToEvent') : t('wizard.backToEvents')}
          onPress={() => (created ? goToEvent() : router.canGoBack() ? router.back() : router.replace('/etkinlikler'))}
        />
        <Stepper steps={STEPS} current={step} />
        <View style={{ width: 42 }} />
      </View>

      <View style={{ flexDirection: wide ? 'row' : 'column', gap: wide ? 56 : 28, alignItems: 'flex-start' }}>
        <View style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%', gap: 32 }}>
          <View style={{ gap: 12 }}>
            <Pill label={t('wizard.stepPill', { n: step + 1, total: STEPS.length })} bg={color.lavenderTint} fg={color.lavenderInk} />
            <Display size={wide ? 64 : 46}>
              {t(STEP_COPY[step].title)}
              <DisplayAccent style={{ color: color.lavender }}>{t(STEP_COPY[step].accent)}</DisplayAccent>
            </Display>
            <Body style={{ maxWidth: 540, fontSize: 17, lineHeight: 27 }}>{t(STEP_COPY[step].body)}</Body>
          </View>
          {created && step >= 2 && <Notice tone="success" text={t('wizard.created')} />}
          {step === 0 ? stepOne : step === 1 ? stepTwo : step === 2 ? stepThree : stepFour}
          {error && <Notice tone="error" text={error} />}
          {wide && summaryBar}
        </View>
        {/* Telefonda davetli ekleme/gönderim adımlarında önizleme gizlenir; iş öne çıksın. */}
        {(wide || step < 2) && <View style={{ width: wide ? 460 : '100%' }}>{preview}</View>}
        {!wide && <View style={{ width: '100%' }}>{summaryBar}</View>}
      </View>
    </Screen>
  );
}
