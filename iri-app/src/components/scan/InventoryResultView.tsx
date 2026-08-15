import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

import { GlassView } from '@/components/glass/GlassView';
import { SattScoreDots } from '@/components/recipes/SattScoreDots';
import { GhostButton } from '@/components/ui/GhostButton';
import { macroShort } from '@/features/diary/macros';
import { RecipeListItem } from '@/features/recipes/recipesData';
import { recipeSattScore, sattScore } from '@/features/recipes/sattScore';
import { matchRecipes } from '@/features/scan/inventoryMatch';
import { InventoryResult } from '@/features/scan/types';
import { t } from '@/i18n';
import { colors, font, radius, spacing, typography } from '@/theme';

export interface InventoryResultViewProps {
  readonly data: InventoryResult;
  readonly recipes: readonly RecipeListItem[];
  readonly onRetake: () => void;
}

/** Ergebnis des Kühlschrank-Scans: Zutaten-Chips, Rezept-Matches, AI-Idee */
export function InventoryResultView({ data, recipes, onRetake }: InventoryResultViewProps) {
  const router = useRouter();
  const [ingredients, setIngredients] = useState(data.ingredients);

  const matches = useMemo(() => matchRecipes(recipes, ingredients), [recipes, ingredients]);

  const removeIngredient = (name: string) => {
    Haptics.selectionAsync();
    setIngredients((prev) => prev.filter((i) => i !== name));
  };

  const suggestion = data.suggestion;
  const suggestionSatt = sattScore({
    kcal: suggestion.kcal,
    proteinG: suggestion.protein_g,
    totalGrams: null,
  });
  const noFood = ingredients.length === 0;

  return (
    <View>
      {noFood ? (
        <GlassView contentStyle={styles.cardPad}>
          <Text style={typography.bodyMuted}>{t('scan.inventoryNone')}</Text>
        </GlassView>
      ) : (
        <>
          {/* Erkannte Zutaten */}
          <GlassView contentStyle={styles.cardPad}>
            <Text style={styles.sectionTitle}>{t('scan.inventoryFound')}</Text>
            <Text style={styles.sectionHint}>{t('scan.inventoryFoundHint')}</Text>
            <View style={styles.chips}>
              {ingredients.map((name) => (
                <Pressable
                  key={name}
                  accessibilityRole="button"
                  accessibilityLabel={`${name} entfernen`}
                  onPress={() => removeIngredient(name)}
                  style={styles.ingredientChip}
                >
                  <Text style={styles.ingredientChipText}>{name}</Text>
                  <Text style={styles.ingredientChipX}>✕</Text>
                </Pressable>
              ))}
            </View>
          </GlassView>

          {/* Kochbare Irina-Rezepte */}
          {matches.cookable.length > 0 ? (
            <>
              <Text style={[typography.eyebrow, styles.sectionLabel]}>
                {t('scan.inventoryTitle')}
              </Text>
              {matches.cookable.map(({ recipe }) => (
                <Pressable
                  key={recipe.id}
                  accessibilityRole="button"
                  accessibilityLabel={recipe.title}
                  onPress={() => router.push(`/recipe/${recipe.id}`)}
                >
                  {({ pressed }) => (
                    <GlassView
                      borderRadius={radius.md}
                      shadow={false}
                      style={[styles.matchRow, pressed && styles.pressed]}
                      contentStyle={styles.matchContent}
                    >
                      <View style={styles.matchText}>
                        <Text style={styles.matchTitle} numberOfLines={1}>
                          {recipe.title}
                        </Text>
                        <Text style={styles.matchMeta}>{recipe.kcal_per_serving} kcal</Text>
                      </View>
                      <SattScoreDots score={recipeSattScore(recipe)} />
                      <Text style={styles.chevron}>›</Text>
                    </GlassView>
                  )}
                </Pressable>
              ))}
            </>
          ) : null}

          {/* Fast möglich */}
          {matches.almost.length > 0 ? (
            <>
              <Text style={[typography.eyebrow, styles.sectionLabel]}>
                {t('scan.inventoryAlmost')}
              </Text>
              {matches.almost.map(({ recipe, missing }) => (
                <Pressable
                  key={recipe.id}
                  accessibilityRole="button"
                  accessibilityLabel={recipe.title}
                  onPress={() => router.push(`/recipe/${recipe.id}`)}
                >
                  {({ pressed }) => (
                    <GlassView
                      borderRadius={radius.md}
                      shadow={false}
                      style={[styles.matchRow, pressed && styles.pressed]}
                      contentStyle={styles.matchContent}
                    >
                      <View style={styles.matchText}>
                        <Text style={styles.matchTitle} numberOfLines={1}>
                          {recipe.title}
                        </Text>
                        <Text style={styles.matchMissing} numberOfLines={1}>
                          {t('scan.inventoryMissing', { items: missing.slice(0, 3).join(', ') })}
                        </Text>
                      </View>
                      <Text style={styles.chevron}>›</Text>
                    </GlassView>
                  )}
                </Pressable>
              ))}
            </>
          ) : null}

          {/* Freier AI-Vorschlag */}
          {matches.cookable.length === 0 ? (
            <Text style={[typography.bodyMuted, styles.noMatchHint]}>
              {t('scan.inventoryNoMatch')}
            </Text>
          ) : null}
          <Text style={[typography.eyebrow, styles.sectionLabel]}>
            {t('scan.inventorySuggestion')}
          </Text>
          <GlassView contentStyle={styles.cardPad}>
            <Text style={[typography.displayLg, styles.suggestionDish]}>{suggestion.dish}</Text>
            <Text style={styles.suggestionDescription}>{suggestion.description}</Text>
            <Text style={styles.suggestionMacros}>
              {t('scan.inventorySuggestionMacros', {
                kcal: Math.round(suggestion.kcal).toLocaleString('de-DE'),
                macros: macroShort(suggestion.carbs_g, suggestion.protein_g, suggestion.fat_g),
              })}
            </Text>
            <View style={styles.suggestionSatt}>
              <SattScoreDots score={suggestionSatt} withLabel size={7} />
            </View>
          </GlassView>
        </>
      )}

      <GhostButton label={t('scan.inventoryRetake')} onPress={onRetake} style={styles.retake} />
    </View>
  );
}

