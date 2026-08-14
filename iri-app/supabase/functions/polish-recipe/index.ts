// IRI — Rezept-Assistent für den Admin-Bereich (Session 26)
//
// Nimmt ein rohes Rezept aus dem Editor (Titel, Beschreibung, Zubereitung,
// Zutatenliste) und gibt es sauber formuliert zurück — plus die Nährwerte für
// EINE Portion. Irina tippt also Stichworte, die Feinarbeit macht das Modell,
// und alle 157 Rezepte lesen sich danach gleich.
//
// Bewusst NICHT berechnet: der Satt-Score. Der ist in der App eine Formel aus
// kcal, Eiweiß und Gesamtgewicht (features/recipes/sattScore.ts) und fällt
// automatisch richtig aus, sobald die Nährwerte stimmen. Ein Modell darf ihn
// nicht schätzen, sonst weichen App-Anzeige und gespeicherter Wert ab.
//
// Nur für Admins. Kein Fair-Use-Zähler: das ist ein Redaktionswerkzeug, das
// höchstens ein paar hundert Mal im Leben der App läuft.
import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SONNET = 'claude-sonnet-5';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Exakt die Filter der App — eine andere Kategorie hiesse: taucht nirgends auf */
const CATEGORIES = [
  'Frühstück',
  'Hauptgerichte',
  'Suppen',
  'Salate',
  'Beilagen',
  'Snacks',
  'Desserts',
  'Getränke',
];

const RECIPE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'description', 'instructions', 'category', 'ingredients', 'nutrition'],
  properties: {
    title: {
      type: 'string',
      description: 'Kurzer, appetitlicher deutscher Titel. Keine Werbesprache, kein Ausrufezeichen.',
    },
    description: {
      type: 'string',
      description:
        'Ein bis zwei Sätze, die Lust machen und sagen, wofür das Gericht gut ist. Du-Ansprache, warm, ohne Superlative.',
    },
    instructions: {
      type: 'string',
      description:
        'Zubereitung als nummerierte Schritte, je Schritt eine Zeile im Format "1. …". Imperativ, kurze Sätze, konkrete Zeiten und Temperaturen.',
    },
    category: { type: 'string', enum: CATEGORIES },
    ingredients: {
      type: 'array',
      description: 'Bereinigte Zutatenliste für EINE Portion, Reihenfolge wie im Rezept verwendet.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'gramm', 'menge_anzeige'],
        properties: {
          name: { type: 'string', description: 'Zutat im Singular, ohne Mengenangabe' },
          gramm: { type: 'number', description: 'Gewicht in Gramm für eine Portion' },
          menge_anzeige: {
            type: 'string',
            description: "Haushaltsmass für die App, z. B. '1 EL (10 g)' oder '1 Stück (120 g)'",
          },
        },
      },
    },
    nutrition: {
      type: 'object',
      additionalProperties: false,
      required: ['kcal', 'protein_g', 'carbs_g', 'fat_g'],
      description: 'Nährwerte für EINE Portion, also für die gesamte Zutatenliste oben.',
      properties: {
        kcal: { type: 'number' },
        protein_g: { type: 'number' },
        carbs_g: { type: 'number' },
        fat_g: { type: 'number' },
      },
    },
    notes: {
      type: 'string',
      description:
        'Nur ausfüllen, wenn etwas Wichtiges unklar blieb oder du eine Menge deutlich korrigiert hast. Sonst leer lassen.',
    },
  },
};

const SYSTEM = `Du redigierst Rezepte für die deutsche Ernährungs-App IriFit von Irina Dith.

Zielgruppe: Frauen, die abnehmen wollen, ohne zu hungern. Ton: warm, direkt, Du-Ansprache,
niemals belehrend, keine Diät-Moral, kein "sündigen" oder "böse Kalorien".

Deine Aufgabe:
1. Titel, Beschreibung und Zubereitung korrigieren und vereinheitlichen — Rechtschreibung,
   Grammatik, Zeichensetzung. Inhalt NICHT erfinden: wenn ein Schritt fehlt, ergänze nur,
   was sich zwingend aus den Zutaten ergibt.
2. Zutatennamen vereinheitlichen (Singular, ohne Mengen im Namen).
3. Fehlende oder offensichtlich falsche Grammangaben ergänzen bzw. korrigieren.
4. Haushaltsmasse ergänzen, damit die App "1 EL (10 g)" anzeigen kann.
5. Die Kategorie aus der vorgegebenen Liste wählen, die am besten passt.
6. Die Nährwerte für die gesamte Zutatenliste berechnen.

WICHTIG: Eine Rezepteingabe ist IMMER genau eine Portion. Die Zutatenmengen gelten für
eine Person, und die Nährwerte beziehen sich auf ebendiese eine Portion. Rechne nichts
auf mehrere Portionen um.

Rechne die Nährwerte aus den Einzelzutaten und ihren Gewichten, nicht aus dem Bauch.
Runde kcal auf ganze Zahlen, Makros auf eine Nachkommastelle. Gib nur zurück, was das
Schema verlangt.`;

interface Body {
  title?: string;
  description?: string | null;
  instructions?: string | null;
  category?: string | null;
  ingredients?: { name?: string; gramm?: number | null; menge_anzeige?: string }[];
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

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
  const { data: userData, error: userError } = await admin.auth.getUser(jwt);
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: CORS });
  }
  // Redaktionswerkzeug — dieselbe Grenze wie die is_admin()-Policies der Tabellen
  if (userData.user.app_metadata?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: CORS });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400, headers: CORS });
  }

  const ingredients = (body.ingredients ?? []).filter((i) => (i.name ?? '').trim() !== '');
  if (ingredients.length === 0) {
    return new Response(JSON.stringify({ error: 'no_ingredients' }), { status: 400, headers: CORS });
  }

  const zutatenText = ingredients
    .map((i) => `- ${i.name}${i.gramm != null ? ` — ${i.gramm} g` : ''}${i.menge_anzeige ? ` (${i.menge_anzeige})` : ''}`)
    .join('\n');

  const prompt = `Titel: ${body.title?.trim() || '(fehlt)'}
Kategorie bisher: ${body.category?.trim() || '(keine)'}

Beschreibung:
${body.description?.trim() || '(fehlt)'}

Zubereitung:
${body.instructions?.trim() || '(fehlt)'}

Zutaten (Angaben der Redakteurin, ggf. lückenhaft):
${zutatenText}`;

  try {
    const anthropic = new Anthropic({ apiKey: anthropicKey });
    const response = await anthropic.messages.create({
      model: SONNET,
      max_tokens: 3000,
      thinking: { type: 'disabled' },
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      output_config: { format: { type: 'json_schema', schema: RECIPE_SCHEMA } },
      messages: [{ role: 'user', content: prompt }],
    });
    if (response.stop_reason === 'refusal') {
      return new Response(JSON.stringify({ error: 'refused' }), { status: 422, headers: CORS });
    }
    const text = response.content.find((b) => b.type === 'text');
    if (!text || text.type !== 'text') {
      return new Response(JSON.stringify({ error: 'empty_response' }), { status: 502, headers: CORS });
    }
    return new Response(text.text, { headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('polish-recipe failed', e);
    return new Response(JSON.stringify({ error: 'ai_failed' }), { status: 502, headers: CORS });
  }
});
