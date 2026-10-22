import { useState } from 'react';
import { Platform, View } from 'react-native';

import { getEventType } from '@/core/event-types';
import { normalizePhone } from '@/core/format';
import { EMAIL_RE } from '@/core/importer';
import type { EventRow, Side } from '@/core/types';
import { useI18n } from '@/i18n';
import { importGuests, type ImportResult } from '@/lib/api-guests';
import { Button, Caption, Field, Label, Notice, Surface, Title } from '@/ui/primitives';
import { color } from '@/ui/tokens';

import { NumberStepper, SideOrGroup, SourceTile, usesSides } from './common';
import { ImportSheet } from './ImportSheet';
import { MyContactsSheet } from './MyContactsSheet';
import { PhoneContactsSheet } from './PhoneContactsSheet';

type Feedback = { tone: 'success' | 'error' | 'info'; text: string } | null;

/**
 * Davetli ekleme: elle, Excel/CSV'den, telefon rehberinden ya da kendi rehberinden.
 * Sihirbazın 3. adımında ve etkinlik sayfasında kullanılır.
 */
export function GuestAdder({ event, onAdded, style }: { event: EventRow; onAdded: () => void; style?: object }) {
  const { t } = useI18n();
  const cfg = getEventType(event.type);
  const [sheet, setSheet] = useState<'file' | 'phone' | 'mine' | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [side, setSide] = useState<Side | null>(null);
  const [group, setGroup] = useState('');
  const [maxParty, setMaxParty] = useState(2);
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const summarize = (r: ImportResult) => {
    return `${t('guests.result.added', { count: r.added })}${r.existing ? t('guests.result.existing', { count: r.existing }) : ''}${r.invalid ? t('guests.result.invalid', { count: r.invalid }) : ''}.`;
  };

  const imported = (r: ImportResult) => {
    setFeedback({ tone: r.added ? 'success' : 'info', text: summarize(r) });
    onAdded();
  };

  const submit = async () => {
    setFormError(null);
    setFeedback(null);
    if (!name.trim()) return setFormError(t('guests.adder.errName'));
    const normalized = phone.trim() ? normalizePhone(phone) : null;
    if (phone.trim() && !normalized) return setFormError(t('guests.adder.errPhone'));
    const mail = email.trim().toLowerCase();
    if (mail && !EMAIL_RE.test(mail)) return setFormError(t('guests.adder.errEmail'));
    setAdding(true);
    try {
      const r = await importGuests(event.id, [
        {
          name: name.trim().slice(0, 120),
          phone: normalized,
          email: mail || null,
          side: usesSides(event.type) ? side : null,
          group: usesSides(event.type) ? null : group.trim() || null,
          max_party: cfg.questions.partySize ? maxParty : 1,
        },
      ]);
      setFeedback(r.added ? { tone: 'success', text: t('guests.adder.added', { name: name.trim() }) } : { tone: 'info', text: t('guests.adder.alreadyIn', { name: name.trim() }) });
      setName('');
      setPhone('');
      setEmail('');
      onAdded();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : String(e));
    } finally {
      setAdding(false);
    }
  };

  return (
    <Surface style={[{ gap: 16 }, style]}>
      <View style={{ gap: 4 }}>
        <Title>{t('guests.adder.title')}</Title>
        <Caption>{t('guests.adder.subtitle')}</Caption>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <SourceTile icon="file" title={t('guests.adder.fromFile')} hint={t('guests.adder.fromFileHint')} accent={color.sage} onPress={() => setSheet('file')} />
        {Platform.OS !== 'web' && <SourceTile icon="phone" title={t('guests.adder.fromPhone')} hint={t('guests.adder.fromPhoneHint')} accent={color.coral} onPress={() => setSheet('phone')} />}
        <SourceTile icon="users" title={t('guests.adder.fromMine')} hint={t('guests.adder.fromMineHint')} accent={color.lavender} onPress={() => setSheet('mine')} />
      </View>

      {feedback && <Notice tone={feedback.tone} text={feedback.text} />}

      <View style={{ gap: 14, paddingTop: 4, borderTopWidth: 1, borderTopColor: color.hairline }}>
        <Label style={{ paddingTop: 12 }}>{t('guests.adder.manualTitle')}</Label>
        <Field label={t('guests.adder.name')} placeholder={t('guests.adder.namePlaceholder')} value={name} onChangeText={setName} maxLength={120} />
        <Field label={t('guests.adder.phone')} placeholder={t('guests.adder.phonePlaceholder')} keyboardType="phone-pad" value={phone} onChangeText={setPhone} hint={t('guests.adder.phoneHint')} />
        <Field
          label={t('guests.adder.email')}
          placeholder={t('guests.adder.emailPlaceholder')}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
          hint={t('guests.adder.emailHint')}
        />
        <SideOrGroup type={event.type} side={side} onSide={setSide} group={group} onGroup={setGroup} />
        {cfg.questions.partySize && (
          <View style={{ gap: 8 }}>
            <Label>{t('guests.adder.maxParty')}</Label>
            <NumberStepper label={t('guests.adder.maxParty')} value={maxParty} min={1} max={20} onChange={setMaxParty} />
          </View>
        )}
        {formError && <Notice tone="error" text={formError} />}
        <Button label={t('guests.adder.submit')} icon="plus" loading={adding} onPress={submit} />
      </View>

      <ImportSheet open={sheet === 'file'} onClose={() => setSheet(null)} eventId={event.id} eventType={event.type} onImported={imported} />
      <PhoneContactsSheet open={sheet === 'phone'} onClose={() => setSheet(null)} eventId={event.id} onImported={imported} />
      <MyContactsSheet
        open={sheet === 'mine'}
        onClose={() => setSheet(null)}
        eventId={event.id}
        onAdded={(n) => {
          setFeedback({ tone: n ? 'success' : 'info', text: t('guests.result.added', { count: n }) + '.' });
          onAdded();
        }}
      />
    </Surface>
  );
}
