import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

import { supabase } from '@/lib/supabase';
import { Body, Button, Caption, Display, DisplayItalic, Field, Notice, Surface } from '@/ui/primitives';
import { Screen } from '@/ui/Screen';
import { color } from '@/ui/tokens';

/** E-postaya gelen 6 haneli kodla giriş: derin bağlantı gerektirmez, iOS/Android/web'de aynı çalışır. */
export default function SignIn() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCode = async () => {
    const e = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(e)) {
      setError('Geçerli bir e-posta adresi yaz.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({ email: e, options: { shouldCreateUser: true } });
    setBusy(false);
    if (err) setError('Kod gönderilemedi. Biraz sonra tekrar dene.');
    else setStep('code');
  };

  const verify = async () => {
    if (code.trim().length < 6) {
      setError('E-postadaki 6 haneli kodu yaz.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (err) setError('Kod doğrulanamadı. Kodu kontrol et ya da yenisini iste.');
    // Başarılı olursa oturum değişir ve korumalı rotalar paneli açar.
  };

  return (
    <Screen maxWidth={520} contentStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 40 }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ gap: 28 }}>
        <View style={{ gap: 10 }}>
          <Display size={52}>
            Her davet, <DisplayItalic style={{ color: color.lavender }}>bir dokunuşla.</DisplayItalic>
          </Display>
          <Body>Düğünden halı saha maçına kadar davetlerini gönder, cevapları tek yerden takip et.</Body>
        </View>

        <Surface style={{ gap: 16 }}>
          {step === 'email' ? (
            <>
              <Field
                label="E-posta"
                placeholder="ayse@ornek.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  setError(null);
                }}
                onSubmitEditing={sendCode}
              />
              {error && <Notice tone="error" text={error} />}
              <Button label="Giriş kodu gönder" size="lg" iconRight="arrowRight" loading={busy} onPress={sendCode} />
              <Caption>Hesabın yoksa ilk girişte otomatik oluşturulur.</Caption>
            </>
          ) : (
            <>
              <Notice tone="info" text={`${email} adresine 6 haneli bir kod gönderdik.`} />
              <Field
                label="Giriş kodu"
                placeholder="123456"
                keyboardType="number-pad"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChangeText={(t) => {
                  setCode(t.replace(/\D/g, ''));
                  setError(null);
                }}
                onSubmitEditing={verify}
              />
              {error && <Notice tone="error" text={error} />}
              <Button label="Giriş yap" size="lg" loading={busy} onPress={verify} />
              <Button label="E-postayı değiştir" variant="ghost" onPress={() => setStep('email')} />
            </>
          )}
        </Surface>
      </KeyboardAvoidingView>
    </Screen>
  );
}
