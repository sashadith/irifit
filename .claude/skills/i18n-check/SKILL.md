---
name: i18n-check
description: Prüft die iri-app auf hartkodierte deutsche UI-Strings in .tsx/.ts-Dateien — alle nutzersichtbaren Texte müssen über t() aus src/i18n/de.json kommen.
---

# i18n-Check: hartkodierte Strings finden

Regel aus CLAUDE.md: **i18n ab Tag 1** — jeder nutzersichtbare String der App liegt in
`iri-app/src/i18n/de.json` und wird über `t('pfad.key')` geladen. (Das Next-Admin ist
bewusst ausgenommen: intern, nur Deutsch.)

## Vorgehen

1. Kandidaten sammeln (aus `iri-app/` heraus):

   ```bash
   # Umlaute/ß in Quellcode außerhalb der Sprachdatei
   grep -rnE '[äöüÄÖÜß]' src --include='*.tsx' --include='*.ts' | grep -v 'src/i18n/'

   # Deutsche Wörter ohne Umlaute in JSX-Text oder String-Literalen
   grep -rnE '(>|["'\''`])\s*(Dein|Deine|Du |Noch |Kein|Bitte|Weiter|Zurück|Speichern|Abbrechen|Fertig|Los )' \
     src --include='*.tsx' | grep -v 'src/i18n/'
   ```

2. Treffer einordnen — NICHT jeder Treffer ist ein Fehler:
   - **Verstoß:** Text in JSX (`<Text>Hallo</Text>`), `Alert.alert('…')`, `placeholder="…"`,
     `accessibilityLabel="…"` mit deutschem Klartext.
   - **Kein Verstoß:** Code-Kommentare, Log-/Fehlermeldungen für Entwickler, Keys/IDs,
     `de.json` selbst, reine Satzzeichen (`…`, `—`, `›`).

3. Für jeden Verstoß: String nach `de.json` verschieben (bestehende Namensstruktur der
   Sektion nutzen, Platzhalter als `{name}`), Stelle auf `t()` umstellen.

4. Neue oder geänderte Texte in `de.json` mit dem Skill `avoid-ai-writing` gegenlesen
   (Irinas Ton: per Du, warm, kein Diät-Druck).

5. Abschluss: `npx tsc --noEmit` und kurzer Bericht — Anzahl Verstöße, was verschoben
   wurde, was bewusst stehen blieb (mit Begründung).
