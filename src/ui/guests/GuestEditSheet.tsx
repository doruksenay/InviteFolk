import { useState } from 'react';
import { Text, View } from 'react-native';

import { normalizePhone } from '@/core/format';
import { EMAIL_RE } from '@/core/importer';
import type { Contact, EventSettings, InvitationWithContact, RsvpStatus, Side } from '@/core/types';
import { useI18n } from '@/i18n';
import { must, removeInvitation, supabase, useQuery } from '@/lib/api';
import { deleteContact, updateContact, updateInvitation } from '@/lib/api-guests';
import { Button, Caption, Field, Label, Notice, Skeleton, ToggleRow } from '@/ui/primitives';
import { Sheet } from '@/ui/Sheet';
import { color, font, radius } from '@/ui/tokens';

import { NumberStepper, OptionChip, SideOrGroup } from './common';

type Props = {
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
  /** Kişi id'si zorunlu; etkinlik bağlamında davet de verilir. */
  contactId: string | null;
  invitation?: InvitationWithContact | null;
  event?: { type: string; settings: EventSettings } | null;
};

async function getContact(id: string): Promise<Contact> {
  return must(await supabase.from('contacts').select('*').eq('id', id).single()) as Contact;
}

/** Davetli/kişi düzenleme. Kişi bilgileri tüm etkinliklerde ortaktır; davet alanları yalnızca bu etkinliğe aittir. */
export function GuestEditSheet(props: Props) {
  if (!props.open || !props.contactId) return null;
  return <Inner {...props} contactId={props.contactId} key={props.contactId + (props.invitation?.id ?? '')} />;
}

function Inner({ onClose, onChanged, contactId, invitation, event }: Props & { contactId: string }) {
  const { t } = useI18n();
  const q = useQuery(() => getContact(contactId), [contactId]);
  return (
    <Sheet open onClose={onClose} title={invitation ? t('guests.edit.title') : t('guests.edit.contactTitle')} italic={t('guests.edit.titleAccent')}>
      {q.loading && !q.data ? (
        <View style={{ gap: 10 }}>
          <Skeleton height={50} radius={16} />
          <Skeleton height={50} radius={16} />
          <Skeleton height={50} radius={16} />
        </View>
      ) : q.error || !q.data ? (
        <Notice tone="error" text={q.error ?? t('errors.notFound')} />
      ) : (
        <Form contact={q.data} invitation={invitation ?? null} event={event ?? null} onClose={onClose} onChanged={onChanged} />
      )}
    </Sheet>
  );
}

const STATUSES: RsvpStatus[] = ['yes', 'pending', 'no', 'maybe'];

