import { recipeSattScore } from './sattScore';
import { RecipeListItem } from './recipesData';

export interface SuggestOptions {
  remainingKcal: number;
  remainingProteinG: number;
  /**
   * Bestimmt die Auswahl. Gleicher Seed → gleiche Rezepte, anderer Seed →
   * andere. Der Aufrufer entscheidet damit, wie oft gewechselt wird; die
   * Rezeptseite gibt Tag plus Stunde hinein.
   */
  seed: string;
  count?: number;
}

/**
 * Anteil des Losentscheids an der Rangfolge (0 = reine Bestenliste).
 *
 * Warum es den braucht (gemessen 17.08. an den 158 echten Rezepten): Ohne Los
 * standen bei jedem Kalorienstand eine ganze Woche lang dieselben 8 Rezepte in
 * genau 8 Paaren im Block. Die Punktzahl haengt zu zwei Dritteln an festen
 * Eigenschaften des Rezepts — Satt-Score und Proteinanteil aendern sich nie —,
 * also gewannen immer dieselben, und die alte Tagesrotation nahm daraus nur
 * benachbarte Paare.
 *
 * Bei 0,6 werden daraus 25 Rezepte in 39 Paaren je Woche und Kalorienstand.
 * Der Preis: die Vorschlaege liegen im Schnitt 195 statt 61 kcal vom Idealwert
 * entfernt — immer noch innerhalb des Restbudgets, dafuer sorgt der Filter.
 *
 * So hoch geht das nur mit SATT_UNTERGRENZE. Ohne sie rutschten ab 0,4
 * Rezepte mit Satt-Score 2 in den Block, und das widerspricht seinem
 * Versprechen. Mit Untergrenze bleibt der schlechteste gezeigte Wert bei 3,
 * der Mittelwert bei 4,75 von 5.
 */
const LOSANTEIL = 0.6;

/**
 * Untergrenze fuer den Satt-Score (1–5). Was weniger saettigt, hat in
 * „Was soll ich noch essen?" nichts zu suchen — egal wie gut es kalorisch
 * passt. Kostet wenig Auswahl: Bei 600 kcal Rest bleiben 101 von 128 Rezepten
 * im Fenster uebrig.
 */
const SATT_UNTERGRENZE = 3;

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Losentscheid je Rezept und Seed: 0 bis 1, innerhalb eines Seeds unveraenderlich. */
function lot(recipeId: number, seed: string): number {
  return (hashSeed(`${seed}|${recipeId}`) % 1000) / 1000;
}

/**
 * „Was soll ich noch essen?" (USP): Rezepte, die in die restlichen kcal passen.
 *
 * Bewertet Kalorien-Passung (Ideal ~70 % vom Rest), Satt-Score und — wenn noch
 * viel Protein offen ist — den Protein-Anteil. Auf diese Guete kommt ein
 * Losentscheid (siehe LOSANTEIL), der die Rangfolge je Seed neu mischt. Ohne
 * ihn zeigte der Block immer dieselben acht Rezepte.
 */
export function suggestRecipes(
  recipes: readonly RecipeListItem[],
  { remainingKcal, remainingProteinG, seed, count = 3 }: SuggestOptions,
): RecipeListItem[] {
  if (remainingKcal < 120) return [];

  const minKcal = Math.min(150, remainingKcal * 0.25);
  const candidates = recipes.filter(
    (r) =>
      r.kcal_per_serving <= remainingKcal + 50 &&
      r.kcal_per_serving >= minKcal &&
      recipeSattScore(r) >= SATT_UNTERGRENZE,
  );
  if (candidates.length === 0) return [];

  const proteinMatters = remainingProteinG > 20;
  const scored = candidates.map((recipe) => {
    const ideal = remainingKcal * 0.7;
    const kcalFit = 1 - Math.min(1, Math.abs(recipe.kcal_per_serving - ideal) / remainingKcal);
    const satt = recipeSattScore(recipe) / 5;
    const proteinShare = ((recipe.protein_per_serving_g ?? 0) * 4) / Math.max(1, recipe.kcal_per_serving);
    const protein = proteinMatters ? Math.min(1, proteinShare / 0.35) : 0.5;
    const guete = 0.4 * satt + 0.35 * kcalFit + 0.25 * protein;
    return {
      recipe,
      score: (1 - LOSANTEIL) * guete + LOSANTEIL * lot(recipe.id, seed),
    };
  });

  // Keine Rotation mehr noetig: Das Los mischt die Rangfolge selbst, die Besten
  // stehen also je Seed woanders.
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, count).map((s) => s.recipe);
}