const styles = StyleSheet.create({
  cardPad: {
    padding: spacing.lg,
  },
  sectionTitle: {
    fontFamily: font.bold,
    fontSize: 14,
    color: colors.ink,
  },
  sectionHint: {
    fontFamily: font.regular,
    fontSize: 11.5,
    color: colors.muted2,
    marginTop: 2,
    marginBottom: 10,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ingredientChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  ingredientChipText: {
    fontFamily: font.semibold,
    fontSize: 13,
    color: colors.ink,
  },
  ingredientChipX: {
    fontSize: 10,
    color: colors.muted2,
  },
  sectionLabel: {
    marginTop: 18,
    marginBottom: 10,
  },
  matchRow: {
    marginBottom: 8,
  },
  pressed: {
    opacity: 0.75,
  },
  matchContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  matchText: {
    flex: 1,
  },
  matchTitle: {
    fontFamily: font.semibold,
    fontSize: 14,
    color: colors.ink,
  },
  matchMeta: {
    fontFamily: font.regular,
    fontSize: 11.5,
    color: colors.muted,
    marginTop: 1,
  },
  matchMissing: {
    fontFamily: font.regular,
    fontSize: 11.5,
    color: colors.tintDeep,
    marginTop: 1,
  },
  chevron: {
    fontFamily: font.bold,
    fontSize: 16,
    color: colors.muted,
  },
  noMatchHint: {
    marginTop: 14,
  },
  suggestionDish: {
    fontSize: 19,
    lineHeight: 24,
  },
  suggestionDescription: {
    fontFamily: font.regular,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.muted,
    marginTop: 6,
  },
  suggestionMacros: {
    fontFamily: font.semibold,
    fontSize: 12.5,
    color: colors.ink,
    marginTop: 10,
  },
  suggestionSatt: {
    marginTop: 8,
  },
  retake: {
    marginTop: 16,
  },
});
