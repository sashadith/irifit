#!/usr/bin/env node
/**
 * Session 10: Käuferinnen-Import aus Digistore24 (Produkt 610992 „BLEIB FIT mit IRI").
 *
 * Aufrufe:
 *   node scripts/digistore/fetch-purchases.mjs ping     — API-Key validieren
 *   node scripts/digistore/fetch-purchases.mjs sample   — 1 Seite ziehen, ECHTE Feldnamen inspizieren (PII maskiert)
 *   node scripts/digistore/fetch-purchases.mjs full     — alle Seiten, Refunds/Chargebacks raus → data/legacy-import.json
 *
 * Key liegt in iri-app/.iri-digistore.env (DS_API_KEY=…) — wird NIE ausgegeben.
 * E-Mails/Namen erscheinen in KEINER Ausgabe (nur Zähler); die JSON-Datei
 * bleibt lokal (kein Git-Repo, zusätzlich .gitignore-Eintrag).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA = join(ROOT, '..', 'data');
const PRODUCT_ID = '610992';
const BASE = 'https://www.digistore24.com/api/call';

function loadKey() {
  const text = readFileSync(join(ROOT, '.iri-digistore.env'), 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*(?:export\s+)?(DS_API_KEY|DIGISTORE_API_KEY)\s*=\s*(.+)\s*$/);
    if (m) return m[2].replace(/^["']|["']$/g, '');
  }
  throw new Error('DS_API_KEY nicht in .iri-digistore.env gefunden');
}

const KEY = loadKey();

async function call(fn, params = {}) {
  const url = new URL(`${BASE}/${fn}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url, { headers: { 'X-DS-API-KEY': KEY, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${fn}: HTTP ${res.status}`);
  const json = await res.json();
  if (json.result !== 'success') {
    throw new Error(`${fn}: result=${json.result} message=${json.message ?? '?'}`);
  }
  return json.data;
}

/** Rekursive Struktur-Inspektion ohne PII: Pfade + Typen, Werte nur für unbedenkliche Felder */
const VALUE_WHITELIST = /(billing_status|transaction_type|product_id|currency|billing_type|pay_method|purchase_type|is_|_status|country)$/;
function inspect(value, path = '', out = new Map()) {
  if (Array.isArray(value)) {
    out.set(`${path}[]`, `array(${value.length})`);
    if (value.length > 0) inspect(value[0], `${path}[]`, out);
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) inspect(v, path ? `${path}.${k}` : k, out);
  } else {
    const show = VALUE_WHITELIST.test(path) ? ` = ${JSON.stringify(value)}` : '';
    out.set(path, `${typeof value}${show}`);
  }
  return out;
}

async function fetchPage(pageNo, pageSize) {
  return call('listPurchases', {
    from: 'start',
    to: 'now',
    'search[product_id]': PRODUCT_ID,
    page_size: pageSize,
    page_no: pageNo,
  });
}

const mode = process.argv[2] ?? 'sample';

if (mode === 'ping') {
  const data = await call('ping');
  console.log('ping ok:', JSON.stringify(data));
} else if (mode === 'sample') {
  const data = await fetchPage(1, 5);
  console.log('--- Struktur Seite 1 (Werte nur für unkritische Felder) ---');
  for (const [path, type] of inspect(data)) console.log(`${path}: ${type}`);
} else if (mode === 'full') {
  // Feldnamen aus der Probeseite bestätigt (21.07., sample-Modus):
  // purchase_list[] mit id, main_product_id, buyer.email, billing_status,
  // transaction_pay_method ("Test" = Testbestellung!), created_at.
  const all = [];
  for (let page = 1; ; page++) {
    const data = await fetchPage(page, 500);
    const list = data.purchase_list ?? [];
    all.push(...list);
    console.log(`Seite ${page}: ${list.length} Käufe (gesamt ${all.length})`);
    if (list.length < 500) break;
  }

  const stats = { gesamt: all.length, fremdesProdukt: 0, testBestellung: 0, ausgeschlossen: {}, ohneEmail: 0 };
  const alleStatus = {};
  const byEmail = new Map();
  for (const p of all) {
    const productId = String(p.main_product_id ?? p.items?.[0]?.product_id ?? '');
    if (productId !== PRODUCT_ID) {
      stats.fremdesProdukt++;
      continue;
    }
    const status = String(p.billing_status ?? '').toLowerCase();
    alleStatus[status] = (alleStatus[status] ?? 0) + 1;
    if (String(p.transaction_pay_method ?? '').toLowerCase() === 'test') {
      stats.testBestellung++;
      continue;
    }
    // Nur bezahlte Käufe: Refunds/Chargebacks laut Auftrag raus, dazu
    // erkennbar Unbezahltes; alle Status landen sichtbar im Histogramm
    if (/refund|chargeback|abort|unpaid|waiting|reminding/.test(status)) {
      stats.ausgeschlossen[status] = (stats.ausgeschlossen[status] ?? 0) + 1;
      continue;
    }
    const email = String(p.buyer?.email ?? '').trim().toLowerCase();
    if (!email.includes('@')) {
      stats.ohneEmail++;
      continue;
    }
    const orderId = String(p.id ?? '');
    const createdAt = p.created_at ?? null;
    const entry = byEmail.get(email) ?? { orderIds: [], firstPurchaseAt: null, statuses: new Set() };
    if (orderId) entry.orderIds.push(orderId);
    entry.statuses.add(status);
    if (createdAt && (!entry.firstPurchaseAt || createdAt < entry.firstPurchaseAt)) {
      entry.firstPurchaseAt = createdAt;
    }
    byEmail.set(email, entry);
  }

  const rows = [...byEmail.entries()].map(([email, e]) => ({
    email,
    order_ids: e.orderIds,
    first_purchase_at: e.firstPurchaseAt,
  }));
  writeFileSync(join(DATA, 'legacy-import.json'), JSON.stringify(rows, null, 1));

  const statusHisto = {};
  for (const e of byEmail.values()) for (const s of e.statuses) statusHisto[s] = (statusHisto[s] ?? 0) + 1;
  console.log('\nStatistik:', JSON.stringify(stats));
  console.log('billing_status (alle 610992-Käufe):', JSON.stringify(alleStatus));
  console.log('billing_status (behaltene, je Käuferin):', JSON.stringify(statusHisto));
  console.log(`Eindeutige Käuferinnen: ${rows.length} → data/legacy-import.json`);
} else {
  console.error('Unbekannter Modus:', mode);
  process.exit(1);
}
