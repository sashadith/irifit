import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  SharedValue,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { GlassView } from '@/components/glass/GlassView';
import { IriIcon } from '@/components/icons/IriIcon';
import { t } from '@/i18n';
import { colors, font, radius } from '@/theme';

export interface WaterCardProps {
  readonly currentMl: number;
  readonly goalMl: number;
  readonly glassMl: number;
  readonly onSetAmount: (amountMl: number) => void;
}

const formatLiters = (ml: number) =>
  (ml / 1000).toLocaleString('de-DE', { maximumFractionDigits: 2 });

const GLASS_W = 34;
const GLASS_H = 38;
const WATER_TOP = 9; // Wasseroberfläche (≈ 76 % gefüllt)
const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * S16: Wasseroberfläche als langsam schwappende Sinus-Welle (3,5-s-Loop).
 * amplitude ist je Karte geteilt — ein Tap lässt ALLE Gläser kurz nachschwappen.
 */
function WaveGlass({ amplitude, index }: { amplitude: SharedValue<number>; index: number }) {
  const phase = useSharedValue(0);

  useEffect(() => {
    // 0→2π linear wiederholt = nahtloser Loop (Sinus ist periodisch)
    phase.value = withRepeat(
      withTiming(Math.PI * 2, { duration: 3500, easing: Easing.linear }),
      -1,
    );
  }, [phase]);

  const pathProps = useAnimatedProps(() => {
    'worklet';
    const points: string[] = [];
    for (let i = 0; i <= 10; i += 1) {
      const x = (GLASS_W / 10) * i;
      // Nachbargläser leicht versetzt (index*0.9) — wirkt natürlicher als Gleichtakt
      const y = WATER_TOP + Math.sin(phase.value + (x / GLASS_W) * Math.PI * 1.6 + index * 0.9) * amplitude.value;
      points.push(`L${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return { d: `M0,${GLASS_H} ${points.join(' ')} L${GLASS_W},${GLASS_H} Z` };
  });

  return (
    <View style={[styles.glass, styles.glassWater]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${GLASS_W} ${GLASS_H}`} preserveAspectRatio="none">
        <AnimatedPath animatedProps={pathProps} fill="rgba(98,186,208,0.88)" />
      </Svg>
    </View>
  );
}

/**
 * Wasser-Widget (Prototyp .water): Reihe von Gläsern, Tap füllt bis zum
 * angetippten Glas; Tap auf das letzte volle Glas leert es wieder.
 */
export function WaterCard({ currentMl, goalMl, glassMl, onSetAmount }: WaterCardProps) {
  const glassCount = Math.max(1, Math.round(goalMl / glassMl));
  const filled = Math.round(currentMl / glassMl);
  const amplitude = useSharedValue(1.6);

  const tapGlass = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Nachschwappen: kurz hoch, dann gemütlich zurück zur Ruhe-Welle
    amplitude.value = withSequence(
      withTiming(5, { duration: 130, easing: Easing.out(Easing.quad) }),
      withTiming(1.6, { duration: 1100, easing: Easing.out(Easing.cubic) }),
    );
    const next = index + 1 === filled ? index : index + 1;
    onSetAmount(next * glassMl);
  };

  return (
    <GlassView borderRadius={radius.md} style={styles.card} contentStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <IriIcon name="drop" size={17} color={colors.water} />
          <Text style={styles.title}>{t('home.water')}</Text>
        </View>
        <Text style={styles.amount}>
          {t('home.waterAmount', { current: formatLiters(currentMl), goal: formatLiters(goalMl) })}
        </Text>
      </View>
      <View style={styles.glasses}>
        {Array.from({ length: glassCount }, (_, i) => {
          const isFull = i < filled;
          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={`${t('home.water')} ${i + 1}`}
              accessibilityState={{ selected: isFull }}
              onPress={() => tapGlass(i)}
              style={styles.glassSlot}
            >
              {isFull ? (
                <WaveGlass amplitude={amplitude} index={i} />
              ) : (
                <View style={[styles.glass, styles.glassEmpty]} />
              )}
            </Pressable>
          );
        })}
      </View>
    </GlassView>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 14,
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  title: {
    fontFamily: font.bold,
    fontSize: 14,
    color: colors.ink,
  },
  amount: {
    fontFamily: font.bold,
    fontSize: 12,
    color: colors.muted,
  },
  glasses: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 10,
  },
  glassSlot: {
    flex: 1,
    maxWidth: 34,
  },
  glass: {
    height: 38,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 11,
    borderBottomRightRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  glassWater: {
    overflow: 'hidden',
    backgroundColor: 'rgba(122,206,222,0.18)',
  },
  glassEmpty: {
    backgroundColor: colors.track,
  },
});
