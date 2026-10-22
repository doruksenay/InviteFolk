import { Link, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { eventCopy, getEventType } from '@/core/event-types';
import { formatDayMonth, formatWhen, rsvpUrl } from '@/core/format';
import { getTheme, type InvitationTheme } from '@/core/themes';
import type { EventSettings, PublicInvitation } from '@/core/types';
import { eventLang, LANG_NAMES, LANGS, type Lang, LOCALE_TAG, makeT, type TFn, useI18n } from '@/i18n';
import { getPublicInvitation, respondInvitation, useQuery } from '@/lib/api';
import { getPublicDesign, type PublicDesign } from '@/lib/api-design';
import { addToCalendar, type CalEvent, googleCalendarUrl, mapsUrl } from '@/ui/design/calendar';
import { GuestDesignCard } from '@/ui/design/GuestDesignCard';
import { Icon } from '@/ui/Icon';
import { InvitationCard } from '@/ui/InvitationCard';
import { tapFeedback } from '@/ui/primitives';
import { font } from '@/ui/tokens';

type Step = 'invite' | 'details' | 'no' | 'done';

type GuestSettings = EventSettings & { has_design?: boolean };

/**
 * Davetlinin gördüğü sayfa: giriş yok, uygulama yok.
 * Organizatör paneli renkli bir SaaS gibi; bu sayfa ise sakin, editoryal ve duygusal.
 * Organizatör kendi tasarımını yüklediyse o görsel, üzerinde davetlinin adıyla gösterilir.
 */
export default function GuestRsvp() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { data, loading, error, setData } = useQuery(() => getPublicInvitation(token), [token]);

  const [step, setStep] = useState<Step>('invite');
  const [party, setParty] = useState<number | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [answers, setAnswers] = useState<Record<string, string> | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Davetli sayfası organizatörün arayüz dilini değil, etkinliğin dilini izler; davetli değiştirebilir.
  const [langPick, setLangPick] = useState<Lang | null>(null);
  const [design, setDesign] = useState<PublicDesign | null>(null);
  const [designFailed, setDesignFailed] = useState(false);
  const device = useI18n();

  const hasDesign = !!(data?.event.settings as GuestSettings | undefined)?.has_design;
  useEffect(() => {
    if (!hasDesign || !token) return;
    let alive = true;
    getPublicDesign(token)
      .then((d) => {
        if (!alive) return;
        if (d.overlay && d.url) setDesign(d);
        else setDesignFailed(true);
      })
      .catch(() => alive && setDesignFailed(true));
    return () => {
      alive = false;
    };
  }, [hasDesign, token]);

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
  const settings = (inv.event.settings ?? {}) as GuestSettings;
  const lang: Lang = langPick ?? eventLang(inv.event.settings);
  const t = makeT(lang);
  const locale = LOCALE_TAG[lang];
  const cfg = getEventType(inv.event.type);
  const copyText = eventCopy(inv.event.type, lang);
  const theme = getTheme(inv.event.theme);
  const partyValue = party ?? Math.min(inv.party_size || inv.max_party, inv.max_party);
  const storedMenu = settings.menu;
  const menuOptions = Array.isArray(storedMenu) && storedMenu.length ? storedMenu : cfg.questions.menu ? copyText.menu : null;
  const questions = (Array.isArray(settings.questions) ? settings.questions : []).filter((q) => q && typeof q.id === 'string' && typeof q.label === 'string').slice(0, 5);
  const answerValues = answers ?? inv.answers ?? {};
  const roster = inv.roster ?? null;
  const waitPos = roster?.waitlist_position ?? null;
  const designReady = hasDesign && !!design && !designFailed;
  const designPending = hasDesign && !design && !designFailed;

  const where = [inv.event.venue_name, inv.event.venue_address].filter(Boolean).join(', ');
  const start = inv.event.starts_at ? new Date(inv.event.starts_at) : null;
  const calEvent =
    start && !Number.isNaN(start.getTime())
      ? {
          title: inv.event.title,
          start,
          end: new Date(start.getTime() + (inv.event.type === 'saha' ? 1 : 3) * 3600_000),
          location: where || undefined,
          description: t('rsvp.calendarNote', { link: rsvpUrl(token) }),
        }
      : null;

  const submit = async (status: 'yes' | 'no') => {
    setBusy(true);
    setErr(null);
    try {
      const filled = Object.fromEntries(Object.entries(answerValues).filter(([, v]) => typeof v === 'string' && v.trim()).map(([k, v]) => [k, v.trim().slice(0, 200)]));
      const updated = await respondInvitation(token, status, status === 'yes' ? partyValue : 0, menu, note.trim() || null, questions.length ? filled : null);
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
    if ((cfg.questions.partySize && inv.max_party > 1) || menuOptions || questions.length) setStep('details');
    else submit('yes');
  };

  const previously =
    inv.status === 'waitlist'
      ? waitPos
        ? t('rsvp.waitlistBadge', { position: waitPos })
        : t('rsvp.previouslyWaitlist')
      : inv.status !== 'pending'
        ? t('rsvp.previously', { answer: inv.status === 'yes' ? copyText.rsvp.yes : copyText.rsvp.no })
        : null;

  const actions = (
    <View style={{ gap: 10, paddingTop: 8 }}>
      {inv.table_label && <TableTicket theme={theme} label={inv.table_label} t={t} />}
      {roster && inv.status !== 'waitlist' && (
        <RosterBadge
          theme={theme}
          text={roster.confirmed >= roster.size && inv.status !== 'yes' ? t('rsvp.rosterFull', { yes: copyText.rsvp.yes }) : t('rsvp.rosterCount', { confirmed: roster.confirmed, size: roster.size })}
          full={roster.confirmed >= roster.size}
          ratio={roster.size ? roster.confirmed / roster.size : 0}
        />
      )}
      {previously && <Text style={[styles.small, { color: theme.soft, textAlign: 'center' }]}>{previously}</Text>}
      <PillButton theme={theme} filled label={copyText.rsvp.yes} onPress={yes} />
      <PillButton theme={theme} label={copyText.rsvp.no} onPress={() => setStep('no')} />
    </View>
  );

  const extras = (
    <EventExtras
      theme={theme}
      t={t}
      fee={typeof settings.fee === 'number' && settings.fee > 0 ? new Intl.NumberFormat(locale, { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(settings.fee) : null}
      giftNote={typeof settings.gift_note === 'string' && settings.gift_note.trim() ? settings.gift_note.trim() : null}
      calEvent={calEvent}
      mapQuery={where || null}
    />
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.dark ? theme.bg : '#F6F1E8' }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', padding: 20, paddingBottom: 40 }}>
        <View style={{ width: '100%', maxWidth: 420, gap: 20, flexGrow: 1 }}>
          <LangToggle theme={theme} lang={lang} onChange={setLangPick} t={t} />
          {step === 'invite' && (
            <>
              {designPending ? (
                <View accessibilityLabel={t('rsvp.designLoading')} style={{ height: 520, borderRadius: 28, backgroundColor: theme.dark ? 'rgba(255,255,255,0.05)' : '#EFE8DD', alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator color={theme.ink} />
                </View>
              ) : designReady && design ? (
                <GuestDesignCard theme={theme} uri={design.url} naturalWidth={design.width} naturalHeight={design.height} overlay={design.overlay} name={inv.guest_name}>
                  <View style={{ gap: 8 }}>
                    <InfoRow theme={theme} icon="calendar" text={formatWhen(inv.event.starts_at, locale) ?? t('rsvp.dateSoon')} />
                    <InfoRow theme={theme} icon="pin" text={where || t('rsvp.placeSoon')} />
                  </View>
                  {actions}
                  {inv.event.rsvp_deadline ? (
                    <Text style={[styles.small, { color: theme.soft, textAlign: 'center', fontSize: 12 }]}>
                      {t('wizard.card.deadline', { date: formatDayMonth(inv.event.rsvp_deadline, locale) ?? '' })}
                    </Text>
                  ) : null}
                </GuestDesignCard>
              ) : (
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
                    where: where || t('rsvp.placeSoon'),
                    deadline: formatDayMonth(inv.event.rsvp_deadline, locale),
                    yes: copyText.rsvp.yes,
                    no: copyText.rsvp.no,
                  }}
                  actions={actions}
                />
              )}
              {err && <Text style={[styles.small, { color: '#A3332A', textAlign: 'center' }]}>{err}</Text>}
              {extras}
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
                  <ChoiceChips theme={theme} options={menuOptions} value={menu} onChange={setMenu} />
                </View>
              )}
              {questions.length > 0 && (
                <View style={{ gap: 16 }}>
                  <Text style={[styles.small, { color: theme.soft, letterSpacing: 1.2 }]}>{t('rsvp.questionsTitle').toLocaleUpperCase(locale)}</Text>
                  {questions.map((q) => (
                    <View key={q.id} style={{ gap: 10 }}>
                      <Text style={[styles.label, { color: theme.ink }]}>{q.label}</Text>
                      {q.type === 'choice' && Array.isArray(q.options) && q.options.length ? (
                        <ChoiceChips
                          theme={theme}
                          options={q.options.slice(0, 8)}
                          value={answerValues[q.id] ?? null}
                          onChange={(v) => setAnswers({ ...answerValues, [q.id]: v })}
                        />
                      ) : (
                        <TextInput
                          accessibilityLabel={q.label}
                          value={answerValues[q.id] ?? ''}
                          onChangeText={(v) => setAnswers({ ...answerValues, [q.id]: v })}
                          placeholder={t('rsvp.answerPlaceholder')}
                          placeholderTextColor={theme.dark ? 'rgba(247,241,231,0.45)' : '#A49C90'}
                          maxLength={200}
                          style={[styles.input, { color: theme.ink, backgroundColor: theme.dark ? 'rgba(255,255,255,0.06)' : '#FFFFFF' }]}
                        />
                      )}
                    </View>
                  ))}
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
              <Text style={[styles.h1, { color: theme.ink }]}>
                {inv.status === 'waitlist' ? t('rsvp.doneWaitlistTitle') : inv.status === 'yes' ? t('rsvp.doneYesTitle') : t('rsvp.doneNoTitle')}
              </Text>
              <Text style={[styles.serifBody, { color: theme.soft }]}>
                {inv.status === 'waitlist'
                  ? t('rsvp.doneWaitlistBody', { position: waitPos ?? 1 })
                  : inv.status === 'yes'
                    ? t('rsvp.doneYesBody', { count: inv.party_size ?? 1 })
                    : t('rsvp.doneNoBody')}
              </Text>
              {inv.table_label && <TableTicket theme={theme} label={inv.table_label} t={t} />}
              {(inv.status === 'yes' || inv.status === 'waitlist') && extras}
              <PillButton theme={theme} label={t('rsvp.change')} onPress={() => setStep('invite')} />
            </View>
          )}

          <Footer theme={theme} t={t} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ theme, icon, text }: { theme: InvitationTheme; icon: 'calendar' | 'pin'; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Icon name={icon} size={16} color={theme.ink} />
      <Text style={{ fontFamily: font.medium, fontSize: 14, color: theme.ink, flexShrink: 1 }}>{text}</Text>
    </View>
  );
}

/** Halı saha gibi kadrolu etkinliklerde doluluk. */
function RosterBadge({ theme, text, full, ratio }: { theme: InvitationTheme; text: string; full: boolean; ratio: number }) {
  return (
    <View style={{ gap: 8, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 18, backgroundColor: theme.dark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.75)' }}>
      <Text style={{ fontFamily: font.semibold, fontSize: 14, color: theme.ink }}>{text}</Text>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.dark ? 'rgba(255,255,255,0.12)' : 'rgba(120,100,80,0.14)', overflow: 'hidden' }}>
        <View style={{ height: 6, width: `${Math.round(Math.min(1, ratio) * 100)}%`, borderRadius: 3, backgroundColor: full ? theme.shapeB : theme.shapeA }} />
      </View>
    </View>
  );
}

function ChoiceChips({ theme, options, value, onChange }: { theme: InvitationTheme; options: string[]; value: string | null; onChange: (v: string) => void }) {
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((m) => (
        <Pressable
          key={m}
          accessibilityRole="radio"
          accessibilityState={{ checked: value === m }}
          onPress={() => onChange(m)}
          style={[styles.chip, { backgroundColor: value === m ? theme.ink : 'transparent', boxShadow: `inset 0 0 0 1.5px ${value === m ? theme.ink : 'rgba(120,100,80,0.28)'}` }]}>
          <Text style={[styles.label, { color: value === m ? theme.bg : theme.ink }]}>{m}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Ücret, ev sahibinin notu, takvim ve harita. */
function EventExtras({
  theme,
  t,
  fee,
  giftNote,
  calEvent,
  mapQuery,
}: {
  theme: InvitationTheme;
  t: TFn;
  fee: string | null;
  giftNote: string | null;
  calEvent: CalEvent | null;
  mapQuery: string | null;
}) {
  if (!fee && !giftNote && !calEvent && !mapQuery) return null;
  const soft = theme.dark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.75)';
  return (
    <View style={{ gap: 12 }}>
      {fee && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 18, backgroundColor: soft }}>
          <Icon name="creditCard" size={18} color={theme.ink} />
          <Text style={{ fontFamily: font.medium, fontSize: 14, color: theme.ink, flexShrink: 1 }}>{t('rsvp.fee', { amount: fee })}</Text>
        </View>
      )}
      {giftNote && (
        <View style={{ gap: 6, paddingVertical: 16, paddingHorizontal: 18, borderRadius: 20, backgroundColor: soft }}>
          <Text style={[styles.small, { color: theme.key_, letterSpacing: 1.4, fontFamily: font.bold, fontSize: 11 }]}>{t('rsvp.giftKicker')}</Text>
          <Text style={[styles.serifBody, { color: theme.ink, fontSize: 20, lineHeight: 26 }]}>{giftNote}</Text>
        </View>
      )}
      {(calEvent || mapQuery) && (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {calEvent && <SmallPill theme={theme} icon="calendar" label={t('rsvp.addToCalendar')} onPress={() => addToCalendar(calEvent).catch(() => {})} />}
          {mapQuery && <SmallPill theme={theme} icon="map" label={t('rsvp.openMap')} onPress={() => Linking.openURL(mapsUrl(mapQuery)).catch(() => {})} />}
        </View>
      )}
      {calEvent && Platform.OS === 'web' && (
        <Pressable accessibilityRole="link" onPress={() => Linking.openURL(googleCalendarUrl(calEvent)).catch(() => {})} style={{ alignSelf: 'center', paddingVertical: 2 }}>
          <Text style={{ fontFamily: font.medium, fontSize: 12, color: theme.soft, textDecorationLine: 'underline' }}>{t('rsvp.googleCalendar')}</Text>
        </Pressable>
      )}
    </View>
  );
}

