import { router } from 'expo-router';
import { Fragment, type ReactNode } from 'react';
import { Text, type TextStyle } from 'react-native';

import { color, font } from './tokens';

/**
 * "{terms} ve {privacy}" gibi bir şablonu, yer tutucuları bağlantıya çevirerek yazar.
 * links: { terms: { label: 'Kullanım Koşulları', href: '/yasal/kosullar' } }
 */
export function RichText({ template, links, style }: { template: string; links: Record<string, { label: string; href: string }>; style?: TextStyle }) {
  const parts: ReactNode[] = [];
  const re = /\{(\w+)\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(template))) {
    if (m.index > last) parts.push(<Fragment key={`t${i}`}>{template.slice(last, m.index)}</Fragment>);
    const link = links[m[1]];
    parts.push(
      link ? (
        <Text
          key={`l${i}`}
          accessibilityRole="link"
          onPress={() => router.push(link.href as never)}
          style={{ fontFamily: font.semibold, color: color.lavenderInk, textDecorationLine: 'underline' }}>
          {link.label}
        </Text>
      ) : (
        <Fragment key={`l${i}`}>{m[0]}</Fragment>
      ),
    );
    last = m.index + m[0].length;
    i++;
  }
  if (last < template.length) parts.push(<Fragment key="end">{template.slice(last)}</Fragment>);
  return <Text style={[{ fontFamily: font.regular, fontSize: 13, lineHeight: 19, color: color.muted }, style]}>{parts}</Text>;
}
