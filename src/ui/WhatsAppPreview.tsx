import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import type { InvitationTheme } from '@/core/themes';

import { color, font } from './tokens';

/** Davetin WhatsApp'ta nasıl göründüğünü ve butona basınca gelen takip sorusunu gösterir. */
export function WhatsAppPreview({ theme, title, text, when, yes, no, ask, host }: { theme: InvitationTheme; title: string; text: string; when: string; yes: string; no: string; ask: string; host: string }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: theme.shapeA }]}>
          <Text style={[styles.avatarText, { color: theme.ink }]}>{host}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.name}>Davet Asistanı</Text>
            <Svg width={14} height={14} viewBox="0 0 24 24" accessibilityLabel="Doğrulanmış işletme">
              <Circle cx={12} cy={12} r={10} fill="#25A55F" />
              <Path d="M7.5 12.5l3 3 6-7" fill="none" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
          <Text style={styles.sub}>İşletme hesabı</Text>
        </View>
      </View>
      <View style={styles.chat}>
        <View style={styles.bubbleIn}>
          <View style={[styles.img, { backgroundColor: theme.bg }]}>
            <View style={{ position: 'absolute', left: -40, top: -50, width: 150, height: 150, borderRadius: 75, backgroundColor: theme.shapeA }} />
            <View style={{ position: 'absolute', right: 22, top: 30, width: 70, height: 120, borderTopLeftRadius: 35, borderTopRightRadius: 35, backgroundColor: theme.shapeB }} />
            <Text style={[styles.imgTitle, { color: theme.ink }]}>{title}</Text>
          </View>
          <View style={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6, gap: 4 }}>
            <Text style={styles.msg}>{text}</Text>
            <Text style={[styles.msg, { color: color.muted }]}>{when}</Text>
            <Text style={styles.time}>10:42</Text>
          </View>
          {[yes, no, 'Konum'].map((b) => (
            <Text key={b} style={styles.action}>
              {b}
            </Text>
          ))}
        </View>
        <View style={styles.bubbleOut}>
          <Text style={styles.msg}>{yes}</Text>
          <Text style={[styles.time, { color: '#6A8A66' }]}>10:43</Text>
        </View>
        <View style={[styles.bubbleIn, { padding: 12, gap: 8, width: undefined, maxWidth: '88%' }]}>
          <Text style={styles.msg}>{ask}</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {['1', '2', '3', '4'].map((n) => (
              <View key={n} style={[styles.chip, n === '3' && { backgroundColor: color.ink }]}>
                <Text style={[styles.chipText, n === '3' && { color: '#FFFFFF' }]}>{n}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', maxWidth: 340, alignSelf: 'center', borderRadius: 28, overflow: 'hidden', backgroundColor: '#EFE7DE', boxShadow: '0px 24px 50px rgba(40,30,20,0.18)' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#FFFFFF' },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: font.bold, fontSize: 15 },
  name: { fontFamily: font.semibold, fontSize: 15, color: color.ink },
  sub: { fontFamily: font.regular, fontSize: 12, color: color.muted },
  chat: { padding: 14, gap: 8 },
  bubbleIn: { alignSelf: 'flex-start', width: '88%', backgroundColor: '#FFFFFF', borderRadius: 16, borderTopLeftRadius: 4, overflow: 'hidden', boxShadow: '0px 1px 1px rgba(0,0,0,0.06)' },
  bubbleOut: { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'flex-end', gap: 8, backgroundColor: '#D9FDD3', borderRadius: 16, borderTopRightRadius: 4, paddingVertical: 8, paddingHorizontal: 12 },
  img: { height: 150, overflow: 'hidden' },
  imgTitle: { position: 'absolute', left: 14, bottom: 12, fontFamily: font.serif, fontSize: 28, lineHeight: 27 },
  msg: { fontFamily: font.regular, fontSize: 14, lineHeight: 20, color: color.ink },
  time: { alignSelf: 'flex-end', fontFamily: font.regular, fontSize: 11, color: '#8A8780' },
  action: { paddingVertical: 11, textAlign: 'center', fontFamily: font.semibold, fontSize: 14, color: '#1A8CD8', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E8E4DE' },
  chip: { width: 34, height: 32, borderRadius: 10, backgroundColor: '#F4F1EC', alignItems: 'center', justifyContent: 'center' },
  chipText: { fontFamily: font.semibold, fontSize: 14, color: color.ink },
});
