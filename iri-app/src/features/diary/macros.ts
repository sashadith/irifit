/**
 * Makro-Kurzform, eine Quelle für die ganze App (Sascha 15.08.).
 *
 * Vorbild ist die Mahlzeiten-Karte auf der Startseite: `12K · 37E · 12F`
 * — deutsche Anfangsbuchstaben, Zahl direkt am Buchstaben, Reihenfolge
 * Kohlenhydrate, Eiweiß, Fett wie bei den Makro-Karten darüber.
 *
 * Bis dahin liefen vier Schreibweisen nebeneinander: `27K · 1E · 0F` auf der
 * Startseite, `37 P · 12 C · 12 F` im Rezept und im Lebensmittel-Blatt,
 * `Eiweiß 12 g · KH 30 g` im Eintrags-Detail und `P 24 %` im Fortschritt.
 * P und C sind dabei englisch — wer „P" für Portion oder „C" für Kalorien
 * liest, bekommt eine falsche Zahl in den Kopf.
 *
 * Fehlende Werte fallen weg statt als 0 zu erscheinen: ein Eintrag ohne
 * hinterlegte Makros soll nicht behaupten, er habe null Gramm Eiweiß.
 */
export function macroShort(
  carbsG: number | null | undefined,
  proteinG: number | null | undefined,
  fatG: number | null | undefined,
): string {
  const parts: string[] = [];
  if (carbsG != null) parts.push(`${Math.round(carbsG)}K`);
  if (proteinG != null) parts.push(`${Math.round(proteinG)}E`);
  if (fatG != null) parts.push(`${Math.round(fatG)}F`);
  return parts.join(' · ');
}

/** Dieselben Buchstaben für die Prozent-Aufteilung im Fortschritt: `K 38 %` */
export function macroShareShort(share: number, macro: 'carbs' | 'protein' | 'fat'): string {
  const letter = { carbs: 'K', protein: 'E', fat: 'F' }[macro];
  return `${letter} ${Math.round(share * 100)} %`;
}
