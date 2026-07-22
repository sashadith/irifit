import { StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';

import { IriIconName } from '@/components/icons/IriIcon';
import { ChoiceRow } from '@/components/ui/ChoiceRow';
import { Chip } from '@/components/ui/Chip';
import { QuizStep } from '@/components/ui/QuizStep';
import { allergens, dietPreferences, DietPreference } from '@/features/onboarding/options';
import { useOnboarding } from '@/features/onboarding/OnboardingProvider';
import { t } from '@/i18n';
import { spacing, typography } from '@/theme';
import { View } from 'react-native';

const DIET_ICONS: Record<DietPreference, IriIconName> = {
  none: 'plate',
  vegetarian: 'leaf',
  vegan: 'sparkle',
  pescetarian: 'drop',
};

/** Schritt 5 von 7 — Ernährungspräferenz & Allergien (optional, überspringbar) */
export default function PreferencesScreen() {
  const router = useRouter();
  const { answers, update } = useOnboarding();
  const selectedAllergens = answers.allergies ?? [];

  const next = () => router.push('/(onboarding)/result');

  return (
    <QuizStep
      step={5}
      title={t('onboarding.preferences.title')}
      subtitle={t('onboarding.preferences.subtitle')}
      nextLabel={
        answers.dietPreference || selectedAllergens.length > 0
          ? t('common.next')
          : t('common.skip')
      }
      onNext={next}
      onBack={() => router.back()}
    >
      {dietPreferences.map((pref) => (
        <ChoiceRow
          key={pref}
          label={t(`onboarding.preferences.${pref}`)}
          icon={DIET_ICONS[pref]}
          selected={answers.dietPreference === pref}
          onPress={() => update({ dietPreference: pref })}
        />
      ))}
      <Text style={[typography.eyebrow, styles.allergyTitle]}>
        {t('onboarding.preferences.allergiesTitle')}
      </Text>
      <View style={styles.chips}>
        {allergens.map((allergen) => {
          const selected = selectedAllergens.includes(allergen);
          return (
            <Chip
              key={allergen}
              label={t(`onboarding.preferences.allergens.${allergen}`)}
              selected={selected}
              onPress={() =>
                update({
                  allergies: selected
                    ? selectedAllergens.filter((a) => a !== allergen)
                    : [...selectedAllergens, allergen],
                })
              }
            />
          );
        })}
      </View>
    </QuizStep>
  );
}

const styles = StyleSheet.create({
  allergyTitle: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
