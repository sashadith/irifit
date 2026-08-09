/**
 * Open-Food-Facts-Anbindung (Konzept Kap. 7: exakte Herstellerdaten für Barcode-Produkte).
 * Deutsche Instanz für deutschsprachige Suchtreffer; User-Agent gemäß OFF-Etikette.
 */

export interface FoodItem {
  barcode?: string;
  name: string;
  brand?: string;
  /** Nährwerte pro 100 g bzw. 100 ml */
  kcal100: number;
  protein100: number;
  carbs100: number;
  fat100: number;
  /** Portionsgröße in g/ml, falls vom Hersteller angegeben */
  servingG?: number;
  /** Anzeige-Einheit: ml bei Getränken (Nährwerte je 100 ml), sonst g */
  unit: 'g' | 'ml';
}

const HEADERS = {
  'User-Agent': 'IRI-App - React Native - beta (kontakt: sashadith@googlemail.com)',
};

const FIELDS = 'code,product_name,product_name_de,brands,nutriments,serving_quantity,nutrition_data_per,categories_tags';

interface OffNutriments {
  'energy-kcal_100g'?: number;
  proteins_100g?: number;
  carbohydrates_100g?: number;
  fat_100g?: number;
}

interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_de?: string;
  /** Alt-API: Komma-String · Search-a-licious: Array */
  brands?: string | string[];
  serving_quantity?: number | string;
  nutrition_data_per?: string;
  categories_tags?: string[];
  nutriments?: OffNutriments;
}

function toFoodItem(product: OffProduct): FoodItem | null {
  const n = product.nutriments ?? {};
  const kcal = n['energy-kcal_100g'];
  const name = product.product_name_de || product.product_name;
  // Ohne Namen oder kcal ist ein Eintrag fürs Tracking nutzlos
  if (!name || kcal == null) return null;
  const serving = Number(product.serving_quantity);
  return {
    barcode: product.code,
    name,
    brand: (Array.isArray(product.brands) ? product.brands[0] : product.brands?.split(',')[0])?.trim() || undefined,
    kcal100: Math.round(kcal),
    protein100: Math.round((n.proteins_100g ?? 0) * 10) / 10,
    carbs100: Math.round((n.carbohydrates_100g ?? 0) * 10) / 10,
    fat100: Math.round((n.fat_100g ?? 0) * 10) / 10,
    servingG: Number.isFinite(serving) && serving > 0 ? serving : undefined,
    // Getraenk? Die Such-API liefert kein nutrition_data_per, aber die
    // Kategorie-Tags (en:beverages) sind dort zuverlaessig gepflegt.
    unit:
      product.nutrition_data_per === '100ml' ||
      (product.categories_tags ?? []).some((c) => c.includes('beverage'))
        ? 'ml'
        : 'g',
  };
}

/** Barcode-Lookup — null, wenn das Produkt nicht in der Datenbank ist */
export async function lookupBarcode(barcode: string): Promise<FoodItem | null> {
  const res = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`,
    { headers: HEADERS },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`off_${res.status}`);
  const json = (await res.json()) as { status: number; product?: OffProduct };
  if (json.status !== 1 || !json.product) return null;
  return toFoodItem(json.product);
}

/**
 * Textsuche. Primär die dedizierte Such-API (search.openfoodfacts.org,
 * „Search-a-licious") — die alte cgi/search.pl auf den Hauptservern liefert
 * seit 08/2026 sporadisch 503 (Beta-Befund 09.08.: „Prüfe deine Verbindung").
 * Die alte Route bleibt als Fallback.
 */
export async function searchFoods(query: string): Promise<FoodItem[]> {
  try {
    const params = new URLSearchParams({
      q: query,
      langs: 'de',
      page_size: '25',
      fields: FIELDS,
    });
    const res = await fetch(`https://search.openfoodfacts.org/search?${params}`, {
      headers: HEADERS,
    });
    if (!res.ok) throw new Error(`off_search_${res.status}`);
    const json = (await res.json()) as { hits?: OffProduct[] };
    return (json.hits ?? [])
      .map(toFoodItem)
      .filter((item): item is FoodItem => item !== null);
  } catch {
    return searchFoodsLegacy(query);
  }
}

/** Fallback: alte Suche auf der deutschen Instanz */
async function searchFoodsLegacy(query: string): Promise<FoodItem[]> {
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: '25',
    fields: FIELDS,
  });
  const res = await fetch(`https://de.openfoodfacts.org/cgi/search.pl?${params}`, {
    headers: HEADERS,
  });
  if (!res.ok) throw new Error(`off_${res.status}`);
  const json = (await res.json()) as { products?: OffProduct[] };
  return (json.products ?? [])
    .map(toFoodItem)
    .filter((item): item is FoodItem => item !== null);
}

/** Nährwerte für eine Menge in Gramm (linear aus den 100-g-Werten) */
export function nutrientsForAmount(item: FoodItem, grams: number) {
  const factor = grams / 100;
  const round1 = (v: number) => Math.round(v * 10) / 10;
  return {
    kcal: Math.round(item.kcal100 * factor),
    protein_g: round1(item.protein100 * factor),
    carbs_g: round1(item.carbs100 * factor),
    fat_g: round1(item.fat100 * factor),
  };
}
