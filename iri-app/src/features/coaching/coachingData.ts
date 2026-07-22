import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Kurse & Lektionen (RLS liefert, was die Nutzerin sehen darf:
// Abonnentinnen die neuen Kurse, Legacy-Käuferinnen ihre alten)
// ---------------------------------------------------------------------------

export interface Lesson {
  id: string;
  course_id: string;
  title: string;
  summary: string | null;
  video_uid: string | null;
  video_format: 'portrait' | 'landscape';
  sort_order: number;
}

export interface Course {
  id: string;
  title: string;
  sort_order: number;
  is_legacy: boolean;
  lessons: Lesson[];
}

export async function fetchCourses(): Promise<Course[]> {
  const { data, error } = await supabase
    .from('courses')
    .select('id, title, sort_order, is_legacy, lessons(id, course_id, title, summary, video_uid, video_format, sort_order)')
    .order('sort_order')
    .order('sort_order', { referencedTable: 'lessons' });
  if (error) throw error;
  return (data ?? []).map((c) => ({
    ...c,
    lessons: (c.lessons ?? []) as Lesson[],
  })) as Course[];
}

export async function fetchCompletedLessonIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('lesson_progress')
    .select('lesson_id')
    .eq('user_id', userId);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.lesson_id as string));
}

export async function markLessonCompleted(userId: string, lessonId: string): Promise<void> {
  const { error } = await supabase
    .from('lesson_progress')
    .upsert({ user_id: userId, lesson_id: lessonId }, { onConflict: 'user_id,lesson_id' });
  if (error) throw error;
}

/**
 * Sequentielle Freischaltung (Konzept): Lektion N öffnet nach Abschluss von N−1,
 * Modul öffnet nach Abschluss des vorherigen Moduls.
 * Legacy-Kurse sind komplett frei — die Käuferinnen haben sie bezahlt.
 */
export function isLessonUnlocked(
  courses: readonly Course[],
  course: Course,
  lesson: Lesson,
  completed: ReadonlySet<string>,
): boolean {
  if (course.is_legacy) return true;
  const courseIndex = courses.findIndex((c) => c.id === course.id);
  const previousCourse = courseIndex > 0 ? courses[courseIndex - 1] : null;
  if (previousCourse && !previousCourse.is_legacy) {
    const allDone = previousCourse.lessons.every((l) => completed.has(l.id));
    if (!allDone) return false;
  }
  const lessonIndex = course.lessons.findIndex((l) => l.id === lesson.id);
  if (lessonIndex <= 0) return true;
  return completed.has(course.lessons[lessonIndex - 1].id);
}

// ---------------------------------------------------------------------------
// Broadcasts + Emoji-Reaktionen
// ---------------------------------------------------------------------------

export const REACTION_EMOJIS = ['❤️', '🔥', '💪', '😂', '👏'] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export interface Broadcast {
  id: string;
  body: string;
  image_path: string | null;
  /** Signierte URL fürs Broadcast-Bild (1 h gültig; null = kein Bild) */
  imageUrl: string | null;
  sent_at: string;
  counts: Record<ReactionEmoji, number>;
  mine: Set<ReactionEmoji>;
}

export async function fetchBroadcasts(userId: string, limit = 5): Promise<Broadcast[]> {
  const { data, error } = await supabase
    .from('broadcasts')
    .select('id, body, image_path, sent_at')
    .order('sent_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const { data: reactions } = await supabase
    .from('broadcast_reactions')
    .select('broadcast_id, user_id, emoji')
    .in('broadcast_id', ids);

  // Bilder liegen im privaten broadcast-media-Bucket → signierte URLs erzeugen
  const imagePaths = rows.filter((r) => r.image_path).map((r) => r.image_path as string);
  const signedByPath = new Map<string, string>();
  if (imagePaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from('broadcast-media')
      .createSignedUrls(imagePaths, 3600);
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) signedByPath.set(s.path, s.signedUrl);
    }
  }

  return rows.map((row) => {
    const counts = Object.fromEntries(REACTION_EMOJIS.map((e) => [e, 0])) as Record<ReactionEmoji, number>;
    const mine = new Set<ReactionEmoji>();
    for (const r of reactions ?? []) {
      if (r.broadcast_id !== row.id) continue;
      const emoji = r.emoji as ReactionEmoji;
      counts[emoji] = (counts[emoji] ?? 0) + 1;
      if (r.user_id === userId) mine.add(emoji);
    }
    return {
      ...row,
      imageUrl: row.image_path ? (signedByPath.get(row.image_path) ?? null) : null,
      counts,
      mine,
    };
  });
}

