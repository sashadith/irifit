import { PropsWithChildren } from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';

import { blurIntensity, colors, glassShadow, radius } from '@/theme';

export interface GlassViewProps {
  /** Deckkraft-Variante wie .card vs. .choice.sel im Prototyp */
  readonly strong?: boolean;
  /** Eck-Radius, Standard --r-lg (28) */
  readonly borderRadius?: number;
  /** Äußerer Style (Layout, Margins) — Schatten & Radius kommen von der Komponente */
  readonly style?: StyleProp<ViewStyle>;
  /** Innenabstand des Inhalts, Standard 18 wie .card */
  readonly contentStyle?: StyleProp<ViewStyle>;
  /** Schatten abschalten (z. B. in Listen mit vielen Panels) */
  readonly shadow?: boolean;
}

/**
 * Liquid-Glass-Panel: echtes Blur-Material auf iOS (expo-blur),
 * soliderer weißer Fallback auf Android (kein performantes Backdrop-Blur).
 * Schatten liegt auf dem äußeren View, das Clipping (overflow hidden)
 * auf dem inneren — sonst schneidet overflow den Schatten ab.
 */
export function GlassView({
  strong = false,
  borderRadius = radius.lg,
  style,
  contentStyle,
  shadow = true,
  children,
}: PropsWithChildren<GlassViewProps>) {
  const isIOS = Platform.OS === 'ios';
  const fill = isIOS
    ? strong
      ? colors.glassStrong
      : colors.glass
    : strong
      ? colors.glassStrongAndroid
      : colors.glassAndroid;

  return (
    <View style={[shadow && glassShadow, { borderRadius }, style]}>
      <View style={[styles.clip, { borderRadius }]}>
        {isIOS && (
          <BlurView tint="light" intensity={blurIntensity} style={StyleSheet.absoluteFill} />
        )}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: fill }]} />
        <View style={contentStyle}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.stroke,
  },
});
