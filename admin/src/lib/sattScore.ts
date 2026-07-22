/**
 * Satt-Score — 1:1 aus iri-app/src/features/recipes/sattScore.ts übernommen,
 * damit die Vorschau im Editor exakt das zeigt, was die App rechnet.
 */

export interface SattInput {
  kcal: number;
  proteinG: number;
  totalGrams: number | null;
}

export function sattScore({ kcal, proteinG, totalGrams }: SattInput): number {
  if (kcal <= 0) return 3;

  const proteinShare = (proteinG * 4) / kcal;
  const proteinNorm = Math.min(1, Math.max(0, proteinShare / 0.35));

  let densityNorm = 0.5;
  if (totalGrams != null && totalGrams > 0) {
    const density = totalGrams / kcal;
    densityNorm = Math.min(1, Math.max(0, (density - 0.35) / (1.25 - 0.35)));
  }

  const combined = 0.5 * proteinNorm + 0.5 * densityNorm;
  return Math.max(1, Math.min(5, Math.round(1 + combined * 4)));
}

export interface RecipeNutrition {
  servings: number;
  kcal_per_serving: number;
  protein_per_serving_g: number | null;
  ingredients: readonly { gramm: number | null }[];
}

export function recipeSattScore(recipe: RecipeNutrition): number {
  const totalRecipeGrams = recipe.ingredients.reduce((sum, i) => sum + (i.gramm ?? 0), 0);
  return sattScore({
    kcal: recipe.kcal_per_serving,
    proteinG: recipe.protein_per_serving_g ?? 0,
    totalGrams: totalRecipeGrams > 0 ? totalRecipeGrams / Math.max(1, recipe.servings) : null,
  });
}

export function sattDots(score: number): string {
  return '●'.repeat(score) + '○'.repeat(5 - score);
}
