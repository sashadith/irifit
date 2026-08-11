// IRI — AI-Essensanalyse (Session 5, Konzept Kap. 7)
// Foto (base64, client-seitig ~1024px komprimiert) → Claude Vision → strukturiertes JSON.
// Zweistufig: Haiku 4.5 analysiert jeden Scan; bei niedriger Konfidenz übernimmt Sonnet 5.
// Korrekturen der Nutzerin fließen als Kontext in die Neuberechnung ein.
// Fair-Use: 300 Analysen/Monat. Fotos werden NICHT gespeichert.
import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js@2';

const FAIR_USE_LIMIT = 300;
const HAIKU = 'claude-haiku-4-5';
const SONNET = 'claude-sonnet-5';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Structured-Output-Schema: pro Zutat Gramm + Nährwerte, damit die App
// Portionsänderungen lokal linear nachrechnen kann.
const SCAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['dish', 'portion', 'confidence', 'ingredients'],
  properties: {
    dish: { type: 'string', description: 'Kurzer deutscher Name des Gerichts' },
    portion: {
      type: 'string',
      description: "Portionsbeschreibung, z. B. '1 Teller (ca. 350 g)'",
    },
    confidence: {
      type: 'string',
      enum: ['high', 'medium', 'low'],
      description: 'Wie sicher ist die Erkennung insgesamt',
    },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'grams', 'kcal', 'protein_g', 'carbs_g', 'fat_g'],
        properties: {
          name: { type: 'string', description: 'Zutat auf Deutsch' },
          grams: { type: 'number', description: 'Geschätzte Menge in Gramm' },
          kcal: { type: 'number' },
          protein_g: { type: 'number' },
          carbs_g: { type: 'number' },
          fat_g: { type: 'number' },
        },
      },
    },
  },
} as const;

// Kühlschrank-Scan (Session 8b): Zutaten erkennen + EIN freier Gericht-Vorschlag
const INVENTORY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['ingredients', 'suggestion', 'confidence'],
  properties: {
    ingredients: {
      type: 'array',
      items: { type: 'string' },
      description: 'Erkennbare Lebensmittel auf Deutsch, Singular, ohne Mengen, dedupliziert, max. 20',
    },
    suggestion: {
      type: 'object',
      additionalProperties: false,
      required: ['dish', 'description', 'kcal', 'protein_g', 'carbs_g', 'fat_g'],
      properties: {
        dish: { type: 'string', description: 'Kurzer appetitlicher Gerichtname' },
        description: { type: 'string', description: '1–2 Sätze Zubereitungs-Idee' },
        kcal: { type: 'number' },
        protein_g: { type: 'number' },
        carbs_g: { type: 'number' },
        fat_g: { type: 'number' },
      },
    },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
  },
} as const;

const INVENTORY_PROMPT = `Du bist die Vorrats-Analyse von IRI, einer deutschen Ernährungs-App für Frauen, die abnehmen möchten, ohne zu hungern.

Analysiere das Foto eines Kühlschranks oder Vorratsschranks.

Regeln:
- Liste erkennbare Lebensmittel als generische deutsche Zutaten (Singular, ohne Mengen und Marken: 'Paprika', nicht 'Bio-Paprika 500g'). Maximal 20, dedupliziert. Nur, was wirklich erkennbar ist — nicht raten.
- Erstelle genau EINEN realistischen Gericht-Vorschlag, der sich primär aus den erkannten Zutaten plus Küchen-Basics (Salz, Pfeffer, Öl, Gewürze) kochen lässt. Sättigend und möglichst proteinbetont ('Abnehmen ohne zu hungern'). Kurze Zubereitungs-Idee in 1–2 Sätzen, geschätzte Nährwerte pro Portion.
- confidence 'low', wenn das Foto unscharf ist, wenig zu erkennen ist oder es kein Vorrats-/Kühlschrankfoto ist.
- Wenn keine Lebensmittel erkennbar sind: leere Zutatenliste, dish='Nichts erkannt', confidence='low'.`;

