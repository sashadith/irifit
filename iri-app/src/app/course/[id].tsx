import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { GlassView } from '@/components/glass/GlassView';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { GhostButton } from '@/components/ui/GhostButton';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  Course,
  fetchCompletedLessonIds,
  fetchCourses,
  isLessonUnlocked,
} from '@/features/coaching/coachingData';
import { t } from '@/i18n';
import { colors, font, radius, spacing, typography } from '@/theme';

export default function CourseScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();

  const [courses, setCourses] = useState<Course[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      Promise.all([fetchCourses(), fetchCompletedLessonIds(session.user.id)])
        .then(([c, done]) => {
          setCourses(c);
          setCompleted(done);
        })
        .catch(() => {});
    }, [session?.user.id]),
  );

  const course = courses.find((c) => c.id === id) ?? null;
  if (!course) {
    return <ScreenScaffold withTabBarInset={false} scroll={false}>{null}</ScreenScaffold>;
  }

  const doneCount = course.lessons.filter((l) => completed.has(l.id)).length;

  return (
    <ScreenScaffold withTabBarInset={false}>
      <Text style={typography.eyebrow}>
        {t('coaching.lessonProgressOf', { done: doneCount, total: course.lessons.length })}
      </Text>
      <Text style={[typography.displayLg, styles.title]}>{course.title}</Text>

      <GlassView contentStyle={styles.listPad}>
        {course.lessons.map((lesson, index) => {
          const done = completed.has(lesson.id);
          const unlocked = isLessonUnlocked(courses, course, lesson, completed);
          return (
            <Pressable
              key={lesson.id}
              accessibilityRole="button"
              accessibilityLabel={lesson.title}
              accessibilityState={{ disabled: !unlocked }}
              disabled={!unlocked}
              onPress={() => router.push(`/lesson/${lesson.id}`)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed, !unlocked && styles.locked]}
            >
              <View style={[styles.number, done && styles.numberDone]}>
                <Text style={[styles.numberText, done && styles.numberTextDone]}>
                  {done ? '✓' : index + 1}
                </Text>
              </View>
              <View style={styles.rowText}>
                <Text style={styles.lessonTitle} numberOfLines={2}>
                  {lesson.title}
                </Text>
                {!unlocked ? <Text style={styles.lockedHint}>{t('coaching.lessonLocked')}</Text> : null}
              </View>
              <Text style={styles.chevron}>{unlocked ? '›' : '🔒'}</Text>
            </Pressable>
          );
        })}
      </GlassView>

      <GhostButton label={t('common.back')} small onPress={() => router.back()} style={styles.back} />
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  title: {
    marginTop: 6,
    marginBottom: 14,
  },
  listPad: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.track,
  },
  pressed: {
    opacity: 0.75,
  },
  locked: {
    opacity: 0.5,
  },
  number: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: colors.stroke,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberDone: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  numberText: {
    fontFamily: font.bold,
    fontSize: 13.5,
    color: colors.ink,
  },
  numberTextDone: {
    color: colors.white,
  },
  rowText: {
    flex: 1,
  },
  lessonTitle: {
    fontFamily: font.semibold,
    fontSize: 14,
    color: colors.ink,
  },
  lockedHint: {
    fontFamily: font.regular,
    fontSize: 11,
    color: colors.muted2,
    marginTop: 2,
  },
  chevron: {
    fontFamily: font.bold,
    fontSize: 15,
    color: colors.muted,
  },
  back: {
    marginTop: 16,
  },
});
