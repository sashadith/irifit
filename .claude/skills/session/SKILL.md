---
name: session
description: Führt eine Session oder einen Mini-Auftrag aus dem ENTWICKLUNGSPLAN.md aus — inkl. frischem Plan-Lesen, Verifikation und Plan-Update. Aufruf z. B. /session 11 oder /session Mini-Fix Video-Player.
---

# IRI-Session ausführen

Argument: Session-Nummer oder Name des Auftrags (z. B. `11`, `Mini-Fix Einkaufslisten-Icon`).

## Ablauf (in dieser Reihenfolge)

1. **Plan FRISCH lesen.** `ENTWICKLUNGSPLAN.md` wird von Sascha zwischen den Sessions
   editiert — nie aus dem Gedächtnis oder einer Zusammenfassung arbeiten. Den Eintrag
   zum angefragten Auftrag komplett lesen, inklusive `>`-Notizen darunter und neuer
   Entscheidungen. Bei Widerspruch zwischen Plan und bisherigem Wissen gilt der Plan.
2. **Umsetzen.** Kontext aus `CLAUDE.md` beachten (Stack, Design eingefroren aus
   `IRI-Prototyp.html`, Datenschutz-Regeln). Secrets nie in Chat/Logs/Repo —
   `.iri-*.env`-Dateien sind zusätzlich per Hook gesperrt.
3. **Verifizieren** (aus `iri-app/` bzw. `admin/` heraus):
   - `npx tsc --noEmit` — 0 Fehler
   - iri-app: `npx expo export --platform ios --output-dir <scratchpad>` — Bundle baut
     (regeneriert auch die typed routes nach neuen Screens)
   - admin: `npm run build`
4. **i18n prüfen:** Keine hartkodierten nutzersichtbaren Strings in `.tsx` — alles über
   `t()` / `src/i18n/de.json` (Details: Skill `i18n-check`). Neue nutzersichtbare Texte
   mit dem Skill `avoid-ai-writing` auditieren (Irinas Ton, per Du, kein Diät-Druck).
5. **Plan aktualisieren:** Den Eintrag im ENTWICKLUNGSPLAN.md mit `✅ (TT.MM. — …)`
   markieren: kompakte Ergebnisnotizen, getroffene Entscheidungen, offene Punkte
   (OFFEN: …) und Erkenntnisse, die spätere Sessions brauchen.
6. **Abschlussbericht** an Sascha: Was ist neu, was wurde verifiziert, was ist offen,
   was muss er selbst tun (Dashboard-Einstellungen o. Ä.). Zum Testen: Expo Go neu laden.

## Feste Leitplanken

- Expo SDK 54 bleibt gepinnt (Hook erzwingt das; kein `expo upgrade`).
- Kalorien immer als „übrig", Schätzwerte als „ca."; keine Burned Calories.
- RLS-Grundsätze: `subscriptions`/`voucher_redemptions` nie clientseitig beschreibbar;
  Service-Role-Key und API-Keys nur serverseitig (Edge Functions / Next-API-Routen).
- Bulk-Daten in die DB über das Temp-Edge-Function-Muster (Secret-Header, danach 410-Stub).
