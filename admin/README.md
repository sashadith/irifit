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

## Deployment — https://admin.irinadith.com (live seit 13.08.2026)

Läuft als Hostinger **Web App** (hPanel → Websites → Web Apps) auf dem Business-Plan,
der ohnehin die Landingpage trägt. Node 22, Framework-Preset Next.js, Root `./`,
Build-Einstellungen auf Default. Kostet nichts extra.

Neues Paket bauen und hochladen:

```bash
cd admin && npm run build   # erst lokal gruen bekommen
zip -rq ~/Desktop/irifit-admin.zip . -x "node_modules/*" ".next/*" ".git/*" ".env.local"
```

Dann in hPanel die Web App öffnen und das Archiv neu deployen. Der ZIP-Upload läuft über
einen nativen Dateidialog — den muss ein Mensch bedienen. Wer das loswerden will,
aktiviert SSH (hPanel → Advanced → SSH Access, steht auf *Inactive*) oder hängt ein
GitHub-Repo an; beides ändert die Zugangslage des Hosting-Kontos und ist darum eine
bewusste Entscheidung, kein Nebenbei-Schritt.

**Die `NEXT_PUBLIC_*`-Variablen müssen VOR dem Build gesetzt sein** — Next backt sie in
die JS-Bundles ein. Im Assistenten unter *Environment variables* eintragen, nicht erst
danach im Panel. Gesetzt sind `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` und seit 13.08.
`SUPABASE_SERVICE_ROLE_KEY` (Saschas Entscheidung — die Nutzerverwaltung soll im Web
laufen). Der Service-Role-Key wird nur serverseitig in `/api/users` gelesen und landet
nicht im Browser-Bundle; er ist der einzige Grund, warum diese Variable NICHT mit
`NEXT_PUBLIC_` beginnen darf. `CF_ACCOUNT_ID`/`CF_STREAM_TOKEN` fehlen weiterhin —
Kurs-Video-Upload bleibt ein lokales Werkzeug.

Folge davon: **jeder** Panel-Admin kann Nutzerinnen einsehen, Admin-Rechte vergeben und
Konten sperren, also auch Irina. Wer das einschränken will, muss den Menüpunkt und die
Seite an eine Konto-Liste binden — es gibt unterhalb von `role = 'admin'` keine feinere
Stufe.

Beim ersten Deployment geprüft: `/login` liefert 200, `/`, `/broadcast`, `/qa` und
`/rezepte` leiten ohne Sitzung per 307 auf `/login` (der Proxy-Guard greift), die
Supabase-URL steckt im ausgelieferten Chunk, und eine Anmeldung mit erfundener Adresse
wird von Supabase korrekt abgelehnt.
