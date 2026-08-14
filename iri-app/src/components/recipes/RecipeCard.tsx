import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { GlassView } from '@/components/glass/GlassView';
import { SattScoreDots } from '@/components/recipes/SattScoreDots';
import { recipeGradient, recipeImageUrl, RecipeListItem } from '@/features/recipes/recipesData';
import { recipeSattScore } from '@/features/recipes/sattScore';
import { t } from '@/i18n';
import { colors, font, radius } from '@/theme';

export interface RecipeCardProps {
  readonly recipe: RecipeListItem;
  readonly onPress: () => void;
  /** Abzeichen an den fuenf juengsten Rezepten (Sascha 14.08.) */
  readonly isNew?: boolean;
}

/** Rezept-Karte im 2er-Grid (Prototyp .rcard) — Gradient bis echte Fotos da sind */
export function RecipeCard({ recipe, onPress, isNew }: RecipeCardProps) {
  const [c1, c2] = recipeGradient(recipe.id);
  const servingsLabel =
    recipe.servings === 1
      ? t('recipes.servingOne')
      : t('recipes.servingMany', { count: recipe.servings });

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={recipe.title} onPress={onPress} style={styles.wrap}>
      {({ pressed }) => (
        <GlassView
          borderRadius={radius.md}
          shadow={false}
          style={pressed ? styles.pressed : undefined}
          contentStyle={styles.content}
        >
          {recipe.image_path ? (
            <Image
              source={{ uri: recipeImageUrl(recipe.image_path) }}
              style={styles.image}
              contentFit="cover"
              transition={150}
              placeholder={null}
            />
          ) : (
            <LinearGradient colors={[c1, c2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.image} />
          )}
          {isNew ? (
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>{t('recipes.badgeNew')}</Text>
            </View>
          ) : null}
          <View style={styles.body}>
            <Text style={styles.title} numberOfLines={2}>
              {recipe.title}
            </Text>
            <Text style={styles.meta}>
              {t('recipes.cardMeta', { kcal: recipe.kcal_per_serving, servings: servingsLabel })}
            </Text>
            <View style={styles.scoreRow}>
              <SattScoreDots score={recipeSattScore(recipe)} />
            </View>
          </View>
        </GlassView>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Auf dem Bild oben links — dort ist bei den Rezeptfotos am ehesten Ruhe
  newBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: colors.tintDeep,
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  newBadgeText: {
    fontFamily: font.extrabold,
    fontSize: 10,
    letterSpacing: 0.08 * 10,
    color: colors.white,
  },
  wrap: {
    width: '48.2%',
  },
  pressed: {
    opacity: 0.75,
  },
  content: {
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  image: {
    height: 92,
  },
  body: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
  },
  title: {
    fontFamily: font.bold,
    fontSize: 13,
    lineHeight: 17,
    color: colors.ink,
  },
  meta: {
    fontFamily: font.semibold,
    fontSize: 11.5,
    color: colors.muted,
    marginTop: 4,
  },
  scoreRow: {
    marginTop: 7,
  },
});
