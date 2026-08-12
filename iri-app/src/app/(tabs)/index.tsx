import { useCallback, useEffect, useState } from 'react';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { DiaryHeader } from '@/components/diary/DiaryHeader';
import { LogDetailSheet } from '@/components/diary/LogDetailSheet';
import { MacroBars } from '@/components/diary/MacroBars';
import { MealSlotCard } from '@/components/diary/MealSlotCard';
import { ProgressCard } from '@/components/diary/ProgressCard';
import { WaterCard } from '@/components/diary/WaterCard';
import { GlassView } from '@/components/glass/GlassView';
import { IriIcon } from '@/components/icons/IriIcon';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { CalorieRing } from '@/components/ui/CalorieRing';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SattScoreDots } from '@/components/recipes/SattScoreDots';
import { useAuth } from '@/features/auth/AuthProvider';
import { FoodLog, MealSlot, toIsoDate, useDiaryDay } from '@/features/diary/useDiaryDay';
import { markPushOffered, registerForPush, shouldOfferPush } from '@/features/notifications/push';
import { fetchTodaySteps } from '@/features/health/steps';
import { playSound } from '@/features/sound/sounds';
import { updateStreak } from '@/features/progress/streak';
import { fetchRecipes, RecipeListItem } from '@/features/recipes/recipesData';
import { recipeSattScore } from '@/features/recipes/sattScore';
import { suggestRecipes } from '@/features/recipes/suggest';
import { t } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { colors, font, radius, spacing } from '@/theme';

