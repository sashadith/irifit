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

## Getestet

Beide Migrations + Seed + RLS-Smoke-Tests laufen gegen Postgres 17 (mit Stubs für
`auth.uid()`/`auth.jwt()`/Storage). Geprüft: 17 Tabellen alle mit RLS · 157 Rezepte
veröffentlicht · ohne Abo keine Rezepte sichtbar · Fremddaten unsichtbar · kcal-Untergrenze
1.200 greift · Clients können sich kein Abo selbst schreiben · Vouchers nur für Admin.
