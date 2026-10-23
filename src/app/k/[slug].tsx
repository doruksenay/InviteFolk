import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { normalizePhone } from '@/core/format';
import { getTheme } from '@/core/themes';
import { makeT } from '@/i18n';
import { useQuery } from '@/lib/api';
import { getPublicEvent, submitGuestRequest } from '@/lib/api-guest';
import { hairline } from '@/ui/guest/colors';
import { PublicLoading, PublicNotFound, PublicPanel, PublicShell } from '@/ui/guest/PublicShell';
import { Icon } from '@/ui/Icon';
import { themeTitle } from '@/ui/theme/typography';
import { font } from '@/ui/tokens';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Davetlinin kendi bilgisini bıraktığı form (ev sahibi linki/karekodu paylaşır, onaylayınca listeye girer). */
export default function CollectorPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const q = useQuery(() => getPublicEvent(slug), [slug]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [party, setParty] = useState(1);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (q.loading && !q.data) return <PublicLoading />;
  const ev = q.data;
  const t = makeT(ev?.lang === 'en' ? 'en' : 'tr');
  if (!ev || !ev.collector) return <PublicNotFound title={t('pub.notFoundTitle')} body={t('pub.notFoundBody')} />;
  const theme = getTheme(ev.theme);

  const submit = async () => {
    setErr(null);
    const e164 = phone.trim() ? normalizePhone(phone) : null;
    const mail = email.trim().toLowerCase() || null;
    if (!name.trim()) return setErr(t('pub.collector.name'));
    if (!e164 && !mail) return setErr(t('pub.collector.needContact'));
    if (phone.trim() && !e164) return setErr(t('pub.collector.badPhone'));
    if (mail && !EMAIL.test(mail)) return setErr(t('pub.collector.badEmail'));
    setBusy(true);
    try {
      await submitGuestRequest(slug, { name: name.trim().slice(0, 120), phone: e164, email: mail, party, note: note.trim().slice(0, 300) || null });
      setSent(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const input = { height: 52, borderRadius: 16, paddingHorizontal: 16, fontFamily: font.regular, fontSize: 15, color: theme.ink, backgroundColor: theme.dark ? 'rgba(255,255,255,0.06)' : '#FFFFFF', boxShadow: `inset 0 0 0 1px ${hairline(theme.dark)}` } as const;
  const label = { fontFamily: font.semibold, fontSize: 14, color: theme.ink } as const;
  const ph = theme.dark ? 'rgba(247,241,231,0.45)' : '#A49C90';

  return (
    <PublicShell themeKey={ev.theme} kicker={t('pub.collector.kicker')} title={ev.title} subtitle={ev.host_names}>
      <PublicPanel theme={theme}>
        {sent ? (
          <View style={{ gap: 8, alignItems: 'flex-start' }}>
            <Icon name="check" size={28} color={theme.key_} strokeWidth={2.4} />
            <Text style={[themeTitle(theme, 40), { color: theme.ink }]}>{t('pub.collector.sentTitle')}</Text>
            <Text style={{ fontFamily: font.regular, fontSize: 15, lineHeight: 22, color: theme.soft }}>{t('pub.collector.sentBody')}</Text>
          </View>
        ) : (
          <>
            <Text style={[themeTitle(theme, 34), { color: theme.ink }]}>{t('pub.collector.title')}</Text>
            <Text style={{ fontFamily: font.regular, fontSize: 14, lineHeight: 20, color: theme.soft }}>{t('pub.collector.body')}</Text>
            <View style={{ gap: 6 }}>
              <Text style={label}>{t('pub.collector.name')}</Text>
              <TextInput value={name} onChangeText={setName} placeholder={t('pub.collector.namePlaceholder')} placeholderTextColor={ph} maxLength={120} autoCapitalize="words" accessibilityLabel={t('pub.collector.name')} style={input} />
            </View>
            <View style={{ gap: 6 }}>
              <Text style={label}>{t('pub.collector.phone')}</Text>
              <TextInput value={phone} onChangeText={setPhone} placeholder="0532 123 45 67" placeholderTextColor={ph} keyboardType="phone-pad" autoComplete="tel" maxLength={20} accessibilityLabel={t('pub.collector.phone')} style={input} />
            </View>
            <View style={{ gap: 6 }}>
              <Text style={label}>{t('pub.collector.email')}</Text>
              <TextInput value={email} onChangeText={setEmail} placeholder="ad@ornek.com" placeholderTextColor={ph} keyboardType="email-address" autoCapitalize="none" autoComplete="email" maxLength={254} accessibilityLabel={t('pub.collector.email')} style={input} />
            </View>
            <View style={{ gap: 6 }}>
              <Text style={label}>{t('pub.collector.party')}</Text>
              <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <Pressable
                  key={n}
                  accessibilityRole="radio"
                  accessibilityLabel={String(n)}
                  accessibilityState={{ checked: party === n }}
                  onPress={() => setParty(n)}
                  style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: party === n ? theme.ink : 'transparent', boxShadow: party === n ? 'none' : `inset 0 0 0 1px ${hairline(theme.dark)}` }}>
                  <Text style={{ fontFamily: font.semibold, fontSize: 14, color: party === n ? theme.bg : theme.ink }}>{n}</Text>
                </Pressable>
              ))}
              </View>
            </View>
            <View style={{ gap: 6 }}>
              <Text style={label}>{t('pub.collector.note')}</Text>
              <TextInput value={note} onChangeText={setNote} placeholder={t('pub.collector.notePlaceholder')} placeholderTextColor={ph} maxLength={300} accessibilityLabel={t('pub.collector.note')} style={input} />
            </View>
            {err && <Text style={{ fontFamily: font.medium, fontSize: 13, color: theme.dark ? '#FFB4A8' : '#A3332A' }}>{err}</Text>}
            <Pressable
              accessibilityRole="button"
              onPress={submit}
              disabled={busy}
              style={({ pressed }) => ({ height: 54, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.ink, opacity: busy ? 0.6 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
              <Text style={{ fontFamily: font.semibold, fontSize: 16, color: theme.bg }}>{t('pub.collector.send')}</Text>
            </Pressable>
            <Text style={{ fontFamily: font.regular, fontSize: 12, lineHeight: 17, color: theme.soft }}>{t('pub.collector.privacy')}</Text>
          </>
        )}
      </PublicPanel>
    </PublicShell>
  );
}
