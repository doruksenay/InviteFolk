import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { type ReactNode, useMemo, useState } from 'react';
import { Linking, Text, View } from 'react-native';

import { formatWhen, rsvpUrl, waMeLink } from '@/core/format';
import type { EventRow, InvitationWithContact } from '@/core/types';
import { eventLang, LOCALE_TAG, makeT, useI18n } from '@/i18n';
import { useQuery } from '@/lib/api';
import { emailQuotaLeft, sendEmail, sendWhatsApp, whatsappQuotaLeft } from '@/lib/api-guests';
import { Icon, type IconName } from '@/ui/Icon';
import { Body, Button, Caption, Notice, Surface, Title, ToggleRow } from '@/ui/primitives';
import { Sheet } from '@/ui/Sheet';
import { color, font, radius } from '@/ui/tokens';

import { OptionChip } from '../guests/common';

type Kind = 'invite' | 'reminder';
type Feedback = { tone: 'success' | 'error' | 'info' | 'warning'; text: string } | null;

/** Davetliye giden WhatsApp/kopyalanan metin: her zaman etkinliğin dilinde. */
export function guestMessage(event: EventRow, inv: InvitationWithContact, kind: Kind) {
  const lang = eventLang(event.settings);
  const et = makeT(lang);
  return et(kind === 'invite' ? 'send.message.invite' : 'send.message.reminder', {
    name: inv.contacts.name,
    title: event.title,
    when: [formatWhen(event.starts_at, LOCALE_TAG[lang]), event.venue_name].filter(Boolean).join(' · '),
    link: rsvpUrl(inv.token),
  });
}

/**
 * Gönderim paneli: otomatik WhatsApp, tek tek WhatsApp (wa.me sırası), e-posta, link listesi.
 * Sihirbazın 4. adımında ve etkinlik sayfasındaki "Gönder" penceresinde kullanılır.
 */
