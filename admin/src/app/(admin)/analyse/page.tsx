import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Verhaltensanalyse (Sascha 16.08., Punkt 15).
 *
 * Alle Zahlen kommen aus stats_-Funktionen in der Datenbank. Die laufen mit
 * security definer und pruefen selbst, ob die Aufruferin Admin ist — dieser
 * Seite muss deshalb kein Service-Key beiliegen, und Irina bekommt kein
 * Leserecht auf food_logs. Zurueck kommen nur Summen, nie eine einzelne Zeile.
 *
 * Zwei Quellen: die Fachtabellen (Tagebuch, Lektionen, Abos) liefern sofort,
 * app_events erst ab dem Build mit dem Zaehler. Deshalb steht ueber den
 * ereignisbasierten Bloecken ein Hinweis, wenn dort noch nichts liegt — sonst
 * liest sich "0" wie ein Befund statt wie fehlende Messung.
 */

interface Funnel {
  registriert: number;
  onboarding_fertig: number;
  erster_eintrag: number;
  aktiv_7_tage: number;
  mit_abo: number;
}

interface Retention {
  kohorte: string;
  angemeldet: number;
  woche_0: number;
  woche_1: number;
  woche_2: number;
  woche_3: number;
  woche_4: number;
}

interface Aktivitaet {
  tag: string;
  aktive: number;
  eintraege: number;
}

interface Quelle {
  quelle: string;
  anzahl: number;
  anteil: number;
}

interface TopRezept {
  recipe_id: number;
  titel: string;
  protokolliert: number;
  nutzerinnen: number;
}

interface Lektion {
  kurs: string;
  lektion: string;
  nummer: number;
  abgeschlossen: number;
}

interface Screen {
  screen: string;
  aufrufe: number;
  nutzerinnen: number;
}

interface Schritt {
  schritt: string;
  nutzerinnen: number;
}

interface Paywall {
  gesehen: number;
  kauf_versucht: number;
  gekauft: number;
  abgebrochen: number;
  fehlgeschlagen: number;
  gutschein: number;
}

interface Scan {
  gestartet: number;
  mit_ergebnis: number;
  uebernommen: number;
}

interface Luecke {
  begriff: string;
  anzahl: number;
}

interface Fehler {
  ort: string;
  code: string;
  anzahl: number;
  nutzerinnen: number;
}

const QUELLEN_LABEL: Record<string, string> = {
  scan: "Foto-Scan",
  barcode: "Barcode",
  search: "Suche",
  recipe: "Rezept",
  favorite: "Favorit",
  manual: "Manuell",
};

function prozent(teil: number, ganz: number): string {
  if (ganz === 0) return "—";
  return `${Math.round((teil / ganz) * 100)} %`;
}

