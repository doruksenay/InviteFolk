import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import type { InvitationTheme } from '@/core/themes';
import type { PublicGuestbookEntry } from '@/core/types';
import type { TFn } from '@/i18n';
import { useQuery } from '@/lib/api';
import { guestbookForGuest, guestbookForSlug, signGuestbook, signGuestbookPublic } from '@/lib/api-guest';
import { themeProse } from '@/ui/theme/typography';
import { font } from '@/ui/tokens';

import { hairline } from './colors';
import { SectionCard } from './Sections';

const MAX = 500;

type Source = { token: string } | { slug: string };

/** Anı defteri: davetli bir not bırakır; organizatör "herkes görsün" dediyse son mesajlar listelenir. */
export function GuestbookCard({ theme, t, locale, source, isPublic }: { theme: InvitationTheme; t: TFn; locale: string; source: Source; isPublic: boolean }) {
  const byToken = 'token' in source;
  const key = byToken ? source.token : source.slug;
  const list = useQuery<PublicGuestbookEntry[]>(
    () => (isPublic ? (byToken ? guestbookForGuest(key) : guestbookForSlug(key)) : Promise.resolve([])),
    [key, isPublic, byToken],
  );
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<'ok' | 'pending' | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const canSend = msg.trim().length > 0 && (byToken || name.trim().length > 0) && !busy;
  const send = async () => {
    if (!canSend) return;
    setBusy(true);
    setErr(null);
    try {
      const r = byToken ? await signGuestbook(key, msg) : await signGuestbookPublic(key, name, msg);
      setSent(r.pending ? 'pending' : 'ok');
      setMsg('');
      if (!r.pending) list.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const input = {
    borderRadius: 16,
    paddingHorizontal: 16,
    fontFamily: font.regular,
    fontSize: 15,
    color: theme.ink,
    backgroundColor: theme.dark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
    boxShadow: `inset 0 0 0 1px ${hairline(theme.dark)}`,
  } as const;
  const ph = theme.dark ? 'rgba(247,241,231,0.45)' : '#A49C90';
  const fmt = (iso: string) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' }).format(new Date(iso));
  const entries = list.data ?? [];

  return (
    <SectionCard theme={theme} kicker={t('guest.guestbook.kicker')} icon="book">
      <Text style={{ fontFamily: font.regular, fontSize: 14, lineHeight: 20, color: theme.soft }}>{t('guest.guestbook.body')}</Text>
      {sent ? (
        <View style={{ gap: 8 }}>
          <Text style={{ fontFamily: font.semibold, fontSize: 15, color: theme.key_ }}>{sent === 'pending' ? t('guest.guestbook.pending') : t('guest.guestbook.thanks')}</Text>
          <Pressable accessibilityRole="button" onPress={() => setSent(null)} hitSlop={8}>
            <Text style={{ fontFamily: font.semibold, fontSize: 14, color: theme.ink, textDecorationLine: 'underline' }}>{t('guest.guestbook.another')}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {!byToken && (
            <TextInput
              value={name}
              onChangeText={setName}
              maxLength={80}
              placeholder={t('guest.guestbook.name')}
              placeholderTextColor={ph}
              accessibilityLabel={t('guest.guestbook.name')}
              style={[input, { height: 48 }]}
            />
          )}
          <TextInput
            value={msg}
            onChangeText={setMsg}
            maxLength={MAX}
            multiline
            placeholder={t('guest.guestbook.placeholder')}
            placeholderTextColor={ph}
            accessibilityLabel={t('guest.guestbook.placeholder')}
            style={[input, { minHeight: 96, paddingTop: 12, paddingBottom: 12, textAlignVertical: 'top' }]}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <Text style={{ fontFamily: font.medium, fontSize: 12, color: theme.soft }}>{`${msg.length}/${MAX}`}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSend }}
              disabled={!canSend}
              onPress={send}
              style={({ pressed }) => ({ height: 44, paddingHorizontal: 20, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.ink, opacity: canSend ? 1 : 0.45, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
              {busy ? <ActivityIndicator color={theme.bg} /> : <Text style={{ fontFamily: font.semibold, fontSize: 14, color: theme.bg }}>{t('guest.guestbook.send')}</Text>}
            </Pressable>
          </View>
          {err ? <Text style={{ fontFamily: font.medium, fontSize: 13, color: theme.dark ? '#FFB4A8' : '#A3332A' }}>{err}</Text> : null}
        </View>
      )}
      {isPublic && entries.length > 0 && (
        <View style={{ gap: 10, marginTop: 4 }}>
          {entries.slice(0, 30).map((e, i) => (
            <View key={`${e.at}-${i}`} style={{ gap: 4, paddingTop: 10, borderTopWidth: 1, borderTopColor: hairline(theme.dark) }}>
              <Text style={[themeProse(theme, 20), { color: theme.ink }]}>{e.message}</Text>
              <Text style={{ fontFamily: font.semibold, fontSize: 12, color: theme.soft }}>
                {e.name} · {fmt(e.at)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </SectionCard>
  );
}
