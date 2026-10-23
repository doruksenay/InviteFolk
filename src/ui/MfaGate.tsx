import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { useI18n } from '@/i18n';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { Icon } from '@/ui/Icon';
import { Body, Button, Caption, Display, DisplayAccent, Notice, Skeleton, Surface } from '@/ui/primitives';
import { Screen } from '@/ui/Screen';
import { color, font, radius } from '@/ui/tokens';

type State =
  | { kind: 'loading' }
  | { kind: 'enroll'; factorId: string; svg: string; secret: string }
  | { kind: 'verify'; factorId: string }
  | { kind: 'error'; message: string };

/** data:image/svg+xml;utf-8,<svg…> → <svg…> (native'de SvgXml ile çizmek için). */
function svgFromDataUri(uri: string) {
  const i = uri.indexOf(',');
  const body = i >= 0 ? uri.slice(i + 1) : uri;
  try {
    return decodeURIComponent(body);
  } catch {
    return body;
  }
}

/**
 * Yönetim paneline girmeden önce iki adımlı doğrulama (TOTP).
 * Veritabanı da admin yetkisini yalnızca aal2 oturumlara tanır; bu ekran yalnızca o seviyeye çıkarır.
 */
export function MfaGate() {
  const { t } = useI18n();
  const { refreshAal } = useSession();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      const verified = data.totp.find((f) => f.status === 'verified');
      if (verified) {
        if (alive) setState({ kind: 'verify', factorId: verified.id });
        return;
      }
      // Yarıda kalmış (doğrulanmamış) kayıtları temizle, yenisini başlat.
      for (const f of data.all.filter((x) => x.factor_type === 'totp' && x.status !== 'verified')) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const res = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Invitefolk ${new Date().toISOString().slice(0, 10)}` });
      if (res.error) throw res.error;
      if (alive) setState({ kind: 'enroll', factorId: res.data.id, svg: svgFromDataUri(res.data.totp.qr_code), secret: res.data.totp.secret });
    })().catch((e: unknown) => {
      if (alive) setState({ kind: 'error', message: t('settings.mfa.startFailed', { error: e instanceof Error ? e.message : String(e) }) });
    });
    return () => {
      alive = false;
    };
  }, [t]);

  const submit = async () => {
    if (state.kind !== 'enroll' && state.kind !== 'verify') return;
    setBusy(true);
    setErr(null);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: state.factorId, code });
    setBusy(false);
    if (error) {
      setErr(t('settings.mfa.wrongCode'));
      setCode('');
      return;
    }
    await refreshAal();
  };

  return (
    <Screen maxWidth={520} contentStyle={{ paddingTop: 48 }}>
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="lock" size={16} color={color.lavenderInk} strokeWidth={2} />
          <Text style={{ fontFamily: font.bold, fontSize: 12, letterSpacing: 1.4, color: color.lavenderInk, textTransform: 'uppercase' }}>{t('settings.mfa.kicker')}</Text>
        </View>
        <Display size={44}>
          {t('settings.mfa.title')} <DisplayAccent style={{ color: color.lavender }}>{t('settings.mfa.titleItalic')}</DisplayAccent>
        </Display>
      </View>

      <Surface style={{ gap: 20 }}>
        {state.kind === 'loading' && (
          <View style={{ gap: 12 }}>
            <Caption>{t('settings.mfa.preparing')}</Caption>
            <Skeleton height={180} radius={20} />
          </View>
        )}
        {state.kind === 'error' && <Notice tone="error" text={state.message} />}

        {state.kind === 'enroll' && (
          <>
            <Body>{t('settings.mfa.enrollBody')}</Body>
            <View accessibilityRole="image" accessibilityLabel={t('settings.mfa.qrLabel')} style={{ alignSelf: 'center', padding: 14, backgroundColor: '#FFFFFF', borderRadius: radius.lg, boxShadow: `inset 0 0 0 1px ${color.hairline}` }}>
              <SvgXml xml={state.svg} width={188} height={188} />
            </View>
            <View style={{ gap: 6 }}>
              <Caption>{t('settings.mfa.secretLabel')}</Caption>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('common.copy')}
                onPress={() => Clipboard.setStringAsync(state.secret)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: color.surfaceSoft, borderRadius: radius.md, padding: 12 }}>
                <Text selectable style={{ flex: 1, fontFamily: font.semibold, fontSize: 13, letterSpacing: 1.2, color: color.ink }}>
                  {state.secret}
                </Text>
                <Icon name="copy" size={16} color={color.inkSoft} />
              </Pressable>
            </View>
          </>
        )}
        {state.kind === 'verify' && <Body>{t('settings.mfa.verifyBody')}</Body>}

        {(state.kind === 'enroll' || state.kind === 'verify') && (
          <View style={{ gap: 12 }}>
            <TextInput
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
              onSubmitEditing={() => code.length === 6 && submit()}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={6}
              accessibilityLabel={t('settings.mfa.codeLabel')}
              placeholder="••••••"
              placeholderTextColor={color.faint}
              style={{ height: 64, borderRadius: radius.lg, backgroundColor: color.surfaceSoft, textAlign: 'center', fontFamily: font.semibold, fontSize: 28, letterSpacing: 10, color: color.ink }}
            />
            {err && <Notice tone="error" text={err} />}
            <Button label={busy ? t('settings.mfa.verifying') : t('settings.mfa.verify')} variant="accent" size="lg" loading={busy} disabled={code.length !== 6} onPress={submit} />
          </View>
        )}
      </Surface>

      <Button label={t('settings.mfa.backToPanel')} variant="ghost" icon="arrowLeft" onPress={() => router.replace('/')} style={{ alignSelf: 'center' }} />
    </Screen>
  );
}
