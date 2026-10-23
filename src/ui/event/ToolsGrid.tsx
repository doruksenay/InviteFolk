import { Pressable, Text, View } from 'react-native';

import { Icon, type IconName } from '@/ui/Icon';
import { color, font, radius, shadow } from '@/ui/tokens';

export type ToolTile = { key: string; icon: IconName; title: string; body: string; badge?: string | null; locked?: string | null; tint: string; ink: string; onPress: () => void };

/** Etkinlik sayfasındaki araç kutuları (davetiye sayfası, ekip, duyuru, liste, giriş, albüm…). */
export function ToolsGrid({ tiles, columns }: { tiles: ToolTile[]; columns: number }) {
  const basis = columns >= 4 ? '23%' : columns === 3 ? '31%' : columns === 2 ? '47%' : '100%';
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {tiles.map((tile) => (
        <Pressable
          key={tile.key}
          accessibilityRole="button"
          accessibilityLabel={`${tile.title}. ${tile.body}`}
          onPress={tile.onPress}
          style={({ pressed }) => ({
            flexGrow: 1,
            flexBasis: basis,
            minWidth: 150,
            gap: 10,
            padding: 16,
            borderRadius: radius.xl,
            backgroundColor: color.surface,
            boxShadow: shadow.card,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          })}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: tile.tint, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={tile.icon} size={20} color={tile.ink} />
            </View>
            {tile.locked ? (
              <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: color.lavenderTint }}>
                <Text style={{ fontFamily: font.bold, fontSize: 11, color: color.lavenderInk }}>{tile.locked}</Text>
              </View>
            ) : tile.badge ? (
              <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: tile.tint }}>
                <Text style={{ fontFamily: font.bold, fontSize: 11, color: tile.ink }}>{tile.badge}</Text>
              </View>
            ) : null}
          </View>
          <View style={{ gap: 3 }}>
            <Text style={{ fontFamily: font.bold, fontSize: 15, color: color.ink }}>{tile.title}</Text>
            <Text style={{ fontFamily: font.medium, fontSize: 12.5, lineHeight: 17, color: color.muted }} numberOfLines={2}>
              {tile.body}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}
