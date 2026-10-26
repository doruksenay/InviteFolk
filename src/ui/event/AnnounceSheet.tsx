import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { formatShortDate } from '@/core/format';
import type { PlanLimits } from '@/core/types';
import { useI18n } from '@/i18n';
import { useQuery } from '@/lib/api';
import { type Channel, sendEmail, sendSms, sendWhatsApp } from '@/lib/api-guests';
import { addAnnouncement, deleteAnnouncement, listAnnouncements } from '@/lib/api-tools';
import { CheckRow, OptionChip } from '@/ui/guests/common';
import { Button, Caption, Label, Notice } from '@/ui/primitives';
import { Sheet } from '@/ui/Sheet';
import { color, font, radius } from '@/ui/tokens';

/** Duyuru: davetiye sayfasının üstünde görünür; seçilen kanallardan da gönderilir. */
export function AnnounceSheet({ open, onClose, eventId, limits, onDone }: { open: boolean; onClose: () => void; eventId: string; limits: PlanLimits | null; onDone: () => void }) {
  const { t } = useI18n();
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<'all' | 'yes'>('all');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const history = useQuery(() => (open ? listAnnouncements(eventId).catch(() => []) : Promise.resolve([])), [eventId, open]);

  const available: Channel[] = (['whatsapp', 'email', 'sms'] as Channel[]).filter((c) => {
    if (!limits) return c !== 'sms';
    return c === 'whatsapp' ? limits.whatsapp_per_day > 0 : c === 'email' ? limits.email_per_day > 0 : limits.sms_per_day > 0;
  });
  const chName = (c: Channel) => (c === 'whatsapp' ? t('send.waAuto.title') : c === 'email' ? t('send.email.title') : t('send.sms.title'));
  const toggle = (c: Channel) => setChannels((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));

  const publish = async () => {
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    setMsg(null);
    try {
      const annId = await addAnnouncement(eventId, text);
      const failures: string[] = [];
      let sent = 0;
      for (const c of channels) {
        const fn = c === 'whatsapp' ? sendWhatsApp : c === 'email' ? sendEmail : sendSms;
        try {
          const r = await fn(eventId, 'announcement', { announcementId: annId, audience });
          sent += r.sent;
        } catch (e) {
          failures.push(`${chName(c)}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      setBody('');
      history.reload();
      onDone();
      setMsg(failures.length ? { tone: 'warning', text: [t('tools.announce.done'), ...failures].join('\n') } : { tone: 'success', text: channels.length ? `${t('tools.announce.done')} ${t('send.done', { sent })}` : t('tools.announce.done') });
    } catch (e) {
      setMsg({ tone: 'error', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('tools.announce.title')} italic={t('tools.announce.titleAccent')} subtitle={t('tools.announce.subtitle')} maxWidth={600}>
      <View style={{ gap: 16 }}>
        <View style={{ gap: 6 }}>
          <Label>{t('tools.announce.label')}</Label>
          <TextInput
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={500}
            placeholder={t('tools.announce.placeholder')}
            placeholderTextColor={color.faint}
            accessibilityLabel={t('tools.announce.label')}
            style={{ minHeight: 96, borderRadius: radius.md, backgroundColor: color.surfaceSoft, padding: 14, fontFamily: font.regular, fontSize: 15, lineHeight: 22, color: color.ink, textAlignVertical: 'top' }}
          />
          <Caption style={{ alignSelf: 'flex-end' }}>{`${body.length}/500`}</Caption>
        </View>

        <View style={{ gap: 8 }}>
          <Label>{t('tools.announce.channels')}</Label>
          {available.map((c) => (
            <CheckRow key={c} checked={channels.includes(c)} onPress={() => toggle(c)} title={chName(c)} />
          ))}
          {!channels.length && <Caption>{t('tools.announce.pageOnly')}</Caption>}
        </View>

        {channels.length > 0 && (
          <View style={{ gap: 8 }}>
            <Label>{t('tools.announce.audience')}</Label>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <OptionChip small label={t('tools.announce.audienceAll')} on={audience === 'all'} onPress={() => setAudience('all')} />
              <OptionChip small label={t('tools.announce.audienceYes')} on={audience === 'yes'} onPress={() => setAudience('yes')} />
            </View>
          </View>
        )}

        {msg && <Notice tone={msg.tone} text={msg.text} />}
        <Button label={t('tools.announce.send')} icon="megaphone" size="lg" loading={busy} disabled={!body.trim()} onPress={publish} />

        {(history.data ?? []).length > 0 && (
          <View style={{ gap: 8, marginTop: 6 }}>
            <Label>{t('tools.announce.history')}</Label>
            {(history.data ?? []).map((a) => (
              <View key={a.id} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 12, borderRadius: radius.lg, backgroundColor: color.surfaceSoft }}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ fontFamily: font.medium, fontSize: 14, lineHeight: 20, color: color.ink }}>{a.body}</Text>
                  <Caption>{formatShortDate(a.created_at)}</Caption>
                </View>
                <Button
                  label={t('tools.announce.delete')}
                  variant="ghost"
                  onPress={async () => {
                    try {
                      await deleteAnnouncement(a.id);
                      history.reload();
                      onDone();
                    } catch (e) {
                      setMsg({ tone: 'error', text: e instanceof Error ? e.message : t('tools.announce.deleteFailed') });
                    }
                  }}
                />
              </View>
            ))}
          </View>
        )}
      </View>
    </Sheet>
  );
}
