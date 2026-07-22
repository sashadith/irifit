import { recipeSattScore } from './sattScore';
import { RecipeListItem } from './recipesData';

export interface SuggestOptions {
  remainingKcal: number;
  remainingProteinG: number;
  /** z. B. "2026-07-20" — rotiert die Top-Auswahl deterministisch pro Tag */
  daySeed: string;
  count?: number;
}

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * „Was soll ich noch essen?" (USP): Rezepte, die in die restlichen kcal passen.
 * Bewertet Kalorien-Passung (Ideal ~70 % vom Rest), Satt-Score und — wenn noch
 * viel Protein offen ist — den Protein-Anteil. Tagesrotation, damit nicht
 * jeden Abend dieselben drei Rezepte erscheinen.
 */
export function suggestRecipes(
  recipes: readonly RecipeListItem[],
  { remainingKcal, remainingProteinG, daySeed, count = 3 }: SuggestOptions,
): RecipeListItem[] {
  if (remainingKcal < 120) return [];

  const minKcal = Math.min(150, remainingKcal * 0.25);
  const candidates = recipes.filter(
    (r) => r.kcal_per_serving <= remainingKcal + 50 && r.kcal_per_serving >= minKcal,
  );
  if (candidates.length === 0) return [];

  const proteinMatters = remainingProteinG > 20;
  const scored = candidates.map((recipe) => {
    const ideal = remainingKcal * 0.7;
    const kcalFit = 1 - Math.min(1, Math.abs(recipe.kcal_per_serving - ideal) / remainingKcal);
    const satt = recipeSattScore(recipe) / 5;
    const proteinShare = ((recipe.protein_per_serving_g ?? 0) * 4) / Math.max(1, recipe.kcal_per_serving);
    const protein = proteinMatters ? Math.min(1, proteinShare / 0.35) : 0.5;
    return { recipe, score: 0.4 * satt + 0.35 * kcalFit + 0.25 * protein };
  });

  scored.sort((a, b) => b.score - a.score);

  // Tagesrotation innerhalb der Top-8, damit die Auswahl frisch bleibt
  const pool = scored.slice(0, Math.max(count, Math.min(8, scored.length))).map((s) => s.recipe);
  const offset = hashSeed(daySeed) % pool.length;
  const rotated = [...pool.slice(offset), ...pool.slice(0, offset)];
  return rotated.slice(0, count);
}
