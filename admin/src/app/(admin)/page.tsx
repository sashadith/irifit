import Link from 'next/link';

import { supabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

async function count(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  table: string,
  filter?: (q: ReturnType<ReturnType<typeof supabase.from>['select']>) => unknown,
): Promise<number> {
  let query = supabase.from(table).select('*', { count: 'exact', head: true });
  if (filter) query = filter(query) as typeof query;
  const { count: n } = await query;
  return n ?? 0;
}

export default async function DashboardPage() {
  const supabase = await supabaseServer();

  const [profiles, recipes, draftRecipes, courses, lessons, questions, legacy, legacyClaimed] =
    await Promise.all([
      count(supabase, 'profiles'),
      count(supabase, 'recipes'),
      count(supabase, 'recipes', (q) => q.eq('status', 'draft')),
      count(supabase, 'courses'),
      count(supabase, 'lessons'),
      count(supabase, 'questions', (q) => q.eq('status', 'new')),
      count(supabase, 'legacy_customers'),
      count(supabase, 'legacy_customers', (q) => q.not('claimed_by', 'is', null)),
    ]);

  const stats = [
    { label: 'Nutzerinnen', value: profiles, sub: null, href: '/nutzerinnen' },
    { label: 'Rezepte', value: recipes, sub: draftRecipes > 0 ? `${draftRecipes} Entwürfe` : null, href: '/rezepte' },
    { label: 'Kurse', value: courses, sub: `${lessons} Lektionen`, href: '/kurse' },
    { label: 'Offene Fragen', value: questions, sub: null, href: '/qa' },
    { label: 'Kurs-Käuferinnen', value: legacy, sub: `${legacyClaimed} angemeldet`, href: '/nutzerinnen' },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Überblick</div>
          <h1 className="display">Hallo Irina!</h1>
        </div>
      </div>
      <div className="stat-grid">
        {stats.map((stat) => {
          const card = (
            <div className="glass pad" key={stat.label}>
              <div className="eyebrow">{stat.label}</div>
              <div className="stat-num">{stat.value}</div>
              {stat.sub ? <div className="hint">{stat.sub}</div> : null}
            </div>
          );
          return stat.href ? (
            <Link key={stat.label} href={stat.href}>
              {card}
            </Link>
          ) : (
            card
          );
        })}
      </div>
      <div className="glass pad" style={{ marginTop: 20 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          Umsatz & Abos
        </div>
        <p className="hint">
          Die Zahlen aus RevenueCat (Abos, Trials, Umsatz) erscheinen hier, sobald die
          Abo-Integration steht — folgt nach Session 11. Bis dahin zeigen wir hier bewusst
          nichts Geschätztes an.
        </p>
      </div>
    </>
  );
}
