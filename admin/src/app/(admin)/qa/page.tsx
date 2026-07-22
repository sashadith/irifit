'use client';

import { useCallback, useEffect, useState } from 'react';

import { supabaseBrowser } from '@/lib/supabase/client';
import { Question } from '@/lib/types';

const TABS: { key: Question['status']; label: string }[] = [
  { key: 'new', label: 'Neu' },
  { key: 'answered', label: 'Beantwortet' },
  { key: 'published', label: 'Veröffentlicht' },
];

export default function QaPage() {
  const [tab, setTab] = useState<Question['status']>('new');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [pushFlags, setPushFlags] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = supabaseBrowser();
    const { data, error: e } = await supabase
      .from('questions')
      .select('*')
      .order('created_at', { ascending: false });
    if (e) {
      setError(e.message);
      return;
    }
    const all = (data ?? []) as Question[];
    setQuestions(all);
    const c: Record<string, number> = {};
    for (const q of all) c[q.status] = (c[q.status] ?? 0) + 1;
    setCounts(c);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const update = async (q: Question, patch: Partial<Question>) => {
    setBusyId(q.id);
    setError(null);
    const { error: e } = await supabaseBrowser().from('questions').update(patch).eq('id', q.id);
    if (e) setError(e.message);
    else await load();
    setBusyId(null);
  };

  const saveAnswer = (q: Question) => {
    const answer = (drafts[q.id] ?? q.answer ?? '').trim();
    if (!answer) return;
    // send_push = Übergabepunkt S12: der Push-Versand (Expo Notifications) liest das Flag
    update(q, {
      answer,
      status: 'answered',
      answered_at: q.answered_at ?? new Date().toISOString(),
      send_push: pushFlags[q.id] ?? q.send_push,
    });
  };

  const visible = questions.filter((q) => q.status === tab);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Fragen aus der App</div>
          <h1 className="display">Q&amp;A</h1>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`btn btn-small ${tab === t.key ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTab(t.key)}
          >
            {t.label} ({counts[t.key] ?? 0})
          </button>
        ))}
      </div>

      {error ? <p className="error-text" style={{ marginBottom: 12 }}>{error}</p> : null}
      {visible.length === 0 ? (
        <p className="hint">Keine Einsendungen in dieser Liste.</p>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {visible.map((q) => (
          <div key={q.id} className="glass pad">
            <div className="hint" style={{ marginBottom: 6 }}>
              {new Date(q.created_at).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}
              {q.published_at
                ? ` · veröffentlicht am ${new Date(q.published_at).toLocaleDateString('de-DE')}`
                : ''}
            </div>
            <p style={{ fontWeight: 600, marginBottom: 10, whiteSpace: 'pre-wrap' }}>{q.body}</p>
            <div className="field" style={{ marginBottom: 10 }}>
              <label>Irinas Antwort</label>
              <textarea
                value={drafts[q.id] ?? q.answer ?? ''}
                onChange={(e) => setDrafts((d) => ({ ...d, [q.id]: e.target.value }))}
                placeholder="Antwort schreiben …"
              />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                className="btn btn-primary btn-small"
                onClick={() => saveAnswer(q)}
                disabled={busyId === q.id || !(drafts[q.id] ?? q.answer ?? '').trim()}
              >
                {q.status === 'new' ? 'Antworten & als beantwortet markieren' : 'Antwort speichern'}
              </button>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={pushFlags[q.id] ?? q.send_push}
                  onChange={(e) => setPushFlags((f) => ({ ...f, [q.id]: e.target.checked }))}
                />
                Push senden (aktiv ab Session 12)
              </label>
              {q.status === 'answered' ? (
                <button
                  className="btn btn-ghost btn-small"
                  onClick={() => update(q, { status: 'published', published_at: new Date().toISOString() })}
                  disabled={busyId === q.id || !(q.answer ?? '').trim()}
                  title="Erscheint dann anonym in der App (Irinas Ecke, S15)"
                >
                  Veröffentlichen
                </button>
              ) : null}
              {q.status === 'published' ? (
                <button
                  className="btn btn-ghost btn-small"
                  onClick={() => update(q, { status: 'answered', published_at: null })}
                  disabled={busyId === q.id}
                >
                  Veröffentlichung zurückziehen
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
