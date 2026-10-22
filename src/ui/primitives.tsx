import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  type PressableStateCallbackType,
  StyleSheet,
  Text,
  type TextProps,
  TextInput,
  type TextInputProps,
  type TextStyle,
  View,
  type ViewProps,
  type ViewStyle,
} from 'react-native';

import { useI18n } from '@/i18n';

import { Icon, type IconName } from './Icon';
import { color, font, radius, shadow, space, status as statusTokens } from './tokens';

type PressState = PressableStateCallbackType & { hovered?: boolean };

export function tapFeedback() {
  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
}

// ---------------------------------------------------------------------------
// Tipografi: tek sans (Plus Jakarta Sans), serif yalnızca büyük başlıklarda.
// ---------------------------------------------------------------------------
type TProps = TextProps & { color?: string; center?: boolean };

export function Display({ style, color: c, center, size = 56, ...rest }: TProps & { size?: number }) {
  return (
    <Text
      {...rest}
      style={[{ fontFamily: font.serif, fontSize: size, lineHeight: size * 1.02, letterSpacing: -0.4, color: c ?? color.ink, textAlign: center ? 'center' : undefined }, style]}
    />
  );
}

export function DisplayItalic(props: TProps) {
  return <Text {...props} style={[{ fontFamily: font.serifItalic }, props.style]} />;
}

export function Title({ style, color: c, center, ...rest }: TProps) {
  return <Text {...rest} style={[styles.title, { color: c ?? color.ink, textAlign: center ? 'center' : undefined }, style]} />;
}

export function Body({ style, color: c, center, ...rest }: TProps) {
  return <Text {...rest} style={[styles.body, { color: c ?? color.muted, textAlign: center ? 'center' : undefined }, style]} />;
}

export function Label({ style, color: c, ...rest }: TProps) {
  return <Text {...rest} style={[styles.label, { color: c ?? color.ink }, style]} />;
}

export function Caption({ style, color: c, ...rest }: TProps) {
  return <Text {...rest} style={[styles.caption, { color: c ?? color.muted }, style]} />;
}

