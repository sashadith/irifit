import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

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

/** Kalorien-Ring mit Rosé-Verlauf (Prototyp: .ring) — Zahl in Italiana */
export function CalorieRing({ value, label, progress, size = 210 }: CalorieRingProps) {
  const r = (size - STROKE * 2) / 2 + STROKE / 2 - 1;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(1, Math.max(0, progress));

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
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#ringGradient)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
        />
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <Text style={typography.displayNum}>{value.toLocaleString('de-DE')}</Text>
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
