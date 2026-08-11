import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
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
 * Kalorien-Ring mit Rosé-Verlauf (Prototyp: .ring) — Zahl in der Display-Schrift (font.display).
 * S16: Bogen füllt sich in ~800 ms mit Ease-out, die Zahl zählt mit;
 * spätere Wertänderungen (Loggen) animieren vom alten Stand weiter.
 */
export function CalorieRing({ value, label, progress, size = 210 }: CalorieRingProps) {
  const r = (size - STROKE * 2) / 2 + STROKE / 2 - 1;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(1, Math.max(0, progress));
  const animated = useSharedValue(0);

  // Liquid-Glass-Look (Sascha 11.08.): Glanzlicht wandert langsam ueber den
  // Ring — EIN Timer, laeuft als Worklet auf dem UI-Thread (kostet ~nichts)
  const glint = useSharedValue(0);

  useEffect(() => {
    animated.value = withTiming(clamped, { duration: 800, easing: Easing.out(Easing.cubic) });
  }, [clamped, animated]);

  useEffect(() => {
    glint.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1);
    return () => cancelAnimation(glint);
  }, [glint]);

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: c * (1 - animated.value),
  }));

  // Lichtkante folgt dem Bogen auf einem etwas groesseren Radius
  const rSheen = r + STROKE / 2 - 2.5;
  const cSheen = 2 * Math.PI * rSheen;
  const sheenProps = useAnimatedProps(() => ({
    strokeDashoffset: cSheen * (1 - animated.value),
  }));

  const glintProps = useAnimatedProps(() => ({
    strokeDashoffset: -c * glint.value,
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
        {/* Glasrinne: milchiger Tube-Track mit feinen Kanten */}
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.72)" strokeWidth={STROKE} />
        <Circle cx={size / 2} cy={size / 2} r={r + STROKE / 2} fill="none" stroke="rgba(28,28,33,0.05)" strokeWidth={1} />
        <Circle cx={size / 2} cy={size / 2} r={r - STROKE / 2} fill="none" stroke="rgba(28,28,33,0.05)" strokeWidth={1} />
        {/* Weicher Rose-Schein hinter dem Bogen */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#ringGradient)"
          strokeWidth={STROKE + 8}
          strokeLinecap="round"
          strokeDasharray={c}
          opacity={0.18}
          animatedProps={arcProps}
        />
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
        {/* Lichtkante am oberen Glasrand des Bogens */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={rSheen}
          fill="none"
          stroke="rgba(255,255,255,0.55)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray={cSheen}
          animatedProps={sheenProps}
        />
        {/* Wanderndes Glanzlicht ueber der ganzen Glasrinne */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.4)"
          strokeWidth={STROKE - 5}
          strokeLinecap="round"
          strokeDasharray={`${c * 0.14} ${c * 0.86}`}
          animatedProps={glintProps}
        />
      </Svg>
      {/* Zahl EXAKT im Ringzentrum (Beta 09.08.); das Label haengt absolut
          darunter und verschiebt die Zahl nicht mehr nach oben */}
      <View style={styles.center} pointerEvents="none">
        <AnimatedNumber value={value} from={0} style={[typography.displayNum, styles.number]} />
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
  number: {
    lineHeight: 58,
  },
  label: {
    position: 'absolute',
    top: '50%',
    marginTop: 32, // halbe Zahlhoehe + Luft
    fontFamily: font.bold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.muted,
  },
});