function datum(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

/** Waagerechter Balken, Breite relativ zum groessten Wert der Reihe. */
function Balken({ wert, max }: { wert: number; max: number }) {
  const breite = max > 0 ? Math.max(2, Math.round((wert / max) * 100)) : 0;
  return (
    <div
      style={{
        height: 8,
        borderRadius: 4,
        background: "var(--track)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${breite}%`,
          height: "100%",
          background: "linear-gradient(90deg, #e58aa6, #d25578)",
        }}
      />
    </div>
  );
}

function Karte({
  titel,
  hinweis,
  children,
}: {
  titel: string;
  hinweis?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass pad" style={{ marginTop: 20 }}>
      <div className="eyebrow" style={{ marginBottom: 12 }}>
        {titel}
      </div>
      {children}
      {hinweis ? (
        <p className="hint" style={{ marginTop: 12, marginBottom: 0 }}>
          {hinweis}
        </p>
      ) : null}
    </div>
  );
}

function Leer({ text }: { text: string }) {
  return (
    <p className="hint" style={{ margin: 0 }}>
      {text}
    </p>
  );
}

export default async function AnalysePage() {
  const supabase = await supabaseServer();

  // Alle Auswertungen parallel — sie haengen nicht voneinander ab.
  const [
    funnelRes,
    retentionRes,
    aktivitaetRes,
    quellenRes,
    rezepteRes,
    lektionenRes,
    screensRes,
    schritteRes,
    paywallRes,
    scanRes,
    lueckenRes,
    fehlerRes,
  ] = await Promise.all([
    supabase.rpc("stats_funnel"),
    supabase.rpc("stats_retention", { p_weeks: 8 }),
    supabase.rpc("stats_activity", { p_days: 14 }),
    supabase.rpc("stats_log_sources", { p_days: 30 }),
    supabase.rpc("stats_top_recipes", { p_limit: 10, p_days: 90 }),
    supabase.rpc("stats_course_dropoff"),
    supabase.rpc("stats_screens", { p_days: 30 }),
    supabase.rpc("stats_onboarding_steps", { p_days: 30 }),
    supabase.rpc("stats_paywall", { p_days: 30 }),
    supabase.rpc("stats_scan", { p_days: 30 }),
    supabase.rpc("stats_search_gaps", { p_limit: 20, p_days: 60 }),
    supabase.rpc("stats_errors", { p_days: 14 }),
  ]);

  const funnel = (funnelRes.data as Funnel[] | null)?.[0] ?? null;
  const retention = (retentionRes.data as Retention[] | null) ?? [];
  const aktivitaet = (aktivitaetRes.data as Aktivitaet[] | null) ?? [];
  const quellen = (quellenRes.data as Quelle[] | null) ?? [];
  const rezepte = (rezepteRes.data as TopRezept[] | null) ?? [];
  const lektionen = (lektionenRes.data as Lektion[] | null) ?? [];
  const screens = (screensRes.data as Screen[] | null) ?? [];
  const schritte = (schritteRes.data as Schritt[] | null) ?? [];
  const paywall = (paywallRes.data as Paywall[] | null)?.[0] ?? null;
  const scan = (scanRes.data as Scan[] | null)?.[0] ?? null;
  const luecken = (lueckenRes.data as Luecke[] | null) ?? [];
  const fehler = (fehlerRes.data as Fehler[] | null) ?? [];

  const fehlerMeldung = [funnelRes, retentionRes, aktivitaetRes, quellenRes]
    .map((r) => r.error?.message)
    .find(Boolean);

  // Liegt noch kein einziges Ereignis vor, ist der Zaehler noch nicht in einem
  // Build draussen. Das steht dann ueber den betroffenen Bloecken, damit "0"
  // nicht als Ergebnis missverstanden wird.
  const keineEreignisse =
    screens.length === 0 &&
    (paywall?.gesehen ?? 0) === 0 &&
    (scan?.gestartet ?? 0) === 0 &&
    luecken.length === 0;
  const wartet = keineEreignisse
    ? "Noch keine Ereignisse aufgelaufen — der Zähler ist erst ab dem nächsten Build in der App."
    : undefined;

  const maxAktive = Math.max(1, ...aktivitaet.map((a) => a.aktive));
  const maxQuelle = Math.max(1, ...quellen.map((q) => q.anzahl));
  const maxRezept = Math.max(1, ...rezepte.map((r) => r.protokolliert));
  const maxScreen = Math.max(1, ...screens.map((s) => s.aufrufe));
  const maxLuecke = Math.max(1, ...luecken.map((l) => l.anzahl));
  const maxSchritt = Math.max(1, ...schritte.map((s) => s.nutzerinnen));

  if (fehlerMeldung) {
    return (
      <>
        <div className="page-head">
          <div>
            <div className="eyebrow">Analyse</div>
            <h1 className="display">Nutzung</h1>
          </div>
        </div>
        <div className="glass pad">
          <p className="error-text" style={{ margin: 0 }}>
            Die Auswertung ließ sich nicht laden: {fehlerMeldung}
          </p>
          <p className="hint" style={{ marginBottom: 0 }}>
            Die Statistik-Funktionen antworten nur Admin-Konten. Bist du mit
            Irinas Konto angemeldet?
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Analyse</div>
          <h1 className="display">Nutzung</h1>
        </div>
      </div>

      {funnel ? (
        <Karte
          titel="Von der Anmeldung zur Gewohnheit"
          hinweis={`${prozent(funnel.aktiv_7_tage, funnel.registriert)} der angemeldeten Frauen haben in den letzten sieben Tagen etwas ins Tagebuch geschrieben.`}
        >
          <div className="funnel">
            <div className="funnel-step">
              <b>{funnel.registriert}</b>
              <span>angemeldet</span>
            </div>
            <div className="funnel-arrow">→</div>
            <div className="funnel-step">
              <b>{funnel.onboarding_fertig}</b>
              <span>Onboarding fertig</span>
            </div>
            <div className="funnel-arrow">→</div>
            <div className="funnel-step">
              <b>{funnel.erster_eintrag}</b>
              <span>erster Eintrag</span>
            </div>
            <div className="funnel-arrow">→</div>
            <div className="funnel-step">
              <b>{funnel.aktiv_7_tage}</b>
              <span>diese Woche aktiv</span>
            </div>
            <div className="funnel-arrow">→</div>
            <div className="funnel-step">
              <b>{funnel.mit_abo}</b>
              <span>mit Abo</span>
            </div>
          </div>
        </Karte>
      ) : null}

      <Karte
        titel="Bindung nach Anmeldewoche"
        hinweis="Jede Zeile ist eine Anmeldewoche. Die Spalten zählen, wie viele dieser Frauen in der jeweiligen Folgewoche noch etwas eingetragen haben. Fällt Woche 1 stark ab, verliert die App sie in den ersten Tagen — dann lohnt Arbeit am Anfang, nicht an neuen Funktionen."
      >
        {retention.length === 0 ? (
          <Leer text="Noch keine Anmeldungen im Zeitraum." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Woche</th>
                  <th>Angemeldet</th>
                  <th>W0</th>
                  <th>W1</th>
                  <th>W2</th>
                  <th>W3</th>
                  <th>W4</th>
                </tr>
              </thead>
              <tbody>
                {retention.map((r) => (
                  <tr key={r.kohorte}>
                    <td data-label="Woche">ab {datum(r.kohorte)}</td>
                    <td data-label="Angemeldet">{r.angemeldet}</td>
                    <td data-label="W0">{prozent(r.woche_0, r.angemeldet)}</td>
                    <td data-label="W1">{prozent(r.woche_1, r.angemeldet)}</td>
                    <td data-label="W2">{prozent(r.woche_2, r.angemeldet)}</td>
                    <td data-label="W3">{prozent(r.woche_3, r.angemeldet)}</td>
                    <td data-label="W4">{prozent(r.woche_4, r.angemeldet)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Karte>

      <div className="split" style={{ marginTop: 20 }}>
        <div className="glass pad">
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            Aktive Nutzerinnen, 14 Tage
          </div>
          {aktivitaet.length === 0 ? (
            <Leer text="Noch keine Tagebucheinträge." />
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {aktivitaet.map((a) => (
                <div
                  key={a.tag}
                  style={{ display: "grid", gridTemplateColumns: "48px 1fr 60px", gap: 10, alignItems: "center" }}
                >
                  <span className="hint">{datum(a.tag)}</span>
                  <Balken wert={a.aktive} max={maxAktive} />
                  <span className="hint" style={{ textAlign: "right" }}>
                    {a.aktive} / {a.eintraege}
                  </span>
                </div>
              ))}
            </div>
          )}
          <p className="hint" style={{ marginTop: 12, marginBottom: 0 }}>
            Links aktive Nutzerinnen, rechts Einträge. Tage ohne Eintrag fehlen
            in der Liste.
          </p>
        </div>

        <div className="glass pad">
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            Eingabewege, 30 Tage
          </div>
          {quellen.length === 0 ? (
            <Leer text="Noch keine Tagebucheinträge." />
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {quellen.map((q) => (
                <div key={q.quelle}>
                  <div
                    style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 13.5 }}
                  >
                    <span>{QUELLEN_LABEL[q.quelle] ?? q.quelle}</span>
                    <span className="hint">
                      {q.anzahl} · {q.anteil} %
                    </span>
                  </div>
                  <Balken wert={q.anzahl} max={maxQuelle} />
                </div>
              ))}
            </div>
          )}
          <p className="hint" style={{ marginTop: 12, marginBottom: 0 }}>
            Wo die Frauen wirklich eintragen. Der Foto-Scan kostet Geld pro
            Aufnahme — bleibt er klein, ist das eine gute Nachricht für die
            Rechnung und eine schlechte für das Verkaufsargument.
          </p>
        </div>
      </div>

      <Karte titel="Onboarding-Schritte, 30 Tage" hinweis={wartet ?? "Zwischen zwei Zeilen mit großem Abstand springen sie ab. Wer vor der Kontoanlage aufhört, taucht hier nicht auf — dafür gibt es keine ID."}>
        {schritte.length === 0 ? (
          <Leer text="Noch keine Screen-Aufrufe aufgelaufen." />
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {schritte.map((s) => (
              <div key={s.schritt}>
                <div
                  style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 13.5 }}
                >
                  <span>{s.schritt}</span>
                  <span className="hint">{s.nutzerinnen}</span>
                </div>
                <Balken wert={s.nutzerinnen} max={maxSchritt} />
              </div>
            ))}
          </div>
        )}
      </Karte>

      <div className="split" style={{ marginTop: 20 }}>
        <div className="glass pad">
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            Paywall, 30 Tage
          </div>
          {paywall ? (
            <>
              <div className="funnel">
                <div className="funnel-step">
                  <b>{paywall.gesehen}</b>
                  <span>gesehen</span>
                </div>
                <div className="funnel-arrow">→</div>
                <div className="funnel-step">
                  <b>{paywall.kauf_versucht}</b>
                  <span>Kauf ausgelöst</span>
                </div>
                <div className="funnel-arrow">→</div>
                <div className="funnel-step">
                  <b>{paywall.gekauft}</b>
                  <span>gekauft</span>
                </div>
              </div>
              <p className="hint" style={{ marginTop: 12, marginBottom: 0 }}>
                {paywall.abgebrochen} im Store-Dialog abgebrochen,{" "}
                {paywall.fehlgeschlagen} fehlgeschlagen, {paywall.gutschein} über
                Gutschein. {wartet ?? ""}
              </p>
            </>
          ) : (
            <Leer text="Keine Daten." />
          )}
        </div>

        <div className="glass pad">
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            Foto-Scan, 30 Tage
          </div>
          {scan ? (
            <>
              <div className="funnel">
                <div className="funnel-step">
                  <b>{scan.gestartet}</b>
                  <span>gestartet</span>
                </div>
                <div className="funnel-arrow">→</div>
                <div className="funnel-step">
                  <b>{scan.mit_ergebnis}</b>
                  <span>mit Ergebnis</span>
                </div>
                <div className="funnel-arrow">→</div>
                <div className="funnel-step">
                  <b>{scan.uebernommen}</b>
                  <span>übernommen</span>
                </div>
              </div>
              <p className="hint" style={{ marginTop: 12, marginBottom: 0 }}>
                Der Verlust zwischen Ergebnis und Übernahme ist der ehrlichste
                Gütetest für die Erkennung: Wer das Ergebnis wegwirft, hat es
                nicht wiedererkannt. {wartet ?? ""}
              </p>
            </>
          ) : (
            <Leer text="Keine Daten." />
          )}
        </div>
      </div>

      <Karte
        titel="Suche ohne Treffer, 60 Tage"
        hinweis={wartet ?? "Diese Begriffe hat jemand gesucht und nichts gefunden — die Arbeitsliste für die Lebensmitteldatenbank."}
      >
        {luecken.length === 0 ? (
          <Leer text="Keine erfolglosen Suchen." />
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {luecken.map((l) => (
              <div
                key={l.begriff}
                style={{ display: "grid", gridTemplateColumns: "1fr 1fr 40px", gap: 10, alignItems: "center" }}
              >
                <span style={{ fontSize: 13.5 }}>{l.begriff}</span>
                <Balken wert={l.anzahl} max={maxLuecke} />
                <span className="hint" style={{ textAlign: "right" }}>
                  {l.anzahl}
                </span>
              </div>
            ))}
          </div>
        )}
      </Karte>

      <Karte
        titel="Rezepte im Tagebuch, 90 Tage"
        hinweis="Nicht was angesehen wird, sondern was tatsächlich gegessen und eingetragen wurde."
      >
        {rezepte.length === 0 ? (
          <Leer text="Noch kein Rezept über die Rezeptseite eingetragen." />
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {rezepte.map((r) => (
              <div
                key={r.recipe_id}
                style={{ display: "grid", gridTemplateColumns: "1fr 120px 70px", gap: 10, alignItems: "center" }}
              >
                <span style={{ fontSize: 13.5 }}>{r.titel}</span>
                <Balken wert={r.protokolliert} max={maxRezept} />
                <span className="hint" style={{ textAlign: "right" }}>
                  {r.protokolliert}× / {r.nutzerinnen}
                </span>
              </div>
            ))}
          </div>
        )}
      </Karte>

      <Karte
        titel="Screen-Aufrufe, 30 Tage"
        hinweis={wartet ?? "IDs sind zusammengefasst: /recipe/[id] statt /recipe/32."}
      >
        {screens.length === 0 ? (
          <Leer text="Noch keine Screen-Aufrufe aufgelaufen." />
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {screens.map((s) => (
              <div
                key={s.screen}
                style={{ display: "grid", gridTemplateColumns: "1fr 120px 90px", gap: 10, alignItems: "center" }}
              >
                <span style={{ fontSize: 13.5, fontFamily: "var(--font-mono, monospace)" }}>
                  {s.screen}
                </span>
                <Balken wert={s.aufrufe} max={maxScreen} />
                <span className="hint" style={{ textAlign: "right" }}>
                  {s.aufrufe} / {s.nutzerinnen}
                </span>
              </div>
            ))}
          </div>
        )}
      </Karte>

      <Karte
        titel="Kurs-Fortschritt"
        hinweis="Abgeschlossene Lektionen. Die Stelle, an der die Zahl einbricht, ist die Lektion, die zu lang oder zu zäh ist."
      >
        {lektionen.length === 0 ? (
          <Leer text="Keine veröffentlichten Lektionen." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Kurs</th>
                  <th>Lektion</th>
                  <th>Abgeschlossen</th>
                </tr>
              </thead>
              <tbody>
                {lektionen.map((l) => (
                  <tr key={`${l.kurs}-${l.nummer}`}>
                    <td data-label="Kurs">{l.kurs}</td>
                    <td data-label="Lektion">{l.lektion}</td>
                    <td data-label="Abgeschlossen">{l.abgeschlossen}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Karte>

      <Karte
        titel="Stille Fehler, 14 Tage"
        hinweis={wartet ?? "Fehler, die in der App eine Meldung erzeugt haben. Ohne diese Liste erfahren wir davon nur, wenn jemand schreibt."}
      >
        {fehler.length === 0 ? (
          <Leer text="Keine Fehler gemeldet." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Stelle</th>
                  <th>Code</th>
                  <th>Fälle</th>
                  <th>Betroffene</th>
                </tr>
              </thead>
              <tbody>
                {fehler.map((f) => (
                  <tr key={`${f.ort}-${f.code}`}>
                    <td data-label="Stelle">{f.ort}</td>
                    <td data-label="Code">{f.code}</td>
                    <td data-label="Fälle">{f.anzahl}</td>
                    <td data-label="Betroffene">{f.nutzerinnen}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Karte>

      <div className="glass pad" style={{ marginTop: 20 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          Was hier nicht steht
        </div>
        <p className="hint" style={{ marginBottom: 0 }}>
          Keine einzelne Nutzerin, keine Mahlzeit, kein Gewicht, kein Foto — die
          Statistik-Funktionen geben ausschließlich Summen zurück. Ereignisse
          werden nach 180 Tagen gelöscht, und wer in der App unter Profil &gt;
          Rechtliches widerspricht, wird nicht mitgezählt.
        </p>
      </div>
    </>
  );
}
