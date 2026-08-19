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

/**
 * Zusammensetzung der Toepfe (Sascha 17.08.): ueberwiegend MIT Vornamen und
 * durchweg positiv — die App soll bei jedem Oeffnen gute Laune machen, nicht
 * nur „Hallo" sagen. Die neutralen Varianten bleiben als Minderheit drin,
 * weil sie fuer Profile ohne Vornamen der einzige Topf sind.
 */
const MORNING: readonly Greeting[] = [
  { key: 'home.greet.mMoin', withName: true },
  { key: 'home.greet.mMorgen', withName: true },
  { key: 'home.greet.mGutenMorgenName', withName: true },
  { key: 'home.greet.mAloha', withName: true },
  { key: 'home.greet.mNa', withName: true },
  { key: 'home.greet.mHey', withName: true },
  { key: 'home.greet.mAufGehts', withName: true },
  { key: 'home.greet.mFrischStart', withName: true },
  { key: 'home.greet.mHeuteWirdGut', withName: true },
  { key: 'home.greet.mStrahlst', withName: true },
  { key: 'home.greet.mRockst', withName: true },
  { key: 'home.greet.mKaffee', withName: true },
  // "Schoenheit" und Co. tragen keinen Namen, wirken aber persoenlich —
  // sie halten auch die Profile ohne Vornamen locker-flockig
  { key: 'home.greet.mSchoenheit' },
  { key: 'home.greet.mMoinMoin' },
  { key: 'home.greet.mGutenMorgen' },
  { key: 'home.greet.mGeschlafen' },
  { key: 'home.greet.mTag' },
];

const NOON: readonly Greeting[] = [
  { key: 'home.greet.nMahlzeit', withName: true },
  { key: 'home.greet.nHallo', withName: true },
  { key: 'home.greet.nHey', withName: true },
  { key: 'home.greet.nDaBist', withName: true },
  // "Guten Tag, {name}" flog am 17.08. raus (Sascha: zu trocken, klingt nach
  // Behoerdenbrief). Ersatz ist persoenlich statt hoeflich.
  { key: 'home.greet.nSchoenDich', withName: true },
  { key: 'home.greet.nHalbzeitName', withName: true },
  { key: 'home.greet.nLaeuft', withName: true },
  { key: 'home.greet.nDranbleiben', withName: true },
  { key: 'home.greet.nStark', withName: true },
  { key: 'home.greet.nMittagsheldin', withName: true },
  { key: 'home.greet.nWeiterSo', withName: true },
  { key: 'home.greet.nPowerfrau' },
  { key: 'home.greet.nVollePower' },
  { key: 'home.greet.nHalloechen' },
  // "Sonnenschein" wirkt persoenlich, obwohl kein Name drinsteckt — waermt
  // damit auch die Profile ohne Vornamen, die sonst nur Neutrales bekommen.
  { key: 'home.greet.nSonnenschein' },
  // "Schon was gegessen?" flog am 17.08. raus (Sascha): Der Gruss steht direkt
  // ueber dem Kalorienring — ist der halb voll, stellt die App eine Frage,
  // deren Antwort sie selbst anzeigt. Ein Gruss, der dem Bildschirm darunter
  // widerspricht, wirkt dumm. Also keine Fragen nach Dingen, die die App weiss.
  { key: 'home.greet.nFit' },
  { key: 'home.greet.nWeiter' },
];

const EVENING: readonly Greeting[] = [
  { key: 'home.greet.eAbend', withName: true },
  { key: 'home.greet.eFeierabend', withName: true },
  { key: 'home.greet.eHey', withName: true },
  { key: 'home.greet.eGutenAbendName', withName: true },
  { key: 'home.greet.eGutGemacht', withName: true },
  { key: 'home.greet.eZeitFuerDich', withName: true },
  { key: 'home.greet.eStolz', withName: true },
  { key: 'home.greet.eFuesseHoch', withName: true },
  { key: 'home.greet.eCouch', withName: true },
  { key: 'home.greet.eVerdient', withName: true },
  { key: 'home.greet.eHeldin' },
  { key: 'home.greet.eGutenAbend' },
  { key: 'home.greet.eTag' },
  { key: 'home.greet.eSchoen' },
];

