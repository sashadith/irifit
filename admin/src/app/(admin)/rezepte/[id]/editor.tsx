'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { recipeSattScore, sattDots } from '@/lib/sattScore';
import { supabaseBrowser } from '@/lib/supabase/client';
import { Ingredient, Recipe, recipeImageUrl } from '@/lib/types';

/**
 * Genau die Kategorien, nach denen die App filtert
 * (iri-app/src/features/recipes/recipesData.ts) — „Alle" ist dort nur der
 * Filter-Chip, keine echte Kategorie. Freitext hier hiesse: das Rezept taucht
 * in keinem Filter auf.
 */
const RECIPE_CATEGORIES = [
  'Frühstück',
  'Hauptgerichte',
  'Suppen',
  'Salate',
  'Beilagen',
  'Snacks',
  'Desserts',
  'Getränke',
] as const;

/** Was der Editor bearbeitet: id und created_at vergibt die Datenbank */
type RecipeDraft = Omit<Recipe, 'id' | 'created_at'>;

const EMPTY: RecipeDraft = {
  title: '',
  category: null,
  description: null,
  ingredients: [],
  instructions: null,
  servings: 1,
  servings_note: null,
  kcal_total: null,
  kcal_per_serving: 0,
  protein_per_serving_g: null,
  carbs_per_serving_g: null,
  fat_per_serving_g: null,
  nutrition_note: null,
  tags: [],
  image_path: null,
  status: 'draft',
};

/** KI-Sternchen wie in der App: klein unten links, groß oben rechts (Sascha 12.08.) */
function SparkleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.5 2.5l1.1 2.9 2.9 1.1-2.9 1.1-1.1 2.9-1.1-2.9L12.5 6.5l2.9-1.1z" />
      <path d="M7 13l.8 2.2L10 16l-2.2.8L7 19l-.8-2.2L4 16l2.2-.8z" />
    </svg>
  );
}

/** Foto clientseitig auf max. 1280 px verkleinern und als JPEG hochladen */
async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob fehlgeschlagen'))), 'image/jpeg', 0.82),
  );
}

