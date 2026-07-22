import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';

import { GlassView } from '@/components/glass/GlassView';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { GhostButton } from '@/components/ui/GhostButton';
import { IriAvatar } from '@/components/ui/IriAvatar';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  Course,
  fetchCompletedLessonIds,
  fetchCourses,
} from '@/features/coaching/coachingData';
import { t } from '@/i18n';
import { colors, font, radius, spacing, typography } from '@/theme';

/**
 * Legacy-Bereich (Session 10): Digistore24-Käuferinnen sehen hier NUR ihre
 * alten Kurse (RLS liefert exakt die). Bewusst außerhalb der Tabs — Tracker,
 * Rezepte & Co. gibt es über die normale Testphase + Abo.
 */
export default function LegacyScreen() {
  const router = useRouter();
  const { session, profile, legacy, loading, signOut } = useAuth();

  const [courses, setCourses] = useState<Course[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      Promise.all([fetchCourses(), fetchCompletedLessonIds(session.user.id)])
        .then(([c, done]) => {
          setCourses(c.filter((course) => course.is_legacy));
          setCompleted(done);
        })
        .catch(() => {});
    }, [session?.user.id]),
  );

  if (loading) return null;
  if (!session || !legacy) return <Redirect href="/(onboarding)/welcome" />;
  // Voll-Nutzerin (Onboarding fertig): Kurse leben im Coaching-Tab
  if (profile?.onboarding_completed_at) return <Redirect href="/(tabs)/coaching" />;

  return (
    <ScreenScaffold withTabBarInset={false}>
      <View style={styles.top}>
        <IriAvatar size={84} />
        <Text style={[typography.eyebrow, styles.eyebrow]}>{t('legacy.eyebrow')}</Text>
        <Text style={[typography.displayXl, styles.title]}>{t('legacy.title')}</Text>
      </View>

      <GlassView contentStyle={styles.introPad}>
        <Text style={styles.intro}>{t('legacy.intro')}</Text>
      </GlassView>

      {courses.map((course) => {
        const done = course.lessons.filter((l) => completed.has(l.id)).length;
        return (
          <Pressable
            key={course.id}
            accessibilityRole="button"
            accessibilityLabel={course.title}
            onPress={() => router.push(`/course/${course.id}`)}
            style={({ pressed }) => [pressed && styles.pressed]}
          >
            <GlassView style={styles.courseCard} contentStyle={styles.courseContent}>
              <View style={styles.courseText}>
                <Text style={styles.courseTitle} numberOfLines={2}>
                  {course.title}
                </Text>
                <Text style={styles.courseMeta}>
                  {t('coaching.lessonProgressOf', { done, total: course.lessons.length })}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </GlassView>
          </Pressable>
        );
      })}
      {courses.length === 0 ? (
        <GlassView style={styles.courseCard} contentStyle={styles.introPad}>
          <Text style={styles.intro}>{t('legacy.loadingCourses')}</Text>
        </GlassView>
      ) : null}

      <GlassView style={styles.upsellCard} contentStyle={styles.upsellPad}>
        <Text style={styles.upsellTitle}>{t('legacy.upsellTitle')}</Text>
        <Text style={styles.upsellText}>{t('legacy.upsellText')}</Text>
        <PrimaryButton
          label={t('legacy.upsellCta')}
          onPress={() => router.push('/(onboarding)/goal')}
          style={styles.upsellButton}
        />
      </GlassView>

      <GhostButton label={t('legacy.signOut')} small onPress={signOut} style={styles.signOut} />
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  top: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  eyebrow: {
    marginTop: 12,
  },
  title: {
    textAlign: 'center',
    marginTop: 10,
  },
  introPad: {
    padding: spacing.lg,
  },
  intro: {
    fontFamily: font.regular,
    fontSize: 13.5,
    lineHeight: 21,
    color: colors.muted,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
  courseCard: {
    marginTop: 12,
  },
  courseContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: 12,
  },
  courseText: {
    flex: 1,
  },
  courseTitle: {
    fontFamily: font.bold,
    fontSize: 15,
    color: colors.ink,
  },
  courseMeta: {
    fontFamily: font.regular,
    fontSize: 12,
    color: colors.muted,
    marginTop: 3,
  },
  chevron: {
    fontFamily: font.bold,
    fontSize: 18,
    color: colors.muted,
  },
  upsellCard: {
    marginTop: 20,
    borderRadius: radius.lg,
  },
  upsellPad: {
    padding: spacing.lg,
  },
  upsellTitle: {
    fontFamily: font.extrabold,
    fontSize: 15,
    color: colors.ink,
  },
  upsellText: {
    fontFamily: font.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.muted,
    marginTop: 6,
  },
  upsellButton: {
    marginTop: 14,
  },
  signOut: {
    marginTop: 18,
    marginBottom: 10,
  },
});
