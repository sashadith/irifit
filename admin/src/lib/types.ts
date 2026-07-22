export interface Ingredient {
  name: string;
  gramm: number | null;
  menge_anzeige: string;
}

export interface Recipe {
  id: number;
  title: string;
  category: string | null;
  description: string | null;
  ingredients: Ingredient[];
  instructions: string | null;
  servings: number;
  servings_note: string | null;
  kcal_total: number | null;
  kcal_per_serving: number;
  protein_per_serving_g: number | null;
  carbs_per_serving_g: number | null;
  fat_per_serving_g: number | null;
  nutrition_note: string | null;
  tags: string[];
  image_path: string | null;
  status: 'draft' | 'published';
}

export interface Course {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
  is_legacy: boolean;
  legacy_slug: string | null;
  status: 'draft' | 'published';
}

export interface Lesson {
  id: string;
  course_id: string;
  title: string;
  summary: string | null;
  video_uid: string | null;
  video_format: 'portrait' | 'landscape';
  duration_seconds: number | null;
  sort_order: number;
  status: 'draft' | 'published';
}

export function recipeImageUrl(imagePath: string | null): string | null {
  if (!imagePath) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/recipe-images/${imagePath}`;
}
