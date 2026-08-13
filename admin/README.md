# IriFit Admin

Next.js 16 (App Router). Verwaltungsoberfläche für Broadcasts, Q&A, Rezepte, Kurse,
Gutscheine und Nutzerinnen. Login über Supabase Auth mit dem normalen IriFit-Konto —
niemand braucht einen Supabase-Zugang.

```bash
npm run dev      # http://localhost:3000
npm run build
```

## Wer reinkommt

`is_admin()` in Postgres und `isAdminUser()` im Code prüfen dasselbe:
`auth.jwt().app_metadata.role === 'admin'`. Die Rolle lässt sich nur mit dem
Service-Role-Key setzen, nicht aus der App heraus:

```bash
curl -X PUT "https://mzzonwvbacxlpwsmefrn.supabase.co/auth/v1/admin/users/<USER-ID>" \
  -H "apikey: $SRK" -H "Authorization: Bearer $SRK" -H "Content-Type: application/json" \
  -d '{"app_metadata":{"role":"admin"}}'
```

Der Key kommt aus `npx supabase projects api-keys --project-ref mzzonwvbacxlpwsmefrn`.

Aktuell Admin: `sashadith@gmail.com`, `info@secretbrand.eu`, `irinadith@gmail.com`
(Irina seit 13.08.2026 — meldet sich mit E-Mail + Passwort an, „Passwort vergessen"
funktioniert). Rolle entziehen: dasselbe PUT mit `{"app_metadata":{"role":null}}`.

Ein Admin sieht über die Policies aus `20260722120000_admin_read_policies.sql` auch
`profiles`, `subscriptions` und `voucher_redemptions` — also Kundendaten. Das ist beim
Vergeben der Rolle mitzudenken.

## Umgebungsvariablen

`.env.local` (nicht im Repo):

| Variable | Zweck | Geheim |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase-Projekt | nein |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable Key | nein |
| `CF_ACCOUNT_ID`, `CF_STREAM_TOKEN` | Video-Upload für Kurse (Cloudflare Stream) | **ja** |
| `SUPABASE_SERVICE_ROLE_KEY` | nur `/api/users` (Nutzerverwaltung) | **ja** |

Ohne die beiden geheimen Blöcke läuft alles außer Video-Upload und Nutzerverwaltung;
beide Module zeigen dann eine klare Meldung statt zu crashen.

## Deployment auf admin.irinadith.com — offener Schritt

Hostinger **Business** kann Node-Apps (hPanel → Websites → Web Apps, „Supports Next.js").
Kostet nichts extra, läuft auf dem Plan, der ohnehin die Landingpage trägt.

Vorbereitet ist ein Paket ohne `node_modules`, `.next` und `.env.local`:

```bash
cd admin && zip -rq ~/Desktop/irifit-admin.zip . -x "node_modules/*" ".next/*" ".git/*" ".env.local"
```

Der Assistent (hPanel → Web Apps → *Get started*) fragt nacheinander nach Domain,
Deploy-Methode und Dateien. Zwei Dinge stehen dort noch im Weg:

1. **`admin.irinadith.com` wird abgelehnt** („Your domain can't have active subdomains"),
   weil die Subdomain schon als statische Seite mit dem Platzhalter aus `website/admin/`
   existiert. Sie muss vorher weg — danach legt der Assistent sie neu an.
   Alternativ zuerst auf der temporären Domain deployen und die Domain später umhängen.
2. **Der ZIP-Upload braucht einen Menschen** am Dateidialog. Wer das automatisieren will,
   aktiviert SSH (hPanel → Advanced → SSH Access, steht auf *Inactive*) und lädt per
   `scp` hoch — das ist eine Änderung an den Sicherheitseinstellungen des Hosting-Kontos
   und darum bewusst nicht nebenbei passiert.

Danach im Web-App-Panel die beiden `NEXT_PUBLIC_*`-Variablen eintragen. Die geheimen
Variablen gehören nur dorthin, wenn Video-Upload und Nutzerverwaltung wirklich im Web
gebraucht werden — sonst bleiben sie lokal.
