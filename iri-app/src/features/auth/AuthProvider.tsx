import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { fetchMyLegacyAccess, LegacyAccess } from '@/features/auth/legacy';
import { calcTargets } from '@/features/onboarding/calorieGoal';
import {
  OnboardingAnswers,
  PENDING_ANSWERS_KEY,
} from '@/features/onboarding/OnboardingProvider';
import { supabase } from '@/lib/supabase';

export interface Profile {
  id: string;
  display_name: string | null;
  kcal_goal: number | null;
  protein_goal_g: number | null;
  carbs_goal_g: number | null;
  fat_goal_g: number | null;
  water_goal_ml: number;
  water_glass_ml: number;
  streak_count: number;
  streak_longest: number;
  allergies: string[];
  diet_preference: string | null;
  birth_year: number | null;
  start_weight_kg: number | null;
  target_weight_kg: number | null;
  onboarding_completed_at: string | null;
  timezone: string;
  push_broadcast: boolean;
  push_streak: boolean;
  push_meal_evening: boolean;
  push_water: boolean;
  push_weekly: boolean;
  reminder_evening_time: string | null;
}

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  /** Beanspruchter Digistore24-Kauf (null = keine Legacy-Kundin) */
  legacy: LegacyAccess | null;
  /** true bis Session UND Profil initial geladen sind */
  loading: boolean;
  refreshProfile: () => Promise<void>;
  refreshLegacy: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const PROFILE_COLUMNS =
  'id, display_name, kcal_goal, protein_goal_g, carbs_goal_g, fat_goal_g, water_goal_ml, water_glass_ml, streak_count, streak_longest, allergies, diet_preference, birth_year, start_weight_kg, target_weight_kg, onboarding_completed_at, timezone, push_broadcast, push_streak, push_meal_evening, push_water, push_weekly, reminder_evening_time';

