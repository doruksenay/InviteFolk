import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useI18n } from '@/i18n';
import { type SendChannel, sendToGuests } from '@/lib/api-automation';
import { Icon, type IconName } from '@/ui/Icon';
import { Body, Button, Caption, Notice, ToggleRow } from '@/ui/primitives';
import { Sheet } from '@/ui/Sheet';
import { color, font, radius } from '@/ui/tokens';

type NoticeState = { tone: 'success' | 'info' | 'warning' | 'error'; text: string };

function Option({ icon, title, hint, disabled, busy, onPress, tint }: { icon: IconName; title: string; hint: string; disabled?: boolean; busy?: boolean; onPress: () => void; tint: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        padding: 16,
        borderRadius: radius.lg,
        backgroundColor: color.surfaceSoft,
        opacity: disabled ? 0.45 : 1,
        transform: [{ scale: pressed ? 0.99 : 1 }],
      })}>
      <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={20} color={color.ink} strokeWidth={1.9} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: font.semibold, fontSize: 15, color: color.ink }}>{title}</Text>
        <Caption>{hint}</Caption>
      </View>
      <Icon name="arrowRight" size={18} color={color.muted} strokeWidth={2} />
    </Pressable>
  );
}

/** "Masaları bildir": masası atanmış ve gelecek davetlilere WhatsApp / e-posta ile "masanız" mesajı, ya da listeyi kopyala. */
export function NotifyTablesSheet({
  open,
  onClose,
  eventId,
  total,
  withPhone,
  withEmail,
  onCopy,
  onResult,
}: {
  open: boolean;
  onClose: () => void;
  eventId: string;
  total: number;
  withPhone: number;
  withEmail: number;
  onCopy: () => void;
  onResult: (n: NoticeState) => void;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState<SendChannel | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const send = async (channel: SendChannel) => {
    setBusy(channel);
    setErr(null);
    try {
      const r = await sendToGuests(channel, eventId, 'table');
      onResult({ tone: r.failed ? 'warning' : 'success', text: t('seating.notify.result', { sent: r.sent, failed: r.failed, skipped: r.skipped }) });
      onClose();
    } catch (e) {
      setErr(t('seating.notify.failed', { error: e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('seating.notify.title')} italic={t('seating.notify.titleAccent')} subtitle={total ? t('seating.notify.intro', { count: total }) : undefined}>
      {total === 0 ? (
        <Body>{t('seating.notify.nobody')}</Body>
      ) : (
        <View style={{ gap: 10 }}>
          <Option
            icon="whatsapp"
            tint={color.sageTint}
            title={busy === 'whatsapp' ? t('seating.notify.sending') : t('seating.notify.whatsapp')}
            hint={t('seating.notify.whatsappHint', { count: withPhone })}
            disabled={!withPhone || (!!busy && busy !== 'whatsapp')}
            busy={busy === 'whatsapp'}
            onPress={() => send('whatsapp')}
          />
          <Option
            icon="mail"
            tint={color.lavenderTint}
            title={busy === 'email' ? t('seating.notify.sending') : t('seating.notify.email')}
            hint={t('seating.notify.emailHint', { count: withEmail })}
            disabled={!withEmail || (!!busy && busy !== 'email')}
            busy={busy === 'email'}
            onPress={() => send('email')}
          />
        </View>
      )}
      <Option
        icon="copy"
        tint={color.goldTint}
        title={t('seating.notify.copy')}
        hint={t('seating.notify.copyHint')}
        onPress={() => {
          onCopy();
          onClose();
        }}
      />
      {err && <Notice tone="error" text={err} />}
    </Sheet>
  );
}

/** Masa kartlarını yazdır: isteğe bağlı isim kartlarıyla. */
export function PrintCardsSheet({ open, onClose, busy, disabled, onPrint }: { open: boolean; onClose: () => void; busy: boolean; disabled: boolean; onPrint: (tents: boolean) => void }) {
  const { t } = useI18n();
  const [tents, setTents] = useState(false);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('seating.print.title')}
      italic={t('seating.print.titleAccent')}
      accent={color.coral}
      subtitle={t('seating.print.intro')}
      footer={
        <>
          <Button label={t('common.cancel')} variant="ghost" onPress={onClose} />
          <Button label={busy ? t('seating.print.preparing') : t('seating.print.submit')} icon="print" variant="accent" loading={busy} disabled={disabled} onPress={() => onPrint(tents)} />
        </>
      }>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-end', justifyContent: 'center', paddingVertical: 8 }}>
        <View style={{ width: 96, height: 132, borderRadius: 14, backgroundColor: '#FFFDF9', alignItems: 'center', paddingTop: 16, gap: 2, boxShadow: `inset 0 0 0 1px ${color.hairline}, 0px 10px 24px rgba(40,30,20,0.08)` }}>
          <Text style={{ fontFamily: font.serifItalic, fontSize: 13, color: color.lavender }}>{t('seating.print.tableHeading')}</Text>
          <Text style={{ fontFamily: font.serif, fontSize: 44, lineHeight: 46, color: color.ink }}>7</Text>
          <View style={{ width: 18, height: 2, borderRadius: 1, backgroundColor: color.coral, marginVertical: 6 }} />
          {[46, 38, 52].map((w, i) => (
            <View key={i} style={{ width: w, height: 4, borderRadius: 2, backgroundColor: '#E9E3DA', marginTop: 4 }} />
          ))}
        </View>
        {tents && (
          <View style={{ width: 84, height: 64, borderRadius: 8, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', boxShadow: `inset 0 0 0 1px ${color.hairline}, 0px 10px 24px rgba(40,30,20,0.08)` }}>
            <View style={{ position: 'absolute', left: 6, right: 6, top: 32, borderTopWidth: 1, borderStyle: 'dashed', borderColor: '#D9D2C7' }} />
            <Text style={{ fontFamily: font.serif, fontSize: 13, color: color.ink, marginTop: 30 }}>Ahmet</Text>
          </View>
        )}
      </View>
      <ToggleRow label={t('seating.print.tents')} hint={t('seating.print.tentsHint')} value={tents} onChange={setTents} />
      {disabled && <Caption>{t('seating.print.empty')}</Caption>}
    </Sheet>
  );
}