export async function toggleReaction(
  userId: string,
  broadcastId: string,
  emoji: ReactionEmoji,
  isSet: boolean,
): Promise<void> {
  if (isSet) {
    await supabase
      .from('broadcast_reactions')
      .delete()
      .eq('user_id', userId)
      .eq('broadcast_id', broadcastId)
      .eq('emoji', emoji);
  } else {
    await supabase
      .from('broadcast_reactions')
      .insert({ user_id: userId, broadcast_id: broadcastId, emoji });
  }
}

// ---------------------------------------------------------------------------
// Q&A-Einsendungen
// ---------------------------------------------------------------------------

export interface Question {
  id: string;
  body: string;
  status: 'new' | 'answered' | 'published';
  answer: string | null;
  created_at: string;
}

export async function submitQuestion(userId: string, body: string): Promise<void> {
  const { error } = await supabase.from('questions').insert({ user_id: userId, body });
  if (error) throw error;
}

export async function fetchMyQuestions(userId: string): Promise<Question[]> {
  const { data, error } = await supabase
    .from('questions')
    .select('id, body, status, answer, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) throw error;
  return (data ?? []) as Question[];
}

export interface StreamSource {
  hlsUrl: string;
  /** Signiertes Poster-Thumbnail bei 10 s (erster Frame ist Greenscreen) */
  thumbnailUrl: string | null;
}

/** Signierte HLS- + Thumbnail-URL holen (Edge Function prüft den Zugriff serverseitig) */
export async function fetchStreamUrl(
  target: { lessonId: string } | { trainingId: string },
): Promise<StreamSource> {
  const { data, error } = await supabase.functions.invoke('stream-token', {
    body: target,
  });
  if (error || !data?.hlsUrl) throw new Error('stream_token_failed');
  return { hlsUrl: data.hlsUrl as string, thumbnailUrl: (data.thumbnailUrl as string) ?? null };
}

// ---------------------------------------------------------------------------
// Spur 2: Trainings-Bibliothek (flache Liste neueste-zuerst)
// ---------------------------------------------------------------------------

export interface TrainingVideo {
  id: string;
  title: string;
  description: string | null;
  video_format: 'portrait' | 'landscape';
  duration_seconds: number | null;
  tags: string[];
  published_at: string | null;
}

export async function fetchTrainings(): Promise<TrainingVideo[]> {
  const { data, error } = await supabase
    .from('training_videos')
    .select('id, title, description, video_format, duration_seconds, tags, published_at')
    .order('published_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as TrainingVideo[];
}

/** NEU-Badge: in den letzten 7 Tagen veröffentlicht */
export function isNewTraining(video: TrainingVideo, now = new Date()): boolean {
  if (!video.published_at) return false;
  return now.getTime() - new Date(video.published_at).getTime() < 7 * 86400000;
}

/**
 * Progressive Disclosure (Entscheidung 20.07.): Filter-Chips erscheinen erst,
 * wenn mindestens 2 Tags existieren, die je mindestens 3 Videos tragen.
 * Vorher bleibt die Bibliothek eine bewusst einfache flache Liste.
 */
export function visibleTrainingTags(videos: readonly TrainingVideo[]): string[] {
  const counts = new Map<string, number>();
  for (const video of videos) {
    for (const tag of video.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  const qualified = [...counts.entries()].filter(([, n]) => n >= 3).map(([tag]) => tag);
  return qualified.length >= 2 ? qualified.sort() : [];
}