// ---------------------------------------------------------------------------
// Yüzeyler
// ---------------------------------------------------------------------------
export function Surface({ style, children, soft, ...rest }: ViewProps & { soft?: boolean }) {
  return (
    <View {...rest} style={[styles.surface, soft && { backgroundColor: 'rgba(255,255,255,0.65)', boxShadow: shadow.raised }, style]}>
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Butonlar
// ---------------------------------------------------------------------------
type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'accent' | 'danger';
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  disabled?: boolean;
  size?: 'md' | 'lg';
  style?: ViewStyle;
  accessibilityLabel?: string;
};

export function Button({ label, onPress, variant = 'primary', icon, iconRight, loading, disabled, size = 'md', style, accessibilityLabel }: ButtonProps) {
  const v = BUTTON_VARIANTS[variant];
  const h = size === 'lg' ? 56 : 46;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      disabled={disabled || loading}
      onPress={() => {
        tapFeedback();
        onPress?.();
      }}
      style={(s: PressState) => [
        styles.button,
        { height: h, paddingHorizontal: size === 'lg' ? 26 : 18, backgroundColor: v.bg, boxShadow: v.shadow },
        variant === 'secondary' && { boxShadow: `inset 0 0 0 1px ${color.hairline}, ${shadow.card}` },
        s.hovered && !disabled && { opacity: 0.92, transform: [{ translateY: -1 }] },
        s.pressed && { transform: [{ scale: 0.98 }] },
        (disabled || loading) && { opacity: 0.55 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <>
          {icon && <Icon name={icon} size={18} color={v.fg} strokeWidth={2} />}
          <Text style={[styles.buttonLabel, { color: v.fg, fontSize: size === 'lg' ? 16 : 15 }]}>{label}</Text>
          {iconRight && <Icon name={iconRight} size={18} color={v.fg} strokeWidth={2} />}
        </>
      )}
    </Pressable>
  );
}

const BUTTON_VARIANTS = {
  primary: { bg: color.ink, fg: color.onInk, shadow: shadow.button },
  accent: { bg: color.lavender, fg: color.onInk, shadow: '0px 10px 24px rgba(126,102,222,0.30)' },
  secondary: { bg: color.surface, fg: color.ink, shadow: shadow.card },
  ghost: { bg: 'transparent', fg: color.inkSoft, shadow: 'none' },
  danger: { bg: color.coralTint, fg: color.coralInk, shadow: 'none' },
} as const;

export function IconButton({ icon, onPress, label, style }: { icon: IconName; onPress?: () => void; label: string; style?: ViewStyle }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={(s: PressState) => [styles.iconButton, s.hovered && { backgroundColor: color.surfaceSoft }, s.pressed && { transform: [{ scale: 0.95 }] }, style]}>
      <Icon name={icon} size={18} color={color.ink} strokeWidth={2} />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Rozetler
// ---------------------------------------------------------------------------
export function Pill({ label, bg, fg, style }: { label: string; bg: string; fg: string; style?: ViewStyle }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }, style]}>
      <Text style={[styles.pillText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function StatusBadge({ status }: { status: keyof typeof statusTokens }) {
  const { t } = useI18n();
  const s = statusTokens[status];
  return (
    <View style={[styles.pill, { backgroundColor: s.bg, flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: s.dot }} />
      <Text style={[styles.pillText, { color: s.ink }]}>{t(`status.rsvp.${status}`)}</Text>
    </View>
  );
}

// Beyaz harf okunabilsin diye marka renklerinin koyu tonları.
const AVATAR_COLORS = [color.lavender, '#E0524F', '#16A34A', '#D97706', color.lavenderInk, '#C2410C'];

export function Avatar({ text, index = 0, size = 40 }: { text: string; index?: number; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.35, backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length], alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: font.bold, fontSize: size * 0.34, color: '#FFFFFF' }}>{text}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Form alanı
// ---------------------------------------------------------------------------
export function Field({ label, hint, error, style, ...rest }: TextInputProps & { label: string; hint?: string; error?: string | null; style?: ViewStyle }) {
  return (
    <View style={[{ gap: 8 }, style]}>
      <Label>{label}</Label>
      <TextInput
        placeholderTextColor={color.faint}
        {...rest}
        style={[styles.input, error ? { boxShadow: `inset 0 0 0 1.5px ${color.coral}` } : null, rest.multiline && { height: 96, paddingTop: 14, textAlignVertical: 'top' }] as TextStyle[]}
      />
      {error ? <Caption color={color.coralInk}>{error}</Caption> : hint ? <Caption>{hint}</Caption> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Durumlar: boş, yükleniyor, geri bildirim
// ---------------------------------------------------------------------------
export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <Surface style={{ alignItems: 'center', paddingVertical: 48, paddingHorizontal: 28, gap: 14 }}>
      <View style={{ width: 160, height: 120 }}>
        <View style={{ position: 'absolute', left: 8, top: 10, width: 90, height: 90, borderRadius: 45, backgroundColor: '#F2846F' }} />
        <View style={{ position: 'absolute', right: 14, top: 26, width: 62, height: 94, borderTopLeftRadius: 31, borderTopRightRadius: 31, backgroundColor: '#9CC3AB' }} />
        <View style={{ position: 'absolute', left: 70, top: 70, width: 50, height: 50, borderRadius: 25, backgroundColor: '#E2B04A' }} />
        <View style={{ position: 'absolute', left: 44, top: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: color.lavender }} />
      </View>
      <Display size={36} center>{title}</Display>
      <Body center style={{ maxWidth: 320 }}>{body}</Body>
      {action}
    </Surface>
  );
}

export function Skeleton({ height = 16, width = '100%', radius: r = 10 }: { height?: number; width?: number | `${number}%`; radius?: number }) {
  return <View style={{ height, width, borderRadius: r, backgroundColor: '#EFEAE2' }} />;
}

export function Notice({ tone, text }: { tone: 'success' | 'info' | 'warning' | 'error'; text: string }) {
  const t = {
    success: { bg: color.sageTint, fg: color.sageInk },
    info: { bg: color.lavenderTint, fg: color.lavenderInk },
    warning: { bg: color.goldTint, fg: color.goldInk },
    error: { bg: color.coralTint, fg: color.coralInk },
  }[tone];
  return (
    <View accessibilityRole={tone === 'error' ? 'alert' : undefined} style={{ backgroundColor: t.bg, borderRadius: radius.lg, paddingVertical: 14, paddingHorizontal: 16 }}>
      <Text style={{ fontFamily: font.semibold, fontSize: 14, lineHeight: 20, color: t.fg }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: font.semibold, fontSize: 17, lineHeight: 24 },
  body: { fontFamily: font.regular, fontSize: 15, lineHeight: 23 },
  label: { fontFamily: font.semibold, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: font.regular, fontSize: 13, lineHeight: 19 },
  surface: { backgroundColor: color.surface, borderRadius: radius.xl, padding: space.xl, boxShadow: shadow.card },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: radius.pill },
  buttonLabel: { fontFamily: font.semibold },
  iconButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: color.surface, alignItems: 'center', justifyContent: 'center', boxShadow: shadow.card },
  pill: { alignSelf: 'flex-start', paddingHorizontal: 11, paddingVertical: 5, borderRadius: radius.pill },
  pillText: { fontFamily: font.bold, fontSize: 12, lineHeight: 16 },
  input: {
    height: 50,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    backgroundColor: color.surface,
    fontFamily: font.medium,
    fontSize: 15,
    color: color.ink,
    boxShadow: `inset 0 0 0 1px ${color.hairline}`,
  },
});

// ---------------------------------------------------------------------------
// Anahtar (platformlar arası aynı görünür)
// ---------------------------------------------------------------------------
export function Toggle({ value, onChange, label, disabled }: { value: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => {
        tapFeedback();
        onChange(!value);
      }}
      hitSlop={8}
      style={{ width: 48, height: 28, borderRadius: 14, padding: 3, backgroundColor: value ? color.lavender : '#E3DED6', alignItems: value ? 'flex-end' : 'flex-start', opacity: disabled ? 0.5 : 1 }}>
      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF', boxShadow: '0px 1px 3px rgba(36,33,43,0.25)' }} />
    </Pressable>
  );
}

/** Etiket + açıklama + anahtar satırı. */
export function ToggleRow({ label, hint, value, onChange, disabled }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 6 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: font.medium, fontSize: 15, color: color.ink }}>{label}</Text>
        {hint ? <Caption>{hint}</Caption> : null}
      </View>
      <Toggle value={value} onChange={onChange} label={label} disabled={disabled} />
    </View>
  );
}
