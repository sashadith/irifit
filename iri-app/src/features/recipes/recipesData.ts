import { supabase } from '@/lib/supabase';

export interface RecipeIngredient {
  name: string;
  menge_anzeige: string;
  gramm: number | null;
}

export interface RecipeListItem {
  id: number;
  title: string;
  category: string;
  servings: number;
  kcal_per_serving: number;
  protein_per_serving_g: number | null;
  carbs_per_serving_g: number | null;
  fat_per_serving_g: number | null;
  ingredients: RecipeIngredient[];
  image_path: string | null;
  /** Fuer das NEU-Abzeichen an den fuenf juengsten Rezepten (Sascha 14.08.) */
  created_at: string;
}

export interface RecipeDetail extends RecipeListItem {
  description: string | null;
  instructions: string | null;
  servings_note: string | null;
}

const LIST_COLUMNS =
  'id, title, category, servings, kcal_per_serving, protein_per_serving_g, carbs_per_serving_g, fat_per_serving_g, ingredients, image_path, created_at';

/** Session-Cache: 157 Rezepte einmal laden, dann aus dem Speicher */
let cache: RecipeListItem[] | null = null;

export async function fetchRecipes(): Promise<RecipeListItem[]> {
  // Leere Ergebnisse nicht cachen — z. B. wenn der Zugang (RLS) erst
  // nach dem ersten Aufruf freigeschaltet wird
  if (cache && cache.length > 0) return cache;
  const { data, error } = await supabase
    .from('recipes')
    .select(LIST_COLUMNS)
    .eq('status', 'published')
    // Neueste zuerst (Sascha 14.08.) — sonst steht das NEU-Abzeichen am Ende
    // einer 158er-Liste und sieht niemand. Zweitschluessel ID, weil 156 Rezepte
    // denselben Zeitstempel aus dem Import vom 18.07. tragen.
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });
  if (error) throw error;
  cache = (data ?? []) as RecipeListItem[];
  return cache;
}

export async function fetchRecipeDetail(id: number): Promise<RecipeDetail | null> {
  const { data, error } = await supabase
    .from('recipes')
    .select(`${LIST_COLUMNS}, description, instructions, servings_note`)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as RecipeDetail | null;
}

// ---------------------------------------------------------------------------
// Heuristiken für Präferenz/Allergie-Filter, solange die Rezepte keine
// gepflegten Tags haben (kommt mit dem Admin-Editor in S13). Bewusst
// konservativ: lieber ein Rezept zu viel ausblenden als eine Allergikerin
// auf Nüsse laufen lassen.
// ---------------------------------------------------------------------------

const MEAT_FISH = [
  'hähnchen', 'hühner', 'huhn', 'pute', 'puten', 'truthahn', 'rind', 'schwein',
  'speck', 'schinken', 'wurst', 'salami', 'hackfleisch', 'hack', 'mett', 'fleisch',
  'lachs', 'fisch', 'thunfisch', 'garnele', 'forelle', 'kabeljau', 'meeresfrüchte', 'shrimp',
];

const ALLERGEN_PATTERNS: Record<string, RegExp> = {
  gluten: /mehl|weizen|dinkel|roggen|gerste|hafer|brot|brötchen|toast|nudel|pasta|spaghetti|couscous|bulgur|grieß|semmel|fladen|tortilla|müsli|granola/i,
  lactose: /milch(?!frei)|käse|joghurt|quark|sahne|butter(?!schmalz)|frischkäse|mozzarella|parmesan|feta|skyr|kefir|schmand|crème|creme fraîche/i,
  nuts: /nuss|nüsse|mandel|walnuss|haselnuss|cashew|pistazie|erdnuss|pekan|macadamia/i,
  eggs: /\beier?n?\b|eigelb|eiweiß(?!pulver)/i,
  soy: /soja|tofu|edamame|tempeh/i,
  fish: /lachs|fisch|thunfisch|garnele|forelle|kabeljau|meeresfrüchte|shrimp|scholle|hering/i,
};

export function isVegetarian(recipe: RecipeListItem): boolean {
  return !recipe.ingredients.some((i) => {
    const name = i.name.toLowerCase();
    return MEAT_FISH.some((keyword) => name.includes(keyword));
  });
}

/** true, wenn das Rezept eine der Profil-Allergien berührt */
export function violatesAllergies(recipe: RecipeListItem, allergies: readonly string[]): boolean {
  if (allergies.length === 0) return false;
  return recipe.ingredients.some((i) =>
    allergies.some((allergen) => ALLERGEN_PATTERNS[allergen]?.test(i.name)),
  );
}

// ---------------------------------------------------------------------------
// Rezept-Favoriten (favorites, kind='recipe' — Schema aus Session 2)
// ---------------------------------------------------------------------------

export async function fetchRecipeFavoriteIds(userId: string): Promise<Set<number>> {
  const { data, error } = await supabase
    .from('favorites')
    .select('recipe_id')
    .eq('user_id', userId)
    .eq('kind', 'recipe');
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.recipe_id as number));
}

export async function toggleRecipeFavorite(
  userId: string,
  recipeId: number,
  isFavorite: boolean,
): Promise<void> {
  if (isFavorite) {
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .eq('kind', 'recipe')
      .eq('recipe_id', recipeId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('favorites')
      .insert({ user_id: userId, kind: 'recipe', recipe_id: recipeId });
    if (error) throw error;
  }
}

/** Reihenfolge der Kategorie-Chips (wie im Prototyp, Rest alphabetisch dahinter) */
export const CATEGORY_ORDER = [
  'Frühstück', 'Hauptgerichte', 'Suppen', 'Salate', 'Beilagen', 'Snacks', 'Desserts', 'Getränke',
];

/** Gradient-Platzhalter, bis Irina echte Fotos hochlädt (S13) — Paare aus dem Prototyp */
export const RECIPE_GRADIENTS: readonly [string, string][] = [
  ['#E8C9A8', '#C9A96A'],
  ['#A8C3A0', '#7A8B6F'],
  ['#D9B08C', '#B0785E'],
  ['#E6A5A1', '#C97B76'],
  ['#C4B5D6', '#9A87B8'],
  ['#F0D9A8', '#D4B86A'],
  ['#8B9B7A', '#6B705C'],
  ['#B0785E', '#8A5A44'],
];

export function recipeGradient(id: number): readonly [string, string] {
  return RECIPE_GRADIENTS[id % RECIPE_GRADIENTS.length];
}

/** Öffentliche URL eines Rezeptfotos (recipe-images ist ein Public Bucket) */
export function recipeImageUrl(imagePath: string): string {
  return supabase.storage.from('recipe-images').getPublicUrl(imagePath).data.publicUrl;
}
