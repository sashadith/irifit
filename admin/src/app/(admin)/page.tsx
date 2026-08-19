import Link from "next/link";

import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function count(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  table: string,
  filter?: (
    q: ReturnType<ReturnType<typeof supabase.from>["select"]>,
  ) => unknown,
): Promise<number> {
  let query = supabase.from(table).select("*", { count: "exact", head: true });
  if (filter) query = filter(query) as typeof query;
  const { count: n } = await query;
  return n ?? 0;
}

export default async function DashboardPage() {
  const supabase = await supabaseServer();

  const [
    profiles,
    recipes,
    draftRecipes,
    courses,
    lessons,
    trainings,
    trainingsLive,
    questions,
    legacy,
    legacyClaimed,
    subsActive,
    subsTrialing,
  ] = await Promise.all([
    count(supabase, "profiles"),
    count(supabase, "recipes"),
    count(supabase, "recipes", (q) => q.eq("status", "draft")),
    count(supabase, "courses"),
    count(supabase, "lessons"),
    count(supabase, "training_videos"),
    count(supabase, "training_videos", (q) => q.eq("status", "published")),
    count(supabase, "questions", (q) => q.eq("status", "new")),
    count(supabase, "legacy_customers"),
    count(supabase, "legacy_customers", (q) => q.not("claimed_by", "is", null)),
    count(supabase, "subscriptions", (q) =>
      q.in("status", ["active", "in_grace"]),
    ),
    count(supabase, "subscriptions", (q) => q.eq("status", "trialing")),
  ]);

  /**
   * Kurs-Kaeuferinnen: Wie viele haben sich angemeldet, und wie viele davon
   * haben danach ein Abo genommen? (Sascha 16.08.)
   *
   * Zwei Abfragen statt eines Joins, weil PostgREST keinen Count ueber eine
   * Beziehung liefert. Die Liste der beanspruchenden Konten ist klein — ein
   * paar hundert IDs hoechstens — das traegt bequem.
   */
  const { data: beanspruchende } = await supabase
    .from("legacy_customers")
    .select("claimed_by")
    .not("claimed_by", "is", null);
  const legacyIds = (beanspruchende ?? [])
    .map((r) => r.claimed_by as string)
    .filter(Boolean);

  let legacyMitAbo = 0;
  if (legacyIds.length > 0) {
    const { count: n } = await supabase
      .from("subscriptions")
      .select("*", { count: "exact", head: true })
      .in("user_id", legacyIds)
      .in("status", ["trialing", "active", "in_grace"]);
    legacyMitAbo = n ?? 0;
  }
  const quote =
    legacyClaimed > 0 ? Math.round((legacyMitAbo / legacyClaimed) * 100) : 0;

  const stats = [
    { label: "Nutzerinnen", value: profiles, sub: null, href: "/nutzerinnen" },
    {
      label: "Rezepte",
      value: recipes,
      sub: draftRecipes > 0 ? `${draftRecipes} Entwürfe` : null,
      href: "/rezepte",
    },
    {
      label: "Kurse",
      value: courses,
      sub: `${lessons} Lektionen`,
      href: "/kurse",
    },
    {
      label: "Trainings",
      value: trainings,
      sub: `${trainingsLive} live`,
      href: "/trainings",
    },
    { label: "Offene Fragen", value: questions, sub: null, href: "/qa" },
    {
      label: "Kurs-Käuferinnen",
      value: legacy,
      sub: `${legacyClaimed} angemeldet`,
      href: "/nutzerinnen",
    },
    {
      label: "Abos",
      value: subsActive,
      sub: `${subsTrialing} in Testphase`,
      href: "/nutzerinnen",
    },
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
        <div className="eyebrow" style={{ marginBottom: 12 }}>
          Vom Kurs zur App
        </div>
        <div className="funnel">
          <div className="funnel-step">
            <b>{legacy}</b>
            <span>Kurs-Käuferinnen</span>
          </div>
          <div className="funnel-arrow">→</div>
          <div className="funnel-step">
            <b>{legacyClaimed}</b>
            <span>davon angemeldet</span>
          </div>
          <div className="funnel-arrow">→</div>
          <div className="funnel-step">
            <b>{legacyMitAbo}</b>
            <span>davon mit Abo</span>
          </div>
        </div>
        <p className="hint" style={{ marginTop: 12, marginBottom: 0 }}>
          {legacyClaimed === 0
            ? "Noch hat sich keine Kurs-Käuferin in der App angemeldet."
            : `${quote} % der angemeldeten Kurs-Käuferinnen haben ein Abo (Testphase mitgezählt).`}
        </p>
      </div>

      <div className="glass pad" style={{ marginTop: 20 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          Umsatz & Abos
        </div>
        <p className="hint">
          Die Abo-Karte oben zählt live aus der Datenbank (RevenueCat-Webhook).
          Umsatz- und Trial-Auswertungen mit Kaufpreisen siehst du im
          RevenueCat-Dashboard — eine eingebettete Umsatzansicht hier ist
          bewusst verschoben, bis echte Zahlen auflaufen.
        </p>
      </div>
    </>
  );
}