export function SendPanel({ event, invitations, onSent, flat }: { event: EventRow; invitations: InvitationWithContact[]; onSent: () => void; flat?: boolean }) {
  const { t } = useI18n();
  const [kind, setKind] = useState<Kind>('invite');
  const [resendAll, setResendAll] = useState(false);
  const [busy, setBusy] = useState<'wa' | 'email' | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [queueOpen, setQueueOpen] = useState(false);

  const waQuota = useQuery(() => whatsappQuotaLeft().catch(() => 0), [event.id]);
  const mailQuota = useQuery(() => emailQuotaLeft().catch(() => 0), [event.id]);

  const active = invitations.filter((i) => i.status !== 'no');
  const notSent = active.filter((i) => i.delivery === 'not_sent');
  const targets = useMemo(() => {
    if (kind === 'reminder') return invitations.filter((i) => i.status === 'pending');
    return resendAll || notSent.length === 0 ? active : notSent;
  }, [kind, invitations, resendAll, active, notSent]);
  const withPhone = targets.filter((i) => i.contacts.phone);
  const withEmail = targets.filter((i) => i.contacts.email);
  const waLeft = waQuota.data ?? 0;
  const mailLeft = mailQuota.data ?? 0;

  const hint =
    kind === 'reminder'
      ? t('send.kindHint.reminder', { count: targets.length })
      : resendAll || notSent.length === 0
        ? t('send.kindHint.inviteAll', { count: targets.length })
        : t('send.kindHint.invite', { count: targets.length });

  const report = (r: { sent: number; failed: number; skipped: number }) =>
    setFeedback({
      tone: r.failed ? 'warning' : 'success',
      text: `${t('send.done', { sent: r.sent })}${r.failed ? t('send.doneFailed', { failed: r.failed }) : ''}${r.skipped ? t('send.doneSkipped', { skipped: r.skipped }) : ''}.`,
    });

  const sendWa = async () => {
    setBusy('wa');
    setFeedback(null);
    try {
      report(await sendWhatsApp(event.id, kind, withPhone.slice(0, 1000).map((i) => i.id)));
      waQuota.reload();
      onSent();
    } catch (e) {
      setFeedback({ tone: 'error', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  };

  const sendMail = async () => {
    setBusy('email');
    setFeedback(null);
    try {
      report(await sendEmail(event.id, kind, withEmail.slice(0, 1000).map((i) => i.id)));
      mailQuota.reload();
      onSent();
    } catch (e) {
      setFeedback({ tone: 'error', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  };

  const copyLinks = async () => {
    const text = targets.map((i) => `${i.contacts.name}: ${rsvpUrl(i.token)}`).join('\n');
    await Clipboard.setStringAsync(text);
    setFeedback({ tone: 'success', text: t('send.links.copied', { count: targets.length }) });
  };

  const body = (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {(['invite', 'reminder'] as Kind[]).map((k) => (
            <OptionChip key={k} label={t(`send.kind.${k}`)} on={kind === k} onPress={() => setKind(k)} icon={k === 'invite' ? 'send' : 'bell'} />
          ))}
        </View>
        <Caption>{hint}</Caption>
        {kind === 'invite' && notSent.length > 0 && notSent.length < active.length && (
          <ToggleRow label={t('send.resendAll')} value={resendAll} onChange={setResendAll} />
        )}
      </View>

      {feedback && <Notice tone={feedback.tone} text={feedback.text} />}
      {targets.length === 0 ? (
        <Notice tone="info" text={t('send.nobody')} />
      ) : (
        <View style={{ gap: 12 }}>
          <Channel
            icon="whatsapp"
            tint={color.sageTint}
            ink={color.sageInk}
            title={t('send.waAuto.title')}
            body={t('send.waAuto.body')}
            meta={[
              waQuota.data !== null ? t('send.waAuto.quota', { count: waLeft }) : null,
              targets.length > withPhone.length ? t('send.waAuto.noPhone', { count: targets.length - withPhone.length }) : null,
            ]}>
            {waQuota.data !== null && waLeft <= 0 ? (
              <View style={{ gap: 10 }}>
                <Caption>{t('send.waAuto.noQuota')}</Caption>
                <Button label={t('send.plans')} icon="star" variant="secondary" onPress={() => router.push('/paketler')} style={{ alignSelf: 'flex-start' }} />
              </View>
            ) : (
              <Button
                label={t('send.waAuto.button', { count: Math.min(withPhone.length, waLeft || withPhone.length) })}
                icon="send"
                variant="accent"
                loading={busy === 'wa'}
                disabled={!withPhone.length || !!busy}
                onPress={sendWa}
                style={{ alignSelf: 'flex-start' }}
              />
            )}
          </Channel>

          <Channel icon="whatsapp" tint={color.surfaceSoft} ink={color.ink} title={t('send.waManual.title')} body={t('send.waManual.body')} meta={[]}>
            <Button label={t('send.waManual.button')} icon="arrowRight" variant="secondary" disabled={!withPhone.length} onPress={() => setQueueOpen(true)} style={{ alignSelf: 'flex-start' }} />
          </Channel>

          <Channel
            icon="mail"
            tint={color.lavenderTint}
            ink={color.lavenderInk}
            title={t('send.email.title')}
            body={t('send.email.body')}
            meta={[mailQuota.data !== null ? t('send.email.quota', { count: mailLeft }) : null]}>
            {withEmail.length === 0 ? (
              <Caption>{t('send.email.noEmail')}</Caption>
            ) : mailQuota.data !== null && mailLeft <= 0 ? (
              <Caption>{t('send.email.noQuota')}</Caption>
            ) : (
              <Button
                label={t('send.email.button', { count: withEmail.length })}
                icon="mail"
                variant="secondary"
                loading={busy === 'email'}
                disabled={!!busy}
                onPress={sendMail}
                style={{ alignSelf: 'flex-start' }}
              />
            )}
          </Channel>

          <Channel icon="link" tint={color.goldTint} ink={color.goldInk} title={t('send.links.title')} body={t('send.links.body')} meta={[]}>
            <Button label={t('send.links.button')} icon="copy" variant="secondary" onPress={copyLinks} style={{ alignSelf: 'flex-start' }} />
          </Channel>
        </View>
      )}
      <WaQueueSheet open={queueOpen} onClose={() => setQueueOpen(false)} event={event} targets={withPhone} kind={kind} />
    </View>
  );

  if (flat) return body;
  return (
    <Surface style={{ gap: 16 }}>
      <View style={{ gap: 4 }}>
        <Title>
          {t('send.title')} {t('send.titleAccent')}
        </Title>
        <Caption>{t('send.subtitle')}</Caption>
      </View>
      {body}
    </Surface>
  );
}

function Channel({ icon, tint, ink, title, body, meta, children }: { icon: IconName; tint: string; ink: string; title: string; body: string; meta: (string | null)[]; children: ReactNode }) {
  const m = meta.filter(Boolean);
  return (
    <View style={{ flexDirection: 'row', gap: 14, padding: 16, borderRadius: radius.lg, backgroundColor: color.surface, boxShadow: `inset 0 0 0 1px ${color.hairline}` }}>
      <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={20} color={ink} strokeWidth={2} />
      </View>
      <View style={{ flex: 1, gap: 8 }}>
        <View style={{ gap: 2 }}>
          <Text style={{ fontFamily: font.semibold, fontSize: 15, color: color.ink }}>{title}</Text>
          <Caption>{body}</Caption>
          {m.length > 0 && <Caption color={ink}>{m.join(' · ')}</Caption>}
        </View>
        {children}
      </View>
    </View>
  );
}

/** wa.me sırası: her davetli için WhatsApp hazır mesajla açılır, organizatör gönder'e basar. */
function WaQueueSheet({ open, onClose, event, targets, kind }: { open: boolean; onClose: () => void; event: EventRow; targets: InvitationWithContact[]; kind: Kind }) {
  const { t } = useI18n();
  const [i, setI] = useState(0);
  const [opened, setOpened] = useState(0);
  const cur = targets[i];
  const finished = i >= targets.length;
  const pct = targets.length ? Math.round((Math.min(i, targets.length) / targets.length) * 100) : 0;

  const close = () => {
    setI(0);
    setOpened(0);
    onClose();
  };

  return (
    <Sheet open={open} onClose={close} title={t('send.queue.title')} italic={t('send.queue.titleAccent')} subtitle={t('send.queue.progress', { done: Math.min(i, targets.length), total: targets.length })}>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: color.surfaceSoft, overflow: 'hidden' }}>
        <View style={{ height: 8, width: `${pct}%`, backgroundColor: color.sage, borderRadius: 4 }} />
      </View>
      {finished || !cur ? (
        <View style={{ gap: 14, alignItems: 'flex-start' }}>
          <Body>{targets.length ? t('send.queue.finished', { count: opened }) : t('send.queue.noPhoneLeft')}</Body>
          <Button label={t('send.queue.close')} onPress={close} />
        </View>
      ) : (
        <View style={{ gap: 14 }}>
          <Text style={{ fontFamily: font.serif, fontSize: 32, lineHeight: 36, color: color.ink }}>{cur.contacts.name}</Text>
          <Caption>{cur.contacts.phone}</Caption>
          <View style={{ gap: 6, padding: 14, borderRadius: radius.lg, backgroundColor: '#E7F5EC' }}>
            <Caption>{t('send.queue.preview')}</Caption>
            <Text style={{ fontFamily: font.regular, fontSize: 14, lineHeight: 20, color: color.ink }}>{guestMessage(event, cur, kind)}</Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <Button
              label={t('send.queue.open')}
              icon="whatsapp"
              variant="accent"
              onPress={() => {
                setOpened((n) => n + 1);
                Linking.openURL(waMeLink(cur.contacts.phone, guestMessage(event, cur, kind)));
              }}
            />
            <Button label={t('send.queue.next')} icon="check" variant="secondary" onPress={() => setI(i + 1)} />
            <Button label={t('send.queue.skip')} variant="ghost" onPress={() => setI(i + 1)} />
          </View>
        </View>
      )}
    </Sheet>
  );
}
