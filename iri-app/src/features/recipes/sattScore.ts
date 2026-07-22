/**
 * Satt-Score (USP, Entscheidung 20.07.): Wie satt macht das pro Kalorie?
 *
 * Die Excel liefert keine Ballaststoffe, daher zwei belastbare Proxys:
 * - Protein-Anteil an den kcal (Protein sättigt am stärksten)
 * - Energiedichte: Gramm Essen pro kcal (Volumen/Wasser sättigt — Suppen,
 *   Gemüse, Quark niedrig-dicht; Gebäck/Süßes hoch-dicht)
 *
 * Ergebnis 1–5 (●●●●○). Pure Funktion — separat getestet.
 */

export interface SattInput {
  kcal: number;
  proteinG: number;
  /** Gesamtgewicht der Portion in g (null, wenn unbekannt) */
  totalGrams: number | null;
}

export function sattScore({ kcal, proteinG, totalGrams }: SattInput): number {
  if (kcal <= 0) return 3;

  // Protein-Anteil: 35 %+ der kcal aus Protein = voller Teilscore
  const proteinShare = (proteinG * 4) / kcal;
  const proteinNorm = Math.min(1, Math.max(0, proteinShare / 0.35));

  // Energiedichte: 0,35 g/kcal (dicht, Gebäck) … 1,25 g/kcal (voluminös, Suppe)
  let densityNorm = 0.5; // neutral, wenn kein Gewicht bekannt
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

/** Satt-Score eines Rezepts (Zutaten-Gramm gelten für das GANZE Rezept) */
export function recipeSattScore(recipe: RecipeNutrition): number {
  const totalRecipeGrams = recipe.ingredients.reduce((sum, i) => sum + (i.gramm ?? 0), 0);
  return sattScore({
    kcal: recipe.kcal_per_serving,
    proteinG: recipe.protein_per_serving_g ?? 0,
    totalGrams: totalRecipeGrams > 0 ? totalRecipeGrams / Math.max(1, recipe.servings) : null,
  });
}
