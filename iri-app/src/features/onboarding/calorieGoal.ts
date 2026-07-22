/**
 * Kalorienziel + Makros aus den Onboarding-Antworten (Konzept 5.1, Schritt 6).
 *
 * Grundumsatz: Mifflin-St-Jeor. Die Zielgruppe ist zu >90 % weiblich; das
 * Onboarding fragt kein Geschlecht ab (bewusst, kein Diät-Fragebogen-Gefühl),
 * daher wird mit der weiblichen Konstante (−161) gerechnet.
 *
 * Aktivitätsfaktoren (Alltag ohne Training): low 1,2 · medium 1,375 · high 1,55.
 * Ziel-Anpassung: Abnehmen −20 % (moderat, „ohne zu hungern") · Halten ±0 ·
 * Fitter werden ±0 (Fokus liegt auf Protein, nicht auf Defizit).
 *
 * Produktentscheidung (FIX): Untergrenze 1.200 kcal.
 * Makro-Verteilung wie im eingefrorenen Prototyp: Protein 23 % · Fett 30 % · Carbs 47 %.
 */
import type { activityLevels, goals } from './options';

export type Goal = (typeof goals)[number];
export type ActivityLevel = (typeof activityLevels)[number];

export const KCAL_FLOOR = 1200;

export interface TargetInput {
  readonly goal: Goal;
  readonly birthYear: number;
  readonly heightCm: number;
  readonly weightKg: number;
  readonly activity: ActivityLevel;
}

export interface Targets {
  readonly kcal: number;
  readonly proteinG: number;
  readonly carbsG: number;
  readonly fatG: number;
}

const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  low: 1.2,
  medium: 1.375,
  high: 1.55,
};

const GOAL_FACTOR: Record<Goal, number> = {
  lose_weight: 0.8,
  maintain: 1,
  get_fit: 1,
};

const roundTo = (value: number, step: number) => Math.round(value / step) * step;

export function calcTargets(input: TargetInput, now: Date = new Date()): Targets {
  const age = now.getFullYear() - input.birthYear;
  const bmr = 10 * input.weightKg + 6.25 * input.heightCm - 5 * age - 161;
  const tdee = bmr * ACTIVITY_FACTOR[input.activity];
  const kcal = Math.max(KCAL_FLOOR, roundTo(tdee * GOAL_FACTOR[input.goal], 10));

  return {
    kcal,
    proteinG: roundTo((kcal * 0.23) / 4, 5),
    carbsG: roundTo((kcal * 0.47) / 4, 5),
    fatG: roundTo((kcal * 0.3) / 9, 5),
  };
}
