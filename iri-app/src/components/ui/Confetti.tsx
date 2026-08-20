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
  /** Startgeschwindigkeit der Explosion, in Punkte pro Zeiteinheit */
  vx: number;
  vy: number;
  /** Schwerkraft — zieht das Teilchen nach dem Ausbruch nach unten */
  g: number;
  breite: number;
  laenge: number;
  radius: number;
  drehung: number;
  verzoegerung: number;
  wackel: number;
}

/**
 * ECHTE EXPLOSION statt Regen (Sascha 20.08.).
 *
 * Die erste Fassung schoss die Teilchen bis zu 440 Punkte nach oben — also
 * weit ueber den Bildschirmrand — und liess sie danach fallen. Von unten sah
 * das aus, als regne es vom oberen Rand herein, statt hinter dem Chip
 * herauszubrechen.
 *
 * Jetzt: Jedes Teilchen bekommt einen Winkel im VOLLEN Kreis und eine
 * Geschwindigkeit; es fliegt schnell los und wird langsamer (das ist der
 * Knall), waehrend die Schwerkraft es zunehmend nach unten zieht. Die
 * Geschwindigkeiten sind so gewaehlt, dass der hoechste Punkt knapp unter dem
 * Bildschirmrand liegt — der Ausbruch bleibt sichtbar.
 */
function baueTeilchen(saat: number, ursprungY: number): Teilchen[] {
  return Array.from({ length: COUNT }, (_, i) => {
    const form = i % 3; // 0 = Rechteck, 1 = Streifen, 2 = Kreis
    const winkel = (i / COUNT) * Math.PI * 2 + (zufall(i, saat, 1) - 0.5) * 0.7;
    const tempo = 150 + zufall(i, saat, 2) * 260;
    return {
      farbe: FARBEN[i % FARBEN.length],
      vx: Math.cos(winkel) * tempo * 1.35, // waagerecht weiter als senkrecht
      // Nach oben gedeckelt, damit nichts oben hinausschiesst
      vy: Math.sin(winkel) * Math.min(tempo, ursprungY - 40),
      g: SCREEN_H - ursprungY + 220 + zufall(i, saat, 3) * 260,
      breite: form === 2 ? 9 : form === 1 ? 4 : 12,
      laenge: form === 2 ? 9 : form === 1 ? 16 : 9,
      radius: form === 2 ? 5 : 1.5,
      drehung: (zufall(i, saat, 4) - 0.5) * 1440,
      // Kurzer Versatz: Der Knall soll knallen, nicht tropfen
      verzoegerung: zufall(i, saat, 5) * 0.06,
      wackel: (zufall(i, saat, 6) - 0.5) * 50,
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

    // Ausbruch: schnell los, dann gebremst — das ist der Knall
    const wurf = 1 - (1 - t) * (1 - t);

    const x = p.vx * wurf + Math.sin(t * 9) * p.wackel;
    // Schwerkraft holt sie ein und traegt sie unten aus dem Bild
    const y = p.vy * wurf + p.g * t * t;

    return {
      opacity: t > 0.82 ? interpolate(t, [0.82, 1], [1, 0]) : 1,
      transform: [
        { translateX: x },
        { translateY: y },
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
