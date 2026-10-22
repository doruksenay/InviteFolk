import { useLocalSearchParams } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { eventCopy, getEventType } from '@/core/event-types';
import { formatDayMonth, formatWhen } from '@/core/format';
import { getTheme, type InvitationTheme } from '@/core/themes';
import type { PublicInvitation } from '@/core/types';
import { eventLang, LANG_NAMES, LANGS, type Lang, LOCALE_TAG, makeT, type TFn, useI18n } from '@/i18n';
import { getPublicInvitation, respondInvitation, useQuery } from '@/lib/api';
import { InvitationCard } from '@/ui/InvitationCard';
import { tapFeedback } from '@/ui/primitives';
import { font } from '@/ui/tokens';

type Step = 'invite' | 'details' | 'no' | 'done';

/**
 * Davetlinin gördüğü sayfa: giriş yok, uygulama yok.
 * Organizatör paneli renkli bir SaaS gibi; bu sayfa ise sakin, editoryal ve duygusal.
 */
export default function GuestRsvp() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { data, loading, error, setData } = useQuery(() => getPublicInvitation(token), [token]);

  const [step, setStep] = useState<Step>('invite');
  const [party, setParty] = useState<number | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Davetli sayfası organizatörün arayüz dilini değil, etkinliğin dilini izler; davetli değiştirebilir.
  const [langPick, setLangPick] = useState<Lang | null>(null);
  const device = useI18n();

  if (loading && !data) {
    return (
      <View style={[styles.center, { backgroundColor: '#F6F1E8' }]}>
        <ActivityIndicator color="#24212B" accessibilityLabel={device.t('rsvp.loading')} />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={[styles.center, { backgroundColor: '#F6F1E8', padding: 28 }]}>
        <Text style={[styles.h1, { color: '#24212B', fontSize: 40, textAlign: 'center' }]}>{device.t('rsvp.notFoundTitle')}</Text>
        <Text style={[styles.p, { color: '#5F5D70', textAlign: 'center', marginTop: 10 }]}>{device.t('rsvp.notFoundBody')}</Text>
      </View>
    );
  }

  const inv: PublicInvitation = data;
  const lang: Lang = langPick ?? eventLang(inv.event.settings);
  const t = makeT(lang);
  const locale = LOCALE_TAG[lang];
  const cfg = getEventType(inv.event.type);
  const copyText = eventCopy(inv.event.type, lang);
  const theme = getTheme(inv.event.theme);
  const partyValue = party ?? Math.min(inv.party_size || inv.max_party, inv.max_party);
  const storedMenu = inv.event.settings?.menu;
  const menuOptions = Array.isArray(storedMenu) && storedMenu.length ? (storedMenu as string[]) : cfg.questions.menu ? copyText.menu : null;

  const submit = async (status: 'yes' | 'no') => {
    setBusy(true);
    setErr(null);
    try {
      const updated = await respondInvitation(token, status, status === 'yes' ? partyValue : 0, menu, note.trim() || null);
      setData(updated);
      setStep('done');
    } catch {
      setErr(t('rsvp.sendFailed'));
    } finally {
      setBusy(false);
    }
  };

  const yes = () => {
    tapFeedback();
    if (cfg.questions.partySize && inv.max_party > 1) setStep('details');
    else if (menuOptions) setStep('details');
    else submit('yes');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.dark ? theme.bg : '#F6F1E8' }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', padding: 20, paddingBottom: 48 }}>
        <View style={{ width: '100%', maxWidth: 420, gap: 20 }}>
          <LangToggle theme={theme} lang={lang} onChange={setLangPick} t={t} />
          {step === 'invite' && (
            <>
              <InvitationCard
                theme={theme}
                lang={lang}
                artHeight={240}
                copy={{
                  greet: t('rsvp.greet', { name: inv.guest_name }),
                  kicker: copyText.sample.kicker,
                  title: inv.event.title,
                  line: inv.event.host_names ? t('rsvp.hostLine', { hosts: inv.event.host_names }) : copyText.sample.line,
                  when: formatWhen(inv.event.starts_at, locale) ?? t('rsvp.dateSoon'),
                  where: [inv.event.venue_name, inv.event.venue_address].filter(Boolean).join(', ') || t('rsvp.placeSoon'),
                  deadline: formatDayMonth(inv.event.rsvp_deadline, locale),
                  yes: copyText.rsvp.yes,
                  no: copyText.rsvp.no,
                }}
                actions={
                  <View style={{ gap: 10, paddingTop: 8 }}>
                    {inv.table_label && <TableTicket theme={theme} label={inv.table_label} t={t} />}
                    {inv.status !== 'pending' && (
                      <Text style={[styles.small, { color: theme.soft, textAlign: 'center' }]}>
                        {t('rsvp.previously', { answer: inv.status === 'yes' ? copyText.rsvp.yes : copyText.rsvp.no })}
                      </Text>
                    )}
                    <PillButton theme={theme} filled label={copyText.rsvp.yes} onPress={yes} />
                    <PillButton theme={theme} label={copyText.rsvp.no} onPress={() => setStep('no')} />
                  </View>
                }
              />
              {err && <Text style={[styles.small, { color: '#A3332A', textAlign: 'center' }]}>{err}</Text>}
            </>
          )}

          {step === 'details' && (
            <Sheet theme={theme} title={t('rsvp.detailsTitle')} subtitle={t('rsvp.detailsSubtitle')} backLabel={t('rsvp.backToInvite')} onBack={() => setStep('invite')}>
              {cfg.questions.partySize && inv.max_party > 1 && (
                <View style={[styles.box, { backgroundColor: theme.dark ? 'rgba(255,255,255,0.06)' : '#FFFFFF' }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: theme.ink }]}>{t('rsvp.partyQuestion')}</Text>
                    <Text style={[styles.small, { color: theme.soft }]}>{t('rsvp.partyMax', { count: inv.max_party })}</Text>
                  </View>
                  <Round theme={theme} label="−" a11y={t('rsvp.decrease')} onPress={() => setParty(Math.max(1, partyValue - 1))} />
                  <Text style={[styles.h1, { fontSize: 36, minWidth: 34, textAlign: 'center', color: theme.ink }]}>{partyValue}</Text>
                  <Round theme={theme} label="+" a11y={t('rsvp.increase')} filled onPress={() => setParty(Math.min(inv.max_party, partyValue + 1))} />
                </View>
              )}
              {menuOptions && (
                <View style={{ gap: 10 }}>
                  <Text style={[styles.label, { color: theme.ink }]}>{t('rsvp.menuQuestion')}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {menuOptions.map((m) => (
                      <Pressable
                        key={m}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: menu === m }}
                        onPress={() => setMenu(m)}
                        style={[styles.chip, { backgroundColor: menu === m ? theme.ink : 'transparent', boxShadow: `inset 0 0 0 1.5px ${menu === m ? theme.ink : 'rgba(120,100,80,0.28)'}` }]}>
                        <Text style={[styles.label, { color: menu === m ? theme.bg : theme.ink }]}>{m}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
              <NoteField theme={theme} value={note} onChange={setNote} placeholder={t('rsvp.yesNotePlaceholder')} t={t} />
              {err && <Text style={[styles.small, { color: '#A3332A' }]}>{err}</Text>}
              <PillButton theme={theme} filled label={busy ? t('rsvp.sending') : t('rsvp.sendAnswer')} onPress={() => submit('yes')} />
            </Sheet>
          )}

          {step === 'no' && (
            <Sheet theme={theme} title={t('rsvp.noTitle')} subtitle={t('rsvp.noSubtitle')} backLabel={t('rsvp.backToInvite')} onBack={() => setStep('invite')}>
              <NoteField theme={theme} value={note} onChange={setNote} placeholder={t('rsvp.noNotePlaceholder')} t={t} />
              {err && <Text style={[styles.small, { color: '#A3332A' }]}>{err}</Text>}
              <PillButton theme={theme} filled label={busy ? t('rsvp.sending') : t('rsvp.send')} onPress={() => submit('no')} />
            </Sheet>
          )}

          {step === 'done' && (
            <View style={{ gap: 16, paddingTop: 40 }}>
              <View style={{ height: 160 }}>
                <View style={{ position: 'absolute', right: -10, top: 0, width: 160, height: 160, borderRadius: 80, backgroundColor: theme.shapeA }} />
                <View style={{ position: 'absolute', right: 130, top: 80, width: 60, height: 60, borderRadius: 30, backgroundColor: theme.shapeB }} />
              </View>
              <Text style={[styles.small, { color: theme.soft, letterSpacing: 1.2 }]}>{t('rsvp.doneKicker')}</Text>
              <Text style={[styles.h1, { color: theme.ink }]}>{inv.status === 'yes' ? t('rsvp.doneYesTitle') : t('rsvp.doneNoTitle')}</Text>
              <Text style={[styles.serifBody, { color: theme.soft }]}>
                {inv.status === 'yes'
                  ? t('rsvp.doneYesBody', { count: inv.party_size ?? 1 })
                  : t('rsvp.doneNoBody')}
              </Text>
              {inv.table_label && <TableTicket theme={theme} label={inv.table_label} t={t} />}
              <PillButton theme={theme} label={t('rsvp.change')} onPress={() => setStep('invite')} />
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** Organizatör masayı atadıysa davetliye gösterilen küçük "yer kartı". */
function TableTicket({ theme, label, t }: { theme: InvitationTheme; label: string; t: TFn }) {
  return (
    <View
      accessibilityLabel={t('rsvp.tableA11y', { label })}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 14,
        paddingHorizontal: 18,
        borderRadius: 20,
        backgroundColor: theme.dark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.75)',
        boxShadow: `inset 0 0 0 1px ${theme.dark ? 'rgba(255,255,255,0.14)' : 'rgba(120,100,80,0.16)'}`,
      }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.shapeA, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: theme.dark ? theme.bg : '#FFFFFF' }} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.small, { color: theme.soft, letterSpacing: 1.4 }]}>{t('rsvp.tableKicker')}</Text>
        <Text style={[styles.h1, { fontSize: 30, lineHeight: 34, color: theme.ink }]}>{label}</Text>
      </View>
    </View>
  );
}

