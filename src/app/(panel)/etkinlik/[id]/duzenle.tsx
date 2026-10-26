import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { TextInput, useWindowDimensions, View } from 'react-native';

import { eventCopy, getEventType } from '@/core/event-types';
import type { ThemeKey } from '@/core/themes';
import type { CustomQuestion, EventRow, EventSettings } from '@/core/types';
import { eventLang, type Lang, useI18n } from '@/i18n';
import { useQuery } from '@/lib/api';
import { deleteEvent, getEventRow, updateEvent } from '@/lib/api-guests';
import { useSession } from '@/lib/session';
import { OptionChip } from '@/ui/guests/common';
import { cleanQuestions, MenuEditor, QuestionsEditor } from '@/ui/eventForm/Editors';
import { isDate, splitIso, toIso } from '@/ui/eventForm/dates';
import { LangPicker, ThemePicker } from '@/ui/eventForm/Pickers';
import { Body, Button, Caption, Display, DisplayAccent, Field, IconButton, Label, Notice, Skeleton, Surface, Title, ToggleRow } from '@/ui/primitives';
import { Screen } from '@/ui/Screen';
import { color, font, radius } from '@/ui/tokens';

/** Etkinlik ayrıntıları, davetliye sorulanlar, türe özel ayarlar; arşivleme ve silme. */
export default function EditEvent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const q = useQuery(() => getEventRow(id), [id]);

  if (q.loading && !q.data) {
    return (
      <Screen maxWidth={980}>
        <Skeleton height={44} width="40%" />
        <Skeleton height={420} radius={24} />
      </Screen>
    );
  }
  if (q.error || !q.data) {
    return (
      <Screen maxWidth={640}>
        <Notice tone="error" text={t('event.loadError')} />
        <Button label={t('event.backToEvents')} variant="secondary" onPress={() => router.replace('/etkinlikler')} />
      </Screen>
    );
  }
  return <Form event={q.data} />;
}

const DAYS_BEFORE = [1, 2, 3, 5, 7];

