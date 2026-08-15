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
  /** Fuer die Datumsspalte und die Sortierung in der Liste (Sascha 15.08.) */
  created_at: string;
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

export interface Broadcast {
  id: string;
  body: string;
  image_path: string | null;
  sent_at: string | null;
  send_push: boolean;
  created_at: string;
}

export const REACTION_EMOJIS = ['❤️', '🔥', '💪', '😂', '👏'] as const;

export interface Question {
  id: string;
  user_id: string;
  body: string;
  status: 'new' | 'answered' | 'published';
  answer: string | null;
  answered_at: string | null;
  published_at: string | null;
  send_push: boolean;
  created_at: string;
}

export interface Voucher {
  id: string;
  code: string;
  description: string | null;
  free_months: number;
  valid_from: string | null;
  valid_until: string | null;
  max_redemptions: number | null;
  redemption_count: number;
  active: boolean;
  created_at: string;
}

export interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  banned_until: string | null;
  is_admin: boolean;
  display_name: string | null;
  streak_count: number | null;
  onboarding_completed_at: string | null;
  subscription_status: string | null;
  subscription_period_end: string | null;
  is_legacy: boolean;
}

export function recipeImageUrl(imagePath: string | null): string | null {
  if (!imagePath) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/recipe-images/${imagePath}`;
}
