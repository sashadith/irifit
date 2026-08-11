import { Platform } from 'react-native';

/**
 * Heutige Schritte aus Apple Health (Sascha 11.08.): Health buendelt iPhone,
 * Apple Watch, Smart-Ringe und Armbaender in EINER Quelle und dedupliziert
 * Doppelzaehlungen selbst. Verbrannte Kalorien lesen wir bewusst NICHT.
 *
 * Das native Modul steckt erst ab Build 13 im Binary — der Import ist deshalb
 * weich (try/require), damit aeltere Dev-Clients/Builds nicht crashen.
 * Android liefert null (Health Connect spaeter, im Plan notiert).
 */
type HealthKitModule = typeof import('@kingstinct/react-native-healthkit');

let healthkit: HealthKitModule | null = null;
if (Platform.OS === 'ios') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    healthkit = require('@kingstinct/react-native-healthkit') as HealthKitModule;
  } catch {
    healthkit = null;
  }
}

const STEP_TYPE = 'HKQuantityTypeIdentifierStepCount' as const;

/** Schritte von heute, oder null (kein iOS, kein Modul, keine Freigabe, keine Daten) */
export async function fetchTodaySteps(): Promise<number | null> {
  if (!healthkit) return null;
  try {
    const available = await healthkit.isHealthDataAvailableAsync();
    if (!available) return null;

    // Zeigt beim ersten Mal Apples Freigabe-Dialog; danach ein stiller No-op.
    await healthkit.requestAuthorization({ toRead: [STEP_TYPE] });

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const stats = await healthkit.queryStatisticsForQuantity(STEP_TYPE, ['cumulativeSum'], {
      filter: { date: { startDate: start, endDate: new Date() } },
      unit: 'count',
    });
    const steps = Math.round(stats.sumQuantity?.quantity ?? 0);
    // Wunsch Sascha: Chip nur zeigen, wenn wirklich Schrittdaten da sind
    return steps > 0 ? steps : null;
  } catch {
    return null;
  }
}
