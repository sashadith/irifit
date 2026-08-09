import { createContext, PropsWithChildren, useContext } from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import {
  GlassView as AppleGlassView,
  isLiquidGlassAvailable,
} from 'expo-glass-effect';

import { blurIntensity, colors, glassShadow, radius } from '@/theme';

/**
 * Natives Apple Liquid Glass (iOS 26, UIGlassEffect) — GPU-composited, also
 * praktisch gratis. In Expo Go existiert das native Modul nicht, und auf
 * Android/aelterem iOS liefert isLiquidGlassAvailable() false — dann greift
 * der bisherige Blur- bzw. Pastell-Fallback. Einmal beim Start ausgewertet.
 */
const APPLE_GLASS = (() => {
  try {
    return isLiquidGlassAvailable();
  } catch {
    return false;
  }
})();

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
 * Android-Fallback: Verschachtelungstiefe der Glas-Panels. Semitransparente
 * Flächen würden ihre Alpha-Werte bei Karte-in-Karte stapeln (sichtbare
 * Farbstufen), deshalb bekommt jede Ebene einen festen, deckenden Ton.
 */
const GlassDepth = createContext(0);

function androidFill(depth: number, strong: boolean): string {
  if (depth === 0) return strong ? colors.glassStrongAndroid : colors.glassAndroid;
  return strong ? colors.glassNestedStrongAndroid : colors.glassNestedAndroid;
}

/**
 * Liquid-Glass-Panel: echtes Blur-Material auf iOS (expo-blur),
 * auf Android deckende Pastell-Flächen (kein performantes Backdrop-Blur)
 * ohne Border — die weiße Stroke wirkt auf deckendem Grund wie eine Kante.
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
  const depth = useContext(GlassDepth);
  const isIOS = Platform.OS === 'ios';
  const fill = isIOS
    ? strong
      ? colors.glassStrong
      : colors.glass
    : androidFill(depth, strong);

  if (APPLE_GLASS) {
    // Echtes UIGlassEffect: kein eigenes Blur/Fill noetig — nur ein hauchduenner
    // Rose-Schleier, damit die Panels im IriFit-Ton bleiben statt neutralgrau.
    return (
      <View style={[shadow && glassShadow, { borderRadius }, style]}>
        <AppleGlassView
          glassEffectStyle={strong ? 'regular' : 'clear'}
          tintColor={strong ? 'rgba(255,252,253,0.72)' : 'rgba(255,250,252,0.45)'}
          colorScheme="light"
          style={[styles.clip, { borderRadius }]}
        >
          <GlassDepth.Provider value={depth + 1}>
            <View style={contentStyle}>{children}</View>
          </GlassDepth.Provider>
        </AppleGlassView>
      </View>
    );
  }

  return (
    <View style={[shadow && glassShadow, { borderRadius }, style]}>
      <View style={[styles.clip, isIOS && styles.clipIOS, { borderRadius }]}>
        {isIOS && (
          <BlurView tint="light" intensity={blurIntensity} style={StyleSheet.absoluteFill} />
        )}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: fill }]} />
        <GlassDepth.Provider value={depth + 1}>
          <View style={contentStyle}>{children}</View>
        </GlassDepth.Provider>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
  clipIOS: {
    borderWidth: 1,
    borderColor: colors.stroke,
  },
});