function Form({
  contact,
  invitation,
  event,
  onClose,
  onChanged,
}: {
  contact: Contact;
  invitation: InvitationWithContact | null;
  event: { type: string; settings: EventSettings } | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(contact.name);
  const [phone, setPhone] = useState(contact.phone ?? '');
  const [email, setEmail] = useState(contact.email ?? '');
  const [side, setSide] = useState<Side | null>(contact.side);
  const [group, setGroup] = useState(contact.group_label ?? '');
  const [maxParty, setMaxParty] = useState(contact.max_party);
  const [notes, setNotes] = useState(contact.notes ?? '');

  const [status, setStatus] = useState<RsvpStatus>(invitation?.status ?? 'pending');
  const [party, setParty] = useState(invitation?.party_size || 1);
  const [menu, setMenu] = useState<string | null>(invitation?.menu ?? null);
  const [paid, setPaid] = useState(invitation?.paid ?? false);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'remove' | 'delete' | null>(null);

  const settings = event?.settings ?? {};
  const roster = typeof settings.roster_size === 'number';
  const statuses: RsvpStatus[] = roster ? [...STATUSES, 'waitlist'] : STATUSES;
  const questions = settings.questions ?? [];
  const type = event?.type ?? (contact.side ? 'dugun' : 'diger');

  const save = async () => {
    setErr(null);
    if (!name.trim()) return setErr(t('guests.adder.errName'));
    const normalized = phone.trim() ? normalizePhone(phone) : null;
    if (phone.trim() && !normalized) return setErr(t('guests.adder.errPhone'));
    const mail = email.trim().toLowerCase();
    if (mail && !EMAIL_RE.test(mail)) return setErr(t('guests.adder.errEmail'));
    setBusy(true);
    try {
      await updateContact(contact.id, {
        name: name.trim().slice(0, 120),
        phone: normalized,
        email: mail || null,
        side: event ? (type === 'dugun' || type === 'nisan' || type === 'kina' ? side : contact.side) : side,
        group_label: group.trim().slice(0, 40) || null,
        max_party: Math.min(20, Math.max(1, maxParty)),
        notes: notes.trim().slice(0, 1000) || null,
      });
      if (invitation) {
        const changedStatus = status !== invitation.status;
        await updateInvitation(invitation.id, {
          status,
          party_size: status === 'yes' || status === 'waitlist' ? Math.min(maxParty, Math.max(1, party)) : status === 'no' ? 0 : invitation.party_size,
          menu,
          paid,
          paid_at: paid ? (invitation.paid_at ?? new Date().toISOString()) : null,
          ...(changedStatus ? { responded_at: new Date().toISOString() } : {}),
        });
      }
      onChanged();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (confirm !== 'remove') return setConfirm('remove');
    setBusy(true);
    try {
      if (invitation) await removeInvitation(invitation.id);
      onChanged();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const del = async () => {
    if (confirm !== 'delete') return setConfirm('delete');
    setBusy(true);
    try {
      await deleteContact(contact.id);
      onChanged();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 18 }}>
      <View style={{ gap: 14 }}>
        <Label>{t('guests.edit.contactSection')}</Label>
        <Field label={t('guests.adder.name')} value={name} onChangeText={setName} maxLength={120} />
        <Field label={t('guests.adder.phone')} keyboardType="phone-pad" value={phone} onChangeText={setPhone} placeholder={t('guests.adder.phonePlaceholder')} />
        <Field label={t('guests.adder.email')} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} value={email} onChangeText={setEmail} placeholder={t('guests.adder.emailPlaceholder')} />
        <SideOrGroup type={type} side={side} onSide={setSide} group={group} onGroup={setGroup} />
        <View style={{ gap: 8 }}>
          <Label>{t('guests.adder.maxParty')}</Label>
          <NumberStepper label={t('guests.adder.maxParty')} value={maxParty} min={1} max={20} onChange={setMaxParty} />
        </View>
        <Field label={t('guests.edit.notes')} placeholder={t('guests.edit.notesPlaceholder')} value={notes} onChangeText={setNotes} multiline maxLength={1000} />
        {invitation && <Caption>{t('guests.edit.sharedNote')}</Caption>}
      </View>

      {invitation && (
        <View style={{ gap: 14, paddingTop: 16, borderTopWidth: 1, borderTopColor: color.hairline }}>
          <Label>{t('guests.edit.inviteSection')}</Label>
          <View style={{ gap: 8 }}>
            <Caption>{t('guests.edit.status')}</Caption>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {statuses.map((s) => (
                <OptionChip key={s} small label={t(`status.rsvp.${s}`)} on={status === s} onPress={() => setStatus(s)} />
              ))}
            </View>
          </View>
          {(status === 'yes' || status === 'waitlist') && maxParty > 1 && (
            <View style={{ gap: 8 }}>
              <Caption>{t('guests.edit.partySize')}</Caption>
              <NumberStepper label={t('guests.edit.partySize')} value={Math.min(party, maxParty)} min={1} max={maxParty} onChange={setParty} />
            </View>
          )}
          {settings.menu && settings.menu.length > 0 && (
            <View style={{ gap: 8 }}>
              <Caption>{t('guests.edit.menu')}</Caption>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                <OptionChip small label={t('guests.edit.noMenu')} on={!menu} onPress={() => setMenu(null)} />
                {settings.menu.map((m) => (
                  <OptionChip key={m} small label={m} on={menu === m} onPress={() => setMenu(m)} />
                ))}
              </View>
            </View>
          )}
          {roster && <ToggleRow label={t('guests.edit.paid')} hint={t('guests.edit.paidHint')} value={paid} onChange={setPaid} />}
          {questions.length > 0 && (
            <View style={{ gap: 8, backgroundColor: color.surfaceSoft, borderRadius: radius.lg, padding: 14 }}>
              <Caption>{t('guests.edit.answers')}</Caption>
              {questions.map((qq) => (
                <View key={qq.id} style={{ gap: 2 }}>
                  <Text style={{ fontFamily: font.semibold, fontSize: 13, color: color.ink }}>{qq.label}</Text>
                  <Text style={{ fontFamily: font.regular, fontSize: 14, color: invitation.answers?.[qq.id] ? color.inkSoft : color.faint }}>
                    {invitation.answers?.[qq.id] || t('guests.edit.noAnswer')}
                  </Text>
                </View>
              ))}
            </View>
          )}
          {invitation.note ? (
            <View style={{ gap: 2, backgroundColor: color.lavenderTint, borderRadius: radius.lg, padding: 14 }}>
              <Caption color={color.lavenderInk}>{t('guests.edit.guestNote')}</Caption>
              <Text style={{ fontFamily: font.regular, fontSize: 14, color: color.ink }}>{invitation.note}</Text>
            </View>
          ) : null}
        </View>
      )}

      {err && <Notice tone="error" text={err} />}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <Button label={t('guests.edit.save')} icon="check" loading={busy} onPress={save} />
        {invitation ? (
          <Button label={confirm === 'remove' ? t('guests.edit.confirm') : t('guests.edit.removeFromEvent')} variant="danger" icon="trash" onPress={remove} />
        ) : (
          <Button label={confirm === 'delete' ? t('guests.edit.confirm') : t('guests.edit.deleteContact')} variant="danger" icon="trash" onPress={del} />
        )}
      </View>
      {!invitation && <Caption>{t('guests.edit.deleteContactHint')}</Caption>}
    </View>
  );
}