function Form({ event }: { event: EventRow }) {
  const { t, lang: uiLang } = useI18n();
  const { session } = useSession();
  // Arşivleme ve silme yalnızca sahibe açık (veritabanı da yalnızca sahibe izin verir); ortak yönetici bu kutuları görmez.
  const isOwner = !!session && event.owner_id === session.user.id;
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const half = width >= 640 ? '48.5%' : '100%';
  const cfg = getEventType(event.type);
  const s0 = (event.settings ?? {}) as EventSettings;
  const when = splitIso(event.starts_at);

  const [title, setTitle] = useState(event.title);
  const [hosts, setHosts] = useState(event.host_names ?? '');
  const [date, setDate] = useState(when.date);
  const [time, setTime] = useState(when.time);
  const [venue, setVenue] = useState(event.venue_name ?? '');
  const [address, setAddress] = useState(event.venue_address ?? '');
  const [deadline, setDeadline] = useState(event.rsvp_deadline ?? '');
  const [theme, setTheme] = useState<ThemeKey>(event.theme as ThemeKey);
  const [lang, setLang] = useState<Lang>(eventLang(event.settings));
  const [menu, setMenu] = useState<string[]>(s0.menu ?? []);
  const [questions, setQuestions] = useState<CustomQuestion[]>(s0.questions ?? []);
  const [giftNote, setGiftNote] = useState(s0.gift_note ?? '');
  const [roster, setRoster] = useState(String(s0.roster_size ?? ''));
  const [weekly, setWeekly] = useState(s0.recurring === 'weekly');
  const [autoInvite, setAutoInvite] = useState(!!s0.auto_invite);
  const [fee, setFee] = useState(s0.fee ? String(s0.fee) : '');
  const [remindAuto, setRemindAuto] = useState(!!s0.reminders?.auto);
  const [daysBefore, setDaysBefore] = useState(s0.reminders?.days_before ?? 3);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [confirm, setConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const word = t('settings.confirmWord');
  const archived = event.status === 'archived';

  const back = () => (router.canGoBack() ? router.back() : router.replace({ pathname: '/etkinlik/[id]', params: { id: event.id } }));

  const save = async () => {
    setErr(null);
    setOk(null);
    if (!title.trim()) return setErr(t('wizard.errors.title'));
    const startsAt = date.trim() ? toIso(date, time) : null;
    if (date.trim() && !startsAt) return setErr(t('wizard.errors.date'));
    if (deadline.trim() && !isDate(deadline)) return setErr(t('wizard.errors.date'));
    const cq = cleanQuestions(questions);
    if (cq.error) return setErr(cq.error === 'label' ? t('wizard.editor.errLabel') : t('wizard.editor.errOptions'));
    const rosterN = parseInt(roster, 10);
    const feeN = Number(fee.replace(',', '.'));

    // Mevcut ayarlar korunur (tasarım, son tekrar zamanı vb.); yalnızca bu ekrandakiler değişir.
    const settings: EventSettings = { ...s0, lang };
    if (cfg.questions.menu) settings.menu = menu;
    if (cq.questions.length) settings.questions = cq.questions;
    else delete settings.questions;
    if (event.type === 'dogum' && giftNote.trim()) settings.gift_note = giftNote.trim().slice(0, 200);
    else delete settings.gift_note;
    if (cfg.questions.roster) {
      if (Number.isFinite(rosterN) && rosterN >= 2) settings.roster_size = Math.min(200, rosterN);
      else delete settings.roster_size;
    }
    if (cfg.tools.recurring) {
      settings.recurring = weekly ? 'weekly' : null;
      settings.auto_invite = weekly && autoInvite;
    }
    if (cfg.tools.payments) {
      if (Number.isFinite(feeN) && feeN > 0) settings.fee = Math.round(feeN * 100) / 100;
      else delete settings.fee;
    }
    settings.reminders = { auto: remindAuto, days_before: daysBefore };

    setSaving(true);
    try {
      await updateEvent(event.id, {
        title: title.trim().slice(0, 120),
        host_names: hosts.trim().slice(0, 160) || null,
        starts_at: startsAt,
        venue_name: venue.trim().slice(0, 160) || null,
        venue_address: address.trim().slice(0, 300) || null,
        rsvp_deadline: deadline.trim() || null,
        theme,
        settings,
      });
      setOk(t('wizard.editor.saved'));
      back();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const toggleArchive = async () => {
    setErr(null);
    try {
      await updateEvent(event.id, { status: archived ? 'active' : 'archived' });
      if (archived) back();
      else router.replace('/etkinlikler');
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const remove = async () => {
    setDeleting(true);
    setErr(null);
    try {
      await deleteEvent(event.id);
      router.replace('/etkinlikler');
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setDeleting(false);
    }
  };

  const typeName = eventCopy(event.type, uiLang).name;

  return (
    <Screen maxWidth={1100}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <IconButton icon="arrowLeft" label={t('common.back')} onPress={back} />
        <View style={{ flex: 1, gap: 2 }}>
          <Caption>{typeName}</Caption>
          <Display size={wide ? 48 : 36}>
            {t('wizard.editor.title')} <DisplayAccent style={{ color: color.lavender }}>{t('wizard.editor.titleAccent')}</DisplayAccent>
          </Display>
        </View>
      </View>

      <View style={{ flexDirection: wide ? 'row' : 'column', gap: 20, alignItems: 'flex-start' }}>
        <View style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%', gap: 20 }}>
          <Surface style={{ gap: 16 }}>
            <Title>{t('wizard.editor.details')}</Title>
            <Field label={t('wizard.fields.title')} value={title} onChangeText={setTitle} maxLength={120} />
            <Field label={t('wizard.fields.hosts')} placeholder={t('wizard.fields.hostsPlaceholder')} value={hosts} onChangeText={setHosts} maxLength={160} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
              <Field style={{ width: half }} label={t('wizard.fields.date')} placeholder="2027-06-12" value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" hint={t('wizard.fields.dateHint')} />
              <Field style={{ width: half }} label={t('wizard.fields.time')} placeholder="19:00" value={time} onChangeText={setTime} keyboardType="numbers-and-punctuation" />
            </View>
            <Field label={t('wizard.fields.venue')} placeholder={t('wizard.fields.venuePlaceholder')} value={venue} onChangeText={setVenue} maxLength={160} />
            <Field label={t('wizard.fields.address')} placeholder={t('wizard.fields.addressPlaceholder')} value={address} onChangeText={setAddress} maxLength={300} />
            <Field label={t('wizard.fields.deadline')} placeholder="2027-05-01" value={deadline} onChangeText={setDeadline} keyboardType="numbers-and-punctuation" hint={t('wizard.fields.deadlineHint')} />
          </Surface>

          <Surface style={{ gap: 16 }}>
            <Title>{t('wizard.editor.look')}</Title>
            <View style={{ gap: 8 }}>
              <Label>{t('wizard.language')}</Label>
              <LangPicker value={lang} onChange={setLang} />
              <Caption>{t('wizard.editor.langHint')}</Caption>
            </View>
            <View style={{ gap: 10 }}>
              <Label>{t('wizard.theme')}</Label>
              <ThemePicker value={theme} onChange={setTheme} suggested={cfg.suggestedTheme} />
            </View>
          </Surface>
        </View>

        <View style={{ width: wide ? 420 : '100%', gap: 20 }}>
          <Surface style={{ gap: 18 }}>
            <Title>{t('wizard.editor.asking')}</Title>
            {cfg.questions.menu && <MenuEditor value={menu} onChange={setMenu} />}
            <QuestionsEditor value={questions} onChange={setQuestions} />
            {event.type === 'dogum' && (
              <Field label={t('wizard.editor.giftNote')} placeholder={t('wizard.editor.giftNotePlaceholder')} value={giftNote} onChangeText={setGiftNote} maxLength={200} hint={t('wizard.editor.giftNoteHint')} />
            )}
          </Surface>

          {(cfg.questions.roster || cfg.tools.recurring || cfg.tools.payments) && (
            <Surface style={{ gap: 14 }}>
              <Title>{t('wizard.editor.squad')}</Title>
              {cfg.questions.roster && <Field label={t('wizard.fields.roster')} value={roster} onChangeText={setRoster} keyboardType="number-pad" hint={t('wizard.fields.rosterHint')} />}
              {cfg.tools.recurring && <ToggleRow label={t('wizard.fields.weekly')} hint={t('wizard.editor.weeklyHint')} value={weekly} onChange={setWeekly} />}
              {cfg.tools.recurring && weekly && <ToggleRow label={t('wizard.editor.autoInvite')} hint={t('wizard.editor.autoInviteHint')} value={autoInvite} onChange={setAutoInvite} />}
              {cfg.tools.payments && <Field label={t('wizard.editor.fee')} placeholder="150" value={fee} onChangeText={setFee} keyboardType="decimal-pad" hint={t('wizard.editor.feeHint')} />}
            </Surface>
          )}

          <Surface style={{ gap: 12 }}>
            <Title>{t('wizard.editor.reminders')}</Title>
            <ToggleRow label={t('wizard.editor.remindAuto')} hint={t('wizard.editor.remindAutoHint')} value={remindAuto} onChange={setRemindAuto} />
            {remindAuto && (
              <View style={{ gap: 8 }}>
                <Caption>{t('wizard.editor.daysBefore')}</Caption>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {DAYS_BEFORE.map((d) => (
                    <OptionChip key={d} small label={t('wizard.editor.days', { count: d })} on={daysBefore === d} onPress={() => setDaysBefore(d)} />
                  ))}
                </View>
              </View>
            )}
          </Surface>
        </View>
      </View>

      {err && <Notice tone="error" text={err} />}
      {ok && <Notice tone="success" text={ok} />}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Button label={t('wizard.editor.save')} icon="check" size="lg" loading={saving} onPress={save} />
        <Button label={t('common.cancel')} variant="ghost" onPress={back} />
      </View>

      <View style={{ flexDirection: wide ? 'row' : 'column', gap: 20, alignItems: 'flex-start' }}>
        {isOwner && (
          <Surface style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%', gap: 12 }}>
            <Title>{archived ? t('wizard.editor.unarchiveTitle') : t('wizard.editor.archiveTitle')}</Title>
            <Body>{archived ? t('wizard.editor.unarchiveBody') : t('wizard.editor.archiveBody')}</Body>
            <Button label={archived ? t('wizard.editor.unarchive') : t('wizard.editor.archive')} icon="archive" variant="secondary" onPress={toggleArchive} style={{ alignSelf: 'flex-start' }} />
          </Surface>
        )}
        {isOwner && (
          <Surface style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%', gap: 12, backgroundColor: '#FFF8F6' }}>
            <Title color={color.coralInk}>{t('wizard.editor.deleteTitle')}</Title>
            <Body>{t('wizard.editor.deleteBody')}</Body>
            <Label>{t('settings.confirmPrompt', { word })}</Label>
            <TextInput
              value={confirm}
              onChangeText={setConfirm}
              autoCapitalize="characters"
              autoCorrect={false}
              accessibilityLabel={t('settings.confirmPrompt', { word })}
              placeholder={word}
              placeholderTextColor={color.faint}
              style={{ height: 50, borderRadius: radius.md, backgroundColor: '#FFFFFF', paddingHorizontal: 16, fontFamily: font.semibold, fontSize: 16, letterSpacing: 2, color: color.ink, boxShadow: `inset 0 0 0 1px ${color.hairline}` }}
            />
            <Button
              label={t('wizard.editor.delete')}
              icon="trash"
              variant="danger"
              loading={deleting}
              disabled={confirm.trim().toLocaleUpperCase(uiLang === 'tr' ? 'tr-TR' : 'en-GB') !== word}
              onPress={remove}
              style={{ alignSelf: 'flex-start' }}
            />
          </Surface>
        )}
      </View>
    </Screen>
  );
}
