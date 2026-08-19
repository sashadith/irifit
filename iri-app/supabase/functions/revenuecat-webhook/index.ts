// IRI — RevenueCat-Webhook (Session 11).
// Einzige Schreibquelle für subscriptions neben redeem-voucher — der Client
// darf die Tabelle per RLS nie beschreiben. Auth: RevenueCat sendet den in
// den Webhook-Einstellungen hinterlegten Authorization-Header; er muss exakt
// dem Supabase-Secret RC_WEBHOOK_SECRET entsprechen (verify_jwt ist aus,
// RevenueCat besitzt kein Supabase-JWT).
import { createClient } from 'npm:@supabase/supabase-js@2';

import { notifyTelegram } from '../_shared/telegram.ts';

const ENTITLEMENT = 'pro';
const PRODUCTS = ['irifit_monthly', 'irifit_yearly'];

const PRODUKT_NAME: Record<string, string> = {
  irifit_yearly: 'Jahresabo',
  irifit_monthly: 'Monatsabo',
  voucher: 'Gutschein',
};

function produktName(productId: string | null | undefined): string {
  return PRODUKT_NAME[productId ?? ''] ?? 'Abo';
}

function datumKurz(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Berlin',
  });
}

/**
 * Meldung fuer den Telegram-Chat — oder null, wenn das Ereignis keine wert ist.
 *
 * Bewusst still: die normale Verlaengerung. Bei 200 Abos waeren das 200
 * Nachrichten im Monat, die niemand mehr liest — und dann geht die Kuendigung
 * darin unter. Verlaengerungen stehen im Tagesbericht.
 *
 * Der Uebergang Test → zahlend bekommt eine eigene Meldung: Das ist die Zahl,
 * an der sich entscheidet, ob die Preise stimmen.
 */
function meldung(
  event: RcEvent,
  neuerStatus: string,
  vorherStatus: string | null,
): string | null {
  const produkt = produktName(event.product_id);
  const bis = datumKurz(event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null);
  const trial = event.period_type === 'TRIAL';

  switch (event.type) {
    case 'INITIAL_PURCHASE':
      return trial
        ? `🎉 <b>Neuer Test</b> — ${produkt}${bis ? `, Test endet ${bis}` : ''}`
        : `🎉 <b>Neues ${produkt}</b>${bis ? `, läuft bis ${bis}` : ''}`;
    case 'RENEWAL':
      if (vorherStatus === 'trialing' && !trial) {
        return `💚 <b>Aus Test wurde Abo</b> — ${produkt}${bis ? `, bis ${bis}` : ''}`;
      }
      return null;
    case 'PRODUCT_CHANGE':
      return `🔁 <b>Tarifwechsel</b> zu ${produkt}${bis ? `, bis ${bis}` : ''}`;
    case 'CANCELLATION':
      return `🔕 <b>Kündigung</b> — ${produkt}${bis ? `, Zugang bleibt bis ${bis}` : ''}`;
    case 'UNCANCELLATION':
      return `↩️ <b>Kündigung zurückgenommen</b> — ${produkt}`;
    case 'BILLING_ISSUE':
      return `⚠️ <b>Zahlungsproblem</b> — ${produkt}${bis ? `, Kulanz bis ${bis}` : ''}`;
    case 'SUBSCRIPTION_PAUSED':
      return `⏸ <b>Abo pausiert</b> — ${produkt}`;
    case 'EXPIRATION':
      return `➖ <b>Abo abgelaufen</b> — ${produkt}`;
    default:
      return null;
  }
}

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

  // Status VOR dem Upsert lesen: nur so laesst sich der Uebergang
  // Test → zahlend erkennen, und der ist die wichtigste Meldung von allen.
  const { data: vorher } = await admin
    .from('subscriptions')
    .select('status')
    .eq('user_id', userId)
    .maybeSingle();

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

  /* Telegram-Meldung (Punkt 14). Steht NACH dem Upsert und ausserhalb der
     Fehlerbehandlung: Ein stummer Bot darf einen bestaetigten Kauf nicht
     ungueltig machen. Scheitert der Versand, steht das im Function-Log. */
  const text = meldung(event, mapped.status, vorher?.status ?? null);
  if (text) {
    const { count } = await admin
      .from('subscriptions')
      .select('*', { count: 'exact', head: true })
      .in('status', ['trialing', 'active', 'in_grace']);
    const { count: imTest } = await admin
      .from('subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'trialing');
    await notifyTelegram(
      `${text}\n\nJetzt <b>${count ?? 0}</b> mit Zugang, davon ${imTest ?? 0} im Test.`,
    );
  }

  return json({ ok: true, type: event.type, status: mapped.status });
});
