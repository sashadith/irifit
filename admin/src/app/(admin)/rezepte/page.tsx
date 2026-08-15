'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { recipeSattScore, sattDots } from '@/lib/sattScore';
import { matchesSearch } from '@/lib/search';
import { supabaseBrowser } from '@/lib/supabase/client';
import { Recipe, recipeImageUrl } from '@/lib/types';

export default function RezepteListe() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabaseBrowser()
      .from('recipes')
      .select('*')
      // Neueste oben (Sascha 15.08.) — wie in der App; Zweitschluessel ID, weil
      // die Import-Rezepte alle denselben Zeitstempel tragen
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .then(({ data, error: e }) => {
        if (e) setError(e.message);
        else setRecipes((data ?? []) as Recipe[]);
      });
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return recipes;
    // Gleiche verzeihende Suche wie in der App: „hähn spar" findet den
    // Hähnchen-Spargel-Salat, Umlaute zaehlen in beide Richtungen
    return recipes.filter((r) => matchesSearch(q, r.title, r.category));
  }, [recipes, search]);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{recipes.length} Rezepte</div>
          <h1 className="display">Rezepte</h1>
        </div>
        <Link href="/rezepte/neu" className="btn btn-primary">
          + Neues Rezept
        </Link>
      </div>

      <div className="field field-search">
        <label htmlFor="search">Suche</label>
        <input
          id="search"
          placeholder="Titel oder Kategorie …"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      <div className="glass" style={{ overflow: 'hidden' }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 60 }}></th>
              <th>Titel</th>
              <th>Kategorie</th>
              <th>kcal/Portion</th>
              <th>Satt-Score</th>
              <th>Status</th>
              <th>Angelegt</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((recipe) => {
              const url = recipeImageUrl(recipe.image_path);
              return (
                <tr key={recipe.id} className="row-link" onClick={() => router.push(`/rezepte/${recipe.id}`)}>
                  <td data-label="">
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt="" className="thumb" loading="lazy" />
                    ) : (
                      <span className="thumb" />
                    )}
                  </td>
                  <td data-label="" style={{ fontWeight: 600 }}>
                    {recipe.title}
                  </td>
                  <td data-label="Kategorie">{recipe.category ?? '—'}</td>
                  <td data-label="kcal/Portion">{recipe.kcal_per_serving}</td>
                  <td data-label="Satt-Score">
                    <span className="satt">{sattDots(recipeSattScore(recipe))}</span>
                  </td>
                  <td data-label="Status">
                    <span className={`badge ${recipe.status}`}>
                      {recipe.status === 'published' ? 'Live' : 'Entwurf'}
                    </span>
                  </td>
                  <td data-label="Angelegt" style={{ whiteSpace: 'nowrap' }}>
                    {new Date(recipe.created_at).toLocaleDateString('de-DE', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
