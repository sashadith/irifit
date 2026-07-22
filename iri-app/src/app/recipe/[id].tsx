import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { GlassView } from '@/components/glass/GlassView';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { SattScoreDots } from '@/components/recipes/SattScoreDots';
import { Chip } from '@/components/ui/Chip';
import { GhostButton } from '@/components/ui/GhostButton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { useAuth } from '@/features/auth/AuthProvider';
import { MealSlot } from '@/features/diary/useDiaryDay';
import {
  fetchRecipeDetail,
  fetchRecipeFavoriteIds,
  recipeGradient,
  recipeImageUrl,
  RecipeDetail,
  toggleRecipeFavorite,
} from '@/features/recipes/recipesData';
import { recipeSattScore } from '@/features/recipes/sattScore';
import { addItems } from '@/features/shopping/shoppingList';
import { t, TranslationKey } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { colors, font, radius, spacing, typography } from '@/theme';

const SLOT_LABELS: Record<MealSlot, TranslationKey> = {
  breakfast: 'home.slotBreakfast',
  lunch: 'home.slotLunch',
  dinner: 'home.slotDinner',
  snack: 'home.slotSnack',
};

function defaultSlot(now = new Date()): MealSlot {
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes < 10.5 * 60) return 'breakfast';
  if (minutes < 15 * 60) return 'lunch';
  if (minutes < 21.5 * 60) return 'dinner';
  return 'snack';
}

/** "1. Schritt eins. 2. Schritt zwei." → nummerierte Einzelschritte */
function splitSteps(instructions: string | null): string[] {
  if (!instructions) return [];
  const parts = instructions.split(/\s*\d+\.\s+/).filter((s) => s.trim().length > 0);
  return parts.length > 1 ? parts : [instructions];
}

