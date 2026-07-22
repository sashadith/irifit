import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';

import { GlassView } from '@/components/glass/GlassView';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { CalorieRing } from '@/components/ui/CalorieRing';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { calcTargets } from '@/features/onboarding/calorieGoal';
import { useOnboarding } from '@/features/onboarding/OnboardingProvider';
import { t } from '@/i18n';
import { colors, font, spacing, typography } from '@/theme';

/** Schritt 6 von 7 — Ergebnis: Kalorienziel + Makros (Prototyp s-ziel) */
export default function ResultScreen() {
  const router = useRouter();
  const { answers } = useOnboarding();

  const targets = useMemo(() => {
    if (!answers.goal || !answers.birthYear || !answers.heightCm || !answers.weightKg || !answers.activity) {
      return null;
    }
    return calcTargets({
      goal: answers.goal,
      birthYear: answers.birthYear,
      heightCm: answers.heightCm,
      weightKg: answers.weightKg,
      activity: answers.activity,
    });
  }, [answers]);

  // Direktaufruf ohne Quiz-Antworten (z. B. Deep Link) → zurück zum Start
  if (!targets) return <Redirect href="/(onboarding)/welcome" />;

  const titleKey =
    answers.goal === 'maintain'
      ? 'onboarding.result.titleMaintain'
      : answers.goal === 'get_fit'
        ? 'onboarding.result.titleFit'
        : 'onboarding.result.title';

  return (
    <ScreenScaffold withTabBarInset={false}>
      <Text style={[typography.eyebrow, styles.eyebrow]}>{t('onboarding.result.eyebrow')}</Text>
      <Text style={[typography.displayLg, styles.title]}>{t(titleKey)}</Text>
      <GlassView style={styles.card} contentStyle={styles.cardContent}>
        <CalorieRing value={targets.kcal} label={t('onboarding.result.ringLabel')} progress={0.76} />
        <Text style={styles.macros}>
          {t('onboarding.result.macros', {
            protein: targets.proteinG,
            carbs: targets.carbsG,
            fat: targets.fatG,
          })}
        </Text>
        <Text style={styles.explanation}>{t('onboarding.result.explanation')}</Text>
      </GlassView>
      <PrimaryButton
        label={t('onboarding.result.cta')}
        onPress={() => router.push('/(onboarding)/account')}
        style={styles.cta}
      />
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    textAlign: 'center',
    marginTop: 26,
  },
  title: {
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 6,
  },
  card: {
    marginTop: 14,
  },
  cardContent: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  macros: {
    fontFamily: font.bold,
    fontSize: 13.5,
    color: colors.ink,
    marginTop: 14,
    textAlign: 'center',
  },
  explanation: {
    fontFamily: font.regular,
    fontSize: 13.5,
    lineHeight: 21,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 6,
  },
  cta: {
    marginTop: spacing.xl,
  },
});
