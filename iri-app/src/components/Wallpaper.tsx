import { useEffect } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

import { colors } from '@/theme';

interface Blob {
  readonly id: string;
  readonly color: string;
  readonly opacity: number;
  /** Position/Größe der Ellipse relativ zum Bildschirm (Prozent) */
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  /** Driftweite in Punkten + Dauer eines Hin-und-Zurück */
  readonly driftX: number;
  readonly driftY: number;
  readonly duration: number;
}

/** Radial-Verläufe aus dem Prototyp: radial-gradient(RX RY at CX CY, Farbe, transparent 70%) */
const blobs: readonly Blob[] = [
  { id: 'rose', color: colors.wallpaper.rose, opacity: 0.8, left: -38, top: -30, width: 112, height: 76, driftX: 22, driftY: 14, duration: 26000 },
  { id: 'lilac', color: colors.wallpaper.lilac, opacity: 0.8, left: 38, top: -14, width: 100, height: 72, driftX: -26, driftY: 18, duration: 32000 },
  { id: 'peach', color: colors.wallpaper.peach, opacity: 0.75, left: 10, top: 46, width: 120, height: 84, driftX: 18, driftY: -22, duration: 29000 },
  { id: 'mauve', color: colors.wallpaper.mauve, opacity: 0.7, left: -34, top: 38, width: 92, height: 68, driftX: 28, driftY: -14, duration: 35000 },
];

/**
 * S18: Ein Farbfleck, der langsam driftet — „atmen“, nicht auffallen.
 *
 * WICHTIG (Befund 09.08.): Die Bewegung läuft als **transform** auf einer View,
 * nicht als animierte SVG-Koordinate. Prozent-Strings (`cx="24%"`) kann
 * Reanimated nicht auf dem UI-Thread verrechnen — es parst dann pro Bild neu und
 * blockiert genau den Thread, der auf iOS den Splashscreen entfernt (App hing im
 * Startbild). Transforms sind dagegen GPU-Sache und praktisch gratis.
 */
function DriftingBlob({ blob }: { blob: Blob }) {
  const t = useSharedValue(0);

  useEffect(() => {
    const start = () => {
      t.value = withRepeat(
        withTiming(1, { duration: blob.duration, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
    };
    start();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') start();
      else cancelAnimation(t);
    });
    return () => {
      cancelAnimation(t);
      sub.remove();
    };
  }, [blob.duration, t]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: blob.driftX * t.value },
      { translateY: blob.driftY * t.value },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.blob,
        {
          left: `${blob.left}%`,
          top: `${blob.top}%`,
          width: `${blob.width}%`,
          height: `${blob.height}%`,
        },
        style,
      ]}
    >
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id={blob.id} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={blob.color} stopOpacity={blob.opacity} />
            <Stop offset="70%" stopColor={blob.color} stopOpacity={blob.opacity * 0.35} />
            <Stop offset="100%" stopColor={blob.color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx="50%" cy="50%" rx="50%" ry="50%" fill={`url(#${blob.id})`} />
      </Svg>
    </Animated.View>
  );
}

/**
 * Weiches Pastell-Wallpaper hinter allen Glas-Panels
 * (Rosé/Flieder/Pfirsich auf warmem Grundverlauf).
 */
export function Wallpaper() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={colors.wallpaper.base}
        start={{ x: 0.4, y: 0 }}
        end={{ x: 0.6, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {blobs.map((b) => (
        <DriftingBlob key={b.id} blob={b} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  blob: {
    position: 'absolute',
  },
});
