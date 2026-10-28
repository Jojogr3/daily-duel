/** Small set of shared building blocks so every screen looks consistent. */
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { font, radius, space, useTheme } from '../theme';

export function Screen({ children, scroll = true, style }: { children: ReactNode; scroll?: boolean; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const inner = <View style={[{ padding: space(2.5), gap: space(2), flexGrow: 1 }, style]}>{children}</View>;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['bottom', 'left', 'right']}>
      {scroll ? <ScrollView contentContainerStyle={{ flexGrow: 1 }}>{inner}</ScrollView> : inner}
    </SafeAreaView>
  );
}

export function Title({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return <Text style={[font.title, { color: t.ink }, style]}>{children}</Text>;
}

export function H2({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return <Text style={[font.h2, { color: t.ink }, style]}>{children}</Text>;
}

export function Body({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return <Text style={[font.body, { color: muted ? t.muted : t.ink, lineHeight: 22 }, style]}>{children}</Text>;
}

export function Small({ children, style, selectable }: { children: ReactNode; style?: StyleProp<TextStyle>; selectable?: boolean }) {
  const t = useTheme();
  return (
    <Text selectable={selectable} style={[font.small, { color: t.muted }, style]}>
      {children}
    </Text>
  );
}

export function Card({ children, style, onPress, accent }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; accent?: string }) {
  const t = useTheme();
  const base: ViewStyle = {
    backgroundColor: t.surface,
    borderRadius: radius.lg,
    padding: space(2),
    borderWidth: accent ? 2 : StyleSheet.hairlineWidth,
    borderColor: accent ?? t.line,
    gap: space(1),
  };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [base, { opacity: pressed ? 0.85 : 1 }, style]}>
      {children}
    </Pressable>
  );
}

type ButtonKind = 'primary' | 'secondary' | 'ghost';

export function Button({
  label,
  onPress,
  kind = 'primary',
  disabled,
  loading,
  style,
}: {
  label: string;
  onPress: () => void;
  kind?: ButtonKind;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const bg = kind === 'primary' ? t.you : kind === 'secondary' ? t.surfaceAlt : 'transparent';
  const fg = kind === 'primary' ? '#FFFFFF' : t.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderRadius: radius.md,
          paddingVertical: space(1.75),
          paddingHorizontal: space(2.5),
          alignItems: 'center',
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={{ color: fg, fontSize: 17, fontWeight: '700' }}>{label}</Text>}
    </Pressable>
  );
}

export function Pill({ label, color, textColor }: { label: string; color: string; textColor?: string }) {
  const t = useTheme();
  return (
    <View style={{ backgroundColor: color, borderRadius: 999, paddingHorizontal: space(1.25), paddingVertical: 4, alignSelf: 'flex-start' }}>
      <Text style={{ color: textColor ?? t.ink, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space(1) }, style]}>{children}</View>;
}

export function Loading({ label }: { label?: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space(1.5), backgroundColor: t.bg }}>
      <ActivityIndicator color={t.you} size="large" />
      {label ? <Small>{label}</Small> : null}
    </View>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const t = useTheme();
  return (
    <Card style={{ borderColor: t.warn }}>
      <Body>{message}</Body>
      {onRetry ? <Button label="Try again" kind="secondary" onPress={onRetry} /> : null}
    </Card>
  );
}