function SmallPill({ theme, icon, label, onPress }: { theme: InvitationTheme; icon: 'calendar' | 'map'; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: 48,
        borderRadius: 999,
        boxShadow: `inset 0 0 0 1px ${theme.dark ? 'rgba(255,255,255,0.22)' : 'rgba(120,100,80,0.28)'}`,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}>
      <Icon name={icon} size={16} color={theme.ink} />
      <Text style={{ fontFamily: font.semibold, fontSize: 14, color: theme.ink }}>{label}</Text>
    </Pressable>
  );
}

function Footer({ theme, t }: { theme: InvitationTheme; t: TFn }) {
  return (
    <View style={{ marginTop: 'auto', paddingTop: 28, alignItems: 'center', gap: 6 }}>
      <Link href="/yasal/kvkk" accessibilityRole="link" style={{ fontFamily: font.medium, fontSize: 12, color: theme.soft, textDecorationLine: 'underline' }}>
        {t('rsvp.footerPrivacy')}
      </Link>
      <Text style={{ fontFamily: font.regular, fontSize: 11, color: theme.soft, opacity: 0.75 }}>{t('rsvp.footerMade')}</Text>
    </View>
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
  input: { height: 52, borderRadius: 18, paddingHorizontal: 16, fontFamily: font.regular, fontSize: 15, boxShadow: 'inset 0 0 0 1px rgba(120,100,80,0.18)' },
  note: { minHeight: 96, borderRadius: 18, padding: 14, fontFamily: font.regular, fontSize: 15, textAlignVertical: 'top', boxShadow: 'inset 0 0 0 1px rgba(120,100,80,0.18)' },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  pill: { height: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  pillText: { fontFamily: font.semibold, fontSize: 16 },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
