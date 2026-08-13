'use client';

import { useCallback, useEffect, useState } from 'react';

import { AdminUser } from '@/lib/types';

const SUB_LABEL: Record<string, string> = {
  trialing: 'Testphase',
  active: 'Aktiv',
  in_grace: 'Zahlungsproblem',
  paused: 'Pausiert',
  cancelled: 'Gekündigt',
  expired: 'Abgelaufen',
};

export default function NutzerinnenPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (q: string) => {
    setError(null);
    const res = await fetch(`/api/users?q=${encodeURIComponent(q)}`);
    const json = await res.json();
    if (!res.ok) {
      setError(
        json.error === 'service_role_missing'
          ? 'SUPABASE_SERVICE_ROLE_KEY fehlt. Im Web: hPanel → Web Apps → admin.irinadith.com → Environment variables, danach neu deployen. Lokal: admin/.env.local, danach Dev-Server neu starten.'
          : `Laden fehlgeschlagen: ${json.error}`,
      );
      return;
    }
    setUsers(json.users);
    setLoaded(true);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(search), search ? 250 : 0);
    return () => clearTimeout(t);
  }, [search, load]);

  const act = async (user: AdminUser, action: string, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusyId(user.id);
    setError(null);
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, userId: user.id }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error === 'cannot_target_self' ? 'Du kannst dich nicht selbst sperren oder degradieren.' : `Aktion fehlgeschlagen: ${json.error}`);
    } else {
      await load(search);
    }
    setBusyId(null);
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{loaded ? `${users.length} Accounts` : 'Accounts'}</div>
          <h1 className="display">Nutzerinnen</h1>
        </div>
      </div>

      <div className="field" style={{ maxWidth: 380 }}>
        <label htmlFor="search">Suche (E-Mail oder Name)</label>
        <input id="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="anna@…" />
      </div>

      {error ? <p className="error-text" style={{ marginBottom: 12 }}>{error}</p> : null}

      <div className="glass" style={{ overflow: 'hidden' }}>
        <table className="table">
          <thead>
            <tr>
              <th>E-Mail / Name</th>
              <th>Abo</th>
              <th>Legacy</th>
              <th>Streak</th>
              <th>Registriert</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const subEnded =
                u.subscription_period_end && new Date(u.subscription_period_end) < new Date();
              return (
                <tr key={u.id} style={u.banned_until ? { opacity: 0.55 } : undefined}>
                  <td>
                    <span style={{ fontWeight: 600 }}>{u.email}</span>
                    {u.is_admin ? (
                      <span className="badge published" style={{ marginLeft: 8 }}>
                        Admin
                      </span>
                    ) : null}
                    {u.banned_until ? (
                      <span className="badge draft" style={{ marginLeft: 8 }}>
                        Gesperrt
                      </span>
                    ) : null}
                    <div className="hint">
                      {u.display_name ?? 'ohne Namen'}
                      {u.onboarding_completed_at ? '' : ' · Onboarding offen'}
                    </div>
                  </td>
                  <td>
                    {u.subscription_status ? (
                      <>
                        {SUB_LABEL[u.subscription_status] ?? u.subscription_status}
                        {subEnded ? ' (abgelaufen)' : ''}
                        <div className="hint">
                          bis{' '}
                          {u.subscription_period_end
                            ? new Date(u.subscription_period_end).toLocaleDateString('de-DE')
                            : '—'}
                        </div>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{u.is_legacy ? 'BLEIB FIT ✓' : '—'}</td>
                  <td>{u.streak_count ?? '—'}</td>
                  <td>{new Date(u.created_at).toLocaleDateString('de-DE')}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {u.is_admin ? (
                      <button
                        className="btn btn-ghost btn-small"
                        disabled={busyId === u.id}
                        onClick={() => act(u, 'revoke-admin', `${u.email} die Admin-Rolle entziehen?`)}
                      >
                        Admin entziehen
                      </button>
                    ) : (
                      <button
                        className="btn btn-ghost btn-small"
                        disabled={busyId === u.id}
                        onClick={() =>
                          act(u, 'grant-admin', `${u.email} zur Admin machen? Gilt ab der nächsten Anmeldung.`)
                        }
                      >
                        Zur Admin machen
                      </button>
                    )}{' '}
                    {u.banned_until ? (
                      <button
                        className="btn btn-ghost btn-small"
                        disabled={busyId === u.id}
                        onClick={() => act(u, 'unban')}
                      >
                        Entsperren
                      </button>
                    ) : (
                      <button
                        className="btn btn-danger btn-small"
                        disabled={busyId === u.id}
                        onClick={() =>
                          act(u, 'ban', `${u.email} sperren? Die Person kann sich dann nicht mehr anmelden.`)
                        }
                      >
                        Sperren
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="hint" style={{ marginTop: 10 }}>
        Rollen wirken erst bei der nächsten Anmeldung bzw. Token-Auffrischung. Account-Löschung macht die
        Nutzerin selbst in der App (Store-Pflicht, Session 15).
      </p>
    </>
  );
}
