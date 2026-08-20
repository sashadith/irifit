import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { RoseHeart } from '@/components/ui/RoseHeart';
import { font } from '@/theme';

/**
 * Tipp-Ausbruch hinter dem Kalorienring (Sascha 20.08., Vorbild Wolt).
 *
 * Gemischt: ein paar „kcal", ein paar Herzen. Beide fliegen radial nach aussen,
 * WACHSEN dabei zum Rand hin und drehen sich. Die Farben wuerfelt jeder Tipp
 * neu, damit sich zwei Beruehrungen nie gleich anfuehlen.
 *
 * Warum das die Leistung nicht frisst (siehe Waermestau 18.08.): EINE Zeitachse
 * fuer alle Teilchen, 1,1 s lang, danach raeumt sich die Ansicht selbst ab.
 * Nur transform und opacity — der Weichzeichner der Karte muss nichts neu
 * berechnen, was er nicht ohnehin tut.
 */

/** Zweimal aufgestockt (Sascha 20.08.): 14 → 21 → 32. Der erste Ausbruch war
    zu duenn, man sah eher einzelne Zeichen als eine Wolke. */
const COUNT = 32;
const DURATION = 1100;

/** Marken-Rose plus warme Nachbartoene — kein Signalrot, kein Giftgruen */
const FARBEN = [
  '#E87F9C', '#D25578', '#F2A65A', '#E8B45C',
  '#C77DBB', '#8A7B8E', '#4CAF7D', '#5AC8DE',
];

function zufall(i: number, saat: number, salz: number): number {
  const x = Math.sin(i * 12.9898 + saat * 78.233 + salz * 43.758) * 43758.5453;
  return x - Math.floor(x);
}

interface Teilchen {
  istHerz: boolean;
  farbe: string;
  winkel: number;
  weite: number;
  drehung: number;
  endGroesse: number;
  verzoegerung: number;
}

function baueTeilchen(saat: number): Teilchen[] {
  return Array.from({ length: COUNT }, (_, i) => {
    // Gleichmaessig im Kreis verteilt, mit leichtem Versatz — sonst sieht es
    // aus wie ein Zahnrad statt wie ein Ausbruch
    const grund = (i / COUNT) * Math.PI * 2;
    return {
      istHerz: i % 2 === 0,
      farbe: FARBEN[Math.floor(zufall(i, saat, 1) * FARBEN.length)],
      winkel: grund + (zufall(i, saat, 2) - 0.5) * 0.5,
      weite: 130 + zufall(i, saat, 3) * 70,
      drehung: (zufall(i, saat, 4) - 0.5) * 540,
      // Nach aussen groesser (Saschas Wunsch): Startgroesse ist 0,35
      endGroesse: 1.25 + zufall(i, saat, 5) * 0.55,
      verzoegerung: zufall(i, saat, 6) * 0.12,
    };
  });
}

export interface RingBurstProps {
  /** Zaehlt hoch bei jedem Tipp — jeder neue Wert startet einen Ausbruch */
  readonly trigger: number;
  readonly onDone?: () => void;
}

export function RingBurst({ trigger, onDone }: RingBurstProps) {
  const progress = useSharedValue(0);
  const teilchen = useMemo(() => baueTeilchen(trigger), [trigger]);

  /* onDone in einer Box statt in den Abhaengigkeiten (Sascha 20.08.).
     Der Aufrufer gibt bei jedem Tipp eine NEUE Funktion herein — steht die in
     den Abhaengigkeiten, laeuft der Effekt erneut und setzt progress auf 0
     zurueck. Folge: Ein neuer Tipp hat alle noch laufenden Wellen mit
     zurueckgerissen, statt sich darueberzulegen. Genau der Fehler, den Sascha
     gesehen hat. Jetzt startet jede Welle genau einmal und laeuft unbeirrt zu
     Ende, egal wie oft daneben getippt wird. */
  const fertigRef = useRef(onDone);
  fertigRef.current = onDone;

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(
      1,
      { duration: DURATION, easing: Easing.out(Easing.quad) },
      (fertig) => {
        if (fertig) runOnJS(melden)();
      },
    );
    function melden() {
      fertigRef.current?.();
    }
    // Bewusst NUR trigger: siehe Kommentar oben
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  return (
    <View style={styles.layer} pointerEvents="none">
      {teilchen.map((p, i) => (
        <Stueck key={`${trigger}-${i}`} p={p} progress={progress} />
      ))}
    </View>
  );
}

function Stueck({ p, progress }: { p: Teilchen; progress: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const t = Math.min(1, Math.max(0, (progress.value - p.verzoegerung) / (1 - p.verzoegerung)));
    if (t <= 0) return { opacity: 0 };

    const strecke = p.weite * t;
    return {
      opacity: t > 0.6 ? interpolate(t, [0.6, 1], [1, 0]) : interpolate(t, [0, 0.15], [0, 1], 'clamp'),
      transform: [
        { translateX: Math.cos(p.winkel) * strecke },
        { translateY: Math.sin(p.winkel) * strecke },
        { rotate: `${p.drehung * t}deg` },
        { scale: interpolate(t, [0, 1], [0.35, p.endGroesse]) },
      ],
    };
  });

  return (
    <Animated.View style={[styles.stueck, style]}>
      {p.istHerz ? (
        <RoseHeart size={18} color={p.farbe} />
      ) : (
        <Text style={[styles.kcal, { color: p.farbe }]}>kcal</Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  /* Mittig ueber dem Ring, aber HINTER ihm (zIndex bleibt 0, der Ring liegt
     spaeter im Baum) — die Teilchen kommen dadurch unter dem Bogen hervor */
  layer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stueck: {
    position: 'absolute',
  },
  kcal: {
    fontFamily: font.bold,
    fontSize: 13,
    letterSpacing: 0.3,
  },
});
