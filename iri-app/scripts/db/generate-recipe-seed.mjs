#!/usr/bin/env node
/**
 * Erzeugt supabase/seed.sql aus supabase/data/rezepte-import.json (157 Rezepte).
 *
 * Aufruf:  node scripts/db/generate-recipe-seed.mjs
 *
 * Idempotent: upsert per Import-ID (on conflict do update) — kann nach
 * Rezept-Korrekturen in der Excel/JSON jederzeit neu laufen, ohne von der
 * App angelegte Verknüpfungen (favorites, food_logs) zu brechen.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const source = join(root, 'supabase', 'data', 'rezepte-import.json');
const target = join(root, 'supabase', 'seed.sql');

const recipes = JSON.parse(readFileSync(source, 'utf8'));

/** SQL-String-Literal: einfache Anführungszeichen verdoppeln */
const q = (value) => (value == null ? 'null' : `'${String(value).replaceAll("'", "''")}'`);
const num = (value) => (value == null ? 'null' : Number(value));

const rows = recipes.map((r) => {
  const ingredients = q(JSON.stringify(r.zutaten)) + '::jsonb';
  return `  (${[
    r.id,
    q(r.titel),
    q(r.kategorie),
    q(r.beschreibung),
    ingredients,
    q(r.zubereitung),
    num(r.portionen),
    q(r.portionen_begruendung),
    num(r.kcal_gesamt),
    num(r.kcal_portion),
    num(r.eiweiss_portion),
    num(r.kh_portion),
    num(r.fett_portion),
    q(r.naehrwert_rechnung),
  ].join(', ')})`;
});

const sql = `-- IRI — Rezept-Seed (generiert aus rezepte-import.json, NICHT von Hand editieren)
-- Neu erzeugen: node scripts/db/generate-recipe-seed.mjs
-- Stand: ${recipes.length} Rezepte

insert into public.recipes (
  id, title, category, description, ingredients, instructions,
  servings, servings_note, kcal_total, kcal_per_serving,
  protein_per_serving_g, carbs_per_serving_g, fat_per_serving_g, nutrition_note
)
values
${rows.join(',\n')}
on conflict (id) do update set
  title = excluded.title,
  category = excluded.category,
  description = excluded.description,
  ingredients = excluded.ingredients,
  instructions = excluded.instructions,
  servings = excluded.servings,
  servings_note = excluded.servings_note,
  kcal_total = excluded.kcal_total,
  kcal_per_serving = excluded.kcal_per_serving,
  protein_per_serving_g = excluded.protein_per_serving_g,
  carbs_per_serving_g = excluded.carbs_per_serving_g,
  fat_per_serving_g = excluded.fat_per_serving_g,
  nutrition_note = excluded.nutrition_note,
  updated_at = now();

-- Import-Rezepte sind redaktionell geprüft → direkt veröffentlicht
update public.recipes set status = 'published' where status = 'draft' and id <= ${Math.max(...recipes.map((r) => r.id))};

-- Identity-Sequenz hinter die Import-IDs setzen (Admin-Editor vergibt neue IDs automatisch)
select setval(pg_get_serial_sequence('public.recipes', 'id'), (select max(id) from public.recipes));
`;

writeFileSync(target, sql);
console.log(`geschrieben: ${target} (${recipes.length} Rezepte)`);
