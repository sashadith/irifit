import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';

import { track } from '@/features/analytics/track';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Ein Screen zaehlt erst, wenn er so lange stehen bleibt. Weiterleitungen
 * huschen darunter durch und werden gar nicht gezaehlt.
 */
const VERWEILDAUER = 1200;

/** Derselbe Screen innerhalb dieser Zeit gilt als derselbe Aufruf. */
const WIEDERHOLSPERRE = 30_000;

/**
 * Aus "/recipe/32" wird "/recipe/[id]".
 *
 * Zwei Gruende: Sonst haette die Auswertung 150 Zeilen fuer 150 Rezepte statt
 * einer fuer den Rezeptschirm, und der Screen-Aufruf wuerde verraten, welches
 * Rezept sich wer angesehen hat. Welche Rezepte gut laufen, messen wir
 * getrennt und absichtlich ueber recipe_open.
 */
export function normalizeScreen(pathname: string): string {
  const teile = pathname.split('/').map((teil) => {
    if (teil === '') return teil;
    if (/^\d+$/.test(teil) || UUID.test(teil)) return '[id]';
    return teil;
  });
  return teile.join('/') || '/';
}

/**
 * Zaehlt Screen-Aufrufe. Einmal im Wurzel-Layout aufgerufen, deckt es jeden
 * Screen ab — nichts muss pro Bildschirm nachgetragen werden, und damit kann
 * auch keiner vergessen werden.
 *
 * Zwei Filter, beide aus dem Testlauf im Simulator am 17.08.:
 *
 *   1. Wartezeit. Beim Start stand "/" fuer 0,2 s im Pfad, bevor der Guard auf
 *      /welcome umleitete — als Aufruf der Startseite gezaehlt, obwohl niemand
 *      sie gesehen hat. Ein Screen, der nach 200 ms wieder weg ist, war kein
 *      Aufruf.
 *   2. Wiederholsperre. /login lag fuenfmal in 16 Sekunden in der
 *      Warteschlange: Der Pfad flatterte waehrend der Anmeldung hin und her,
 *      und ein reiner Vergleich mit dem letzten Wert laesst jedes
 *      Zurueckflattern erneut durch. Jetzt zaehlt derselbe Screen erst nach
 *      einer halben Minute wieder.
 */
export function useScreenTracking(): void {
  const pathname = usePathname();
  const letzter = useRef<{ screen: string; zeit: number } | null>(null);

  useEffect(() => {
    const screen = normalizeScreen(pathname);
    const timer = setTimeout(() => {
      const jetzt = Date.now();
      const vorher = letzter.current;
      if (vorher && vorher.screen === screen && jetzt - vorher.zeit < WIEDERHOLSPERRE) return;
      letzter.current = { screen, zeit: jetzt };
      track('screen_view', { screen });
    }, VERWEILDAUER);
    return () => clearTimeout(timer);
  }, [pathname]);
}

/**
 * Der Zaehler als eigene, leere Komponente. Wuerde der Hook direkt im
 * Wurzel-Layout stehen, wuerde jeder Screen-Wechsel den ganzen Stack neu
 * rendern — so bleibt das Neurendern in diesem Nichts.
 */
export function ScreenTracker(): null {
  useScreenTracking();
  return null;
}