// Text-Eingabe (Session 22): Freitext wie '100 g Hähnchenbrust gebraten, 10 g Öl'
// → gleiche Zutaten-Struktur wie der Foto-Scan, damit die App identisch rechnet
const TEXT_PROMPT = `Du bist die Essens-Analyse von IRI, einer deutschen Ernährungs-App für Frauen, die abnehmen möchten, ohne zu hungern.

Die Nutzerin beschreibt ihre Mahlzeit als freien Text (oft mit Tippfehlern, Abkürzungen wie 'gr', 'EL', 'TL', 'Stk', Umgangssprache). Zerlege die Beschreibung in Zutaten mit Gramm-Mengen und berechne die Nährwerte.

Regeln:
- Angegebene Mengen sind Wahrheit — exakt übernehmen ('100 gr' = 100 g, '1 EL Öl' ≈ 10 g, '1 TL' ≈ 5 g, '1 Dose Cola' = 330 ml ≈ 330 g). Fehlt eine Menge, schätze eine realistische deutsche Portion.
- Zubereitungsart einrechnen: 'gebraten' ohne separates Öl → typische Bratfett-Menge als eigene Zutat ergänzen; steht Öl/Butter schon im Text, NICHT doppelt zählen.
- Tippfehler stillschweigend korrigieren ('Hhnerbrust' → Hähnchenbrust).
- Nährwerte pro Zutat müssen zur Menge passen (4 kcal/g Kohlenhydrate, 4 kcal/g Protein, 9 kcal/g Fett).
- dish: kurzer deutscher Name der Mahlzeit (max. 40 Zeichen), portion: Gesamtmenge (z. B. '110 g').
- confidence 'high' bei klaren Mengenangaben; 'low' nur, wenn der Text keine Mahlzeit beschreibt — dann dish='Keine Mahlzeit erkannt' und leere Zutatenliste.`;

// Stabiler System-Prompt (Prompt-Caching-Breakpoint am Ende)
const SYSTEM_PROMPT = `Du bist die Essens-Analyse von IRI, einer deutschen Ernährungs-App für Frauen, die abnehmen möchten, ohne zu hungern.

Analysiere das Foto einer Mahlzeit und schätze Zutaten, Mengen und Nährwerte.

Regeln:
- Deutsche Ess-Realität ausdrücklich berücksichtigen: Hausmannskost (z. B. Schnitzel, Eintöpfe, Aufläufe), Bäckerei-Produkte (belegte Brötchen, Laugengebäck, Kuchen), Kantinengerichte, Abendbrot mit Brot/Aufschnitt/Käse.
- Nenne 2–6 Hauptzutaten mit realistischen Gramm-Mengen für die sichtbare Portion. Versteckte Kalorienträger (Öl, Butter, Sahne, Dressing, Zucker) einschätzen und als eigene Zutat aufführen, wenn wahrscheinlich.
- Nährwerte pro Zutat müssen zur Menge passen (Plausibilität: 4 kcal/g Kohlenhydrate, 4 kcal/g Protein, 9 kcal/g Fett).
- Mengen im Zweifel leicht konservativ schätzen, aber nicht schönrechnen.
- confidence: 'high' nur, wenn Gericht UND Portionsgröße klar erkennbar sind; 'low' bei unklarem Foto, verdeckten Zutaten, unbekanntem Gericht oder schwer schätzbarer Menge.
- dish: kurzer, appetitlicher deutscher Name (max. 40 Zeichen).
- Wenn eine Korrektur der Nutzerin mitgegeben wird, übernimm ihre Angaben als Wahrheit und rechne den Rest konsistent neu.
- Wenn auf dem Foto kein Essen zu erkennen ist, gib dish='Kein Essen erkannt', confidence='low' und eine leere Zutatenliste zurück.`;

