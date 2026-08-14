'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload } from 'tus-js-client';

import { supabaseBrowser } from '@/lib/supabase/client';
import { Course, Lesson } from '@/lib/types';

export function CourseBuilder({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);

  const load = useCallback(() => {
    const supabase = supabaseBrowser();
    supabase
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .single()
      .then(({ data, error }) => {
        if (error) setMessage({ kind: 'error', text: error.message });
        else setCourse(data as Course);
      });
    supabase
      .from('lessons')
      .select('*')
      .eq('course_id', courseId)
      .order('sort_order')
      .then(({ data }) => setLessons((data ?? []) as Lesson[]));
  }, [courseId]);

  useEffect(load, [load]);

  const selected = lessons.find((l) => l.id === selectedId) ?? null;

  const saveCourse = async () => {
    if (!course) return;
    setBusy(true);
    const { error } = await supabaseBrowser()
      .from('courses')
      .update({
        title: course.title,
        description: course.description,
        sort_order: course.sort_order,
        status: course.status,
      })
      .eq('id', course.id);
    setMessage(error ? { kind: 'error', text: error.message } : { kind: 'ok', text: 'Kurs gespeichert.' });
    setBusy(false);
  };

  const addLesson = async () => {
    const maxSort = lessons.reduce((m, l) => Math.max(m, l.sort_order), 0);
    const { data, error } = await supabaseBrowser()
      .from('lessons')
      .insert({
        course_id: courseId,
        title: 'Neue Lektion',
        sort_order: maxSort + 1,
        status: 'draft',
        video_format: course?.is_legacy ? 'landscape' : 'portrait',
      })
      .select('*')
      .single();
    if (error) setMessage({ kind: 'error', text: error.message });
    else {
      setLessons((ls) => [...ls, data as Lesson]);
      setSelectedId((data as Lesson).id);
    }
  };

  const patchLesson = (id: string, patch: Partial<Lesson>) =>
    setLessons((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const saveLesson = async () => {
    if (!selected) return;
    setBusy(true);
    const { error } = await supabaseBrowser()
      .from('lessons')
      .update({
        title: selected.title,
        summary: selected.summary,
        video_format: selected.video_format,
        status: selected.status,
      })
      .eq('id', selected.id);
    setMessage(error ? { kind: 'error', text: error.message } : { kind: 'ok', text: 'Lektion gespeichert.' });
    setBusy(false);
  };

  const deleteLesson = async () => {
    if (!selected) return;
    if (
      !window.confirm(
        `Lektion „${selected.title}" löschen?\n\nDer Lernfortschritt der Nutzerinnen zu dieser Lektion wird mit gelöscht. Das Video bleibt bei Cloudflare erhalten.`,
      )
    )
      return;
    const { error } = await supabaseBrowser().from('lessons').delete().eq('id', selected.id);
    if (error) setMessage({ kind: 'error', text: error.message });
    else {
      setLessons((ls) => ls.filter((l) => l.id !== selected.id));
      setSelectedId(null);
    }
  };

  const deleteCourse = async () => {
    if (!course) return;
    // Legacy-Kurse sind gekaufter Inhalt der Digistore24-Kundinnen — nie löschbar
    if (course.is_legacy) return;
    const ok = window.confirm(
      `Kurs „${course.title}" mit ${lessons.length} ${lessons.length === 1 ? 'Lektion' : 'Lektionen'} löschen?\n\n` +
        'Alle Lektionen und der Lernfortschritt der Nutzerinnen (lesson_progress) werden mit gelöscht. ' +
        'Die Videos bleiben bei Cloudflare erhalten (Aufräumen passiert bewusst manuell).\n\n' +
        'Das lässt sich nicht rückgängig machen.',
    );
    if (!ok) return;
    setBusy(true);
    const { error } = await supabaseBrowser().from('courses').delete().eq('id', course.id);
    if (error) {
      setMessage({ kind: 'error', text: error.message });
      setBusy(false);
    } else {
      router.push('/kurse');
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const other = index + dir;
    if (other < 0 || other >= lessons.length) return;
    const a = lessons[index];
    const b = lessons[other];
    const supabase = supabaseBrowser();
    await supabase.from('lessons').update({ sort_order: b.sort_order }).eq('id', a.id);
    await supabase.from('lessons').update({ sort_order: a.sort_order }).eq('id', b.id);
    const copy = [...lessons];
    copy[index] = { ...b, sort_order: a.sort_order };
    copy[other] = { ...a, sort_order: b.sort_order };
    setLessons(copy);
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
        body: JSON.stringify({ size: file.size, name: `${course?.title ?? ''} – ${selected.title}` }),
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

      const { error } = await supabaseBrowser().from('lessons').update({ video_uid: uid }).eq('id', selected.id);
      if (error) throw error;
      patchLesson(selected.id, { video_uid: uid });
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

  if (!course) return <p className="hint">Lädt …</p>;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">
            {course.is_legacy ? `Alt-Kurs · ${course.legacy_slug}` : 'Kurs'}
          </div>
          <h1 className="display">{course.title}</h1>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={() => router.push('/kurse')}>
            Zurück
          </button>
          <button className="btn btn-primary" onClick={saveCourse} disabled={busy}>
            Kurs speichern
          </button>
        </div>
      </div>

      {message ? (
        <p className={message.kind === 'ok' ? 'ok-text' : 'error-text'} style={{ marginBottom: 14 }}>
          {message.text}
        </p>
      ) : null}

      <div className="glass pad" style={{ marginBottom: 20 }}>
        <div className="form-row cols-3">
          <div className="field">
            <label>Titel</label>
            <input value={course.title} onChange={(e) => setCourse({ ...course, title: e.target.value })} />
          </div>
          <div className="field">
            <label>Reihenfolge</label>
            <input
              type="number"
              value={course.sort_order}
              onChange={(e) => setCourse({ ...course, sort_order: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label>Status</label>
            <select
              value={course.status}
              onChange={(e) => setCourse({ ...course, status: e.target.value as Course['status'] })}
            >
              <option value="draft">Entwurf</option>
              <option value="published">Live</option>
            </select>
          </div>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Beschreibung</label>
          <textarea
            value={course.description ?? ''}
            onChange={(e) => setCourse({ ...course, description: e.target.value || null })}
          />
        </div>
      </div>

      <div className="split">
        <div className="glass" style={{ overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 70 }}></th>
                <th>Lektion</th>
                <th>Video</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {lessons.map((lesson, i) => (
                <tr
                  key={lesson.id}
                  className="row-link"
                  onClick={() => setSelectedId(lesson.id)}
                  style={selectedId === lesson.id ? { background: 'rgba(232,127,156,0.12)' } : undefined}
                >
                  <td data-label="" onClick={(e) => e.stopPropagation()}>
                    <button className="btn btn-ghost btn-small" title="Nach oben" onClick={() => move(i, -1)}>
                      ↑
                    </button>{' '}
                    <button className="btn btn-ghost btn-small" title="Nach unten" onClick={() => move(i, 1)}>
                      ↓
                    </button>
                  </td>
                  <td data-label="" style={{ fontWeight: 600 }}>{lesson.title}</td>
                  <td data-label="Video">{lesson.video_uid ? '🎬' : '—'}</td>
                  <td data-label="Status">
                    <span className={`badge ${lesson.status}`}>
                      {lesson.status === 'published' ? 'Live' : 'Entwurf'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: 14 }}>
            <button className="btn btn-ghost btn-small" onClick={addLesson}>
              + Lektion
            </button>
          </div>
        </div>

        {selected ? (
          <div className="glass pad">
            <div className="eyebrow" style={{ marginBottom: 10 }}>
              Lektion bearbeiten
            </div>
            <div className="field">
              <label>Titel</label>
              <input
                value={selected.title}
                onChange={(e) => patchLesson(selected.id, { title: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Beschreibung</label>
              <textarea
                style={{ minHeight: 120 }}
                value={selected.summary ?? ''}
                onChange={(e) => patchLesson(selected.id, { summary: e.target.value || null })}
              />
            </div>
            <div className="form-row cols-2">
              <div className="field">
                <label>Format</label>
                <select
                  value={selected.video_format}
                  onChange={(e) =>
                    patchLesson(selected.id, { video_format: e.target.value as Lesson['video_format'] })
                  }
                >
                  <option value="portrait">Hochformat (9:16)</option>
                  <option value="landscape">Querformat (16:9)</option>
                </select>
              </div>
              <div className="field">
                <label>Status</label>
                <select
                  value={selected.status}
                  onChange={(e) => patchLesson(selected.id, { status: e.target.value as Lesson['status'] })}
                >
                  <option value="draft">Entwurf</option>
                  <option value="published">Live</option>
                </select>
              </div>
            </div>

            <div className="eyebrow" style={{ margin: '6px 0 8px' }}>
              Video
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
              <button className="btn btn-primary btn-small" onClick={saveLesson} disabled={busy}>
                Lektion speichern
              </button>
              <button className="btn btn-danger btn-small" onClick={deleteLesson} disabled={busy}>
                Löschen
              </button>
            </div>
          </div>
        ) : (
          <div className="glass pad">
            <p className="hint">Wähle eine Lektion aus der Liste oder lege eine neue an.</p>
          </div>
        )}
      </div>

      {/* Kurs löschen — bewusst dezent ganz unten, weit weg von „Speichern" */}
      <div style={{ marginTop: 28, display: 'flex', justifyContent: 'flex-end' }}>
        {course.is_legacy ? (
          <p className="hint">
            Legacy-Kurs — gekaufter Inhalt der Digistore24-Kundinnen, kann nicht gelöscht werden.
          </p>
        ) : (
          <button className="btn btn-danger btn-small" onClick={deleteCourse} disabled={busy}>
            Kurs löschen …
          </button>
        )}
      </div>
    </>
  );
}
