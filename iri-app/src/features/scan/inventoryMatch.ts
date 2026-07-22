/**
 * Kühlschrank-Scan (Session 8b): erkannte Zutaten gegen Irinas Rezepte matchen.
 * Läuft clientseitig gegen den Rezept-Cache — pure Funktionen, separat testbar.
 */
import type { RecipeListItem } from '@/features/recipes/recipesData';

/** Küchen-Basics zählen nicht als „fehlende" Zutat */
const PANTRY = [
  'salz', 'pfeffer', 'wasser', 'öl', 'gewürz', 'kräuter', 'essig', 'backpulver',
  'vanille', 'zimt', 'muskat', 'paprikapulver', 'zucker', 'süßstoff', 'brühe',
  'zitronensaft', 'sojasauce', 'senf',
];

export function normalizeIngredient(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-zäöüß\s-]/g, '')
    .trim();
}

function isPantry(normalized: string): boolean {
  return PANTRY.some((p) => normalized.includes(p));
}

/** Fuzzy: Substring in beide Richtungen; Kurzwörter (< 3) nur exakt */
function ingredientAvailable(recipeIngredient: string, available: readonly string[]): boolean {
  const r = normalizeIngredient(recipeIngredient);
  return available.some((a) => {
    if (a.length < 3 || r.length < 3) return a === r;
    return r.includes(a) || a.includes(r);
  });
}

export interface InventoryMatch {
  recipe: RecipeListItem;
  /** Anteil verfügbarer Nicht-Basic-Zutaten (0..1) */
  coverage: number;
  missing: string[];
}

export interface MatchResult {
  /** Direkt kochbar (≥ 65 % der Zutaten da) */
  cookable: InventoryMatch[];
  /** Fast möglich (30–65 %, max. 3 fehlende) */
  almost: InventoryMatch[];
}

export function matchRecipes(
  recipes: readonly RecipeListItem[],
  detectedRaw: readonly string[],
): MatchResult {
  const available = detectedRaw.map(normalizeIngredient).filter((s) => s.length > 0);
  if (available.length === 0) return { cookable: [], almost: [] };

  const scored: InventoryMatch[] = [];
  for (const recipe of recipes) {
    const relevant = recipe.ingredients.filter((i) => !isPantry(normalizeIngredient(i.name)));
    if (relevant.length < 2) continue;
    const missing = relevant
      .filter((i) => !ingredientAvailable(i.name, available))
      .map((i) => i.name);
    const coverage = (relevant.length - missing.length) / relevant.length;
    if (coverage >= 0.3) scored.push({ recipe, coverage, missing });
  }

  scored.sort((a, b) => b.coverage - a.coverage || a.missing.length - b.missing.length);

  return {
    cookable: scored.filter((m) => m.coverage >= 0.65).slice(0, 3),
    almost: scored.filter((m) => m.coverage < 0.65 && m.missing.length <= 3).slice(0, 3),
  };
}
