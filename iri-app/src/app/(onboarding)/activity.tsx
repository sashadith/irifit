import { useRouter } from 'expo-router';

import { IriIconName } from '@/components/icons/IriIcon';
import { ChoiceRow } from '@/components/ui/ChoiceRow';
import { QuizStep } from '@/components/ui/QuizStep';
import { ActivityLevel } from '@/features/onboarding/calorieGoal';
import { activityLevels } from '@/features/onboarding/options';
import { useOnboarding } from '@/features/onboarding/OnboardingProvider';
import { t } from '@/i18n';

const ACTIVITY_ICONS: Record<ActivityLevel, IriIconName> = {
  low: 'home',
  medium: 'drop',
  high: 'flame',
};

/** Schritt 4 von 7 — Aktivitätslevel im Alltag */
export default function ActivityScreen() {
  const router = useRouter();
  const { answers, update } = useOnboarding();

  return (
    <QuizStep
      step={4}
      title={t('onboarding.activity.title')}
      nextDisabled={!answers.activity}
      onNext={() => router.push('/(onboarding)/preferences')}
      onBack={() => router.back()}
    >
      {activityLevels.map((level) => (
        <ChoiceRow
          key={level}
          label={t(`onboarding.activity.${level}`)}
          description={t(`onboarding.activity.${level}Description`)}
          icon={ACTIVITY_ICONS[level]}
          selected={answers.activity === level}
          onPress={() => update({ activity: level })}
        />
      ))}
    </QuizStep>
  );
}
