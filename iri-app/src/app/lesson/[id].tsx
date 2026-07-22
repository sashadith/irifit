import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { StreamPlayer } from '@/components/coaching/StreamPlayer';
import { GlassView } from '@/components/glass/GlassView';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { GhostButton } from '@/components/ui/GhostButton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  Course,
  fetchCompletedLessonIds,
  fetchCourses,
  fetchStreamUrl,
  Lesson,
  markLessonCompleted,
  StreamSource,
} from '@/features/coaching/coachingData';
import { t } from '@/i18n';
import { colors, font, spacing, typography } from '@/theme';

export default function LessonScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [source, setSource] = useState<StreamSource | null>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!session || !id) return;
    let cancelled = false;
    (async () => {
      try {
        const [courses, done] = await Promise.all([
          fetchCourses(),
          fetchCompletedLessonIds(session.user.id),
        ]);
        if (cancelled) return;
        for (const c of courses) {
          const found = c.lessons.find((l) => l.id === id);
          if (found) {
            setLesson(found);
            setCourse(c);
            break;
          }
        }
        setIsCompleted(done.has(id));
        const streamSource = await fetchStreamUrl({ lessonId: id });
        if (!cancelled) setSource(streamSource);
      } catch {
        if (!cancelled) setVideoFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user.id, id]);

  const complete = async () => {
    if (!session || !id || isCompleted) return;
    setBusy(true);
    try {
      await markLessonCompleted(session.user.id, id);
      setIsCompleted(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenScaffold withTabBarInset={false}>
      {course ? <Text style={typography.eyebrow}>{course.title}</Text> : null}
      <Text style={[typography.displayLg, styles.title]}>{lesson?.title ?? ''}</Text>

      <StreamPlayer
        source={source}
        failed={videoFailed}
        portrait={lesson?.video_format === 'portrait'}
        onPlayToEnd={() => {
          // Video zu Ende → Lektion automatisch abschließen
          if (!isCompleted) complete();
        }}
      />

      {lesson?.summary ? (
        <GlassView style={styles.summaryCard} contentStyle={styles.cardPad}>
          <Text style={styles.summary}>{lesson.summary}</Text>
        </GlassView>
      ) : null}

      <PrimaryButton
        label={isCompleted ? t('coaching.lessonCompleted') : t('coaching.lessonComplete')}
        onPress={complete}
        disabled={isCompleted}
        loading={busy}
        style={styles.completeButton}
      />
      <GhostButton label={t('common.back')} small onPress={() => router.back()} style={styles.back} />
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  title: {
    marginTop: 6,
    marginBottom: 14,
  },
  summaryCard: {
    marginTop: 14,
  },
  cardPad: {
    padding: spacing.lg,
  },
  summary: {
    fontFamily: font.regular,
    fontSize: 13.5,
    lineHeight: 21,
    color: colors.ink,
  },
  completeButton: {
    marginTop: 16,
  },
  back: {
    marginTop: 10,
  },
});