const NIGHT: readonly Greeting[] = [
  { key: 'home.greet.xWach', withName: true },
  { key: 'home.greet.xNacht', withName: true },
  { key: 'home.greet.xTraeum', withName: true },
  { key: 'home.greet.xKissen', withName: true },
  { key: 'home.greet.xRunde' },
  { key: 'home.greet.xSchlafTraining' },
];

/**
 * Wochentags-Grüße KOMMEN DAZU, sie ersetzen den Tageszeit-Topf nicht.
 *
 * Bis 17.08. war es andersherum, und das Ergebnis hat Sascha zu Recht
 * beanstandet: Montags gab es vormittags und mittags genau zwei Moeglichkeiten,
 * „Neue Woche" und „Neue Woche, {name}" — den ganzen Tag dasselbe, und von
 * „Guten Morgen", „Mahlzeit" oder „Moin" war nie etwas zu sehen. Jetzt liegen
 * sie im selben Topf wie die Tageszeit-Gruesse und kommen mit deren
 * Wahrscheinlichkeit dran (montags vormittags zwei von vierzehn).
 *
 * Getrennt nach Tageszeit, weil „Montag läuft" morgens um acht gelogen waere.
 * Abends bleibt es bei „Feierabend" und Co. — dort passt kein Wochentagsgruss.
 * („Halben Montag geschafft" flog am 17.08. wieder raus: mit Namen zu lang
 * fuer die Kopfzeile, Sascha hat es gestrichen.)
 */
interface WeekdayGreetings {
  readonly morning?: readonly Greeting[];
  readonly noon?: readonly Greeting[];
}

const WEEKDAY: Record<number, WeekdayGreetings | undefined> = {
  1: {
    morning: [
      { key: 'home.greet.wMontagStart', withName: true },
      { key: 'home.greet.wMontagFrisch', withName: true },
    ],
    noon: [{ key: 'home.greet.wMontagLaeuft', withName: true }],
  },
  5: {
    morning: [{ key: 'home.greet.wFreitagName', withName: true }, { key: 'home.greet.wFreitag' }],
    noon: [{ key: 'home.greet.wFreitagName', withName: true }, { key: 'home.greet.wFreitag' }],
  },
  6: {
    morning: [{ key: 'home.greet.wSamstagName', withName: true }, { key: 'home.greet.wSamstag' }],
    noon: [{ key: 'home.greet.wSamstagName', withName: true }, { key: 'home.greet.wSamstag' }],
  },
  0: {
    morning: [{ key: 'home.greet.wSonntagName', withName: true }, { key: 'home.greet.wSonntag' }],
    noon: [{ key: 'home.greet.wSonntagName', withName: true }, { key: 'home.greet.wSonntag' }],
  },
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

export function pickGreeting(
  name: string | null | undefined,
  now: Date,
  userId?: string,
  /** Zaehler je Bildschirm-Aufruf — ohne ihn bleibt der Gruss den ganzen Tag gleich */
  seed?: number,
): string {
  const bucket = bucketFor(now.getHours());
  const timePool =
    bucket === 'morning' ? MORNING : bucket === 'noon' ? NOON : bucket === 'evening' ? EVENING : NIGHT;
  const weekday = WEEKDAY[now.getDay()];
  const weekdayPool =
    bucket === 'morning' ? weekday?.morning : bucket === 'noon' ? weekday?.noon : undefined;
  const base = weekdayPool ? [...timePool, ...weekdayPool] : timePool;

  const firstName = name?.trim().split(' ')[0] ?? '';
  const pool = firstName ? base : base.filter((g) => !g.withName);
  // Nur Namens-Grüße im Topf und kein Name da: dann lieber neutral bleiben
  if (pool.length === 0) return t('home.greeting');

  // seed wechselt bei jedem Home-Aufruf (Sascha 16.08.). Weiterhin KEIN
  // Math.random: der Aufrufer haelt den Wert fest, solange der Bildschirm
  // sichtbar ist — sonst spraenge der Gruss beim Scrollen.
  const day = now.toISOString().slice(0, 10);
  const chosen = pool[hash(`${day}|${bucket}|${userId ?? ''}|${seed ?? ''}`) % pool.length];
  return chosen.withName ? t(chosen.key, { name: firstName }) : t(chosen.key);
}
