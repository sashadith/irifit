import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { RingBurst } from '@/components/ui/RingBurst';
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
/** Nach so viel Ruhe stoppt der Fluessigkeits-Loop (Blaeschen + Puls) */
const FLOW_REST_MS = 6000;
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

  // Fluessigglas (Sascha 11.08., v2): durchscheinende Rose-Fluessigkeit in
  // matter Glasrinne, Blaeschen treiben durch den Bogen, die Spitze pulst.
  // EIN Loop-Timer, alles Worklets auf dem UI-Thread.
  const flow = useSharedValue(0);

  useEffect(() => {
    animated.value = withTiming(clamped, { duration: 800, easing: Easing.out(Easing.cubic) });
  }, [clamped, animated]);

  /* Animation bei Interaktion, Ruhe danach (Sascha 18.08., Waermestau auf
     dem Home): Der Endlos-Fluss schrieb in jedem Bild neue SVG-Werte fuer
     Leuchtpunkt und Blaeschen. Jetzt laeuft er nach jedem Wertwechsel (Oeffnen,
     Eintrag) FLOW_REST_MS lang, dann blenden die Blaeschen aus und der
     Zeitgeber stoppt — der Punkt an der Spitze bleibt stehen, nur ohne Puls. */
  const alive = useSharedValue(1);
  // Fokus-Effekt statt Mount-Effekt: Die Tabs halten den Screen am Leben,
  // beim Zurueckwechseln soll der Fluss wieder anlaufen (Sascha 18.08.)
  useFocusEffect(
    useCallback(() => {
      alive.value = 1;
      cancelAnimation(flow);
      flow.value = withRepeat(withTiming(1, { duration: 5200, easing: Easing.linear }), -1);
      let stopTimer: ReturnType<typeof setTimeout> | undefined;
      const rest = setTimeout(() => {
        alive.value = withTiming(0, { duration: 700 });
        stopTimer = setTimeout(() => cancelAnimation(flow), 750);
      }, FLOW_REST_MS);
      return () => {
        clearTimeout(rest);
        if (stopTimer) clearTimeout(stopTimer);
        cancelAnimation(flow);
      };
    }, [flow, alive, clamped]),
  );

  /* Tipp-Ausbruch (Sascha 20.08., Vorbild Wolt): Der Ring gibt kurz nach, man
     spuert es in der Hand, und hinter ihm fliegen kcal und Herzen heraus.
     Reine Spielerei — aber genau die Art, die Leute morgens die App oeffnen
     laesst. Kostet nichts, solange niemand tippt.

     Jeder Tipp loest SOFORT einen eigenen Ausbruch aus (Sascha 20.08.) —
     vorher sperrte ein Riegel, bis die laufende Welle durch war, und schnelles
     Tippen fuehlte sich tot an. Die Wellen liegen jetzt uebereinander: Jede
     bekommt eine eigene Kennung und raeumt sich selbst ab. Die Obergrenze von
     vier gleichzeitigen Wellen ist der Schutz gegen Dauerlast — bei mehr
     saehe man ohnehin nur noch Brei. */
  const [bursts, setBursts] = useState<number[]>([]);
  const naechsteId = useRef(0);
  const druck = useSharedValue(1);

  const tippen = useCallback(() => {
    /* Kurzes Antippen statt Nachwippen (Sascha 20.08.): Die weiche Feder hat
       den Ring fast eine halbe Sekunde nachschwingen lassen — das wirkte
       wackelig. Jetzt gibt er knapp nach und ist sofort wieder still. */
    druck.value = withSequence(
      withTiming(0.97, { duration: 70, easing: Easing.out(Easing.quad) }),
      withSpring(1, { damping: 22, stiffness: 420 }),
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const id = ++naechsteId.current;
    setBursts((alt) => [...alt.slice(-3), id]);
  }, [druck]);

  const burstFertig = useCallback((id: number) => {
    setBursts((alt) => alt.filter((x) => x !== id));
  }, []);

  const druckStil = useAnimatedStyle(() => ({ transform: [{ scale: druck.value }] }));

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: c * (1 - animated.value),
  }));

  const cx = size / 2;
  // Leuchtpunkt an der Bogenspitze, sanft pulsierend
  const tipProps = useAnimatedProps(() => {
    'worklet';
    const angle = animated.value * Math.PI * 2;
    const pulse = 1 + 0.18 * Math.sin(flow.value * Math.PI * 4) * alive.value;
    return {
      cx: cx + r * Math.cos(angle),
      cy: cx + r * Math.sin(angle),
      r: 3.2 * pulse,
      opacity: animated.value > 0.02 ? 0.9 : 0,
    };
  });

  // Zwei Blaeschen treiben vom Start zur Spitze (versetzt), verblassen am Ende
  const bubbleProps = (offset: number, radial: number) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useAnimatedProps(() => {
      'worklet';
      // Blaeschen fliessen der Fuellrichtung ENTGEGEN (Sascha 11.08.)
      const u = 1 - ((flow.value + offset) % 1);
      const angle = u * animated.value * Math.PI * 2;
      const fade = u < 0.12 ? u / 0.12 : u > 0.85 ? (1 - u) / 0.15 : 1;
      return {
        cx: cx + (r + radial) * Math.cos(angle),
        cy: cx + (r + radial) * Math.sin(angle),
        opacity: animated.value > 0.06 ? 0.55 * fade * alive.value : 0,
      };
    });
  const bubble1 = bubbleProps(0, -2.5);
  const bubble2 = bubbleProps(0.45, 2);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={tippen}
      style={{ width: size, height: size }}
    >
      {/* Der Ausbruch steht VOR dem Ring im Baum und liegt damit dahinter —
          die Teilchen kommen unter dem Bogen hervor (Vorbild Wolt) */}
      {bursts.map((id) => (
        <RingBurst key={id} trigger={id} onDone={() => burstFertig(id)} />
      ))}
      <Animated.View style={druckStil}>
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
        {/* Matte Glasrinne mit zarten Kanten */}
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.66)" strokeWidth={STROKE} />
        <Circle cx={size / 2} cy={size / 2} r={r + STROKE / 2} fill="none" stroke="rgba(28,28,33,0.045)" strokeWidth={1} />
        <Circle cx={size / 2} cy={size / 2} r={r - STROKE / 2} fill="none" stroke="rgba(28,28,33,0.045)" strokeWidth={1} />
        {/* Durchscheinende Rose-Fluessigkeit */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#ringGradient)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={c}
          opacity={0.82}
          animatedProps={arcProps}
        />
        {/* Blaeschen treiben durch die Fluessigkeit */}
        <AnimatedCircle r={1.7} fill="rgba(255,255,255,0.9)" animatedProps={bubble1} />
        <AnimatedCircle r={1.2} fill="rgba(255,255,255,0.9)" animatedProps={bubble2} />
        {/* Pulsierender Leuchtpunkt an der Spitze */}
        <AnimatedCircle fill="rgba(255,255,255,0.95)" animatedProps={tipProps} />
      </Svg>
      {/* Zahl EXAKT im Ringzentrum (Beta 09.08.); das Label haengt absolut
          darunter und verschiebt die Zahl nicht mehr nach oben */}
      <View style={styles.center} pointerEvents="none">
        <AnimatedNumber value={value} from={0} style={[typography.displayNum, styles.number]} />
        <Text style={styles.label}>{label}</Text>
      </View>
      </Animated.View>
    </Pressable>
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
