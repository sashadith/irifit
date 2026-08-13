# Website irinadith.com — Deploy

Statische Seiten, Hosting bei Hostinger (Business Web Hosting, SSL + CDN aktiv).

## Struktur
- `index.html` — Landingpage (Hero, App-Features, Kurs/Broadcast, Über Irina, FAQ, CTA)
- `datenschutz.html`, `agb.html` — **generiert** aus `iri-app/src/i18n/de.json` (`legal.privacyBody` / `legal.termsBody`),
  damit App und Web nie auseinanderlaufen. Bei Textänderungen in der App neu generieren.
- `impressum.html` — handgepflegt (LTD-Daten, HE450005, VAT CY60038766O)
- `style.css` — gemeinsames Markenstylesheet (Antic Didone + Manrope, Rosé-Verlauf, Milchglas)
- `img/iri-N.webp` + `@small` — aus `iri-app/assets/images/iripics/*.png` (11 MB PNG → 0,9 MB WebP)
- `img/shot-*.webp` + `@small` — App-Screenshots aus dem iOS-Simulator, in iPhone-Rahmen gesetzt
- `admin/index.html` — Platzhalter für admin.irinadith.com
- `.htaccess` — Cache-Regeln (siehe unten)

## Hochladen (FTP)
Host `ftp.irinadith.com`, Benutzer `u773043848.irifitdeploy`, Ziel `/` (= public_html).

WICHTIG: **ohne** `--ftp-ssl` hochladen — mit TLS bricht Hostinger bei Dateien > ~50 KB
mit `450 Transfer aborted. Link to file server lost` ab.

```bash
curl --ftp-pasv -u "u773043848.irifitdeploy:PASSWORT" -T datei.html ftp://ftp.irinadith.com/datei.html
```

Bilder einzeln hochladen (Sammel-Uploads in einer Sitzung laufen in 450er).

## Caching — beim Ändern von style.css unbedingt beachten
Hostinger lieferte per Default für **alles** `max-age=604800`. `.htaccess` setzt das jetzt
auf 5 Minuten für HTML und lange Zeiten für Assets. CSS/JS werden über einen Query-Parameter
versioniert: `href="/style.css?v=JJJJMMTTNN"`.

Nach jeder CSS-Änderung die Versionsnummer in **allen** HTML-Dateien hochzählen, sonst sehen
wiederkehrende Besucher tagelang das alte Stylesheet:

```bash
perl -pi -e 's{style\.css\?v=\d+}{style.css?v=2026081304}g' index.html datenschutz.html agb.html impressum.html admin/index.html
```

Eine einmal ausgelieferte Versions-URL ist eine Woche verbrannt — wer versehentlich eine kaputte
Datei hochlädt, muss die Nummer erhöhen, nicht nur die Datei reparieren.

## DNS
- irinadith.com → Hostinger (ns1/ns2.dns-parking.com), A 92.113.16.216
- admin.irinadith.com → automatisch angelegt, A 92.113.16.224
- irinadith.de → eigene Zone (nova/cosmos.dns-parking.com), A 2.57.91.91 — 301 auf https://irinadith.com
  (zwei Regeln in Hostinger: http:// und https://)

## Offen
- Store-Links: derzeit Platzhalter `#` mit "Bald verfügbar" — nach Veröffentlichung echte URLs eintragen
- Admin-Bereich für Irina (Login mit App-Konto, Broadcasts + Rezepte pflegen)
