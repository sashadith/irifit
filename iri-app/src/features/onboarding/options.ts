/** Auswahloptionen des Onboarding-Quiz — Werte entsprechen den DB-Enums/Feldern */

export const goals = ['lose_weight', 'maintain', 'get_fit'] as const;

export const activityLevels = ['low', 'medium', 'high'] as const;

export const dietPreferences = ['none', 'vegetarian', 'vegan', 'pescetarian'] as const;
export type DietPreference = (typeof dietPreferences)[number];

/** Allergie-/Unverträglichkeits-Slugs (steuern später Rezeptfilter) */
export const allergens = ['gluten', 'lactose', 'nuts', 'eggs', 'soy', 'fish'] as const;
export type Allergen = (typeof allergens)[number];