/** Profilzeile anlegen, falls sie fehlt — aus den lokal gespiegelten Quiz-Antworten */
async function ensureProfile(userId: string): Promise<Profile | null> {
  const { data: existing, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  if (existing) return existing;

  const raw = await AsyncStorage.getItem(PENDING_ANSWERS_KEY);
  const a: OnboardingAnswers = raw ? JSON.parse(raw) : {};
  const targets =
    a.goal && a.birthYear && a.heightCm && a.weightKg && a.activity
      ? calcTargets({
          goal: a.goal,
          birthYear: a.birthYear,
          heightCm: a.heightCm,
          weightKg: a.weightKg,
          activity: a.activity,
        })
      : null;

  const { data: created, error: insertError } = await supabase
    .from('profiles')
    .insert({
      id: userId,
      display_name: a.displayName?.trim() || null,
      goal: a.goal ?? null,
      birth_year: a.birthYear ?? null,
      height_cm: a.heightCm ?? null,
      start_weight_kg: a.weightKg ?? null,
      target_weight_kg: a.targetWeightKg ?? null,
      activity_level: a.activity ?? null,
      diet_preference: a.dietPreference === 'none' ? null : (a.dietPreference ?? null),
      allergies: a.allergies ?? [],
      kcal_goal: targets?.kcal ?? null,
      protein_goal_g: targets?.proteinG ?? null,
      carbs_goal_g: targets?.carbsG ?? null,
      fat_goal_g: targets?.fatG ?? null,
      health_consent_at: a.healthConsentAt ?? null,
    })
    .select(PROFILE_COLUMNS)
    .single();
  if (insertError) throw insertError;
  return created;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [legacy, setLegacy] = useState<LegacyAccess | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) {
        setProfile(null);
        setLegacy(null);
        setLoading(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  /* Generationszaehler: Beim Legacy-Login laufen zwei Abfragen gegeneinander —
     dieser Effekt (startet, sobald die Sitzung im Zustand landet) und
     refreshLegacy() nach dem Anspruch. Ohne Zaehler kann die aeltere, noch
     leere Antwort die juengere ueberschreiben. Es gewinnt immer die letzte. */
  const legacyGen = useRef(0);
  const ladeLegacy = useCallback(async (userId: string) => {
    const gen = ++legacyGen.current;
    const l = await fetchMyLegacyAccess(userId).catch(() => null);
    if (gen === legacyGen.current) setLegacy(l);
  }, []);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    Promise.all([
      ensureProfile(session.user.id),
      ladeLegacy(session.user.id),
    ])
      .then(([p]) => {
        if (cancelled) return;
        setProfile(p);
      })
      .catch((e) => console.warn('Profil laden fehlgeschlagen', e))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.user.id]);

  /**
   * Beide Auffrischer holen die Nutzer-ID vom Supabase-Client statt aus dem
   * React-Zustand. Grund (Sascha 16.08., Legacy-Login getestet): Nach
   * verifyOtp() steht die Sitzung sofort im Client, aber `session` hier erst
   * nach dem naechsten Render. Der Login-Screen rief refreshLegacy() aus einer
   * Closure auf, in der session noch null war — die Funktion stieg still aus,
   * `legacy` blieb null und /legacy warf die Kaeuferin zurueck auf den
   * Willkommensbildschirm, obwohl der Anspruch serverseitig laengst stand.
   * Leere Abhaengigkeitsliste: die Funktionen sind damit stabil und koennen
   * gar keine veraltete Sitzung mehr sehen.
   */
  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) return;
    setProfile(await ensureProfile(userId));
  }, []);

  const refreshLegacy = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) return;
    await ladeLegacy(userId);
  }, [ladeLegacy]);

  const completeOnboarding = useCallback(async () => {
    if (!session) return;
    // Sicherstellen, dass die Profilzeile existiert (Insert läuft ggf. noch parallel)
    await ensureProfile(session.user.id);
    // Quiz-Antworten nachziehen: Bei Legacy-Nutzerinnen entsteht die Profilzeile
    // schon beim Magic-Link-Login (leer) — das Quiz käme sonst nie im Profil an.
    const raw = await AsyncStorage.getItem(PENDING_ANSWERS_KEY);
    const a: OnboardingAnswers = raw ? JSON.parse(raw) : {};
    const targets =
      a.goal && a.birthYear && a.heightCm && a.weightKg && a.activity
        ? calcTargets({
            goal: a.goal,
            birthYear: a.birthYear,
            heightCm: a.heightCm,
            weightKg: a.weightKg,
            activity: a.activity,
          })
        : null;
    const answerUpdate = targets
      ? {
          display_name: a.displayName?.trim() || null,
          goal: a.goal,
          birth_year: a.birthYear,
          height_cm: a.heightCm,
          start_weight_kg: a.weightKg,
          target_weight_kg: a.targetWeightKg ?? null,
          activity_level: a.activity,
          diet_preference: a.dietPreference === 'none' ? null : (a.dietPreference ?? null),
          allergies: a.allergies ?? [],
          kcal_goal: targets.kcal,
          protein_goal_g: targets.proteinG,
          carbs_goal_g: targets.carbsG,
          fat_goal_g: targets.fatG,
          health_consent_at: a.healthConsentAt ?? null,
        }
      : {};
    const { data, error } = await supabase
      .from('profiles')
      .update({ ...answerUpdate, onboarding_completed_at: new Date().toISOString() })
      .eq('id', session.user.id)
      .select(PROFILE_COLUMNS)
      .single();
    if (error) throw error;
    setProfile(data);
    await AsyncStorage.removeItem(PENDING_ANSWERS_KEY);
  }, [session?.user.id]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({ session, profile, legacy, loading, refreshProfile, refreshLegacy, completeOnboarding, signOut }),
    [session, profile, legacy, loading, refreshProfile, refreshLegacy, completeOnboarding, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth außerhalb des AuthProvider');
  return ctx;
}
