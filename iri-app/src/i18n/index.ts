/**
 * i18n ab Tag 1: alle UI-Strings leben in Sprachdateien (aktuell nur de.json).
 * Weitere Sprachen: Datei ergänzen und in `dictionaries` registrieren.
 */
import de from './de.json';

const dictionaries = { de } as const;

type Dict = typeof de;

/** "tabs.home" | "scan.title" | … — typisiert aus de.json abgeleitet */
type DotPaths<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : DotPaths<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type TranslationKey = DotPaths<Dict>;

const locale: keyof typeof dictionaries = 'de';

export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  const value = key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], dictionaries[locale]);
  if (typeof value !== 'string') return key;
  if (!params) return value;
  return value.replace(/\{(\w+)\}/g, (match, name) =>
    name in params ? String(params[name]) : match,
  );
}
