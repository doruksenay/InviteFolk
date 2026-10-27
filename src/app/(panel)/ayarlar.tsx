import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, useWindowDimensions, View, Linking } from 'react-native';

import { LANG_NAMES, LANGS, type Lang, useI18n } from '@/i18n';
import { deleteMyAccount, setProfileLocale } from '@/lib/api';
import { setNotifyRsvp } from '@/lib/api-billing';
import { useSession } from '@/lib/session';
import { Icon } from '@/ui/Icon';
import { Body, Button, Caption, Display, DisplayAccent, IconButton, Label, Notice, Pill, Surface, Title, ToggleRow } from '@/ui/primitives';
import { Screen } from '@/ui/Screen';
import { color, font, radius } from '@/ui/tokens';
import { mailto, supportEmail } from '@/core/contact';

/** Ayarlar: uygulama dili, hesap, güvenlik ve hesabı kalıcı silme (App Store kuralı, KVKK). */
export default function SettingsScreen() {
  const { t, lang, setLang } = useI18n();
  const { session, profile, isAdmin, aal, signOut, refreshProfile } = useSession();
  const { width } = useWindowDimensions();
  const wide = width >= 900;

  const [confirm, setConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const word = t('settings.confirmWord');
  const [notify, setNotify] = useState<boolean | null>(null);
  const notifyValue = notify ?? profile?.notify_rsvp ?? true;
  const [notifyErr, setNotifyErr] = useState(false);

  const changeNotify = (v: boolean) => {
    if (!profile) return;
    setNotify(v);
    setNotifyErr(false);
    setNotifyRsvp(profile.id, v)
      .then(() => refreshProfile())
      .catch(() => {
        setNotify(!v);
        setNotifyErr(true);
      });
  };

  const legalLink = (label: string, doc: 'gizlilik' | 'kosullar' | 'kvkk', first: boolean) => (
    <Pressable
      key={doc}
      accessibilityRole="link"
      onPress={() => router.push({ pathname: '/yasal/[doc]', params: { doc } })}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: first ? 0 : 1, borderTopColor: color.hairline, opacity: pressed ? 0.6 : 1 })}>
      <Icon name="file" size={18} color={color.muted} />
      <Text style={{ flex: 1, fontFamily: font.medium, fontSize: 15, color: color.ink }}>{label}</Text>
      <Icon name="arrowRight" size={16} color={color.muted} />
    </Pressable>
  );

  const changeLang = (l: Lang) => {
    setLang(l);
    // Sunucudaki tercih e-posta/WhatsApp bildirimlerinin dili için; başarısız olursa arayüz yine değişir.
    if (profile) setProfileLocale(profile.id, l).catch(() => {});
  };

  const remove = async () => {
    setDeleting(true);
    setErr(null);
    try {
      await deleteMyAccount();
      router.replace('/giris');
    } catch (e) {
      setErr(t('settings.deleteFailed', { error: e instanceof Error ? e.message : String(e) }));
      setDeleting(false);
    }
  };

  return (
    <Screen maxWidth={980}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <IconButton icon="arrowLeft" label={t('settings.back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/etkinlikler'))} />
        <Display size={wide ? 52 : 40}>
          {t('settings.title')} <DisplayAccent style={{ color: color.lavender }}>{t('settings.titleItalic')}</DisplayAccent>
        </Display>
      </View>

      <View style={{ flexDirection: wide ? 'row' : 'column', gap: 20, alignItems: 'flex-start' }}>
        <View style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%', gap: 20 }}>
          {/* Dil */}
          <Surface style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Icon name="globe" size={20} color={color.lavender} />
              <Title>{t('settings.languageTitle')}</Title>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {LANGS.map((l) => {
                const on = l === lang;
                return (
                  <Pressable
                    key={l}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    onPress={() => changeLang(l)}
                    style={({ pressed }) => ({
                      flex: 1,
                      paddingVertical: 16,
                      borderRadius: radius.lg,
                      alignItems: 'center',
                      backgroundColor: on ? color.lavenderTint : color.surfaceSoft,
                      boxShadow: on ? `inset 0 0 0 2px ${color.lavender}` : 'none',
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                    })}>
                    <Text style={{ fontFamily: font.display, fontSize: 20, color: on ? color.lavenderInk : color.ink }}>{LANG_NAMES[l]}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Caption>{t('settings.languageHint')}</Caption>
          </Surface>

          {/* Hesap */}
          <Surface style={{ gap: 12 }}>
            <Title>{t('settings.accountTitle')}</Title>
            <Body>{t('settings.signedInAs', { email: session?.user.email ?? '' })}</Body>
            {profile && <Pill label={t('settings.plan', { plan: t(`status.plan.${profile.plan}`) })} bg={color.sageTint} fg={color.sageInk} />}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
              <Button label={t('settings.plansButton')} icon="star" variant="accent" onPress={() => router.push('/paketler')} />
              <Button label={t('common.signOut')} icon="logout" variant="secondary" onPress={signOut} />
            </View>
          </Surface>

          {/* Bildirimler */}
          <Surface style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Icon name="bell" size={20} color={color.coral} />
              <Title>{t('settings.notificationsTitle')}</Title>
            </View>
            <ToggleRow label={t('settings.notifyRsvp')} hint={t('settings.notifyRsvpHint')} value={notifyValue} onChange={changeNotify} disabled={!profile} />
            {notifyErr && <Notice tone="error" text={t('settings.notifyFailed')} />}
          </Surface>

          {/* Yardım */}
          <Surface style={{ gap: 8 }}>
            <Title>{t('settings.helpTitle')}</Title>
            <Body>{t('settings.helpBody')}</Body>
            <Button label={supportEmail(lang)} icon="mail" variant="secondary" onPress={() => Linking.openURL(mailto(supportEmail(lang), 'Invitefolk'))} style={{ alignSelf: 'flex-start' }} />
          </Surface>

          {/* Yasal */}
          <Surface style={{ gap: 4 }}>
            <Title style={{ marginBottom: 4 }}>{t('settings.legalTitle')}</Title>
            {legalLink(t('settings.legalPrivacy'), 'gizlilik', true)}
            {legalLink(t('settings.legalTerms'), 'kosullar', false)}
            {legalLink(t('settings.legalKvkk'), 'kvkk', false)}
          </Surface>
        </View>

        <View style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%', gap: 20 }}>
          {/* Güvenlik */}
          <Surface style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Icon name="shield" size={20} color={color.sage} />
              <Title>{t('settings.securityTitle')}</Title>
            </View>
            <Body>{t('settings.securityBody')}</Body>
            <Notice tone="info" text={t('settings.privacy')} />
            {isAdmin && (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <Pill label={aal === 'aal2' ? t('settings.mfaOn') : t('settings.mfaOff')} bg={aal === 'aal2' ? color.sageTint : color.goldTint} fg={aal === 'aal2' ? color.sageInk : color.goldInk} />
                {aal !== 'aal2' && <Button label={t('settings.mfaSetup')} icon="lock" variant="secondary" onPress={() => router.push('/admin')} />}
              </View>
            )}
          </Surface>

          {/* Hesabı sil */}
          <Surface style={{ gap: 12, backgroundColor: '#FFF8F6' }}>
            <Title color={color.coralInk}>{t('settings.dangerTitle')}</Title>
            <Body>{t('settings.dangerBody')}</Body>
            <Label>{t('settings.confirmPrompt', { word })}</Label>
            <TextInput
              value={confirm}
              onChangeText={setConfirm}
              autoCapitalize="characters"
              autoCorrect={false}
              accessibilityLabel={t('settings.confirmPrompt', { word })}
              placeholder={word}
              placeholderTextColor={color.faint}
              style={{ height: 50, borderRadius: radius.md, backgroundColor: '#FFFFFF', paddingHorizontal: 16, fontFamily: font.semibold, fontSize: 16, letterSpacing: 2, color: color.ink, boxShadow: `inset 0 0 0 1px ${color.hairline}` }}
            />
            {err && <Notice tone="error" text={err} />}
            <Button
              label={deleting ? t('settings.deleting') : t('settings.deleteButton')}
              icon="trash"
              variant="danger"
              loading={deleting}
              disabled={confirm.trim().toLocaleUpperCase(lang === 'tr' ? 'tr-TR' : 'en-GB') !== word}
              onPress={remove}
              style={{ alignSelf: 'flex-start' }}
            />
          </Surface>
        </View>
      </View>
    </Screen>
  );
}