export default function RecipeDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();

  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [portions, setPortions] = useState(1);
  const [slot, setSlot] = useState<MealSlot>(defaultSlot());
  const [busy, setBusy] = useState(false);
  const [shoppingFeedback, setShoppingFeedback] = useState<number | null>(null);

  useEffect(() => {
    const recipeId = Number(id);
    if (!Number.isFinite(recipeId)) return;
    fetchRecipeDetail(recipeId)
      .then((r) => {
        setRecipe(r);
        if (r) setPortions(1);
      })
      .finally(() => setLoaded(true));
    if (session) {
      fetchRecipeFavoriteIds(session.user.id)
        .then((ids) => setIsFavorite(ids.has(recipeId)))
        .catch(() => {});
    }
  }, [id, session?.user.id]);

  const steps = useMemo(() => splitSteps(recipe?.instructions ?? null), [recipe?.instructions]);

  if (loaded && !recipe) {
    return (
      <ScreenScaffold withTabBarInset={false}>
        <Text style={[typography.bodyMuted, styles.notFound]}>{t('recipes.notFound')}</Text>
        <GhostButton label={t('common.back')} onPress={() => router.back()} />
      </ScreenScaffold>
    );
  }
  if (!recipe) return <ScreenScaffold withTabBarInset={false} scroll={false}>{null}</ScreenScaffold>;

  const [c1, c2] = recipeGradient(recipe.id);
  const satt = recipeSattScore(recipe);
  /** Faktor: gewählte Portionen relativ zum Gesamtrezept */
  const scale = portions / Math.max(1, recipe.servings);
  const showScaled = portions !== recipe.servings;

  const toggleFavorite = async () => {
    if (!session) return;
    Haptics.selectionAsync();
    const next = !isFavorite;
    setIsFavorite(next);
    try {
      await toggleRecipeFavorite(session.user.id, recipe.id, !next);
    } catch {
      setIsFavorite(!next);
    }
  };

  const logRecipe = async () => {
    if (!session) return;
    setBusy(true);
    try {
      const round1 = (n: number) => Math.round(n * 10) / 10;
      const { error } = await supabase.from('food_logs').insert({
        user_id: session.user.id,
        slot,
        source: 'recipe',
        recipe_id: recipe.id,
        title: recipe.title,
        kcal: Math.round(recipe.kcal_per_serving * portions),
        protein_g: round1((recipe.protein_per_serving_g ?? 0) * portions),
        carbs_g: round1((recipe.carbs_per_serving_g ?? 0) * portions),
        fat_g: round1((recipe.fat_per_serving_g ?? 0) * portions),
        details: { portions },
      });
      if (error) throw error;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      Alert.alert(t('common.error'), t('food.searchError'));
    } finally {
      setBusy(false);
    }
  };

  const addToShoppingList = async () => {
    const texts = recipe.ingredients.map((i) => {
      if (i.gramm != null && showScaled) {
        return `${Math.round(i.gramm * scale)} g ${i.name}`;
      }
      return `${i.menge_anzeige} ${i.name}`;
    });
    await addItems(texts, recipe.title);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShoppingFeedback(texts.length);
    setTimeout(() => setShoppingFeedback(null), 2500);
  };

  return (
    <ScreenScaffold withTabBarInset={false}>
      <View style={styles.headerImageWrap}>
        {recipe.image_path ? (
          <Image
            source={{ uri: recipeImageUrl(recipe.image_path) }}
            style={styles.headerImage}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <LinearGradient colors={[c1, c2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerImage} />
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isFavorite ? t('food.favRemove') : t('food.favAdd')}
          accessibilityState={{ selected: isFavorite }}
          onPress={toggleFavorite}
          style={styles.favButton}
        >
          <Text style={[styles.favHeart, isFavorite && styles.favHeartActive]}>
            {isFavorite ? '♥' : '♡'}
          </Text>
        </Pressable>
      </View>

      <GlassView style={styles.card} contentStyle={styles.cardPad}>
        <Text style={styles.category}>{recipe.category}</Text>
        <Text style={[typography.displayLg, styles.title]}>{recipe.title}</Text>
        <Text style={styles.macroLine}>
          {recipe.kcal_per_serving} kcal {t('recipes.perServing')} ·{' '}
          {t('recipes.macroShort', {
            protein: Math.round(recipe.protein_per_serving_g ?? 0),
            carbs: Math.round(recipe.carbs_per_serving_g ?? 0),
            fat: Math.round(recipe.fat_per_serving_g ?? 0),
          })}
        </Text>
        <View style={styles.sattRow}>
          <SattScoreDots score={satt} withLabel size={7} />
        </View>
        <Text style={styles.sattExplain}>{t('recipes.sattExplain')}</Text>
        {recipe.description ? <Text style={styles.description}>{recipe.description}</Text> : null}
      </GlassView>

      {/* Zutaten + Portionsrechner */}
      <Text style={[typography.eyebrow, styles.sectionLabel]}>{t('recipes.ingredients')}</Text>
      <GlassView contentStyle={styles.cardPad}>
        <View style={styles.portionRow}>
          <Text style={styles.portionLabel}>{t('recipes.portions')}</Text>
          <View style={styles.stepper}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="−"
              onPress={() => setPortions(Math.max(0.5, portions - 0.5))}
              style={styles.stepButton}
            >
              <Text style={styles.stepButtonText}>−</Text>
            </Pressable>
            <Text style={styles.portionValue}>{portions.toLocaleString('de-DE')}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="＋"
              onPress={() => setPortions(Math.min(8, portions + 0.5))}
              style={styles.stepButton}
            >
              <Text style={styles.stepButtonText}>＋</Text>
            </Pressable>
          </View>
        </View>
        {recipe.ingredients.map((ingredient, i) => (
          <View key={`${ingredient.name}-${i}`} style={styles.ingredientRow}>
            <Text style={styles.ingredientAmount}>
              {ingredient.gramm != null && showScaled
                ? `${Math.round(ingredient.gramm * scale)} g`
                : ingredient.menge_anzeige}
            </Text>
            <Text style={styles.ingredientName}>{ingredient.name}</Text>
          </View>
        ))}
        <GhostButton
          label={
            shoppingFeedback !== null
              ? t('recipes.shoppingAdded', { count: shoppingFeedback })
              : t('recipes.shoppingAdd')
          }
          small
          onPress={addToShoppingList}
          style={styles.shoppingButton}
        />
      </GlassView>

      {/* Zubereitung */}
      {steps.length > 0 ? (
        <>
          <Text style={[typography.eyebrow, styles.sectionLabel]}>{t('recipes.steps')}</Text>
          <GlassView contentStyle={styles.cardPad}>
            {steps.map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{i + 1}</Text>
                </View>
                <Text style={styles.stepText}>{step.trim()}</Text>
              </View>
            ))}
          </GlassView>
        </>
      ) : null}

      {/* In Tagebuch */}
      <Text style={[typography.eyebrow, styles.sectionLabel]}>{t('recipes.logCta')}</Text>
      <View style={styles.slotChips}>
        {(Object.keys(SLOT_LABELS) as MealSlot[]).map((s) => (
          <Chip key={s} label={t(SLOT_LABELS[s])} selected={slot === s} onPress={() => setSlot(s)} />
        ))}
      </View>
      <PrimaryButton
        label={t('recipes.logPortions', { count: portions.toLocaleString('de-DE') })}
        onPress={logRecipe}
        loading={busy}
        style={styles.logButton}
      />
      <GhostButton label={t('common.back')} small onPress={() => router.back()} style={styles.backButton} />
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  notFound: {
    marginTop: 60,
    marginBottom: 16,
    textAlign: 'center',
  },
  headerImageWrap: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    height: 170,
  },
  headerImage: {
    flex: 1,
  },
  favButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favHeart: {
    fontSize: 20,
    color: colors.muted,
  },
  favHeartActive: {
    color: colors.tintDeep,
  },
  card: {
    marginTop: -26,
    marginHorizontal: 10,
    zIndex: 2,
  },
  cardPad: {
    padding: spacing.lg,
  },
  category: {
    fontFamily: font.bold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  title: {
    fontSize: 22,
    lineHeight: 27,
    marginTop: 4,
  },
  macroLine: {
    fontFamily: font.semibold,
    fontSize: 12.5,
    color: colors.muted,
    marginTop: 6,
  },
  sattRow: {
    marginTop: 10,
  },
  sattExplain: {
    fontFamily: font.regular,
    fontSize: 11.5,
    color: colors.muted2,
    marginTop: 4,
  },
  description: {
    fontFamily: font.regular,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.muted,
    marginTop: 10,
  },
  sectionLabel: {
    marginTop: 18,
    marginBottom: 10,
  },
  portionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  portionLabel: {
    fontFamily: font.bold,
    fontSize: 13,
    color: colors.ink,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonText: {
    fontFamily: font.semibold,
    fontSize: 16,
    color: colors.ink,
  },
  portionValue: {
    fontFamily: font.bold,
    fontSize: 15,
    color: colors.ink,
    minWidth: 28,
    textAlign: 'center',
  },
  ingredientRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.track,
    gap: 12,
  },
  ingredientAmount: {
    fontFamily: font.bold,
    fontSize: 13,
    color: colors.ink,
    minWidth: 92,
  },
  ingredientName: {
    flex: 1,
    fontFamily: font.regular,
    fontSize: 13.5,
    color: colors.ink,
  },
  shoppingButton: {
    marginTop: 12,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: colors.stroke,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontFamily: font.bold,
    fontSize: 12.5,
    color: colors.ink,
  },
  stepText: {
    flex: 1,
    fontFamily: font.regular,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.ink,
  },
  slotChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  logButton: {
    marginTop: 14,
  },
  backButton: {
    marginTop: 10,
  },
});
