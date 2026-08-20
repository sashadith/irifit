/**
 * Tippfehler in der E-Mail-Adresse abfangen (Sascha 20.08.).
 *
 * Warum ueberhaupt: Wir verlangen bewusst KEINE Bestaetigung per Mail — der
 * Umweg ins Postfach liegt genau vor der Paywall und kostet Abschluesse. Damit
 * faellt aber auch das Netz weg, das Vertipper faengt. Wer sich als
 * „anna@gmial.com" registriert, bekommt nie eine Passwort-Zuruecksetzung und
 * ist bei vergessenem Passwort dauerhaft aus einem bezahlten Abo ausgesperrt.
 *
 * Also fangen wir den Fehler dort ab, wo er entsteht: direkt im Feld, ohne
 * Klick, ohne Postfach. Vorgeschlagen wird nur, nie automatisch ersetzt — bei
 * eigenen Firmendomains laege die App sonst falsch.
 */

/** Die Domains, die in Deutschland praktisch alle privaten Adressen abdecken */
const HAEUFIGE_DOMAINS = [
  'gmail.com',
  'googlemail.com',
  'gmx.de',
  'gmx.net',
  'web.de',
  'hotmail.com',
  'hotmail.de',
  'outlook.de',
  'outlook.com',
  'icloud.com',
  'yahoo.de',
  'yahoo.com',
  't-online.de',
  'freenet.de',
  'aol.com',
  'me.com',
  'mail.de',
  'posteo.de',
];

/**
 * Levenshtein-Abstand, aber vorzeitig abgebrochen: Mehr als zwei Aenderungen
 * sind kein Vertipper mehr, sondern eine andere Domain.
 */
function abstand(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let vorherige = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const aktuelle = [i];
    let zeilenMin = i;
    for (let j = 1; j <= b.length; j++) {
      const kosten = a[i - 1] === b[j - 1] ? 0 : 1;
      const wert = Math.min(
        vorherige[j] + 1,
        aktuelle[j - 1] + 1,
        vorherige[j - 1] + kosten,
      );
      aktuelle.push(wert);
      if (wert < zeilenMin) zeilenMin = wert;
    }
    if (zeilenMin > max) return max + 1;
    vorherige = aktuelle;
  }
  return vorherige[b.length];
}

/**
 * Gibt eine korrigierte Adresse zurueck — oder null, wenn alles in Ordnung
 * scheint. Bewusst zurueckhaltend: Nur wenn die Domain FAST einer bekannten
 * gleicht, aber nicht exakt.
 */
export function schlageAdresseVor(eingabe: string): string | null {
  const adresse = eingabe.trim().toLowerCase();
  const at = adresse.lastIndexOf('@');
  if (at < 1 || at === adresse.length - 1) return null;

  const name = adresse.slice(0, at);
  const domain = adresse.slice(at + 1);
  if (HAEUFIGE_DOMAINS.includes(domain)) return null;

  // Fehlender Punkt vor der Endung: „gmail,com" oder „gmailcom"
  for (const kandidat of HAEUFIGE_DOMAINS) {
    if (domain.replace(/[^a-z]/g, '') === kandidat.replace(/[^a-z]/g, '')) {
      return `${name}@${kandidat}`;
    }
  }

  let bester: string | null = null;
  let bestAbstand = 3;
  for (const kandidat of HAEUFIGE_DOMAINS) {
    const d = abstand(domain, kandidat);
    if (d < bestAbstand) {
      bestAbstand = d;
      bester = kandidat;
    }
  }
  // Bei sehr kurzen Domains reicht schon ein Zeichen Unterschied fuer eine
  // voellig andere Firma („mail.de" vs. „mail.ru") — dort strenger sein.
  const grenze = domain.length <= 7 ? 1 : 2;
  if (bester && bestAbstand <= grenze) return `${name}@${bester}`;
  return null;
}