function Sheet({
  theme,
  title,
  subtitle,
  backLabel,
  onBack,
  children,
}: {
  theme: InvitationTheme;
  title: string;
  subtitle: string;
  backLabel: string;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: 20, paddingTop: 8 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={backLabel} onPress={onBack} style={[styles.back, { boxShadow: `inset 0 0 0 1px ${theme.dark ? 'rgba(255,255,255,0.2)' : 'rgba(120,100,80,0.25)'}` }]}>
        <Text style={{ fontFamily: font.semibold, fontSize: 18, color: theme.ink }}>‹</Text>
      </Pressable>
      <View style={{ gap: 6 }}>
        <Text style={[styles.h1, { color: theme.ink }]}>{title}</Text>
        <Text style={[styles.p, { color: theme.soft }]}>{subtitle}</Text>
      </View>
      {children}
    </View>
  );
}

/** Sayfanın üstünde küçük "TR · EN" seçici; davetiye temasının renkleriyle. */
function LangToggle({ theme, lang, onChange, t }: { theme: InvitationTheme; lang: Lang; onChange: (l: Lang) => void; t: TFn }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t('rsvp.langLabel')} style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 2 }}>
      {LANGS.map((l, i) => {
        const on = l === lang;
        return (
          <View key={l} style={{ flexDirection: 'row', alignItems: 'center' }}>
            {i > 0 && <Text style={[styles.small, { color: theme.soft, opacity: 0.6, marginHorizontal: 2 }]}>·</Text>}
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={t('rsvp.switchTo', { name: LANG_NAMES[l] })}
              onPress={() => {
                tapFeedback();
                onChange(l);
              }}
              hitSlop={8}
              style={{ paddingHorizontal: 6, paddingVertical: 4 }}>
              <Text style={{ fontFamily: on ? font.bold : font.medium, fontSize: 12, letterSpacing: 1.6, color: on ? theme.ink : theme.soft, opacity: on ? 1 : 0.7 }}>
                {l.toUpperCase()}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

function PillButton({ theme, label, onPress, filled }: { theme: InvitationTheme; label: string; onPress: () => void; filled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        filled ? { backgroundColor: theme.ink } : { boxShadow: `inset 0 0 0 1.5px ${theme.ink}` },
        pressed && { transform: [{ scale: 0.98 }] },
      ]}>
      <Text style={[styles.pillText, { color: filled ? theme.bg : theme.ink }]}>{label}</Text>
    </Pressable>
  );
}

function Round({ theme, label, a11y, onPress, filled }: { theme: InvitationTheme; label: string; a11y: string; onPress: () => void; filled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      style={({ pressed }) => [styles.round, filled ? { backgroundColor: theme.ink } : { boxShadow: 'inset 0 0 0 1px rgba(120,100,80,0.28)' }, pressed && { transform: [{ scale: 0.94 }] }]}>
      <Text style={{ fontFamily: font.medium, fontSize: 22, color: filled ? theme.bg : theme.ink }}>{label}</Text>
    </Pressable>
  );
}

function NoteField({ theme, value, onChange, placeholder, t }: { theme: InvitationTheme; value: string; onChange: (v: string) => void; placeholder: string; t: TFn }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={[styles.label, { color: theme.ink }]}>
        {t('rsvp.noteLabel')} <Text style={{ fontFamily: font.regular, color: theme.soft }}>{t('rsvp.optional')}</Text>
      </Text>
      <TextInput
        accessibilityLabel={t('rsvp.noteLabel')}
        multiline
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.dark ? 'rgba(247,241,231,0.45)' : '#A49C90'}
        maxLength={500}
        style={[styles.note, { color: theme.ink, backgroundColor: theme.dark ? 'rgba(255,255,255,0.06)' : '#FFFFFF' }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  h1: { fontFamily: font.serif, fontSize: 54, lineHeight: 54, letterSpacing: -0.4 },
  serifBody: { fontFamily: font.serif, fontSize: 22, lineHeight: 29 },
  p: { fontFamily: font.regular, fontSize: 15, lineHeight: 23 },
  small: { fontFamily: font.regular, fontSize: 13, lineHeight: 19 },
  label: { fontFamily: font.semibold, fontSize: 15 },
  box: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, borderRadius: 24 },
  chip: { height: 44, paddingHorizontal: 18, borderRadius: 999, justifyContent: 'center' },
  note: { minHeight: 96, borderRadius: 18, padding: 14, fontFamily: font.regular, fontSize: 15, textAlignVertical: 'top', boxShadow: 'inset 0 0 0 1px rgba(120,100,80,0.18)' },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  pill: { height: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  pillText: { fontFamily: font.semibold, fontSize: 16 },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