interface Ingredient {
  name: string;
  grams: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

interface ScanResult {
  dish: string;
  portion: string;
  confidence: 'high' | 'medium' | 'low';
  ingredients: Ingredient[];
}

interface InventoryResult {
  ingredients: string[];
  suggestion: {
    dish: string;
    description: string;
    kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  };
  confidence: 'high' | 'medium' | 'low';
}

function buildUserContent(
  image: { base64: string; mediaType: string },
  correction?: { previous: ScanResult; note?: string },
  mode: 'meal' | 'inventory' = 'meal',
): Anthropic.MessageParam['content'] {
  const parts: Anthropic.ContentBlockParam[] = [
    {
      type: 'image',
      source: {
        type: 'base64',
        media_type: image.mediaType as 'image/jpeg' | 'image/png' | 'image/webp',
        data: image.base64,
      },
    },
  ];
  if (correction) {
    parts.push({
      type: 'text',
      text: `Deine bisherige Analyse:\n${JSON.stringify(correction.previous)}\n\nKorrektur der Nutzerin: ${
        correction.note ?? 'siehe angepasste Zutaten in der bisherigen Analyse'
      }\n\nBerechne das Ergebnis damit neu.`,
    });
  } else {
    parts.push({
      type: 'text',
      text: mode === 'inventory' ? 'Analysiere diese Vorräte.' : 'Analysiere diese Mahlzeit.',
    });
  }
  return parts;
}

async function analyze<T>(
  anthropic: Anthropic,
  model: string,
  content: Anthropic.MessageParam['content'],
  systemPrompt: string,
  schema: object,
): Promise<T> {
  const response = await anthropic.messages.create({
    model,
    max_tokens: 2000,
    // Sonnet 5 würde sonst adaptiv "denken" — für 2–4 s Latenz abschalten.
    // Haiku 4.5 akzeptiert disabled ebenfalls (kein thinking konfiguriert = aus).
    ...(model === SONNET ? { thinking: { type: 'disabled' as const } } : {}),
    system: [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' },
      },
    ],
    output_config: { format: { type: 'json_schema', schema } },
    messages: [{ role: 'user', content }],
  });
  if (response.stop_reason === 'refusal') {
    throw new Error('analysis_refused');
  }
  const text = response.content.find((b) => b.type === 'text');
  if (!text || text.type !== 'text') throw new Error('empty_response');
  return JSON.parse(text.text) as T;
}

