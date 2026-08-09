import { useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  cancelAnimation,
  Easing,
  SharedValue,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, Path } from 'react-native-svg';

import { GlassView } from '@/components/glass/GlassView';
import { IriIcon } from '@/components/icons/IriIcon';
import { playSound } from '@/features/sound/sounds';
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

/**
 * Glas-Geometrie (Beta-Feedback 09.08., nach Foto): Tumbler — oben weiter Rand,
 * Wände laufen leicht konisch zu, unten weich gerundeter Boden.
 * viewBox 34×42; INNER ist die Wasserfläche (fürs Clipping).
 */
const VB_W = 34;
const VB_H = 42;
const GLASS_OUTLINE =
  'M3,1.5 L31,1.5 C30.7,11 30.1,19 28.8,26 C27.6,34 25.8,40 17,40 C8.2,40 6.4,34 5.2,26 C3.9,19 3.3,11 3,1.5 Z';
const WATER_TOP = 10; // Ruhelage der Wasseroberfläche (≈ 75 % gefüllt)

/** S18: aufsteigende Bläschen — nur im zuletzt gefüllten Glas (Performance!) */
const BUBBLES = [
  { x: 12, r: 1.5, delay: 0, duration: 4600 },
  { x: 22, r: 1.1, delay: 2100, duration: 5400 },
] as const;

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function Bubble({ x, r, delay, duration }: { x: number; r: number; delay: number; duration: number }) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration, easing: Easing.out(Easing.quad) }), -1, false),
    );
    return () => cancelAnimation(t);
  }, [delay, duration, t]);

  const props = useAnimatedProps(() => ({
    cy: VB_H - 5 - (VB_H - WATER_TOP - 8) * t.value,
    opacity: t.value < 0.15 ? t.value / 0.15 : 1 - t.value,
  }));

  return <AnimatedCircle cx={x} r={r} fill="rgba(255,255,255,0.75)" animatedProps={props} />;
}

/** Stützpunkte der Welle — 6 reichen für die Optik, jeder kostet Rechenzeit pro Bild */
const WAVE_STEPS = 6;

/**
 * Ein Glas in Tumbler-Form. amplitude UND phase kommen von der Karte —
 * ein Tap lässt ALLE Gläser nachschwappen, und es läuft nur EIN Zeitgeber.
 */
function TumblerGlass({
  amplitude,
  phase,
  index,
  filled,
  withBubbles,
  width,
}: {
  amplitude: SharedValue<number>;
  phase: SharedValue<number>;
  index: number;
  filled: boolean;
  withBubbles: boolean;
  width: number;
}) {
  const pathProps = useAnimatedProps(() => {
    'worklet';
    let d = `M0,${VB_H}`;
    for (let i = 0; i <= WAVE_STEPS; i += 1) {
      const x = (VB_W / WAVE_STEPS) * i;
      // Nachbargläser leicht versetzt (index*0.9) — wirkt natürlicher als Gleichtakt
      const y =
        WATER_TOP +
        Math.sin(phase.value + (x / VB_W) * Math.PI * 1.6 + index * 0.9) * amplitude.value;
      d += ` L${x.toFixed(1)},${y.toFixed(1)}`;
    }
    return { d: `${d} L${VB_W},${VB_H} Z` };
  });

  const height = Math.round(width * (VB_H / VB_W));
  const clipId = `glass-${index}`;

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`}>
      <Defs>
        <ClipPath id={clipId}>
          <Path d={GLASS_OUTLINE} />
        </ClipPath>
      </Defs>
      {/* Glaskörper */}
      <Path
        d={GLASS_OUTLINE}
        fill={filled ? 'rgba(122,206,222,0.16)' : 'rgba(28,28,33,0.05)'}
      />
      {filled ? (
        <>
          <AnimatedPath
            animatedProps={pathProps}
            fill="rgba(98,186,208,0.88)"
            clipPath={`url(#${clipId})`}
          />
          {withBubbles
            ? BUBBLES.map((b, i) => (
                <Bubble key={i} x={b.x} r={b.r} delay={b.delay} duration={b.duration} />
              ))
            : null}
        </>
      ) : null}
      {/* Kontur zuletzt, damit sie über dem Wasser liegt */}
      <Path
        d={GLASS_OUTLINE}
        fill="none"
        stroke={filled ? 'rgba(255,255,255,0.85)' : 'rgba(28,28,33,0.14)'}
        strokeWidth={1.4}
      />
    </Svg>
  );
}

const GAP = 7;
const MAX_GLASS_W = 46;

/**
 * Wasser-Widget: Reihe von Gläsern, Tap füllt bis zum angetippten Glas;
 * Tap auf das letzte volle Glas leert es wieder. Die Gläser skalieren auf die
 * volle Kartenbreite (Beta-Feedback 09.08.: iPhone vs. Plus).
 */
export function WaterCard({ currentMl, goalMl, glassMl, onSetAmount }: WaterCardProps) {
  const glassCount = Math.max(1, Math.round(goalMl / glassMl));
  const filled = Math.round(currentMl / glassMl);
  const amplitude = useSharedValue(1.6);
  const phase = useSharedValue(0);
  const [rowWidth, setRowWidth] = useState(0);

  // EIN Zeitgeber für alle Gläser: 0→2π linear wiederholt = nahtloser Loop
  useEffect(() => {
    phase.value = withRepeat(
      withTiming(Math.PI * 2, { duration: 3500, easing: Easing.linear }),
      -1,
    );
    return () => cancelAnimation(phase);
  }, [phase]);

  const onRowLayout = (e: LayoutChangeEvent) => setRowWidth(e.nativeEvent.layout.width);
  const glassW = rowWidth
    ? Math.min(MAX_GLASS_W, Math.floor((rowWidth - GAP * (glassCount - 1)) / glassCount))
    : 0;

  const tapGlass = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    playSound('water');
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
      <View style={styles.glasses} onLayout={onRowLayout}>
        {glassW > 0
          ? Array.from({ length: glassCount }, (_, i) => {
              const isFull = i < filled;
              return (
                <Pressable
                  key={i}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('home.water')} ${i + 1}`}
                  accessibilityState={{ selected: isFull }}
                  onPress={() => tapGlass(i)}
                >
                  <TumblerGlass
                    amplitude={amplitude}
                    phase={phase}
                    index={i}
                    filled={isFull}
                    withBubbles={i === filled - 1}
                    width={glassW}
                  />
                </Pressable>
              );
            })
          : null}
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
    justifyContent: 'center',
    gap: GAP,
    marginTop: 10,
  },
});
