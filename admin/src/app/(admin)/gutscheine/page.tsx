'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';

import { supabaseBrowser } from '@/lib/supabase/client';
import { Voucher } from '@/lib/types';

interface RedemptionInfo {
  count: number;
  last: string | null;
}

/** Eine Zeile aus stats_voucher_redemptions (E-Mail kommt aus auth.users) */
interface RedemptionDetail {
  email: string;
  name: string | null;
  eingeloest: string;
  zugang_bis: string | null;
  noch_aktiv: boolean;
}

const EMPTY_FORM = {
  code: '',
  description: '',
  free_months: 1,
  valid_until: '',
  max_redemptions: '',
};

export default function GutscheinePage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [redemptions, setRedemptions] = useState<Record<string, RedemptionInfo>>({});
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  // Aufgeklappter Gutschein + geladene Einlösungen (Sascha 17.08.).
  // null im Cache = Abfrage läuft noch.
  const [expanded, setExpanded] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, RedemptionDetail[] | null>>({});

  const load = useCallback(async () => {
    const supabase = supabaseBrowser();
    const { data, error } = await supabase.from('vouchers').select('*').order('created_at', { ascending: false });
    if (error) {
      setMessage({ kind: 'error', text: error.message });
      return;
    }
    setVouchers((data ?? []) as Voucher[]);
    const { data: reds } = await supabase
      .from('voucher_redemptions')
      .select('voucher_id, redeemed_at')
      .order('redeemed_at', { ascending: false });
    const info: Record<string, RedemptionInfo> = {};
    for (const r of reds ?? []) {
      const entry = info[r.voucher_id] ?? { count: 0, last: null };
      entry.count += 1;
      if (!entry.last) entry.last = r.redeemed_at;
      info[r.voucher_id] = entry;
    }
    setRedemptions(info);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    setBusy(true);
    setMessage(null);
    const { error } = await supabaseBrowser()
      .from('vouchers')
      .insert({
        code: form.code.trim(),
        description: form.description.trim() || null,
        free_months: form.free_months,
        valid_until: form.valid_until ? new Date(form.valid_until).toISOString() : null,
        max_redemptions: form.max_redemptions === '' ? null : Number(form.max_redemptions),
        active: true,
      });
    if (error) {
      setMessage({
        kind: 'error',
        text: error.code === '23505' ? 'Diesen Code gibt es schon.' : error.message,
      });
    } else {
      setMessage({ kind: 'ok', text: `Gutschein ${form.code.trim().toUpperCase()} angelegt.` });
      setForm(EMPTY_FORM);
      setShowForm(false);
      load();
    }
    setBusy(false);
  };

  /** Zeile auf-/zuklappen; die Einlösungen kommen beim ersten Öffnen aus der DB */
  const toggleDetails = async (v: Voucher) => {
    if (expanded === v.id) {
      setExpanded(null);
      return;
    }
    setExpanded(v.id);
    if (details[v.id] !== undefined) return; // schon geladen oder lädt gerade
    setDetails((d) => ({ ...d, [v.id]: null }));
    const { data, error } = await supabaseBrowser().rpc('stats_voucher_redemptions', {
      p_voucher_id: v.id,
    });
    if (error) {
      setMessage({ kind: 'error', text: error.message });
      setDetails((d) => ({ ...d, [v.id]: [] }));
      return;
    }
    setDetails((d) => ({ ...d, [v.id]: (data ?? []) as RedemptionDetail[] }));
  };

  const toggleActive = async (v: Voucher) => {
    const { error } = await supabaseBrowser().from('vouchers').update({ active: !v.active }).eq('id', v.id);
    if (error) setMessage({ kind: 'error', text: error.message });
    else load();
  };

  const remove = async (v: Voucher) => {
    const used = redemptions[v.id]?.count ?? 0;
    if (used > 0) {
      setMessage({ kind: 'error', text: 'Schon eingelöste Gutscheine lieber deaktivieren statt löschen.' });
      return;
    }
    if (!window.confirm(`Gutschein „${v.code}" löschen?`)) return;
    const { error } = await supabaseBrowser().from('vouchers').delete().eq('id', v.id);
    if (error) setMessage({ kind: 'error', text: error.message });
    else load();
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{vouchers.length} Codes</div>
          <h1 className="display">Gutscheine</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Abbrechen' : '+ Neuer Gutschein'}
        </button>
      </div>

      <p className="hint" style={{ marginBottom: 14 }}>
        Das hier sind die App-eigenen Codes (freie Monate, Einlösung in der App). Store-Rabatte über
        RevenueCat Promotional Entitlements kommen mit Session 11.
      </p>

      {message ? (
        <p className={message.kind === 'ok' ? 'ok-text' : 'error-text'} style={{ marginBottom: 12 }}>
          {message.text}
        </p>
      ) : null}

      {showForm ? (
        <div className="glass pad" style={{ marginBottom: 20 }}>
          <div className="form-row cols-4">
            <div className="field">
              <label>Code</label>
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="IRINA3"
              />
            </div>
            <div className="field">
              <label>Freie Monate</label>
              <input
                type="number"
                min={1}
                value={form.free_months}
                onChange={(e) => setForm({ ...form, free_months: Math.max(1, Number(e.target.value)) })}
              />
            </div>
            <div className="field">
              <label>Gültig bis (leer = unbegrenzt)</label>
              <input
                type="date"
                value={form.valid_until}
                onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Max. Einlösungen (leer = unbegrenzt)</label>
              <input
                type="number"
                min={1}
                value={form.max_redemptions}
                onChange={(e) => setForm({ ...form, max_redemptions: e.target.value })}
              />
            </div>
          </div>
          <div className="field">
            <label>Beschreibung (intern)</label>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="z. B. Instagram-Aktion August"
            />
          </div>
          <button className="btn btn-primary btn-small" onClick={create} disabled={busy || !form.code.trim()}>
            Anlegen
          </button>
        </div>
      ) : null}

      <div className="glass" style={{ overflow: 'hidden' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Wert</th>
              <th>Gültig bis</th>
              <th>Einlösungen</th>
              <th>Zuletzt</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {vouchers.map((v) => {
              const info = redemptions[v.id];
              const offen = expanded === v.id;
              const rows = details[v.id];
              return (
                <Fragment key={v.id}>
                <tr
                  className="row-link"
                  onClick={() => toggleDetails(v)}
                  title="Einlösungen anzeigen"
                >
                  <td data-label="" style={{ fontWeight: 700 }}>
                    <span style={{ color: 'var(--muted)', display: 'inline-block', width: 16 }}>
                      {offen ? '▾' : '▸'}
                    </span>
                    {v.code}
                    {v.description ? (
                      <div className="hint" style={{ fontWeight: 400, paddingLeft: 16 }}>
                        {v.description}
                      </div>
                    ) : null}
                  </td>
                  <td data-label="Wert">
                    {v.free_months} {v.free_months === 1 ? 'Monat' : 'Monate'} gratis
                  </td>
                  <td data-label="Gültig bis">{v.valid_until ? new Date(v.valid_until).toLocaleDateString('de-DE') : 'unbegrenzt'}</td>
                  <td data-label="Einlösungen">
                    {info?.count ?? 0}
                    {v.max_redemptions ? ` / ${v.max_redemptions}` : ''}
                  </td>
                  <td data-label="Zuletzt">
                    {info?.last
                      ? new Date(info.last).toLocaleDateString('de-DE')
                      : '—'}
                  </td>
                  <td data-label="Status">
                    <span className={`badge ${v.active ? 'published' : 'draft'}`}>
                      {v.active ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </td>
                  <td data-label="" className="cell-actions">
                    {/* stopPropagation: die Knöpfe sollen die Zeile nicht aufklappen */}
                    <button
                      className="btn btn-ghost btn-small"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleActive(v);
                      }}
                    >
                      {v.active ? 'Deaktivieren' : 'Aktivieren'}
                    </button>{' '}
                    <button
                      className="btn btn-danger btn-small"
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(v);
                      }}
                    >
                      Löschen
                    </button>
                  </td>
                </tr>
                {offen ? (
                  <tr>
                    <td colSpan={7} style={{ background: 'rgba(232,127,156,0.05)', padding: '10px 14px 16px' }}>
                      {rows === null || rows === undefined ? (
                        <span className="hint">Lade Einlösungen …</span>
                      ) : rows.length === 0 ? (
                        <span className="hint">Noch keine Einlösungen.</span>
                      ) : (
                        <table className="table" style={{ margin: 0 }}>
                          <thead>
                            <tr>
                              <th>E-Mail</th>
                              <th>Name</th>
                              <th>Eingelöst</th>
                              <th>Zugang bis</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((r) => (
                              <tr key={`${r.email}-${r.eingeloest}`}>
                                <td data-label="E-Mail">{r.email}</td>
                                <td data-label="Name">{r.name ?? '—'}</td>
                                <td data-label="Eingelöst">
                                  {new Date(r.eingeloest).toLocaleDateString('de-DE')}{' '}
                                  {new Date(r.eingeloest).toLocaleTimeString('de-DE', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}{' '}
                                  Uhr
                                </td>
                                <td data-label="Zugang bis">
                                  {r.zugang_bis
                                    ? `${new Date(r.zugang_bis).toLocaleDateString('de-DE')} ${new Date(
                                        r.zugang_bis,
                                      ).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`
                                    : '—'}
                                </td>
                                <td data-label="Status">
                                  <span className={`badge ${r.noch_aktiv ? 'published' : 'draft'}`}>
                                    {r.noch_aktiv ? 'Aktiv' : 'Abgelaufen'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      <p className="hint" style={{ margin: '10px 0 0' }}>
                        „Zugang bis" ist der aktuelle Stand des Kontos — kauft jemand nach dem
                        Gutschein ein Abo, steht hier das Abo-Ende.
                      </p>
                    </td>
                  </tr>
                ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
