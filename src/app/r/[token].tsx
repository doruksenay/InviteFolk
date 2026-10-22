import { useLocalSearchParams } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getEventType } from '@/core/event-types';
import { formatWhen } from '@/core/format';
import { getTheme, type InvitationTheme } from '@/core/themes';
import type { PublicInvitation } from '@/core/types';
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

  if (loading && !data) {
    return (
      <View style={[styles.center, { backgroundColor: '#F6F1E8' }]}>
        <ActivityIndicator color="#24212B" />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={[styles.center, { backgroundColor: '#F6F1E8', padding: 28 }]}>
        <Text style={[styles.h1, { color: '#24212B', fontSize: 40, textAlign: 'center' }]}>Davet bulunamadı</Text>
        <Text style={[styles.p, { color: '#5F5D70', textAlign: 'center', marginTop: 10 }]}>
          Bu bağlantı geçersiz ya da etkinlik sona ermiş olabilir. Davet edeninle iletişime geçebilirsin.
        </Text>
      </View>
    );
  }

  const inv: PublicInvitation = data;
  const cfg = getEventType(inv.event.type);
  const theme = getTheme(inv.event.theme);
  const partyValue = party ?? Math.min(inv.party_size || inv.max_party, inv.max_party);
  const menuOptions = (inv.event.settings?.menu as string[] | undefined) ?? cfg.questions.menu ?? null;

  const submit = async (status: 'yes' | 'no') => {
    setBusy(true);
    setErr(null);
    try {
      const updated = await respondInvitation(token, status, status === 'yes' ? partyValue : 0, menu, note.trim() || null);
      setData(updated);
      setStep('done');
    } catch {
      setErr('Cevabın gönderilemedi. Bağlantını kontrol edip tekrar dene.');
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
          {step === 'invite' && (
            <>
              <InvitationCard
                theme={theme}
                artHeight={240}
                copy={{
                  greet: `Sayın ${inv.guest_name}`,
                  kicker: cfg.sample.kicker,
                  title: inv.event.title,
                  line: inv.event.host_names ? `${inv.event.host_names} sizi aralarında görmekten mutluluk duyar.` : cfg.sample.line,
                  when: formatWhen(inv.event.starts_at) ?? 'Tarih yakında bildirilecek',
                  where: [inv.event.venue_name, inv.event.venue_address].filter(Boolean).join(', ') || 'Yer yakında bildirilecek',
                  deadline: inv.event.rsvp_deadline ? new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' }).format(new Date(inv.event.rsvp_deadline)) : null,
                  yes: cfg.rsvp.yes,
                  no: cfg.rsvp.no,
                }}
                actions={
                  <View style={{ gap: 10, paddingTop: 8 }}>
                    {inv.status !== 'pending' && (
                      <Text style={[styles.small, { color: theme.soft, textAlign: 'center' }]}>
                        Daha önce “{inv.status === 'yes' ? cfg.rsvp.yes : cfg.rsvp.no}” dediniz. İsterseniz değiştirebilirsiniz.
                      </Text>
                    )}
                    <PillButton theme={theme} filled label={cfg.rsvp.yes} onPress={yes} />
                    <PillButton theme={theme} label={cfg.rsvp.no} onPress={() => setStep('no')} />
                  </View>
                }
              />
              {err && <Text style={[styles.small, { color: '#A3332A', textAlign: 'center' }]}>{err}</Text>}
            </>
          )}

          {step === 'details' && (
            <Sheet theme={theme} title="Ne güzel." subtitle="Birkaç küçük bilgi; yerinizi ona göre hazırlayacağız." onBack={() => setStep('invite')}>
              {cfg.questions.partySize && inv.max_party > 1 && (
                <View style={[styles.box, { backgroundColor: theme.dark ? 'rgba(255,255,255,0.06)' : '#FFFFFF' }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: theme.ink }]}>Kaç kişi geliyorsunuz?</Text>
                    <Text style={[styles.small, { color: theme.soft }]}>en fazla {inv.max_party} kişi</Text>
                  </View>
                  <Round theme={theme} label="−" a11y="Azalt" onPress={() => setParty(Math.max(1, partyValue - 1))} />
                  <Text style={[styles.h1, { fontSize: 36, minWidth: 34, textAlign: 'center', color: theme.ink }]}>{partyValue}</Text>
                  <Round theme={theme} label="+" a11y="Artır" filled onPress={() => setParty(Math.min(inv.max_party, partyValue + 1))} />
                </View>
              )}
              {menuOptions && (
                <View style={{ gap: 10 }}>
                  <Text style={[styles.label, { color: theme.ink }]}>Menü tercihiniz</Text>
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
              <NoteField theme={theme} value={note} onChange={setNote} placeholder="Mutluluklar dileriz, o gece görüşürüz" />
              {err && <Text style={[styles.small, { color: '#A3332A' }]}>{err}</Text>}
              <PillButton theme={theme} filled label={busy ? 'Gönderiliyor…' : 'Cevabımı gönder'} onPress={() => submit('yes')} />
            </Sheet>
          )}

          {step === 'no' && (
            <Sheet theme={theme} title="Sizi özleyeceğiz." subtitle="Cevabınız davet edene iletilecek. İsterseniz bir not ekleyin." onBack={() => setStep('invite')}>
              <NoteField theme={theme} value={note} onChange={setNote} placeholder="Gelemiyoruz ama kalbimiz sizinle" />
              {err && <Text style={[styles.small, { color: '#A3332A' }]}>{err}</Text>}
              <PillButton theme={theme} filled label={busy ? 'Gönderiliyor…' : 'Gönder'} onPress={() => submit('no')} />
            </Sheet>
          )}

          {step === 'done' && (
            <View style={{ gap: 16, paddingTop: 40 }}>
              <View style={{ height: 160 }}>
                <View style={{ position: 'absolute', right: -10, top: 0, width: 160, height: 160, borderRadius: 80, backgroundColor: theme.shapeA }} />
                <View style={{ position: 'absolute', right: 130, top: 80, width: 60, height: 60, borderRadius: 30, backgroundColor: theme.shapeB }} />
              </View>
              <Text style={[styles.small, { color: theme.soft, letterSpacing: 1.2 }]}>CEVABINIZ ALINDI</Text>
              <Text style={[styles.h1, { color: theme.ink }]}>{inv.status === 'yes' ? 'Görüşmek üzere.' : 'Teşekkürler.'}</Text>
              <Text style={[styles.serifBody, { color: theme.soft }]}>
                {inv.status === 'yes'
                  ? `${inv.party_size ?? 1} kişi olarak kaydettik. Etkinlikten önce size hatırlatacağız.`
                  : 'Notunuz iletildi. Fikriniz değişirse bu sayfadan güncelleyebilirsiniz.'}
              </Text>
              <PillButton theme={theme} label="Cevabımı değiştir" onPress={() => setStep('invite')} />
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Sheet({ theme, title, subtitle, onBack, children }: { theme: InvitationTheme; title: string; subtitle: string; onBack: () => void; children: ReactNode }) {
  return (
    <View style={{ gap: 20, paddingTop: 8 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Davetiyeye dön" onPress={onBack} style={[styles.back, { boxShadow: `inset 0 0 0 1px ${theme.dark ? 'rgba(255,255,255,0.2)' : 'rgba(120,100,80,0.25)'}` }]}>
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

function NoteField({ theme, value, onChange, placeholder }: { theme: InvitationTheme; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={[styles.label, { color: theme.ink }]}>
        Bir not bırakın <Text style={{ fontFamily: font.regular, color: theme.soft }}>(isteğe bağlı)</Text>
      </Text>
      <TextInput
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
