'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Dancing_Script } from 'next/font/google';

const dancingScript = Dancing_Script({ weight: '600', subsets: ['latin'] });

import { supabaseBrowser } from '@/lib/supabase/client';
import { Broadcast, REACTION_EMOJIS } from '@/lib/types';

interface BroadcastRow extends Broadcast {
  counts: Record<string, number>;
  imageUrl: string | null;
}

const EMOJIS = ['❤️', '🔥', '💪', '😂', '👏', '🥰', '🤍', '✨', '🎉', '😊', '🙌', '☀️', '🥗', '🍓', '🏃‍♀️', '🧘‍♀️'];

export default function BroadcastPage() {
  const [body, setBody] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [sendPush, setSendPush] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [sent, setSent] = useState<BroadcastRow[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const supabase = supabaseBrowser();
    const { data: rows, error } = await supabase
      .from('broadcasts')
      .select('id, body, image_path, sent_at, send_push, created_at')
      .order('sent_at', { ascending: false })
      .limit(20);
    if (error || !rows) return;

    const ids = rows.map((r) => r.id);
    const { data: reactions } = ids.length
      ? await supabase.from('broadcast_reactions').select('broadcast_id, emoji').in('broadcast_id', ids)
      : { data: [] };

    const withStats = await Promise.all(
      rows.map(async (row) => {
        const counts: Record<string, number> = {};
        for (const r of reactions ?? []) {
          if (r.broadcast_id === row.id) counts[r.emoji] = (counts[r.emoji] ?? 0) + 1;
        }
        let imageUrl: string | null = null;
        if (row.image_path) {
          const { data: signed } = await supabase.storage
            .from('broadcast-media')
            .createSignedUrl(row.image_path, 3600);
          imageUrl = signed?.signedUrl ?? null;
        }
        return { ...row, counts, imageUrl } as BroadcastRow;
      }),
    );
    setSent(withStats);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const insertEmoji = (emoji: string) => {
    const el = bodyRef.current;
    const pos = el?.selectionStart ?? body.length;
    const next = body.slice(0, pos) + emoji + body.slice(el?.selectionEnd ?? pos);
    setBody(next);
    // Fokus + Cursor hinter das eingefügte Emoji
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.selectionStart = el.selectionEnd = pos + emoji.length;
    });
  };

  const uploadImage = async (file: File) => {
    setBusy(true);
    setMessage(null);
    try {
      const supabase = supabaseBrowser();
      const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]+/g, '-')}`;
      const { error } = await supabase.storage.from('broadcast-media').upload(path, file);
      if (error) throw error;
      const { data: signed } = await supabase.storage.from('broadcast-media').createSignedUrl(path, 3600);
      setImagePath(path);
      setImagePreview(signed?.signedUrl ?? null);
    } catch (e) {
      setMessage({ kind: 'error', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    if (!body.trim()) return;
    if (!window.confirm('Broadcast jetzt an alle Abonnentinnen senden?')) return;
    setBusy(true);
    setMessage(null);
    // Übergabepunkt S12: send_push wird hier gesetzt; der Push-Versand selbst
    // (Expo Notifications) liest das Flag in Session 12 — der Composer bleibt unverändert.
    const { error } = await supabaseBrowser().from('broadcasts').insert({
      body: body.trim(),
      image_path: imagePath,
      sent_at: new Date().toISOString(),
      send_push: sendPush,
    });
    if (error) {
      setMessage({ kind: 'error', text: error.message });
    } else {
      setMessage({ kind: 'ok', text: 'Gesendet — ab sofort in der App sichtbar.' });
      setBody('');
      setImagePath(null);
      setImagePreview(null);
      load();
    }
    setBusy(false);
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Irinas Ecke</div>
          <h1 className="display">Broadcast</h1>
        </div>
      </div>

      {message ? (
        <p className={message.kind === 'ok' ? 'ok-text' : 'error-text'} style={{ marginBottom: 14 }}>
          {message.text}
        </p>
      ) : null}

      <div className="split fixed-right">
        <div className="glass pad">
          <div className="field" style={{ position: 'relative' }}>
            <label>Nachricht an alle</label>
            <textarea
              ref={bodyRef}
              style={{ minHeight: 140 }}
              placeholder="Was möchtest du deinen Frauen sagen?"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-ghost btn-small"
              style={{ position: 'absolute', right: 8, top: 26 }}
              title="Emoji einfügen"
              onClick={() => setShowEmoji((s) => !s)}
            >
              😊
            </button>
            {showEmoji ? (
              <div
                className="glass"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 62,
                  zIndex: 10,
                  padding: 10,
                  display: 'grid',
                  // 8 Spalten, aber schrumpffähig: feste 34px liefen auf einem
                  // 360-px-Android um 4px über den Rand hinaus
                  gridTemplateColumns: 'repeat(8, minmax(0, 34px))',
                  maxWidth: '100%',
                  gap: 4,
                  background: 'var(--glass-strong)',
                }}
              >
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => insertEmoji(e)}
                    style={{
                      fontSize: 19,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      borderRadius: 8,
                      padding: 3,
                    }}
                  >
                    {e}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadImage(f);
                e.target.value = '';
              }}
            />
            <button className="btn btn-ghost btn-small" onClick={() => fileRef.current?.click()} disabled={busy}>
              {imagePath ? 'Bild ersetzen' : 'Bild anhängen'}
            </button>
            {imagePath ? (
              <button
                className="btn btn-danger btn-small"
                onClick={() => {
                  setImagePath(null);
                  setImagePreview(null);
                }}
              >
                Bild entfernen
              </button>
            ) : null}
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
              <input type="checkbox" checked={sendPush} onChange={(e) => setSendPush(e.target.checked)} />
              Push senden (aktiv ab Session 12)
            </label>
          </div>
          <button
            className="btn btn-primary"
            style={{ marginTop: 16 }}
            onClick={send}
            disabled={busy || !body.trim()}
          >
            Jetzt senden
          </button>
        </div>

        {/* Vorschau im App-Look: Glas-Karte über Pastell, wie die Broadcast-Karte im Coaching-Tab */}
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            Vorschau (App)
          </div>
          <div
            style={{
              borderRadius: 28,
              padding: 16,
              background:
                'radial-gradient(200px 160px at 20% 10%, rgba(244,187,205,.8), transparent 70%), radial-gradient(220px 180px at 85% 90%, rgba(214,198,232,.8), transparent 70%), linear-gradient(160deg,#faf3f2,#f4ecee)',
            }}
          >
            <div className="glass" style={{ padding: 16, position: 'relative', overflow: 'visible' }}>
              {/* Polaroid oben rechts, wie in der App (Feinschliff 23.07.: breiter unterer Rand + Gruß) */}
              {imagePreview ? (
                <div
                  style={{
                    position: 'absolute',
                    top: -40,
                    right: 4,
                    background: '#fff',
                    padding: '4px 4px 2px',
                    borderRadius: 4,
                    transform: 'rotate(3deg)',
                    boxShadow: '0 6px 14px rgba(20,22,28,0.35)',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreview}
                    alt=""
                    style={{
                      width: 108,
                      height: 108,
                      objectFit: 'cover',
                      objectPosition: 'top center',
                      borderRadius: 2,
                      display: 'block',
                    }}
                  />
                  <div
                    className={dancingScript.className}
                    style={{ color: '#d25578', fontSize: 12, lineHeight: '15px', textAlign: 'center', padding: '1px 0' }}
                  >
                    Liebste Grüße!
                  </div>
                </div>
              ) : null}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 8,
                  paddingRight: imagePreview ? 96 : 0,
                }}
              >
                <span
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    background: 'linear-gradient(135deg, var(--tint), var(--tint-deep))',
                    color: '#fff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: 12,
                  }}
                >
                  ID
                </span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>Irina</div>
                  <div className="hint" style={{ fontSize: 11 }}>
                    gerade eben
                  </div>
                </div>
              </div>
              <p
                style={{
                  fontSize: 13.5,
                  lineHeight: 1.55,
                  whiteSpace: 'pre-wrap',
                  marginTop: imagePreview ? 38 : 0,
                }}
              >
                {body.trim() || 'Deine Nachricht erscheint hier …'}
              </p>
              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                {REACTION_EMOJIS.map((e) => (
                  <span
                    key={e}
                    style={{
                      fontSize: 13,
                      background: 'rgba(255,255,255,.7)',
                      border: '1px solid var(--stroke)',
                      borderRadius: 999,
                      padding: '3px 8px',
                    }}
                  >
                    {e}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="eyebrow" style={{ margin: '26px 0 10px' }}>
        Gesendet
      </div>
      <div className="glass" style={{ overflow: 'hidden' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Datum</th>
              <th>Nachricht</th>
              <th>Bild</th>
              <th>Reaktionen</th>
            </tr>
          </thead>
          <tbody>
            {sent.map((b) => (
              <tr key={b.id}>
                <td data-label="Datum">
                  {b.sent_at ? new Date(b.sent_at).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                </td>
                <td data-label="">{b.body.length > 120 ? `${b.body.slice(0, 120)}…` : b.body}</td>
                <td data-label="Bild">
                  {b.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.imageUrl} alt="" className="thumb" />
                  ) : (
                    '—'
                  )}
                </td>
                <td data-label="Reaktionen">
                  {REACTION_EMOJIS.map((e) =>
                    b.counts[e] ? (
                      <span key={e} style={{ marginRight: 8, fontSize: 13 }}>
                        {e} {b.counts[e]}
                      </span>
                    ) : null,
                  )}
                  {Object.keys(b.counts).length === 0 ? <span className="hint">noch keine</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
