import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import type { InvitationTheme } from '@/core/themes';

import { Icon } from './Icon';
import { font } from './tokens';

export type InvitationCopy = {
  greet: string;
  kicker: string;
  title: string;
  line: string;
  when: string;
  where: string;
  deadline?: string | null;
  yes: string;
  no: string;
};

/**
 * Davetlinin gördüğü editoryal davetiye kartı.
 * Organizatör önizlemesinde butonlar görsel; LCV sayfasında `actions` ile gerçek butonlar verilir.
 */
export function InvitationCard({ theme, copy, actions, style, artHeight = 196 }: { theme: InvitationTheme; copy: InvitationCopy; actions?: ReactNode; style?: ViewStyle; artHeight?: number }) {
  return (
    <View style={[styles.card, { backgroundColor: theme.bg }, style]}>
      <View style={{ height: artHeight, overflow: 'hidden' }}>
        <View style={[styles.shapeA, { backgroundColor: theme.shapeA }]} />
        <View style={[styles.shapeB, { backgroundColor: theme.shapeB }]} />
        <View style={[styles.shapeC, { backgroundColor: theme.dark ? theme.shapeC : '#FFFFFF', opacity: theme.dark ? 1 : 0.75 }]} />
        <View style={[styles.greet, { backgroundColor: theme.chip }]}>
          <Text style={[styles.greetText, { color: theme.ink }]} numberOfLines={1}>
            {copy.greet}
          </Text>
        </View>
      </View>
      <View style={styles.body}>
        <Text style={[styles.kicker, { color: theme.key_ }]}>{copy.kicker.toLocaleUpperCase('tr-TR')}</Text>
        <Text style={[styles.title, { color: theme.ink }]}>{copy.title}</Text>
        <Text style={[styles.line, { color: theme.soft }]}>{copy.line}</Text>
        <View style={{ gap: 8, paddingTop: 4 }}>
          <View style={styles.row}>
            <Icon name="calendar" size={16} color={theme.ink} />
            <Text style={[styles.rowText, { color: theme.ink }]}>{copy.when}</Text>
          </View>
          <View style={styles.row}>
            <Icon name="pin" size={16} color={theme.ink} />
            <Text style={[styles.rowText, { color: theme.ink }]}>{copy.where}</Text>
          </View>
        </View>
        {actions ?? (
          <View style={{ gap: 10, paddingTop: 8 }}>
            <View style={[styles.btn, { backgroundColor: theme.ink }]}>
              <Text style={[styles.btnText, { color: theme.bg }]}>{copy.yes}</Text>
            </View>
            <View style={[styles.btn, { boxShadow: `inset 0 0 0 1.5px ${theme.ink}` }]}>
              <Text style={[styles.btnText, { color: theme.ink }]}>{copy.no}</Text>
            </View>
          </View>
        )}
        {copy.deadline ? <Text style={[styles.foot, { color: theme.soft }]}>Cevap için son gün: {copy.deadline}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', maxWidth: 360, alignSelf: 'center', borderRadius: 28, overflow: 'hidden', boxShadow: '0px 26px 56px rgba(30,20,10,0.20)' },
  shapeA: { position: 'absolute', left: -56, top: -70, width: 220, height: 220, borderRadius: 110 },
  shapeB: { position: 'absolute', right: 28, top: 54, width: 104, height: 160, borderTopLeftRadius: 52, borderTopRightRadius: 52 },
  shapeC: { position: 'absolute', right: 120, top: 126, width: 56, height: 56, borderRadius: 28 },
  greet: { position: 'absolute', left: 18, bottom: 16, maxWidth: '86%', paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999 },
  greetText: { fontFamily: font.semibold, fontSize: 12 },
  body: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 24, gap: 14 },
  kicker: { fontFamily: font.bold, fontSize: 12, letterSpacing: 1.6 },
  title: { fontFamily: font.serif, fontSize: 48, lineHeight: 46, letterSpacing: -0.4 },
  line: { fontFamily: font.regular, fontSize: 15, lineHeight: 23 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowText: { fontFamily: font.medium, fontSize: 14, flexShrink: 1 },
  btn: { height: 50, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: font.semibold, fontSize: 15 },
  foot: { fontFamily: font.regular, fontSize: 12, textAlign: 'center' },
});
