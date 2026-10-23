import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import { useI18n } from '@/i18n';
import { Icon } from '@/ui/Icon';
import { Caption, Display, DisplayAccent } from '@/ui/primitives';
import { color } from '@/ui/tokens';

/**
 * Ortak pencere: geniş ekranda ortada kart, telefonda alttan açılan sayfa.
 * Başlık serif; `italic` verilirse başlığın sonuna vurgulu kelime eklenir.
 */
export function Sheet({
  open,
  onClose,
  title,
  italic,
  subtitle,
  children,
  footer,
  maxWidth = 560,
  accent = color.lavender,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  italic?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: number;
  accent?: string;
}) {
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const centered = width >= 640;
  if (!open) return null;
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable
        accessibilityLabel={t('common.close')}
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(36,33,43,0.35)', alignItems: 'center', justifyContent: centered ? 'center' : 'flex-end', padding: centered ? 24 : 0 }}>
        <Pressable
          onPress={() => {}}
          style={{
            width: '100%',
            maxWidth,
            maxHeight: '92%',
            backgroundColor: color.surface,
            borderRadius: 32,
            borderBottomLeftRadius: centered ? 32 : 0,
            borderBottomRightRadius: centered ? 32 : 0,
            boxShadow: '0px 30px 80px rgba(36,33,43,0.25)',
            overflow: 'hidden',
          }}>
          <ScrollView contentContainerStyle={{ padding: 28, gap: 20 }} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <View style={{ flex: 1, gap: 6 }}>
                <Display size={34}>
                  {title}
                  {italic ? (
                    <>
                      {' '}
                      <DisplayAccent style={{ color: accent }}>{italic}</DisplayAccent>
                    </>
                  ) : null}
                </Display>
                {subtitle ? <Caption>{subtitle}</Caption> : null}
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={onClose} hitSlop={10} style={{ paddingTop: 8 }}>
                <Icon name="close" size={20} color={color.muted} strokeWidth={2} />
              </Pressable>
            </View>
            {children}
            {footer ? <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>{footer}</View> : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
