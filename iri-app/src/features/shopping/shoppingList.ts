import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Einkaufsliste — bewusst lokal (AsyncStorage, kein Sync): schnell, offline,
 * ohne Schema-Erweiterung. Geräteübergreifender Sync wäre ein Nach-Launch-Thema.
 */

export interface ShoppingItem {
  id: string;
  text: string;
  recipeTitle: string | null;
  checked: boolean;
  addedAt: number;
}

const STORAGE_KEY = 'iri.shoppingList';

export async function loadShoppingList(): Promise<ShoppingItem[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ShoppingItem[]) : [];
  } catch {
    return [];
  }
}

export async function saveShoppingList(items: ShoppingItem[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export async function addItems(
  texts: readonly string[],
  recipeTitle: string | null,
): Promise<ShoppingItem[]> {
  const existing = await loadShoppingList();
  const now = Date.now();
  const fresh: ShoppingItem[] = texts.map((text, i) => ({
    id: `${now}-${i}`,
    text,
    recipeTitle,
    checked: false,
    addedAt: now,
  }));
  const next = [...existing, ...fresh];
  await saveShoppingList(next);
  return next;
}
