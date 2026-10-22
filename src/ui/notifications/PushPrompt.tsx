import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { useI18n } from '@/i18n';
import { supabase } from '@/lib/api';
import { enablePush, markAsked, pushPermission, wasAsked } from '@/lib/push';
import { useSession } from '@/lib/session';
import { Icon } from '@/ui/Icon';
import { Body, Button } from '@/ui/primitives';
import { color, font, radius } from '@/ui/tokens';

/**
 * Bildirim izni için nazik ön soru. Sistem izin penceresi yalnızca kullanıcı "Bildirimleri aç" derse açılır.
 * - İzin zaten verilmişse sessizce bu telefonu hesaba bağlar.
 * - En az bir etkinliği olan ve daha önce sorulmamış kullanıcıya bir kez gösterilir.
 */
export function PushPrompt() {
  const { t } = useI18n();
  const { session } = useSession();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);
  const userId = session?.user.id ?? null;
  const channelName = t('notifications.channelName');

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      const state = await pushPermission();
      if (state === 'granted') {
        await enablePush(false, channelName);
        return;
      }
      if (state !== 'undetermined' || wasAsked()) return;
      const { count } = await supabase.from('events').select('id', { count: 'exact', head: true });
      if (alive && (count ?? 0) > 0) setVisible(true);
    })().catch(() => {});
    return () => {
      alive = false;
    };
  }, [userId, channelName]);

  if (!visible) return null;

  const close = () => {
    markAsked();
    setVisible(false);
  };

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, alignItems: 'center' }}>
      <View
        accessibilityRole="alert"
        style={{ width: '100%', maxWidth: 520, backgroundColor: color.surface, borderRadius: radius.xl, padding: 20, gap: 12, boxShadow: '0px 18px 50px rgba(36,33,43,0.18)' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: color.lavenderTint, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="bell" size={18} color={color.lavenderInk} strokeWidth={2} />
          </View>
          <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 16, color: color.ink }}>{t('notifications.prompt.title')}</Text>
        </View>
        <Body>{denied ? t('notifications.prompt.denied') : t('notifications.prompt.body')}</Body>
        <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end' }}>
          <Button label={denied ? t('common.close') : t('notifications.prompt.later')} variant="ghost" onPress={close} />
          {!denied && (
            <Button
              label={t('notifications.prompt.enable')}
              variant="accent"
              icon="bell"
              loading={busy}
              onPress={async () => {
                setBusy(true);
                const state = await enablePush(true, channelName);
                setBusy(false);
                markAsked();
                if (state === 'granted') setVisible(false);
                else setDenied(true);
              }}
            />
          )}
        </View>
      </View>
    </View>
  );
}
