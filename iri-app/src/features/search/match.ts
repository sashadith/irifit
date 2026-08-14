/**
 * Textsuche, die verzeiht (Sascha 14.08.).
 *
 * Zwei Anforderungen:
 *  1. Umlaute in beide Richtungen — „Müsli", „Muesli" und „Musli" finden dasselbe.
 *  2. Mehrere Wortanfänge — „hähn spar" findet „Hähnchen-Spargel-Salat".
 *
 * Umgesetzt über ZWEI Schreibweisen je Text: einmal ausgeschrieben (ü→ue) und
 * einmal abgestreift (ü→u). Ein Suchwort passt, wenn es in einer der beiden
 * vorkommt. Nur eine Variante wuerde je einen Fall verlieren: mit ü→ue findet
 * „musli" nichts, mit ü→u findet „muesli" nichts.
 *
 * Bindestriche, Punkte und Klammern werden zu Leerzeichen — deshalb greift
 * „spar" mitten in „Hähnchen-Spargel-Salat".
 */

const EXPAND: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' };
const FOLD: Record<string, string> = { ä: 'a', ö: 'o', ü: 'u', ß: 'ss' };

function normalize(input: string, map: Record<string, string>): string {
  return input
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => map[c])
    // Restliche Akzente abstreifen: é→e, à→a, ñ→n
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Ausgeschriebene Form — „Müsli" → „muesli" */
export const expandUmlauts = (input: string): string => normalize(input, EXPAND);

/** Abgestreifte Form — „Müsli" → „musli" */
export const foldUmlauts = (input: string): string => normalize(input, FOLD);

/**
 * Passt die Eingabe auf die übergebenen Felder? Jedes Suchwort muss vorkommen,
 * die Reihenfolge ist egal. Leere Eingabe passt immer.
 */
export function matchesSearch(query: string, ...fields: (string | null | undefined)[]): boolean {
  const expandedQuery = expandUmlauts(query);
  if (!expandedQuery) return true;

  const text = fields.filter(Boolean).join(' ');
  const hayExpanded = expandUmlauts(text);
  const hayFolded = foldUmlauts(text);

  const tokensExpanded = expandedQuery.split(' ');
  const tokensFolded = foldUmlauts(query).split(' ');

  return tokensExpanded.every(
    (tok, i) => hayExpanded.includes(tok) || hayFolded.includes(tokensFolded[i] ?? tok),
  );
}
