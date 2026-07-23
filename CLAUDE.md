# IRI — Satt & Fit mit Irina Dith

iOS/Android-Abo-App für Influencerin Irina Dith (@iri.fitnessmum, 257k Reichweite, 93 % Frauen, 90 % DACH). Kernversprechen: **Abnehmen ohne zu hungern.** Referenz-Wettbewerber: Lifesum (wir: keine Paywall-Stufen, keine Werbung, Deutsch first), kalorina.app.

**Maßgebliche Quelle: `IRI-App-Konzept-v1.docx`** (14 Kapitel). Diese Datei hier ist die Kurzfassung für Code-Sessions.

## Produktentscheidungen (FIX)
- Name FINAL (22.07.): **IriFit** — Store-Titel „IriFit – Satt & Fit mit Irina Dith“. Branding (Slogan/Logo/Icon): siehe `IRI-Branding.html`. Stores geprüft: keine App dieses Namens in App Store/Google Play; ABER Social-Handles @irifit/@iri.fit anderweitig belegt (Fitness-Influencerin @IriFit.98) + Nähe zur großen Marke iFIT (NordicTrack) → vor Store-Einreichung kurze Marken-/Domain-Prüfung (DPMA/EUIPO, irifit.de/.app). In-App-Anzeigename seit 22.07. überall „IriFit“ (i18n, Welcome, Paywall, Admin-Header, app.json-Anzeigename); Bundle-IDs/Slugs + Store-Assets erst in S17. App-ID FIX (23.07., in Play Console angelegt): Android `android.package` = **com.irinadith.irifit**, iOS Bundle-ID später identisch **com.irinadith.irifit** — muss exakt so in app.json beim ersten EAS-Build stehen. Wortmarke FINAL: Italiana, „Iri“ Rosé #D25578 + „Fit“ Slogan-Grau #8A7B8E + Rosé-Verlaufsstrich, Slogan „Abnehmen ohne zu hungern.“ (siehe IRI-Branding.html, Final-Sektion); App-Icon-Entscheidung noch offen
- Abo: **6,99 €/Monat, 59,99 €/Jahr, 7 Tage Trial**, Hard Paywall nach Onboarding, kein Freemium; EIN Abo für alles (kein Video-Zusatzabo!), nach Launch ggf. Einmalkauf-Specials
- **VOLL-Launch** ohne Versionstrennung; nach Launch nur Content-Nachschub (+ Referral, Wochenplaner später)
- **KEINE Burned Calories** — bewusste Entscheidung, niemals Aktivität gegen kcal verrechnen
- Sprache: Deutsch (UI per Du, Irinas Ton, kein Diät-Druck); **i18n ab Tag 1** (alle Strings in Sprachdateien)

## Stack (FIX)
React Native + Expo SDK 54 — GEPINNT, kein Upgrade: Expo Go unterstützt max. 54; Upgrade erst mit Dev-Builds (eine Codebase) · Supabase EU (Postgres/Auth/Storage/Edge Functions, RLS überall) · RevenueCat (Abos) · Cloudflare Stream (Video, signierte URLs) · Expo Notifications · Admin: Next.js (Hosting: Cloudflare Pages oder Saschas VPS) · AI-Scan: Claude Vision via Edge Function (API-Key nur serverseitig!), zweistufig Haiku→Sonnet bei niedriger Konfidenz, + Open Food Facts für Barcodes; Fair-Use 300 Scans/Monat

## Funktionsumfang Launch
Onboarding-Quiz → Kalorienziel/Makros · AI-Foto-Scan (primärer Logging-Weg, Ergebnis korrigierbar) · Barcode/Suche/Favoriten · Tagesansicht (Ring „übrig“, Makro-Balken, Mahlzeiten-Slots) · Wasser-Tracker · Gewicht + Progress-Fotos (privat) · Streaks (mild: 1 Joker-Tag/Woche) · Rezepte (157 Stück fertig: `IRI-Rezepte-ueberarbeitet.xlsx`, Import-JSON in Session-Outputs) · Ernährungskurs (Module→Lektionen) · Trainingsvideos (neu: Hochformat) · **USP-Features (Launch): „Was soll ich noch essen?“ (Rest-kcal → Rezeptvorschläge) · Satt-Score (Sättigung pro kcal, ●●●●○ an Rezepten + Scan) · Kühlschrank-Scan (Foto → Zutaten → Rezept-Matching)** · Broadcast (Irina sendet, Emoji-Reaktionen ❤️🔥💪😂👏, KEIN Chat) · Q&A-Einsendungen · Gutscheine (eigene Codes + RevenueCat Promotional Entitlements) · Einkaufsliste · **Legacy-Zugang**: Digistore24-Käuferinnen per Magic-Link-E-Mail → NUR ihre alten Querformat-Kurse (kein Digistore24-Link in der App!)

## Navigation
Tabs: **Home · Rezepte · + (zentral) · Coaching · Profil**; Fortschritt als Karte auf Home

## Design
**Apple Liquid Glass** (Entscheidung Sascha): durchscheinende Glas-Panels mit Blur über weichem Pastell-Wallpaper, System-Typografie (SF Pro / -apple-system), schwebende Glas-Tab-Bar, EIN Akzent: Rosé-Verlauf #E87F9C→#D25578 für CTAs/Ring, Rosé/Flieder/Pfirsich-Wallpaper. Typografie FIX: Headlines + große Zahlen = Italiana (400), ALLER UI-Text inkl. Buttons = Manrope. In RN: expo-blur/Materialien auf iOS, soliderer Fallback auf Android. Referenz: `IRI-Prototyp.html` (finales Design-System, eingefroren 18.07.2026). Kalorien immer als „übrig“, Schätzwerte als „ca.“ kommunizieren.

## Regeln
- Datenschutz: Gesundheitsdaten = Art. 9 DSGVO → explizite Einwilligung im Onboarding; Scan-Fotos nicht dauerhaft speichern; Account-Löschung in der App (Store-Pflicht); Kalorienziel-Untergrenze 1.200 kcal
- Refunds: Apple nur via Apple; Google im Admin möglich
- Subagenten-Workflow: scout (Haiku) für Repo-Suche, implementer (Sonnet) für umgesetzte Tasks — siehe `.claude/agents/`
- Rezept-Nährwert-Annahmen: Milch 1,5 %, 1 EL Öl = 10 g, 1 Ei (M) = 55 g usw. — Legende-Blatt der Excel
