import { useEffect, useMemo } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

/**
 * Konfetti-Ausbruch nach dem Vorbild von iMessage („Send with confetti",
 * Sascha 20.08.).
 *
 * Apples Effekt selbst ist NICHT zugaenglich — er laeuft ueber eine private
 * Schnittstelle, die keine App benutzen darf. Also nachgebaut, mit derselben
 * Mischung: Rechtecke, schmale Streifen und Kreise in kraeftigen Farben, die
 * aus einem Punkt herausschiessen, auseinanderdriften und dann fallen.
 *
 * WARUM DAS TROTZ DER WAERME-GESCHICHTE VOM 18.08. VERTRETBAR IST:
 * Der Waermestau kam von ENDLOS laufenden Animationen ueber Weichzeichnern —
 * die bauten den Blur-Stapel in jedem Bild neu auf, dauerhaft. Das hier ist
 * ein einmaliger Ausbruch von 2,6 s, der sich danach selbst abraeumt und
 * nichts mehr kostet. Ausserdem:
 *
 *   - EINE einzige Zeitachse (progress) treibt alle Teilchen. Nicht 90 Timer,
 *     sondern einer; jedes Teilchen rechnet seine Bahn daraus im Worklet.
 *   - Nur transform und opacity — keine Layout-Aenderung, kein SVG-Neubau,
 *     nichts, was den Blur zur Neuberechnung zwingt.
 *   - pointerEvents="none": faengt keine Beruehrungen ab.
 */

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const COUNT = 90;
const DURATION = 2600;

/** iMessage-Palette: kraeftig und bunt, bewusst nicht im Marken-Rose */
const FARBEN = [
  '#FF3B5C', '#FF9F0A', '#FFD60A', '#32D74B',
  '#0A84FF', '#5E5CE6', '#BF5AF2', '#FF7AB8',
];

/** Deterministischer Zufall: gleicher Index + Saat = gleiche Bahn */
function zufall(i: number, saat: number, salz: number): number {
  const x = Math.sin(i * 12.9898 + saat * 78.233 + salz * 43.758) * 43758.5453;
  return x - Math.floor(x);
}

interface Teilchen {
  farbe: string;
  /** Wohin es fliegt (Bildschirmpunkte, relativ zum Ursprung) */
  zielX: number;
  hoehe: number;
  fall: number;
  breite: number;
  laenge: number;
  radius: number;
  drehung: number;
  verzoegerung: number;
  wackel: number;
}

function baueTeilchen(saat: number, ursprungY: number): Teilchen[] {
  return Array.from({ length: COUNT }, (_, i) => {
    const form = i % 3; // 0 = Rechteck, 1 = Streifen, 2 = Kreis
    const breite = form === 2 ? 9 : form === 1 ? 4 : 12;
    const laenge = form === 2 ? 9 : form === 1 ? 16 : 9;
    return {
      farbe: FARBEN[i % FARBEN.length],
      // Ueber die volle Breite streuen, aber zur Mitte hin dichter
      zielX: (zufall(i, saat, 1) - 0.5) * SCREEN_W * 1.5,
      // Aufstieg: manche schiessen hoch, manche kaum
      hoehe: 120 + zufall(i, saat, 2) * 320,
      // Fall bis unter den Bildschirmrand
      fall: SCREEN_H - ursprungY + 160 + zufall(i, saat, 3) * 200,
      breite,
      laenge,
      radius: form === 2 ? 5 : 1.5,
      drehung: (zufall(i, saat, 4) - 0.5) * 1440,
      verzoegerung: zufall(i, saat, 5) * 0.18,
      wackel: (zufall(i, saat, 6) - 0.5) * 60,
    };
  });
}

export interface ConfettiProps {
  /** Startpunkt des Ausbruchs in Bildschirmpunkten */
  readonly originX: number;
  readonly originY: number;
  /** Wird gerufen, wenn alles durch ist — der Aufrufer haengt die Ansicht dann aus */
  readonly onDone?: () => void;
}

export function Confetti({ originX, originY, onDone }: ConfettiProps) {
  const progress = useSharedValue(0);
  // Saat einmal pro Ausbruch: zwei Feiern sehen nicht identisch aus
  const saat = useMemo(() => Math.floor(Math.random() * 1000), []);
  const teilchen = useMemo(() => baueTeilchen(saat, originY), [saat, originY]);

  useEffect(() => {
    progress.value = withTiming(
      1,
      { duration: DURATION, easing: Easing.linear },
      (fertig) => {
        if (fertig && onDone) runOnJS(onDone)();
      },
    );
  }, [progress, onDone]);

  return (
    <View style={styles.layer} pointerEvents="none">
      {teilchen.map((p, i) => (
        <Stueck key={i} p={p} progress={progress} originX={originX} originY={originY} />
      ))}
    </View>
  );
}

function Stueck({
  p,
  progress,
  originX,
  originY,
}: {
  p: Teilchen;
  progress: SharedValue<number>;
  originX: number;
  originY: number;
}) {
  const style = useAnimatedStyle(() => {
    // Eigene Zeitachse je Teilchen — der Ausbruch startet leicht versetzt
    const t = Math.min(1, Math.max(0, (progress.value - p.verzoegerung) / (1 - p.verzoegerung)));
    if (t <= 0) return { opacity: 0 };

    // Waagerecht: gleichmaessig nach aussen, mit leichtem Wackeln
    const x = p.zielX * t + Math.sin(t * 9) * p.wackel;

    // Senkrecht: erst hoch (schnell, gebremst), dann fallen (beschleunigt) —
    // dieselbe Kurve wie ein geworfener Gegenstand
    const auf = interpolate(Math.min(t / 0.35, 1), [0, 1], [0, -p.hoehe]);
    const ab = t > 0.35 ? Math.pow((t - 0.35) / 0.65, 2) * p.fall : 0;

    return {
      opacity: t > 0.82 ? interpolate(t, [0.82, 1], [1, 0]) : 1,
      transform: [
        { translateX: x },
        { translateY: auf + ab },
        { rotate: `${p.drehung * t}deg` },
        // Zweite Achse: laesst die Plaettchen kippen statt nur zu kreiseln
        { scaleX: Math.cos(t * 12 + p.wackel) },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.stueck,
        {
          left: originX,
          top: originY,
          width: p.breite,
          height: p.laenge,
          borderRadius: p.radius,
          backgroundColor: p.farbe,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  stueck: {
    position: 'absolute',
  },
});