/** Zweistufig Haiku→Sonnet mit gemeinsamer Konfidenz-Eskalation */
async function analyzeTwoStage<T extends { confidence: string }>(
  anthropic: Anthropic,
  content: Anthropic.MessageParam['content'],
  systemPrompt: string,
  schema: object,
  hasContent: (r: T) => boolean,
): Promise<{ result: T; modelUsed: 'haiku' | 'sonnet' }> {
  let result = await analyze<T>(anthropic, HAIKU, content, systemPrompt, schema);
  let modelUsed: 'haiku' | 'sonnet' = 'haiku';
  if (result.confidence === 'low' && hasContent(result)) {
    try {
      result = await analyze<T>(anthropic, SONNET, content, systemPrompt, schema);
      modelUsed = 'sonnet';
    } catch {
      // Sonnet-Fehler ist nicht fatal — Haiku-Ergebnis behalten
    }
  }
  return { result, modelUsed };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: CORS });
  }

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicKey) {
    return new Response(JSON.stringify({ error: 'missing_anthropic_key' }), { status: 500, headers: CORS });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Nutzerin aus dem JWT ermitteln (verify_jwt ist zusätzlich aktiv)
  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
  const { data: userData, error: userError } = await admin.auth.getUser(jwt);
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: CORS });
  }
  const userId = userData.user.id;

  // S11-Sicherheitscheckliste (b): Scans nur mit gültigem Abo — die Hard
  // Paywall ist clientseitig, hier ist die serverseitige Grenze (Admins frei).
  const isAdmin = userData.user.app_metadata?.role === 'admin';
  if (!isAdmin) {
    const { data: sub } = await admin
      .from('subscriptions')
      .select('status, current_period_end')
      .eq('user_id', userId)
      .in('status', ['trialing', 'active', 'in_grace'])
      .maybeSingle();
    const valid =
      sub != null && (sub.current_period_end == null || new Date(sub.current_period_end) > new Date());
    if (!valid) {
      return new Response(JSON.stringify({ error: 'no_subscription' }), { status: 403, headers: CORS });
    }
  }

  let body: {
    image?: { base64: string; mediaType: string };
    text?: string;
    correction?: { previous: ScanResult; note?: string };
    mode?: 'meal' | 'inventory' | 'text';
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400, headers: CORS });
  }
  const mode = body.mode === 'inventory' ? 'inventory' : body.mode === 'text' ? 'text' : 'meal';
  const textInput = (body.text ?? '').trim().slice(0, 600);
  if (mode === 'text') {
    if (!textInput) {
      return new Response(JSON.stringify({ error: 'missing_text' }), { status: 400, headers: CORS });
    }
  } else if (!body.image?.base64 || !body.image.mediaType) {
    return new Response(JSON.stringify({ error: 'missing_image' }), { status: 400, headers: CORS });
  }

  // Fair-Use: 300 Analysen pro Kalendermonat — atomarer Increment VOR dem
  // Modell-Aufruf (S11-Checkliste d: Read-then-Upsert war race-anfällig)
  const month = new Date().toISOString().slice(0, 7);
  const { data: newCount, error: usageError } = await admin.rpc('increment_scan_usage', {
    p_user_id: userId,
    p_month: month,
  });
  if (usageError) {
    return new Response(JSON.stringify({ error: 'usage_tracking_failed' }), { status: 500, headers: CORS });
  }
  const used = Number(newCount);
  if (used > FAIR_USE_LIMIT) {
    return new Response(
      JSON.stringify({ error: 'fair_use_exceeded', scansUsed: FAIR_USE_LIMIT, scansLimit: FAIR_USE_LIMIT }),
      { status: 429, headers: CORS },
    );
  }

  const anthropic = new Anthropic({ apiKey: anthropicKey });

  let result: ScanResult | InventoryResult;
  let modelUsed: 'haiku' | 'sonnet';
  try {
    if (mode === 'text') {
      const content: Anthropic.MessageParam['content'] = [
        { type: 'text', text: `Beschreibung der Mahlzeit: "${textInput}"` },
      ];
      ({ result, modelUsed } = await analyzeTwoStage<ScanResult>(
        anthropic,
        content,
        TEXT_PROMPT,
        SCAN_SCHEMA,
        (r) => r.ingredients.length > 0,
      ));
    } else if (mode === 'inventory') {
      const content = buildUserContent(body.image, undefined, 'inventory');
      // Zweistufig: nur bei niedriger Konfidenz das teurere Modell (~20 % der Fälle)
      ({ result, modelUsed } = await analyzeTwoStage<InventoryResult>(
        anthropic,
        content,
        INVENTORY_PROMPT,
        INVENTORY_SCHEMA,
        (r) => r.ingredients.length > 0,
      ));
    } else {
      const content = buildUserContent(body.image, body.correction);
      ({ result, modelUsed } = await analyzeTwoStage<ScanResult>(
        anthropic,
        content,
        SYSTEM_PROMPT,
        SCAN_SCHEMA,
        (r) => r.ingredients.length > 0,
      ));
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown';
    const status = message === 'analysis_refused' ? 422 : 502;
    return new Response(JSON.stringify({ error: 'analysis_failed', detail: message }), {
      status,
      headers: CORS,
    });
  }

  return new Response(
    JSON.stringify({
      mode,
      result,
      model: modelUsed,
      scansUsed: used,
      scansLimit: FAIR_USE_LIMIT,
    }),
    { headers: { ...CORS, 'Content-Type': 'application/json' } },
  );
});
