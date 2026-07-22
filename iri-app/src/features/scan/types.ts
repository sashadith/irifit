export interface ScanIngredient {
  name: string;
  grams: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface ScanResult {
  dish: string;
  portion: string;
  confidence: 'high' | 'medium' | 'low';
  ingredients: ScanIngredient[];
}

export interface ScanResponse {
  result: ScanResult;
  model: 'haiku' | 'sonnet';
  scansUsed: number;
  scansLimit: number;
}

export interface InventorySuggestion {
  dish: string;
  description: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface InventoryResult {
  ingredients: string[];
  suggestion: InventorySuggestion;
  confidence: 'high' | 'medium' | 'low';
}

export interface InventoryResponse {
  mode: 'inventory';
  result: InventoryResult;
  model: 'haiku' | 'sonnet';
  scansUsed: number;
  scansLimit: number;
}

export interface ScanTotals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export function sumIngredients(ingredients: readonly ScanIngredient[]): ScanTotals {
  return ingredients.reduce(
    (acc, i) => ({
      kcal: acc.kcal + i.kcal,
      protein: acc.protein + i.protein_g,
      carbs: acc.carbs + i.carbs_g,
      fat: acc.fat + i.fat_g,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

/**
 * Zutatenmenge lokal anpassen: Nährwerte skalieren linear mit der Grammzahl —
 * so ist die Korrektur per Stepper sofort und ohne Server-Roundtrip.
 */
export function scaleIngredient(ingredient: ScanIngredient, newGrams: number): ScanIngredient {
  const factor = ingredient.grams > 0 ? newGrams / ingredient.grams : 0;
  const round1 = (n: number) => Math.round(n * 10) / 10;
  return {
    ...ingredient,
    grams: newGrams,
    kcal: Math.round(ingredient.kcal * factor),
    protein_g: round1(ingredient.protein_g * factor),
    carbs_g: round1(ingredient.carbs_g * factor),
    fat_g: round1(ingredient.fat_g * factor),
  };
}

/** Stepper-Schrittweite: 5 g bei kleinen Mengen, sonst ~10 % gerundet auf 5 g */
export function gramStep(grams: number): number {
  if (grams <= 50) return 5;
  return Math.max(5, Math.round(grams / 100) * 10);
}
