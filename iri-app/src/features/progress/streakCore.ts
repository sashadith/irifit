/**
 * Pure Streak-Logik ohne Abhängigkeiten — separat testbar.
 *
 * Milde Regel (Konzept 5.5): Ein Eintrag pro Tag genügt. Ein fehlender Tag
 * pro Kalenderwoche wird vom Joker geschützt; der zweite Lücken-Tag derselben
 * Woche beendet die Serie. Der heutige Tag zählt nie GEGEN die Serie.
 */

export function toIsoDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** ISO-Wochen-Schlüssel (Jahr-Woche) für die Joker-Buchhaltung */
function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Donnerstag der Woche bestimmt das ISO-Jahr
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-${week}`;
}

export interface StreakResult {
  streak: number;
  lastJokerUsedOn: string | null;
}

export function computeStreak(loggedDays: ReadonlySet<string>, today = new Date()): StreakResult {
  if (loggedDays.size === 0) return { streak: 0, lastJokerUsedOn: null };

  const cursor = new Date(today);
  if (!loggedDays.has(toIsoDay(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  let lastJoker: string | null = null;
  const jokerWeeks = new Set<string>();

  // Terminierung: pro Woche höchstens 1 Joker → spätestens der zweite
  // Lücken-Tag einer Woche bricht ab. 3 Jahre als harte Obergrenze.
  for (let i = 0; i < 1100; i++) {
    const iso = toIsoDay(cursor);
    if (loggedDays.has(iso)) {
      streak++;
    } else {
      const week = isoWeekKey(cursor);
      if (jokerWeeks.has(week)) break;
      jokerWeeks.add(week);
      if (!lastJoker) lastJoker = iso;
    }
    cursor.setDate(cursor.getDate() - 1);
  }

  return { streak, lastJokerUsedOn: lastJoker };
}
