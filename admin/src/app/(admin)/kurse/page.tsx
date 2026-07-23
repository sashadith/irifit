'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { supabaseBrowser } from '@/lib/supabase/client';
import { Course } from '@/lib/types';

interface CourseRow extends Course {
  lessons: { count: number }[];
}

export default function KurseListe() {
  const router = useRouter();
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    supabaseBrowser()
      .from('courses')
      .select('*, lessons(count)')
      .order('sort_order')
      .then(({ data, error: e }) => {
        if (e) setError(e.message);
        else setCourses((data ?? []) as CourseRow[]);
      });
  };

  useEffect(load, []);

  const createCourse = async () => {
    const title = window.prompt('Titel des neuen Kurses:');
    if (!title?.trim()) return;
    setBusy(true);
    const maxSort = courses.reduce((m, c) => Math.max(m, c.sort_order), 0);
    const { data, error: e } = await supabaseBrowser()
      .from('courses')
      .insert({ title: title.trim(), sort_order: maxSort + 1, status: 'draft' })
      .select('id')
      .single();
    setBusy(false);
    if (e) setError(e.message);
    else router.push(`/kurse/${data.id}`);
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{courses.length} Kurse</div>
          <h1 className="display">Kurse</h1>
        </div>
        <button className="btn btn-primary" onClick={createCourse} disabled={busy}>
          + Neuer Kurs
        </button>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      <div className="glass" style={{ overflow: 'hidden' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Titel</th>
              <th>Lektionen</th>
              <th>Typ</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((course) => (
              <tr key={course.id} className="row-link" onClick={() => router.push(`/kurse/${course.id}`)}>
                <td style={{ fontWeight: 600 }}>{course.title}</td>
                <td>{course.lessons?.[0]?.count ?? 0}</td>
                <td>{course.is_legacy ? `Alt-Kurs (${course.legacy_slug})` : 'Neu'}</td>
                <td>
                  <span className={`badge ${course.status}`}>
                    {course.status === 'published' ? 'Live' : 'Entwurf'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint" style={{ marginTop: 12 }}>
        Alt-Kurse (BLEIB FIT) gehören den Digistore24-Käuferinnen — Inhalte dort nur mit Bedacht ändern.
        Und: <strong>Kurse</strong> sind strukturierte Programme in Modulen — für einzelne neue
        Hochformat-Videos ist die <strong>Trainings</strong>-Bibliothek der richtige Ort.
      </p>
    </>
  );
}
