import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { colors, font, typography } from '@/theme';

export interface CalorieRingProps {
  /** Große Zahl in der Mitte (z. B. Kalorienziel) */
  readonly value: number;
  /** Unterzeile, z. B. "kcal pro Tag" */
  readonly label: string;
  /** Füllstand 0..1 des Rosé-Bogens */
  readonly progress: number;
  readonly size?: number;
}

const STROKE = 14;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * Kalorien-Ring mit Rosé-Verlauf (Prototyp: .ring) — Zahl in Italiana.
 * S16: Bogen füllt sich in ~800 ms mit Ease-out, die Zahl zählt mit;
 * spätere Wertänderungen (Loggen) animieren vom alten Stand weiter.
 */
export function CalorieRing({ value, label, progress, size = 210 }: CalorieRingProps) {
  const r = (size - STROKE * 2) / 2 + STROKE / 2 - 1;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(1, Math.max(0, progress));
  const animated = useSharedValue(0);

  useEffect(() => {
    animated.value = withTiming(clamped, { duration: 800, easing: Easing.out(Easing.cubic) });
  }, [clamped, animated]);

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: c * (1 - animated.value),
  }));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={styles.rotated}>
        <Defs>
          <LinearGradient
            id="ringGradient"
            gradientUnits="userSpaceOnUse"
            x1={0}
            y1={0}
            x2={size}
            y2={size}
          >
            <Stop offset="0%" stopColor={colors.tint} />
            <Stop offset="100%" stopColor={colors.tintDeep} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colors.track} strokeWidth={STROKE} />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#ringGradient)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={c}
          animatedProps={arcProps}
        />
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <AnimatedNumber value={value} from={0} style={typography.displayNum} />
        <Text style={styles.label}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rotated: {
    transform: [{ rotate: '-90deg' }],
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: font.bold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.muted,
    marginTop: 2,
  },
});
