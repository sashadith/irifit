import { MealSlot } from '@/features/diary/useDiaryDay';

/**
 * Vorausgewählte Mahlzeit nach Tageszeit — EINE Quelle für die ganze App
 * (Sascha 15.08.: „egal welcher Art").
 *
 * Bis dahin stand dieselbe Berechnung dreimal im Code (FoodSheet, Scan,
 * Rezept-Detail) und „Nochmal essen" hielt sich gar nicht daran: es buchte in
 * den Slot, in dem das Essen DAMALS lag — wer morgens eine Banane vom Vortag
 * nachtrug, fand sie beim Mittagessen wieder.
 *
 * Die Grenzen sind bewusst großzügig, weil niemand um Punkt 10 Uhr frühstückt:
 *   bis 10:30 Frühstück · bis 15:00 Mittagessen · bis 21:30 Abendessen · danach Snack
 * Die Vorauswahl ist nur ein Vorschlag — im Sheet lässt sie sich umschalten.
 */
export function slotForNow(now: Date = new Date()): MealSlot {
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes < 10.5 * 60) return 'breakfast';
  if (minutes < 15 * 60) return 'lunch';
  if (minutes < 21.5 * 60) return 'dinner';
  return 'snack';
}