const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export default function HomeScreen() {
  const router = useRouter();
  const { session, profile, refreshProfile } = useAuth();
  const diary = useDiaryDay();
  const [selectedLog, setSelectedLog] = useState<FoodLog | null>(null);
  const [latestWeight, setLatestWeight] = useState<number | null>(null);
  const [firstWeight, setFirstWeight] = useState<number | null>(null);
  const [recipes, setRecipes] = useState<RecipeListItem[]>([]);

  useEffect(() => {
    fetchRecipes().then(setRecipes).catch(() => {});
  }, []);

  // Push (S12): beim ersten Home-Besuch einmalig den System-Dialog anbieten,
  // danach bei jedem Start nur noch still Token + Zeitzone synchronisieren.
  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) return;
    shouldOfferPush().then((firstTime) => {
      if (firstTime) {
        markPushOffered();
        registerForPush(userId).catch(() => {});
      } else {
        registerForPush(userId, { silent: true }).catch(() => {});
      }
    });
  }, [session?.user.id]);

  const kcalGoal = profile?.kcal_goal ?? 1600;
  const remaining = Math.max(0, kcalGoal - diary.totals.kcal);
  const progress = kcalGoal > 0 ? Math.min(1, diary.totals.kcal / kcalGoal) : 0;

  const loadWeight = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase
      .from('weights')
      .select('weight_kg')
      .eq('user_id', session.user.id)
      .order('measured_on', { ascending: true });
    const rows = data ?? [];
    setFirstWeight(rows.length > 1 ? rows[0].weight_kg : null);
    setLatestWeight(rows.length > 0 ? rows[rows.length - 1].weight_kg : null);
  }, [session?.user.id]);

  useEffect(() => {
    loadWeight();
  }, [loadWeight]);

  // Schritte aus Apple Health (Sascha 11.08.) — Chip nur bei echten Daten.
  // Health haengt dem Live-Zaehler ein paar Minuten hinterher (Apple buendelt);
  // wir fragen bei Tab-Fokus UND bei Rueckkehr aus dem Hintergrund neu ab (12.08.).
  const [steps, setSteps] = useState<number | null>(null);
  useFocusEffect(
    useCallback(() => {
      fetchTodaySteps().then(setSteps);
    }, []),
  );
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') fetchTodaySteps().then(setSteps);
    });
    return () => sub.remove();
  }, []);

  // Nach Rückkehr aus dem Scan-Modal o. Ä. frische Daten zeigen
  // + Streak neu berechnen (milde Regel mit Joker, Session 7)
  useFocusEffect(
    useCallback(() => {
      diary.refresh();
      loadWeight();
      if (session) {
        updateStreak(session.user.id).then((changed) => {
          if (changed) {
            playSound('streak'); // Serie gewachsen — kleiner Moment der Freude
            refreshProfile().catch(() => {});
          }
        });
      }
    }, [diary.refresh, loadWeight, session?.user.id, refreshProfile]),
  );

  const greeting = profile?.display_name
    ? t('home.greetingName', { name: profile.display_name })
    : t('home.greeting');

  // Delta = seit der ERSTEN Wiegung (Beta-Befund 09.08.) — erst ab zwei
  // Messungen, sonst „Noch kein Verlauf"
  const deltaKg =
    latestWeight !== null && firstWeight !== null ? latestWeight - firstWeight : null;

  const showEmptyHint = !diary.loading && diary.isToday && diary.logs.length === 0;

  // „Was soll ich noch essen?" — Home-Karte am Abend (USP, Session 8)
  const remainingProtein = Math.max(0, (profile?.protein_goal_g ?? 0) - diary.totals.protein);
  const suggestions =
    diary.isToday && new Date().getHours() >= 15 && remaining >= 150 && recipes.length > 0
      ? suggestRecipes(recipes, {
          remainingKcal: remaining,
          remainingProteinG: remainingProtein,
          daySeed: toIsoDate(new Date()),
          count: 2,
        })
      : [];

  return (
    <ScreenScaffold>
      <DiaryHeader
        date={diary.date}
        isToday={diary.isToday}
        greeting={greeting}
        streakCount={profile?.streak_count ?? 0}
        onShiftDate={diary.shiftDate}
      />

      <GlassView style={styles.ringCard} contentStyle={styles.ringContent}>
        {steps !== null && diary.isToday ? (
          <View style={styles.stepsChip}>
            <IriIcon name="steps" size={15} color={colors.tintDeep} />
            <Text style={styles.stepsText}>{steps.toLocaleString('de-DE')}</Text>
          </View>
        ) : null}
        <CalorieRing value={remaining} label={t('home.remaining')} progress={1 - progress} />
        <Text style={styles.summary}>
          {t('home.summary', {
            eaten: diary.totals.kcal.toLocaleString('de-DE'),
            goal: kcalGoal.toLocaleString('de-DE'),
          })}
        </Text>
      </GlassView>

      <MacroBars
        protein={{ current: diary.totals.protein, goal: profile?.protein_goal_g ?? 95 }}
        carbs={{ current: diary.totals.carbs, goal: profile?.carbs_goal_g ?? 185 }}
        fat={{ current: diary.totals.fat, goal: profile?.fat_goal_g ?? 55 }}
      />

      <WaterCard
        currentMl={diary.waterMl}
        goalMl={profile?.water_goal_ml ?? 2000}
        glassMl={profile?.water_glass_ml ?? 250}
        onSetAmount={diary.setWater}
      />

      {suggestions.length > 0 ? (
        <GlassView style={styles.suggestCard} contentStyle={styles.suggestContent}>
          <Text style={styles.suggestTitle}>{t('recipes.suggestTitle')}</Text>
          <Text style={styles.suggestSubtitle}>
            {t('recipes.suggestSubtitle', { kcal: remaining.toLocaleString('de-DE') })}
          </Text>
          {suggestions.map((recipe) => (
            <Pressable
              key={recipe.id}
              accessibilityRole="button"
              accessibilityLabel={recipe.title}
              onPress={() => router.push(`/recipe/${recipe.id}`)}
              style={styles.suggestRow}
            >
              <View style={styles.suggestText}>
                <Text style={styles.suggestRecipe} numberOfLines={1}>
                  {recipe.title}
                </Text>
                <Text style={styles.suggestMeta}>{recipe.kcal_per_serving} kcal</Text>
              </View>
              <SattScoreDots score={recipeSattScore(recipe)} />
              <Text style={styles.suggestChevron}>›</Text>
            </Pressable>
          ))}
        </GlassView>
      ) : null}

      {showEmptyHint ? (
        <Animated.View entering={FadeInUp.duration(400)}>
        <GlassView style={styles.emptyCard} contentStyle={styles.emptyContent}>
          <Text style={styles.emptyTitle}>{t('home.emptyTitle')}</Text>
          <Text style={styles.emptyText}>{t('home.emptyText')}</Text>
          <PrimaryButton
            label={t('home.emptyCta')}
            onPress={() => router.push('/scan')}
            style={styles.emptyCta}
          />
        </GlassView>
        </Animated.View>
      ) : null}

      {SLOTS.map((slot) => (
        <MealSlotCard
          key={slot}
          slot={slot}
          logs={diary.logsBySlot[slot]}
          kcalGoal={kcalGoal}
          onAdd={() => router.push('/scan')}
          onDeleteLog={diary.deleteLog}
          onSelectLog={setSelectedLog}
        />
      ))}

      <LogDetailSheet log={selectedLog} onClose={() => setSelectedLog(null)} onDelete={diary.deleteLog} />

      <ProgressCard
        deltaKg={deltaKg}
        targetWeightKg={profile?.target_weight_kg ?? null}
        onPress={() => router.push('/progress')}
      />
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  stepsChip: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    zIndex: 1,
  },
  stepsText: {
    fontFamily: font.bold,
    fontSize: 12.5,
    color: colors.ink,
  },
  ringCard: {
    marginTop: spacing.md,
  },
  ringContent: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  summary: {
    fontFamily: font.regular,
    fontSize: 12.5,
    color: colors.muted,
    marginTop: 14,
  },
  emptyCard: {
    marginBottom: 14,
  },
  emptyContent: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyTitle: {
    fontFamily: font.bold,
    fontSize: 15,
    color: colors.ink,
  },
  emptyText: {
    fontFamily: font.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 4,
  },
  emptyCta: {
    marginTop: 14,
    alignSelf: 'stretch',
  },
  suggestCard: {
    marginBottom: 14,
  },
  suggestContent: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  suggestTitle: {
    fontFamily: font.bold,
    fontSize: 14,
    color: colors.ink,
  },
  suggestSubtitle: {
    fontFamily: font.regular,
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
    marginBottom: 6,
  },
  suggestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: colors.track,
  },
  suggestText: {
    flex: 1,
  },
  suggestRecipe: {
    fontFamily: font.semibold,
    fontSize: 13.5,
    color: colors.ink,
  },
  suggestMeta: {
    fontFamily: font.regular,
    fontSize: 11.5,
    color: colors.muted,
    marginTop: 1,
  },
  suggestChevron: {
    fontFamily: font.bold,
    fontSize: 16,
    color: colors.muted,
  },
});
