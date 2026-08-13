# Website irinadith.com — Deploy

Statische Seiten, Hosting bei Hostinger (Business Web Hosting, SSL + CDN aktiv).

## Struktur
- `index.html` — Landingpage (Hero, App-Features, Kurs/Broadcast, Über Irina, FAQ, CTA)
- `datenschutz.html`, `agb.html` — **generiert** aus `iri-app/src/i18n/de.json` (`legal.privacyBody` / `legal.termsBody`),
  damit App und Web nie auseinanderlaufen. Bei Textänderungen in der App neu generieren.
- `impressum.html` — handgepflegt (LTD-Daten, HE450005, VAT CY60038766O)
- `style.css` — gemeinsames Markenstylesheet (Antic Didone + Manrope, Rosé-Verlauf, Milchglas)
- `img/iri-N.webp` + `@small` — aus `iri-app/assets/images/iripics/*.png` (11 MB PNG → 0,9 MB WebP)
- `admin/index.html` — Platzhalter für admin.irinadith.com

## Hochladen (FTP)
Host `ftp.irinadith.com`, Benutzer `u773043848.irifitdeploy`, Ziel `/` (= public_html).

WICHTIG: **ohne** `--ftp-ssl` hochladen — mit TLS bricht Hostinger bei Dateien > ~50 KB
mit `450 Transfer aborted. Link to file server lost` ab.

```bash
curl --ftp-pasv -u "u773043848.irifitdeploy:PASSWORT" -T datei.html ftp://ftp.irinadith.com/datei.html
```

Bilder einzeln hochladen (Sammel-Uploads in einer Sitzung laufen in 450er).

## DNS
- irinadith.com → Hostinger (ns1/ns2.dns-parking.com), A 92.113.16.216
- admin.irinadith.com → automatisch angelegt, A 92.113.16.224
- irinadith.de → eigene Zone (nova/cosmos.dns-parking.com), A 2.57.91.91 — steht auf "Parked",
  Weiterleitung auf .com noch offen

## Offen
- Store-Links: derzeit Platzhalter `#` mit "Bald verfügbar" — nach Veröffentlichung echte URLs eintragen
- App-Screenshots in die Landingpage (nach finalen Store-Assets)
- irinadith.de → 301 auf irinadith.com
