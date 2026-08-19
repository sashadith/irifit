import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';

import { t } from '@/i18n';

/**
 * 10.000 Schritte gefeiert (Sascha 16.08.).
 *
 * Warum lokal und nicht über den Push-Verteiler: Die Schritte kommen aus Apple
 * Health und liegen ausschliesslich auf dem Geraet — der Server kennt sie
 * nicht. Ein Push vom Cron waere also blind. Also meldet das Geraet selbst,
 * sobald es die Zahl beim Oeffnen der App sieht.
 *
 * Einmal pro Tag: Der Tag wird gemerkt, sonst gratuliert die App bei jedem
 * Wechsel auf die Startseite erneut.
 */
export const STEP_GOAL = 10_000;

const KEY = 'iri.stepGoalCelebrated';

/** Hat die Nutzerin heute schon ihre Gratulation bekommen? */
async function bereitsGefeiert(heute: string): Promise<boolean> {
  return (await AsyncStorage.getItem(KEY)) === heute;
}

/**
 * Prueft die Schrittzahl und feiert genau einmal am Tag.
 * Gibt zurueck, ob gefeiert wurde — der Aufrufer muss nichts weiter tun.
 */
export async function celebrateStepGoal(steps: number | null): Promise<boolean> {
  if (steps === null || steps < STEP_GOAL) return false;

  const heute = new Date().toISOString().slice(0, 10);
  if (await bereitsGefeiert(heute)) return false;
  await AsyncStorage.setItem(KEY, heute);

  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  // Sofort zustellen statt planen: Liegt die App im Hintergrund, erscheint es
  // als Mitteilung; ist sie offen, zeigt der Handler in push.ts sie oben an.
  await Notifications.scheduleNotificationAsync({
    content: {
      title: t('home.stepGoalTitle'),
      body: t('home.stepGoalBody', { steps: steps.toLocaleString('de-DE') }),
    },
    trigger: null,
  }).catch(() => {});

  return true;
}
