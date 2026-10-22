import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, View } from 'react-native';

import { useI18n } from '@/i18n';
import { supabase } from '@/lib/supabase';
import logoFull from '../../assets/images/logo-full.png';
import { Body, Button, Caption, Display, DisplayItalic, Field, Notice, Surface } from '@/ui/primitives';
import { RichText } from '@/ui/RichText';
import { Screen } from '@/ui/Screen';
import { color } from '@/ui/tokens';

/** E-postaya gelen 6 haneli kodla giriş: derin bağlantı gerektirmez, iOS/Android/web'de aynı çalışır. */
export default function SignIn() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCode = async () => {
    const e = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(e)) {
      setError(t('auth.invalidEmail'));
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({ email: e, options: { shouldCreateUser: true } });
    setBusy(false);
    if (err) setError(t('auth.sendFailed'));
    else setStep('code');
  };

  const verify = async () => {
    if (code.trim().length < 6) {
      setError(t('auth.codeTooShort'));
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (err) setError(t('auth.verifyFailed'));
    // Başarılı olursa oturum değişir ve korumalı rotalar paneli açar.
  };

  return (
    <Screen maxWidth={520} contentStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 40 }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ gap: 28 }}>
        <Image source={logoFull} accessibilityLabel="Invitefolk" resizeMode="contain" style={{ width: 200, height: 164, alignSelf: 'flex-start', marginBottom: -6 }} />
        <View style={{ gap: 10 }}>
          <Display size={52}>
            {t('auth.headline')}
            <DisplayItalic style={{ color: color.lavender }}>{t('auth.headlineAccent')}</DisplayItalic>
          </Display>
          <Body>{t('auth.intro')}</Body>
        </View>

        <Surface style={{ gap: 16 }}>
          {step === 'email' ? (
            <>
              <Field
                label={t('auth.email')}
                placeholder={t('auth.emailPlaceholder')}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  setError(null);
                }}
                onSubmitEditing={sendCode}
              />
              {error && <Notice tone="error" text={error} />}
              <Button label={t('auth.sendCode')} size="lg" iconRight="arrowRight" loading={busy} onPress={sendCode} />
              <Caption>{t('auth.newAccountHint')}</Caption>
            </>
          ) : (
            <>
              <Notice tone="info" text={t('auth.codeSent', { email })} />
              <Field
                label={t('auth.code')}
                placeholder="123456"
                keyboardType="number-pad"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChangeText={(v) => {
                  setCode(v.replace(/\D/g, ''));
                  setError(null);
                }}
                onSubmitEditing={verify}
              />
              {error && <Notice tone="error" text={error} />}
              <Button label={t('auth.signIn')} size="lg" loading={busy} onPress={verify} />
              <Button label={t('auth.changeEmail')} variant="ghost" onPress={() => setStep('email')} />
            </>
          )}
        </Surface>
        <RichText
          template={t('auth.legalNotice')}
          links={{
            terms: { label: t('auth.terms'), href: '/yasal/kosullar' },
            privacy: { label: t('auth.privacy'), href: '/yasal/gizlilik' },
            kvkk: { label: t('auth.kvkk'), href: '/yasal/kvkk' },
          }}
          style={{ textAlign: 'center', paddingHorizontal: 12 }}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}
