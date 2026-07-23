// IRI — RevenueCat-Webhook (Session 11).
// Einzige Schreibquelle für subscriptions neben redeem-voucher — der Client
// darf die Tabelle per RLS nie beschreiben. Auth: RevenueCat sendet den in
// den Webhook-Einstellungen hinterlegten Authorization-Header; er muss exakt
// dem Supabase-Secret RC_WEBHOOK_SECRET entsprechen (verify_jwt ist aus,
// RevenueCat besitzt kein Supabase-JWT).
import { createClient } from 'npm:@supabase/supabase-js@2';

const ENTITLEMENT = 'pro';
const PRODUCTS = ['irifit_monthly', 'irifit_yearly'];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface RcEvent {
  type: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  product_id?: string;
  entitlement_ids?: string[] | null;
  period_type?: string;
  purchased_at_ms?: number;
  expiration_at_ms?: number | null;
  store?: string;
  cancel_reason?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** SDK wird mit appUserID = Supabase-UUID konfiguriert — anonyme IDs überspringen */
function resolveUserId(event: RcEvent): string | null {
  const candidates = [event.app_user_id, event.original_app_user_id, ...(event.aliases ?? [])];
  for (const c of candidates) {
    if (c && UUID_RE.test(c)) return c;
  }
  return null;
}

/** Event-Typ → subscription_status (Enum: trialing/active/in_grace/paused/cancelled/expired) */
function mapStatus(event: RcEvent): { status: string; willRenew: boolean } | null {
  const trial = event.period_type === 'TRIAL';
  switch (event.type) {
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
    case 'UNCANCELLATION':
    case 'PRODUCT_CHANGE':
      return { status: trial ? 'trialing' : 'active', willRenew: true };
    case 'CANCELLATION':
      // Auto-Renew aus — Zugriff bleibt bis zum Periodenende (is_subscriber
      // prüft current_period_end, daher Status NICHT auf cancelled kippen)
      return { status: trial ? 'trialing' : 'active', willRenew: false };
    case 'BILLING_ISSUE':
      return { status: 'in_grace', willRenew: true };
    case 'SUBSCRIPTION_PAUSED':
      return { status: 'paused', willRenew: true };
    case 'EXPIRATION':
      return { status: 'expired', willRenew: false };
    default:
      return null; // TEST, TRANSFER, NON_RENEWING_PURCHASE, … → bestätigen, nichts schreiben
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const secret = Deno.env.get('RC_WEBHOOK_SECRET');
  if (!secret) return json({ error: 'secret_not_configured' }, 500);
  if (req.headers.get('Authorization') !== secret) {
    return json({ error: 'unauthorized' }, 401);
  }

  let payload: { event?: RcEvent };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  const event = payload.event;
  if (!event?.type) return json({ error: 'missing_event' }, 400);

  // Nur unser Entitlement/unsere Produkte verarbeiten (Wizard-Altlasten ignorieren)
  const relevant =
    (event.entitlement_ids ?? []).includes(ENTITLEMENT) ||
    PRODUCTS.includes(event.product_id ?? '');
  const mapped = mapStatus(event);
  const userId = resolveUserId(event);
  if (!relevant || !mapped || !userId) {
    return json({ ok: true, skipped: true, type: event.type });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { error } = await admin.from('subscriptions').upsert(
    {
      user_id: userId,
      rc_customer_id: event.original_app_user_id ?? event.app_user_id ?? null,
      status: mapped.status,
      product_id: event.product_id ?? null,
      entitlement: ENTITLEMENT,
      will_renew: mapped.willRenew,
      current_period_end: event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
  if (error) return json({ error: 'upsert_failed' }, 500);

  return json({ ok: true, type: event.type, status: mapped.status });
});
