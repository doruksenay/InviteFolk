import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, useWindowDimensions, View } from 'react-native';

import { LANG_NAMES, LANGS, type Lang, useI18n } from '@/i18n';
import { deleteMyAccount, setProfileLocale } from '@/lib/api';
import { useSession } from '@/lib/session';
import { Icon } from '@/ui/Icon';
import { Body, Button, Caption, Display, DisplayItalic, IconButton, Label, Notice, Pill, Surface, Title } from '@/ui/primitives';
import { Screen } from '@/ui/Screen';
import { color, font, radius } from '@/ui/tokens';

/** Ayarlar: uygulama dili, hesap, güvenlik ve hesabı kalıcı silme (App Store kuralı, KVKK). */
export default function SettingsScreen() {
  const { t, lang, setLang } = useI18n();
  const { session, profile, isAdmin, aal, signOut } = useSession();
  const { width } = useWindowDimensions();
  const wide = width >= 900;

  const [confirm, setConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const word = t('settings.confirmWord');

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
        <IconButton icon="arrowLeft" label={t('settings.back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <Display size={wide ? 52 : 40}>
          {t('settings.title')} <DisplayItalic style={{ color: color.lavender }}>{t('settings.titleItalic')}</DisplayItalic>
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
                    <Text style={{ fontFamily: font.serif, fontSize: 26, color: on ? color.lavenderInk : color.ink }}>{LANG_NAMES[l]}</Text>
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
            <Button label={t('common.signOut')} icon="logout" variant="secondary" onPress={signOut} style={{ alignSelf: 'flex-start', marginTop: 4 }} />
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
