// IRI — Rechtstexte ausliefern (Session 15). Supabase Storage erzwingt für
// HTML text/plain (Phishing-Schutz), darum serviert diese Function die Seiten
// aus dem legal-Bucket mit korrektem Content-Type. Inhalte pflegen = Dateien
// im Bucket ersetzen, kein Redeploy nötig.
import { createClient } from 'npm:@supabase/supabase-js@2';

const PAGES = new Set(['datenschutz', 'agb']);

Deno.serve(async (req: Request) => {
  const page = new URL(req.url).pathname.split('/').pop() ?? '';
  if (!PAGES.has(page)) return new Response('Not found', { status: 404 });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data, error } = await admin.storage.from('legal').download(`${page}.html`);
  if (error || !data) return new Response('Not found', { status: 404 });

  return new Response(await data.text(), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
});
