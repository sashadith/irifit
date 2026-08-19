import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { AppState, Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

/**
 * Verhaltensanalyse (Sascha 16.08., Punkt 15).
 *
 * Zaehlt, was die App sonst vergisst: welcher Screen wird geoeffnet, wo bricht
 * das Onboarding ab, wird die Paywall gesehen aber nicht gekauft, welche Suche
 * findet nichts. Alles andere — Mahlzeiten, Gewichte, Lektionen — steht schon
 * in den Fachtabellen und wird dort ausgewertet, nicht hier doppelt erhoben.
 *
 * Drei Regeln, die dieses Modul nie brechen darf:
 *
 *   1. Kein Inhalt. Keine Mahlzeit, kein Gewicht, kein Freitext. Die einzige
 *      Ausnahme ist der Suchbegriff bei einer erfolglosen Lebensmittelsuche —
 *      genau der sagt uns, was in der Datenbank fehlt.
 *   2. Nie stoeren. Kein await im Aufrufer, kein throw, kein Ladebalken. Faellt
 *      das Netz aus, bleibt die Warteschlange liegen und geht spaeter raus.
 *   3. Widerspruch gilt sofort. Steht der Schalter in Profil > Datenschutz auf
 *      aus, wird nichts mehr gesammelt und die Warteschlange verworfen.
 *
 * Warum eine Warteschlange in AsyncStorage und nicht ein Insert pro Ereignis:
 * Ein Screen-Wechsel darf keine Netzanfrage kosten, und Ereignisse aus dem
 * Onboarding entstehen, bevor es ein Konto gibt. Sie warten, bis die Nutzerin
 * sich anmeldet, und gehen dann mit ihrer ID raus. Wer das Onboarding vor der
 * Kontoanlage abbricht, taucht damit nicht auf — dafuer braeuchten wir einen
 * oeffentlich beschreibbaren Endpunkt, und den wollen wir nicht.
 */

export type EventName =
  | 'screen_view'
  | 'onboarding_step'
  | 'paywall_view'
  | 'paywall_plan_selected'
  | 'paywall_purchase_result'
  | 'paywall_voucher_result'
  | 'scan_started'
  | 'scan_result'
  | 'scan_saved'
  | 'search_no_hit'
  | 'recipe_open'
  | 'lesson_start'
  | 'training_start'
  | 'app_error';

type Props = Record<string, string | number | boolean | null>;

interface QueuedEvent {
  name: EventName;
  props: Props;
  platform: string;
  app_version: string | null;
  created_at: string;
}

const QUEUE_KEY = 'iri.analyticsQueue';
export const OPT_OUT_KEY = 'iri.analyticsOptOut';

/** Nach so vielen Ereignissen wird sofort gesendet, sonst nach FLUSH_DELAY. */
const MAX_QUEUE = 40;
const FLUSH_DELAY = 8000;
/* Reissleine: Liegt die Warteschlange bei fehlendem Netz voll, werden die
   aeltesten Ereignisse verworfen statt den Speicher zu fluten. */
const HARD_LIMIT = 300;

const appVersion = Constants.expoConfig?.version ?? null;

let queue: QueuedEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let optOut = false;
let bereit = false;
let sending = false;

/** Einmal beim ersten track() nachladen: Widerspruch und liegengebliebene Zeilen. */
async function init(): Promise<void> {
  if (bereit) return;
  bereit = true;
  const [flag, raw] = await Promise.all([
    AsyncStorage.getItem(OPT_OUT_KEY).catch(() => null),
    AsyncStorage.getItem(QUEUE_KEY).catch(() => null),
  ]);
  optOut = flag === '1';
  if (optOut) {
    await AsyncStorage.removeItem(QUEUE_KEY).catch(() => {});
    return;
  }
  if (raw) {
    try {
      const gespeichert = JSON.parse(raw) as QueuedEvent[];
      if (Array.isArray(gespeichert)) queue = [...gespeichert, ...queue];
    } catch {
      await AsyncStorage.removeItem(QUEUE_KEY).catch(() => {});
    }
  }
}

async function persist(): Promise<void> {
  if (queue.length === 0) {
    await AsyncStorage.removeItem(QUEUE_KEY).catch(() => {});
    return;
  }
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue)).catch(() => {});
}

/**
 * Ereignis vormerken. Gibt sofort zurueck; der Versand passiert gebuendelt.
 * Wirft nie — ein Fehler in der Statistik darf die App nicht anhalten.
 */
export function track(name: EventName, props: Props = {}): void {
  void (async () => {
    try {
      await init();
      if (optOut) return;
      queue.push({
        name,
        props,
        platform: Platform.OS,
        app_version: appVersion,
        created_at: new Date().toISOString(),
      });
      if (queue.length > HARD_LIMIT) queue = queue.slice(-HARD_LIMIT);
      await persist();
      if (queue.length >= MAX_QUEUE) {
        await flush();
      } else if (!timer) {
        timer = setTimeout(() => {
          timer = null;
          void flush();
        }, FLUSH_DELAY);
      }
    } catch {
      /* Statistik schweigt bei Fehlern */
    }
  })();
}

/**
 * Warteschlange abschicken. Die Nutzer-ID kommt beim Versand aus dem Supabase-
 * Client, nicht aus dem React-Zustand — genauso wie in AuthProvider, und aus
 * demselben Grund: nach dem Login steht sie dort sofort, im Zustand erst nach
 * dem naechsten Render.
 */
export async function flush(): Promise<void> {
  if (sending || optOut) return;
  await init();
  if (queue.length === 0) return;

  const { data } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
  const userId = data.session?.user.id;
  // Noch kein Konto: liegen lassen. RLS wuerde die Zeilen ohnehin abweisen.
  if (!userId) return;

  sending = true;
  const gesendet = queue.slice(0, MAX_QUEUE);
  try {
    const { error } = await supabase
      .from('app_events')
      .insert(gesendet.map((e) => ({ ...e, user_id: userId })));
    if (!error) {
      queue = queue.slice(gesendet.length);
      await persist();
    }
    // Bei Fehler bleibt alles stehen und geht beim naechsten Versuch mit raus.
  } catch {
    /* Netz weg — nichts zu tun */
  } finally {
    sending = false;
  }
}

/**
 * Widerspruch setzen (Profil > Datenschutz). Beim Abschalten wird die
 * Warteschlange verworfen: Was die Nutzerin nicht mehr senden will, soll auch
 * nicht auf ihrem Geraet auf eine Gelegenheit warten.
 */
export async function setAnalyticsOptOut(aus: boolean): Promise<void> {
  optOut = aus;
  bereit = true;
  await AsyncStorage.setItem(OPT_OUT_KEY, aus ? '1' : '0').catch(() => {});
  if (aus) {
    queue = [];
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    await AsyncStorage.removeItem(QUEUE_KEY).catch(() => {});
  }
}

/** Beim Start aus dem Profil spiegeln, damit der Schalter geraeteuebergreifend gilt. */
export async function syncAnalyticsOptOut(ausProfil: boolean): Promise<void> {
  const lokal = (await AsyncStorage.getItem(OPT_OUT_KEY).catch(() => null)) === '1';
  if (lokal !== ausProfil) await setAnalyticsOptOut(ausProfil);
}

// Beim Wechsel in den Hintergrund alles rausschicken: Danach kann der Prozess
// jederzeit beendet werden, und die Warteschlange wuerde erst beim naechsten
// Start wieder anlaufen.
AppState.addEventListener('change', (state) => {
  if (state !== 'active') void flush();
});
