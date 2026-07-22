'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { recipeSattScore, sattDots } from '@/lib/sattScore';
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
      .order('title')
      .then(({ data, error: e }) => {
        if (e) setError(e.message);
        else setRecipes((data ?? []) as Recipe[]);
      });
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter(
      (r) => r.title.toLowerCase().includes(q) || (r.category ?? '').toLowerCase().includes(q),
    );
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

      <div className="field" style={{ maxWidth: 360 }}>
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
            </tr>
          </thead>
          <tbody>
            {filtered.map((recipe) => {
              const url = recipeImageUrl(recipe.image_path);
              return (
                <tr key={recipe.id} className="row-link" onClick={() => router.push(`/rezepte/${recipe.id}`)}>
                  <td>
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt="" className="thumb" loading="lazy" />
                    ) : (
                      <span className="thumb" />
                    )}
                  </td>
                  <td style={{ fontWeight: 600 }}>{recipe.title}</td>
                  <td>{recipe.category ?? '—'}</td>
                  <td>{recipe.kcal_per_serving}</td>
                  <td>
                    <span className="satt">{sattDots(recipeSattScore(recipe))}</span>
                  </td>
                  <td>
                    <span className={`badge ${recipe.status}`}>
                      {recipe.status === 'published' ? 'Live' : 'Entwurf'}
                    </span>
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
