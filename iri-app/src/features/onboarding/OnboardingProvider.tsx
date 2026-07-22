import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useContext, useMemo, useState } from 'react';

import type { ActivityLevel, Goal } from './calorieGoal';
import type { Allergen, DietPreference } from './options';

/**
 * Antworten des 7-Schritte-Quiz. Sie werden VOR der Account-Erstellung gesammelt
 * und zusätzlich in AsyncStorage gespiegelt, damit das Profil auch dann noch
 * angelegt werden kann, wenn zwischen Registrierung und erstem Login eine
 * E-Mail-Bestätigung liegt.
 */
export interface OnboardingAnswers {
  displayName?: string;
  goal?: Goal;
  birthYear?: number;
  heightCm?: number;
  weightKg?: number;
  targetWeightKg?: number;
  activity?: ActivityLevel;
  dietPreference?: DietPreference;
  allergies?: Allergen[];
  /** Zeitpunkt der expliziten Art.-9-Einwilligung (Gesundheitsdaten) */
  healthConsentAt?: string;
}

export const PENDING_ANSWERS_KEY = 'iri.pendingOnboardingAnswers';

interface OnboardingContextValue {
  answers: OnboardingAnswers;
  update: (patch: Partial<OnboardingAnswers>) => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: PropsWithChildren) {
  const [answers, setAnswers] = useState<OnboardingAnswers>({});

  const value = useMemo<OnboardingContextValue>(
    () => ({
      answers,
      update: (patch) => {
        setAnswers((prev) => {
          const next = { ...prev, ...patch };
          AsyncStorage.setItem(PENDING_ANSWERS_KEY, JSON.stringify(next)).catch(() => {});
          return next;
        });
      },
    }),
    [answers],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding außerhalb des OnboardingProvider');
  return ctx;
}
