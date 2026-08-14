import { t, TranslationKey } from '@/i18n';

/**
 * Begrüßung auf der Startseite (Sascha 14.08.): wechselt, ist kurz und locker.
 *
 * Zwei Regeln, die den Ton bestimmen:
 *  - Die Kopfzeile ist EINZEILIG (DiaryHeader, numberOfLines={1}) in der großen
 *    Display-Schrift. Alles über ~20 Zeichen inklusive Name wird abgeschnitten.
 *  - Die Auswahl wird aus Datum + Tageszeit + Nutzerin gewürfelt, NICHT zufällig
 *    pro Render. Sonst springt der Gruß bei jedem Scrollen.
 */

interface Greeting {
  readonly key: TranslationKey;
  /** Braucht {name} — fällt weg, wenn im Profil kein Vorname steht */
  readonly withName?: boolean;
}

const MORNING: readonly Greeting[] = [
  { key: 'home.greet.mMoin', withName: true },
  { key: 'home.greet.mMorgen', withName: true },
  { key: 'home.greet.mAloha', withName: true },
  { key: 'home.greet.mNa', withName: true },
  { key: 'home.greet.mHey', withName: true },
  { key: 'home.greet.mMoinMoin' },
  { key: 'home.greet.mGutenMorgen' },
  { key: 'home.greet.mGeschlafen' },
  { key: 'home.greet.mDaBist' },
  { key: 'home.greet.mTag' },
];

const NOON: readonly Greeting[] = [
  { key: 'home.greet.nMahlzeit', withName: true },
  { key: 'home.greet.nHallo', withName: true },
  { key: 'home.greet.nHey', withName: true },
  { key: 'home.greet.nDaBist', withName: true },
  { key: 'home.greet.nHalbzeit' },
  { key: 'home.greet.nGegessen' },
  { key: 'home.greet.nFit' },
  { key: 'home.greet.nWeiter' },
];

const EVENING: readonly Greeting[] = [
  { key: 'home.greet.eAbend', withName: true },
  { key: 'home.greet.eFeierabend', withName: true },
  { key: 'home.greet.eHey', withName: true },
  { key: 'home.greet.eGutenAbend' },
  { key: 'home.greet.eTag' },
  { key: 'home.greet.eSchoen' },
];

const NIGHT: readonly Greeting[] = [
  { key: 'home.greet.xWach', withName: true },
  { key: 'home.greet.xNacht', withName: true },
  { key: 'home.greet.xRunde' },
];

/**
 * Wochentags-Grüße überschreiben die Tageszeit (Saschas Vorgabe), aber nur
 * morgens und mittags — abends passt „Feierabend" besser als „Neue Woche".
 */
const WEEKDAY: Record<number, readonly Greeting[] | undefined> = {
  1: [{ key: 'home.greet.wMontag', withName: true }, { key: 'home.greet.wMontagO' }],
  5: [{ key: 'home.greet.wFreitag' }],
  6: [{ key: 'home.greet.wSamstag' }],
  0: [{ key: 'home.greet.wSonntag' }],
};

/** Stabiler Streuwert aus einer Zeichenkette (djb2) — kein Math.random */
function hash(seed: string): number {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) + h + seed.charCodeAt(i)) >>> 0;
  return h;
}

type Bucket = 'morning' | 'noon' | 'evening' | 'night';

function bucketFor(hour: number): Bucket {
  if (hour < 11) return 'morning';
  if (hour < 17) return 'noon';
  if (hour < 22) return 'evening';
  return 'night';
}

export function pickGreeting(name: string | null | undefined, now: Date, userId?: string): string {
  const bucket = bucketFor(now.getHours());
  const weekdayPool = bucket === 'morning' || bucket === 'noon' ? WEEKDAY[now.getDay()] : undefined;
  const base =
    weekdayPool ??
    (bucket === 'morning' ? MORNING : bucket === 'noon' ? NOON : bucket === 'evening' ? EVENING : NIGHT);

  const firstName = name?.trim().split(' ')[0] ?? '';
  const pool = firstName ? base : base.filter((g) => !g.withName);
  // Nur Namens-Grüße im Topf und kein Name da: dann lieber neutral bleiben
  if (pool.length === 0) return t('home.greeting');

  const day = now.toISOString().slice(0, 10);
  const chosen = pool[hash(`${day}|${bucket}|${userId ?? ''}`) % pool.length];
  return chosen.withName ? t(chosen.key, { name: firstName }) : t(chosen.key);
}
