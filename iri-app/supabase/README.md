# IRI — Supabase

Schema, RLS-Policies, Storage-Buckets und Rezept-Seed (Session 2).

## Struktur

- `migrations/20260718140000_initial_schema.sql` — 17 Tabellen gemäß Konzept Kap. 8, alle mit RLS
- `migrations/20260718140100_storage_buckets.sql` — Buckets `progress-photos` (privat), `recipe-images` (öffentlich), `broadcast-media` (privat) + Storage-Policies
- `seed.sql` — 157 Rezepte, generiert aus `data/rezepte-import.json` (nicht von Hand editieren)
- `data/rezepte-import.json` — Quelle aus `IRI-Rezepte-ueberarbeitet.xlsx`

Seed neu erzeugen nach Rezept-Änderungen: `node scripts/db/generate-recipe-seed.mjs`

## Rollen-Modell

- **Nutzerin** (`authenticated`): sieht ausschließlich eigene Daten; Rezepte/Kurse/Broadcasts nur mit aktivem Abo (`is_subscriber()`)
- **Admin (Irina)**: JWT mit `app_metadata.role = 'admin'` — volle Rechte auf Inhalte, Vouchers, Q&A (`is_admin()`); setzen per `supabase auth admin update-user` bzw. Admin-API (nur serverseitig)
- **Service Role**: schreibt `subscriptions` (RevenueCat-Webhook), `voucher_redemptions` und claimt `legacy_customers` — dafür gibt es bewusst keine Client-Policies
- **Legacy-Kundinnen**: sehen nur ihre alten Kurse (`has_legacy_access()`), sonst nichts — auch ohne Abo

## Deployment (sobald das Supabase-Projekt existiert — EU-Region!)

```bash
brew install supabase/tap/supabase
supabase login
cd iri-app
supabase init            # erzeugt config.toml (einmalig)
supabase link --project-ref <PROJECT_REF>
supabase db push         # spielt migrations/ ein
psql "$SUPABASE_DB_URL" -f supabase/seed.sql   # Rezepte einspielen (idempotent)
```

Lokale Entwicklung (braucht Docker): `supabase start` + `supabase db reset` (spielt Migrations + seed.sql automatisch ein).

## Telegram-Meldungen (Punkt 14, 17.08.)

Ein Bot schreibt in einen Chat, in dem Sascha und Irina sitzen.

**Sofort**, aus den Edge Functions heraus:

| Ereignis | Quelle |
|---|---|
| Neuer Test, neues Abo, Tarifwechsel | `revenuecat-webhook` |
| Test → zahlend | `revenuecat-webhook` |
| Kündigung, Zahlungsproblem, Ablauf, Pause | `revenuecat-webhook` |
| Gutschein eingelöst | `redeem-voucher` |
| Neue Frage im Q&A | `push-dispatch`, ≤ 15 Min |

Bewusst **still**: die normale Verlängerung. Bei 200 Abos wären das 200 Nachrichten
im Monat, in denen die eine Kündigung untergeht. Verlängerungen stehen im Bericht.

**Täglich** um 18:00 UTC (Sommer 20 Uhr, Winter 19 Uhr): `telegram-digest` —
Anmeldungen, aktive Nutzerinnen, Zugänge, was in sieben Tagen ausläuft, offene
Fragen, Suchbegriffe ohne Treffer.

**Keine Namen, keine E-Mail-Adressen, keine IDs.** Telegram ist ein fremder
Dienst; wer es war, steht im Admin-Bereich. Gutscheincodes und Fragetexte gehen
raus — der Code gehört niemandem persönlich, und der Fragetext ist genau das,
was Irina zum Entscheiden braucht.

### Einrichten

1. In Telegram `@BotFather` anschreiben → `/newbot` → Namen vergeben → Token merken
2. Bot in die Gruppe holen (oder ihm direkt schreiben) und dort eine Nachricht senden
3. Chat-ID holen: `https://api.telegram.org/bot<TOKEN>/getUpdates` im Browser öffnen,
   die Zahl unter `result[0].message.chat.id` ist es (Gruppen-IDs sind negativ)
4. Beides als Function-Secret setzen — am besten im Dashboard unter
   *Project Settings → Edge Functions → Secrets*, dann landet der Token nicht in
   der Shell-History:
   `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`

Ohne diese beiden Secrets meldet der Bot nichts und alles andere läuft
unverändert weiter — kein Kauf und kein Cron-Lauf hängt daran.

### Prüfen

Trockenlauf ohne Versand (zeigt nur den Text an):

```bash
curl -s -X POST https://mzzonwvbacxlpwsmefrn.supabase.co/functions/v1/telegram-digest \
  -H "x-cron-secret: $CRON_SECRET" -H 'Content-Type: application/json' -d '{"dry":true}'
```

Ohne `"dry"` geht der Bericht wirklich raus.

## Getestet

Beide Migrations + Seed + RLS-Smoke-Tests laufen gegen Postgres 17 (mit Stubs für
`auth.uid()`/`auth.jwt()`/Storage). Geprüft: 17 Tabellen alle mit RLS · 157 Rezepte
veröffentlicht · ohne Abo keine Rezepte sichtbar · Fremddaten unsichtbar · kcal-Untergrenze
1.200 greift · Clients können sich kein Abo selbst schreiben · Vouchers nur für Admin.
