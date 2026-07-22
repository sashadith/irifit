'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { isAdminUser } from '@/lib/admin';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = supabaseBrowser();
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (authError) {
      setError('Anmeldung fehlgeschlagen. E-Mail oder Passwort stimmen nicht.');
      setBusy(false);
      return;
    }
    if (!isAdminUser(data.user)) {
      await supabase.auth.signOut();
      setError('Dieser Account hat keinen Admin-Zugang.');
      setBusy(false);
      return;
    }
    router.replace('/');
    router.refresh();
  };

  return (
    <div className="login-wrap">
      <div className="glass login-card">
        <div className="display" style={{ fontSize: 42, marginBottom: 4 }}>
          <span style={{ color: '#d25578' }}>Iri</span>
          <span style={{ color: '#8a7b8e' }}>Fit</span>{' '}
          <span style={{ fontSize: 24, color: 'var(--muted)' }}>Admin</span>
        </div>
        <p className="hint" style={{ marginBottom: 24 }}>
          Verwaltung für Irinas App
        </p>
        <form onSubmit={signIn}>
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
          <div className="field" style={{ textAlign: 'left' }}>
            <label htmlFor="password">Passwort</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy || !email || !password}>
            {busy ? 'Einen Moment …' : 'Anmelden'}
          </button>
          {error ? (
            <p className="error-text" style={{ marginTop: 14 }}>
              {error}
            </p>
          ) : null}
        </form>
        <p style={{ marginTop: 18 }}>
          <Link href="/login/passwort-vergessen" className="hint">
            Passwort vergessen?
          </Link>
        </p>
      </div>
    </div>
  );
}