export function RecipeEditor({ recipeId }: { recipeId: number | null }) {
  const router = useRouter();
  const [recipe, setRecipe] = useState<RecipeDraft>(EMPTY);
  const [loaded, setLoaded] = useState(recipeId === null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  /**
   * Gewähltes Foto, das noch nicht im Bucket liegt. Zwei Aufgaben: sofortige
   * Vorschau (vorher stand nach dem Auswählen weiter „Noch kein Foto") und ein
   * Zwischenlager für neue Rezepte — die haben noch keine ID, unter der das
   * Bild abgelegt werden könnte, also wandert es direkt nach dem Anlegen hoch.
   */
  const [pendingPhoto, setPendingPhoto] = useState<{ file: File; url: string } | null>(null);

  // Object-URLs wieder freigeben, sonst hält der Browser die Datei im Speicher
  useEffect(() => () => {
    if (pendingPhoto) URL.revokeObjectURL(pendingPhoto.url);
  }, [pendingPhoto]);

  useEffect(() => {
    if (recipeId === null) return;
    supabaseBrowser()
      .from('recipes')
      .select('*')
      .eq('id', recipeId)
      .single()
      .then(({ data, error }) => {
        if (error) setMessage({ kind: 'error', text: error.message });
        else setRecipe(data as Recipe);
        setLoaded(true);
      });
  }, [recipeId]);

  const set = <K extends keyof RecipeDraft>(key: K, value: RecipeDraft[K]) =>
    setRecipe((r) => ({ ...r, [key]: value }));

  const setIngredient = (index: number, patch: Partial<Ingredient>) =>
    setRecipe((r) => ({
      ...r,
      ingredients: r.ingredients.map((ing, i) => (i === index ? { ...ing, ...patch } : ing)),
    }));

  const score = useMemo(() => recipeSattScore(recipe), [recipe]);

  const save = async () => {
    setBusy(true);
    setMessage(null);
    const supabase = supabaseBrowser();
    const payload = { ...recipe, updated_at: new Date().toISOString() };
    if (recipeId === null) {
      const { data, error } = await supabase.from('recipes').insert(payload).select('id').single();
      if (error) setMessage({ kind: 'error', text: error.message });
      else {
        // Vorgemerktes Foto nachreichen — erst jetzt gibt es eine ID dafür
        if (pendingPhoto) {
          try {
            await uploadPhoto(pendingPhoto.file, data.id, null);
          } catch (e) {
            setMessage({
              kind: 'error',
              text: `Rezept angelegt, aber das Foto ging nicht hoch: ${e instanceof Error ? e.message : String(e)}`,
            });
          }
        }
        router.replace(`/rezepte/${data.id}`);
        return;
      }
    } else {
      const { error } = await supabase.from('recipes').update(payload).eq('id', recipeId);
      setMessage(error ? { kind: 'error', text: error.message } : { kind: 'ok', text: 'Gespeichert.' });
    }
    setBusy(false);
  };

  /** Datei hochladen und am Rezept vermerken. id explizit, weil ein frisch
   *  angelegtes Rezept seine ID erst nach dem Insert kennt. */
  const uploadPhoto = async (file: File, id: number, previousPath: string | null) => {
    const blob = await compressImage(file);
    // Neuer Dateiname pro Upload: bustet den 1-Jahres-Cache in der App
    const path = `${id}-${Date.now()}.jpg`;
    const supabase = supabaseBrowser();
    const { error: uploadError } = await supabase.storage
      .from('recipe-images')
      .upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
    if (uploadError) throw uploadError;
    const { error: dbError } = await supabase.from('recipes').update({ image_path: path }).eq('id', id);
    if (dbError) throw dbError;
    if (previousPath && previousPath !== path) {
      await supabase.storage.from('recipe-images').remove([previousPath]);
    }
    return path;
  };

  /** Foto ausgewählt: sofort anzeigen, bei bestehendem Rezept gleich hochladen */
  const pickPhoto = async (file: File) => {
    if (pendingPhoto) URL.revokeObjectURL(pendingPhoto.url);
    setPendingPhoto({ file, url: URL.createObjectURL(file) });
    setMessage(null);

    if (recipeId === null) {
      setMessage({ kind: 'ok', text: 'Foto gemerkt — es wird beim Anlegen mit hochgeladen.' });
      return;
    }
    setBusy(true);
    try {
      const path = await uploadPhoto(file, recipeId, recipe.image_path);
      set('image_path', path);
      setPendingPhoto(null);
      setMessage({ kind: 'ok', text: 'Foto aktualisiert.' });
    } catch (e) {
      setMessage({ kind: 'error', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  /**
   * Rezept vom Modell redigieren lassen: Titel, Beschreibung, Zubereitung und
   * Zutaten werden vereinheitlicht, die Nährwerte für EINE Portion berechnet.
   * Der Satt-Score kommt nicht von der KI — den rechnet dieselbe Formel wie in
   * der App aus kcal, Eiweiß und Gesamtgewicht, sobald die Werte stehen.
   */
  const polish = async () => {
    const usable = recipe.ingredients.filter((i) => i.name.trim() !== '');
    if (usable.length === 0) {
      setMessage({ kind: 'error', text: 'Trag zuerst die Zutaten ein — daraus rechnet die KI.' });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const supabase = supabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/polish-recipe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({
          title: recipe.title,
          description: recipe.description,
          instructions: recipe.instructions,
          category: recipe.category,
          ingredients: usable,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);

      setRecipe((r) => ({
        ...r,
        title: json.title ?? r.title,
        description: json.description ?? r.description,
        instructions: json.instructions ?? r.instructions,
        category: json.category ?? r.category,
        ingredients: json.ingredients ?? r.ingredients,
        // Eine Rezepteingabe ist immer eine Portion (Sascha 14.08.)
        servings: 1,
        kcal_per_serving: Math.round(json.nutrition?.kcal ?? r.kcal_per_serving),
        kcal_total: Math.round(json.nutrition?.kcal ?? r.kcal_per_serving),
        protein_per_serving_g: json.nutrition?.protein_g ?? r.protein_per_serving_g,
        carbs_per_serving_g: json.nutrition?.carbs_g ?? r.carbs_per_serving_g,
        fat_per_serving_g: json.nutrition?.fat_g ?? r.fat_per_serving_g,
      }));
      setMessage({
        kind: 'ok',
        text: json.notes
          ? `Überarbeitet. Hinweis der KI: ${json.notes}`
          : 'Überarbeitet — bitte durchlesen und dann speichern.',
      });
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      const text =
        raw === 'forbidden'
          ? 'Nur Admins dürfen das.'
          : raw === 'no_ingredients'
            ? 'Ohne Zutaten kann die KI nichts rechnen.'
            : `KI-Aufruf fehlgeschlagen: ${raw}`;
      setMessage({ kind: 'error', text });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (recipeId === null) return;
    if (!window.confirm('Rezept wirklich löschen? Das lässt sich nicht rückgängig machen.')) return;
    setBusy(true);
    const supabase = supabaseBrowser();
    const { error } = await supabase.from('recipes').delete().eq('id', recipeId);
    if (error) {
      setMessage({ kind: 'error', text: error.message });
      setBusy(false);
      return;
    }
    if (recipe.image_path) await supabase.storage.from('recipe-images').remove([recipe.image_path]);
    router.replace('/rezepte');
  };

  if (!loaded) return <p className="hint">Lädt …</p>;

  // Vorschau: das eben gewählte Foto schlägt den Bucket-Stand
  const imageUrl = pendingPhoto?.url ?? recipeImageUrl(recipe.image_path);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{recipeId === null ? 'Neues Rezept' : `Rezept #${recipeId}`}</div>
          <h1 className="display">{recipe.title || 'Ohne Titel'}</h1>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="satt" title="Satt-Score-Vorschau (wie in der App)">
            {sattDots(score)}
          </span>
          <button className="btn btn-ghost" onClick={() => router.push('/rezepte')}>
            Zurück
          </button>
          <button className="btn btn-primary" onClick={save} disabled={busy || !recipe.title.trim()}>
            {recipeId === null ? 'Anlegen' : 'Speichern'}
          </button>
        </div>
      </div>

      {message ? (
        <p className={message.kind === 'ok' ? 'ok-text' : 'error-text'} style={{ marginBottom: 14 }}>
          {message.text}
        </p>
      ) : null}

      <div className="split wide-left">
        <div className="glass pad">
          <div className="form-row cols-2">
            <div className="field">
              <label>Titel</label>
              <input value={recipe.title} onChange={(e) => set('title', e.target.value)} />
            </div>
            <div className="field">
              <label>Kategorie</label>
              <select value={recipe.category ?? ''} onChange={(e) => set('category', e.target.value || null)}>
                <option value="">— bitte wählen —</option>
                {RECIPE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Beschreibung</label>
            <textarea
              value={recipe.description ?? ''}
              onChange={(e) => set('description', e.target.value || null)}
            />
          </div>
          <div className="field">
            <label>Zubereitung</label>
            <textarea
              style={{ minHeight: 140 }}
              value={recipe.instructions ?? ''}
              onChange={(e) => set('instructions', e.target.value || null)}
            />
          </div>

          <div className="eyebrow" style={{ margin: '10px 0' }}>
            Zutaten (Gramm fürs ganze Rezept)
          </div>
          {recipe.ingredients.map((ing, i) => (
            <div key={i} className="form-row ingredient-row" style={{ marginBottom: 8 }}>
              <input
                aria-label="Zutat"
                placeholder="Zutat"
                value={ing.name}
                onChange={(e) => setIngredient(i, { name: e.target.value })}
                className="ing-input"
              />
              <input
                aria-label="Gramm"
                placeholder="g"
                type="number"
                value={ing.gramm ?? ''}
                onChange={(e) => setIngredient(i, { gramm: e.target.value === '' ? null : Number(e.target.value) })}
                className="ing-input"
              />
              <input
                aria-label="Anzeige"
                placeholder="Anzeige, z. B. 1 EL (10 g)"
                value={ing.menge_anzeige}
                onChange={(e) => setIngredient(i, { menge_anzeige: e.target.value })}
                className="ing-input"
              />
              <button
                className="btn btn-danger btn-small"
                title="Zutat entfernen"
                onClick={() => set('ingredients', recipe.ingredients.filter((_, j) => j !== i))}
              >
                ×
              </button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              className="btn btn-ghost btn-small"
              onClick={() =>
                set('ingredients', [...recipe.ingredients, { name: '', gramm: null, menge_anzeige: '' }])
              }
            >
              + Zutat
            </button>
            <button className="btn btn-primary btn-small" onClick={polish} disabled={busy}>
              <SparkleIcon />
              {busy ? 'IriFit KI rechnet …' : 'Mit KI berechnen'}
            </button>
          </div>
          <p className="hint" style={{ marginTop: 8 }}>
            Bessert Titel, Beschreibung, Zubereitung und Zutaten aus und füllt die Nährwerte für eine
            Portion. Danach bitte durchlesen — gespeichert wird erst mit „Speichern".
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="glass pad">
            <div className="eyebrow" style={{ marginBottom: 10 }}>
              Foto
            </div>
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt={recipe.title} style={{ width: '100%', borderRadius: 14, marginBottom: 10 }} />
            ) : (
              <p className="hint" style={{ marginBottom: 10 }}>
                Noch kein Foto — die App zeigt dann einen Farbverlauf.
              </p>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) pickPhoto(file);
                e.target.value = '';
              }}
            />
            <button className="btn btn-ghost btn-small" onClick={() => fileRef.current?.click()} disabled={busy}>
              {imageUrl ? 'Foto ersetzen' : 'Foto hochladen'}
            </button>
          </div>

          <div className="glass pad">
            <div className="eyebrow" style={{ marginBottom: 10 }}>
              Nährwerte & Portionen
            </div>
            <div className="form-row cols-2">
              <div className="field">
                <label>Portionen</label>
                <input
                  type="number"
                  min={1}
                  value={recipe.servings}
                  onChange={(e) => set('servings', Math.max(1, Number(e.target.value)))}
                />
              </div>
              <div className="field">
                <label>kcal / Portion</label>
                <input
                  type="number"
                  value={recipe.kcal_per_serving}
                  onChange={(e) => set('kcal_per_serving', Number(e.target.value))}
                />
              </div>
            </div>
            <div className="form-row cols-3">
              <div className="field">
                <label>Eiweiß g</label>
                <input
                  type="number"
                  step="0.1"
                  value={recipe.protein_per_serving_g ?? ''}
                  onChange={(e) => set('protein_per_serving_g', e.target.value === '' ? null : Number(e.target.value))}
                />
              </div>
              <div className="field">
                <label>KH g</label>
                <input
                  type="number"
                  step="0.1"
                  value={recipe.carbs_per_serving_g ?? ''}
                  onChange={(e) => set('carbs_per_serving_g', e.target.value === '' ? null : Number(e.target.value))}
                />
              </div>
              <div className="field">
                <label>Fett g</label>
                <input
                  type="number"
                  step="0.1"
                  value={recipe.fat_per_serving_g ?? ''}
                  onChange={(e) => set('fat_per_serving_g', e.target.value === '' ? null : Number(e.target.value))}
                />
              </div>
            </div>
            <div className="field">
              <label>Hinweis zu Portionen</label>
              <input
                value={recipe.servings_note ?? ''}
                onChange={(e) => set('servings_note', e.target.value || null)}
              />
            </div>
            <div className="field">
              <label>Hinweis zu Nährwerten</label>
              <input
                value={recipe.nutrition_note ?? ''}
                onChange={(e) => set('nutrition_note', e.target.value || null)}
              />
            </div>
            <p className="hint">
              Satt-Score-Vorschau: <span className="satt">{sattDots(score)}</span> — rechnet mit Eiweiß
              pro kcal und Volumen (Zutaten-Gramm ÷ Portionen).
            </p>
          </div>

          <div className="glass pad">
            <div className="eyebrow" style={{ marginBottom: 10 }}>
              Sichtbarkeit
            </div>
            <div className="field">
              <label>Status</label>
              <select value={recipe.status} onChange={(e) => set('status', e.target.value as 'draft' | 'published')}>
                <option value="draft">Entwurf</option>
                <option value="published">Live</option>
              </select>
            </div>
            <div className="field">
              <label>Tags (Komma-getrennt)</label>
              <input
                value={recipe.tags.join(', ')}
                onChange={(e) =>
                  set(
                    'tags',
                    e.target.value
                      .split(',')
                      .map((t) => t.trim())
                      .filter(Boolean),
                  )
                }
              />
            </div>
            {recipeId !== null ? (
              <button className="btn btn-danger btn-small" onClick={remove} disabled={busy}>
                Rezept löschen
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

