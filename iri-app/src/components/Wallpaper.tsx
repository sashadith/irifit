import { useEffect } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

import { colors } from '@/theme';

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

interface Blob {
  readonly id: string;
  readonly color: string;
  readonly opacity: number;
  readonly cx: number; // Prozent
  readonly cy: number;
  readonly rx: string;
  readonly ry: string;
  /** Driftweite in Prozentpunkten + Dauer eines Hin-und-Zurück */
  readonly driftX: number;
  readonly driftY: number;
  readonly duration: number;
}

/** Radial-Verläufe aus dem Prototyp: radial-gradient(RX RY at CX CY, Farbe, transparent 70%) */
const blobs: readonly Blob[] = [
  { id: 'rose', color: colors.wallpaper.rose, opacity: 0.8, cx: 18, cy: 8, rx: '56%', ry: '38%', driftX: 6, driftY: 4, duration: 26000 },
  { id: 'lilac', color: colors.wallpaper.lilac, opacity: 0.8, cx: 88, cy: 22, rx: '50%', ry: '36%', driftX: -7, driftY: 5, duration: 32000 },
  { id: 'peach', color: colors.wallpaper.peach, opacity: 0.75, cx: 70, cy: 88, rx: '60%', ry: '42%', driftX: 5, driftY: -6, duration: 29000 },
  { id: 'mauve', color: colors.wallpaper.mauve, opacity: 0.7, cx: 12, cy: 72, rx: '46%', ry: '34%', driftX: 8, driftY: -4, duration: 35000 },
];

/**
 * S18: Ein Farbfleck, der langsam driftet. Sehr lange Dauern (26–35 s) und
 * kleine Wege (max. 8 Prozentpunkte) — es soll „atmen“, nicht auffallen.
 * Pausiert, sobald die App in den Hintergrund geht (Akku).
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

  const props = useAnimatedProps(() => ({
    cx: `${blob.cx + blob.driftX * t.value}%`,
    cy: `${blob.cy + blob.driftY * t.value}%`,
  }));

  return (
    <AnimatedEllipse
      animatedProps={props}
      rx={blob.rx}
      ry={blob.ry}
      fill={`url(#${blob.id})`}
    />
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
      <Svg width="100%" height="100%">
        <Defs>
          {blobs.map((b) => (
            <RadialGradient key={b.id} id={b.id} cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={b.color} stopOpacity={b.opacity} />
              <Stop offset="70%" stopColor={b.color} stopOpacity={b.opacity * 0.35} />
              <Stop offset="100%" stopColor={b.color} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {blobs.map((b) => (
          <DriftingBlob key={b.id} blob={b} />
        ))}
      </Svg>
    </View>
  );
}
