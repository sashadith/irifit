'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { isAdminUser } from '@/lib/admin';
import { supabaseBrowser } from '@/lib/supabase/client';

/**
 * Passwort zurücksetzen per 6-stelligem E-Mail-Code (type: recovery) —
 * bewusst ohne Redirect-Link, damit kein Umgebungs-Setup nötig ist.
 * Voraussetzung: {{ .Token }} im „Reset Password"-E-Mail-Template.
 */
export default function PasswortVergessenPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: resetError } = await supabaseBrowser().auth.resetPasswordForEmail(email.trim());
    if (resetError) {
      setError('Die E-Mail konnte nicht verschickt werden. Stimmt die Adresse?');
    } else {
      setCodeSent(true);
    }
    setBusy(false);
  };

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = supabaseBrowser();
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'recovery',
    });
    if (verifyError) {
      setError('Der Code stimmt nicht oder ist abgelaufen.');
      setBusy(false);
      return;
    }
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(`Passwort konnte nicht gesetzt werden: ${updateError.message}`);
      setBusy(false);
      return;
    }
    if (!isAdminUser(data.user)) {
      // Kein Admin: Passwort ist gesetzt, aber hier gibt es nichts zu sehen
      await supabase.auth.signOut();
      router.replace('/login');
      return;
    }
    router.replace('/');
    router.refresh();
  };

  return (
    <div className="login-wrap">
      <div className="glass login-card">
        <div className="display" style={{ fontSize: 32, marginBottom: 4 }}>
          Passwort vergessen
        </div>
        <p className="hint" style={{ marginBottom: 24 }}>
          {codeSent
            ? `Wir haben einen 6-stelligen Code an ${email.trim()} geschickt.`
            : 'Wir schicken dir einen Code, mit dem du ein neues Passwort setzt.'}
        </p>
        {codeSent ? (
          <form onSubmit={confirm}>
            <div className="field" style={{ textAlign: 'left' }}>
              <label htmlFor="code">Code aus der E-Mail</label>
              <input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            <div className="field" style={{ textAlign: 'left' }}>
              <label htmlFor="password">Neues Passwort (min. 8 Zeichen)</label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              disabled={busy || code.trim().length < 6 || password.length < 8}
            >
              {busy ? 'Einen Moment …' : 'Passwort setzen'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-small"
              style={{ width: '100%', marginTop: 10 }}
              onClick={sendCode}
              disabled={busy}
            >
              Code nochmal schicken
            </button>
          </form>
        ) : (
          <form onSubmit={sendCode}>
            <div className="field" style={{ textAlign: 'left' }}>
              <label htmlFor="email">E-Mail</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy || !email.trim()}>
              {busy ? 'Einen Moment …' : 'Code schicken'}
            </button>
          </form>
        )}
        {error ? (
          <p className="error-text" style={{ marginTop: 14 }}>
            {error}
          </p>
        ) : null}
        <p style={{ marginTop: 18 }}>
          <Link href="/login" className="hint">
            Zurück zur Anmeldung
          </Link>
        </p>
      </div>
    </div>
  );
}
