'use client';

import { useCallback, useEffect, useState } from 'react';
import { Upload } from 'tus-js-client';

import { supabaseBrowser } from '@/lib/supabase/client';

interface TrainingVideo {
  id: string;
  title: string;
  description: string | null;
  video_uid: string | null;
  video_format: 'portrait' | 'landscape';
  duration_seconds: number | null;
  tags: string[];
  status: 'draft' | 'published';
  published_at: string | null;
  created_at: string;
}

export default function TrainingsPage() {
  const [videos, setVideos] = useState<TrainingVideo[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);

  const load = useCallback(() => {
    supabaseBrowser()
      .from('training_videos')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setMessage({ kind: 'error', text: error.message });
        else setVideos((data ?? []) as TrainingVideo[]);
      });
  }, []);

  useEffect(load, [load]);

  const selected = videos.find((v) => v.id === selectedId) ?? null;

  const patch = (id: string, p: Partial<TrainingVideo>) =>
    setVideos((vs) => vs.map((v) => (v.id === id ? { ...v, ...p } : v)));

  const addVideo = async () => {
    const { data, error } = await supabaseBrowser()
      .from('training_videos')
      .insert({ title: 'Neues Training', status: 'draft', video_format: 'portrait', tags: [] })
      .select('*')
      .single();
    if (error) setMessage({ kind: 'error', text: error.message });
    else {
      setVideos((vs) => [data as TrainingVideo, ...vs]);
      setSelectedId((data as TrainingVideo).id);
    }
  };

  const save = async () => {
    if (!selected) return;
    setBusy(true);
    // NEU-Badge in der App hängt an published_at → beim ersten Livegang setzen
    const publishedAt =
      selected.status === 'published' ? (selected.published_at ?? new Date().toISOString()) : null;
    const { error } = await supabaseBrowser()
      .from('training_videos')
      .update({
        title: selected.title,
        description: selected.description,
        tags: selected.tags,
        status: selected.status,
        published_at: publishedAt,
      })
      .eq('id', selected.id);
    if (error) setMessage({ kind: 'error', text: error.message });
    else {
      patch(selected.id, { published_at: publishedAt });
      setMessage({ kind: 'ok', text: 'Training gespeichert.' });
    }
    setBusy(false);
  };

  const remove = async () => {
    if (!selected) return;
    if (!window.confirm(`Training „${selected.title}" wirklich löschen?`)) return;
    const { error } = await supabaseBrowser().from('training_videos').delete().eq('id', selected.id);
    if (error) setMessage({ kind: 'error', text: error.message });
    else {
      setVideos((vs) => vs.filter((v) => v.id !== selected.id));
      setSelectedId(null);
    }
  };

  const uploadVideo = async (file: File) => {
    if (!selected) return;
    setBusy(true);
    setMessage(null);
    setUploadPct(0);
    try {
      const res = await fetch('/api/stream/direct-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ size: file.size, name: `Training – ${selected.title}` }),
      });
      if (!res.ok) throw new Error(`Upload-URL fehlgeschlagen (${res.status})`);
      const { uploadUrl, uid } = (await res.json()) as { uploadUrl: string; uid: string };

      await new Promise<void>((resolve, reject) => {
        const upload = new Upload(file, {
          uploadUrl,
          chunkSize: 50 * 1024 * 1024,
          onProgress: (sent, total) => setUploadPct(Math.round((sent / total) * 100)),
          onError: reject,
          onSuccess: () => resolve(),
        });
        upload.start();
      });

      const { error } = await supabaseBrowser()
        .from('training_videos')
        .update({ video_uid: uid })
        .eq('id', selected.id);
      if (error) throw error;
      patch(selected.id, { video_uid: uid });
      setMessage({
        kind: 'ok',
        text: 'Video hochgeladen. Cloudflare kodiert es jetzt — das kann ein paar Minuten dauern.',
      });
    } catch (e) {
      setMessage({ kind: 'error', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
      setUploadPct(null);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{videos.length} Videos</div>
          <h1 className="display">Trainings</h1>
        </div>
        <button className="btn btn-primary" onClick={addVideo}>
          + Neues Training
        </button>
      </div>

      <p className="hint" style={{ marginBottom: 14 }}>
        Wann was? <strong>Kurse</strong> sind strukturierte Programme in Modulen mit Reihenfolge und
        Fortschritt (z. B. der Ernährungskurs). <strong>Trainings</strong> sind einzelne neue
        Hochformat-Videos für die wachsende Bibliothek — neueste zuerst, ohne feste Reihenfolge.
        Filter-Chips erscheinen in der App automatisch, sobald mindestens 2 Tags je 3 Videos haben.
      </p>

      {message ? (
        <p className={message.kind === 'ok' ? 'ok-text' : 'error-text'} style={{ marginBottom: 12 }}>
          {message.text}
        </p>
      ) : null}

      <div className="split">
        <div className="glass" style={{ overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Titel</th>
                <th>Tags</th>
                <th>Video</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {videos.map((v) => (
                <tr
                  key={v.id}
                  className="row-link"
                  onClick={() => setSelectedId(v.id)}
                  style={selectedId === v.id ? { background: 'rgba(232,127,156,0.12)' } : undefined}
                >
                  <td data-label="" style={{ fontWeight: 600 }}>{v.title}</td>
                  <td data-label="Tags" className="hint">{v.tags.length > 0 ? v.tags.join(', ') : '—'}</td>
                  <td data-label="Video">{v.video_uid ? '🎬' : '—'}</td>
                  <td data-label="Status">
                    <span className={`badge ${v.status}`}>
                      {v.status === 'published' ? 'Live' : 'Entwurf'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selected ? (
          <div className="glass pad">
            <div className="eyebrow" style={{ marginBottom: 10 }}>
              Training bearbeiten
            </div>
            <div className="field">
              <label>Titel</label>
              <input value={selected.title} onChange={(e) => patch(selected.id, { title: e.target.value })} />
            </div>
            <div className="field">
              <label>Beschreibung</label>
              <textarea
                value={selected.description ?? ''}
                onChange={(e) => patch(selected.id, { description: e.target.value || null })}
              />
            </div>
            <div className="form-row cols-2">
              <div className="field">
                <label>Tags (Komma-getrennt)</label>
                <input
                  value={selected.tags.join(', ')}
                  onChange={(e) =>
                    patch(selected.id, {
                      tags: e.target.value
                        .split(',')
                        .map((t) => t.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="Bauch, 10 Minuten"
                />
              </div>
              <div className="field">
                <label>Status</label>
                <select
                  value={selected.status}
                  onChange={(e) => patch(selected.id, { status: e.target.value as TrainingVideo['status'] })}
                >
                  <option value="draft">Entwurf</option>
                  <option value="published">Live</option>
                </select>
              </div>
            </div>

            <div className="eyebrow" style={{ margin: '6px 0 8px' }}>
              Video (Hochformat 9:16)
            </div>
            <p className="hint" style={{ marginBottom: 8 }}>
              {selected.video_uid
                ? `Verknüpft: ${selected.video_uid.slice(0, 8)}… (signierte Wiedergabe aktiv)`
                : 'Noch kein Video verknüpft.'}
            </p>
            {uploadPct !== null ? (
              <div style={{ marginBottom: 10 }}>
                <div className="progressbar">
                  <div style={{ width: `${uploadPct}%` }} />
                </div>
                <p className="hint" style={{ marginTop: 4 }}>
                  {uploadPct} % hochgeladen …
                </p>
              </div>
            ) : (
              <label className="btn btn-ghost btn-small" style={{ marginBottom: 12 }}>
                {selected.video_uid ? 'Video ersetzen' : 'Video hochladen'}
                <input
                  type="file"
                  accept="video/*"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadVideo(file);
                    e.target.value = '';
                  }}
                />
              </label>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-primary btn-small" onClick={save} disabled={busy}>
                Speichern
              </button>
              <button className="btn btn-danger btn-small" onClick={remove} disabled={busy}>
                Löschen
              </button>
            </div>
          </div>
        ) : (
          <div className="glass pad">
            <p className="hint">Wähle ein Training aus der Liste oder lege ein neues an.</p>
          </div>
        )}
      </div>
    </>
  );
}
