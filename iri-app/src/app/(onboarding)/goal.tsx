import { useRouter } from 'expo-router';

import { IriIconName } from '@/components/icons/IriIcon';
import { ChoiceRow } from '@/components/ui/ChoiceRow';
import { QuizStep } from '@/components/ui/QuizStep';
import { Goal } from '@/features/onboarding/calorieGoal';
import { goals } from '@/features/onboarding/options';
import { useOnboarding } from '@/features/onboarding/OnboardingProvider';
import { t } from '@/i18n';

const GOAL_ICONS: Record<Goal, IriIconName> = {
  lose_weight: 'leaf',
  maintain: 'scales',
  get_fit: 'sparkle',
};

/** Schritt 2 von 7 — Ziel (Prototyp s-onboarding) */
export default function GoalScreen() {
  const router = useRouter();
  const { answers, update } = useOnboarding();

  return (
    <QuizStep
      step={2}
      title={t('onboarding.goal.title')}
      nextDisabled={!answers.goal}
      onNext={() => router.push('/(onboarding)/basics')}
      onBack={() => router.back()}
    >
      {goals.map((goal) => (
        <ChoiceRow
          key={goal}
          label={t(`onboarding.goal.${goal}`)}
          icon={GOAL_ICONS[goal]}
          selected={answers.goal === goal}
          onPress={() => update({ goal })}
        />
      ))}
    </QuizStep>
  );
}
