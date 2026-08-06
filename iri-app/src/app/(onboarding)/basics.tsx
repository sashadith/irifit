import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { GlassView } from '@/components/glass/GlassView';
import { GlassInput } from '@/components/ui/GlassInput';
import { QuizStep } from '@/components/ui/QuizStep';
import { useOnboarding } from '@/features/onboarding/OnboardingProvider';
import { t } from '@/i18n';
import { colors, font, radius, spacing } from '@/theme';

const parseNumber = (value: string): number | undefined => {
  const n = Number(value.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/** Schritt 3 von 7 — Basisdaten + explizite Art.-9-Einwilligung */
export default function BasicsScreen() {
  const router = useRouter();
  const { answers, update } = useOnboarding();
  const [birthYear, setBirthYear] = useState(answers.birthYear?.toString() ?? '');
  const [height, setHeight] = useState(answers.heightCm?.toString() ?? '');
  const [weight, setWeight] = useState(answers.weightKg?.toString() ?? '');
  const [targetWeight, setTargetWeight] = useState(answers.targetWeightKg?.toString() ?? '');
  const [consent, setConsent] = useState(Boolean(answers.healthConsentAt));

  const submit = () => {
    const by = parseNumber(birthYear);
    const h = parseNumber(height);
    const w = parseNumber(weight);
    const tw = parseNumber(targetWeight);
    const currentYear = new Date().getFullYear();
    const valid =
      by && by >= 1920 && by <= currentYear - 14 &&
      h && h >= 100 && h <= 250 &&
      w && w >= 30 && w <= 350 &&
      tw && tw >= 30 && tw <= 350;

    if (!valid) {
      Alert.alert(t('common.error'), t('onboarding.basics.invalidValues'));
      return;
    }
    update({
      birthYear: by,
      heightCm: h,
      weightKg: w,
      targetWeightKg: tw,
      healthConsentAt: answers.healthConsentAt ?? new Date().toISOString(),
    });
    router.push('/(onboarding)/activity');
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <QuizStep
        step={3}
        title={t('onboarding.basics.title')}
        nextDisabled={!consent}
        onNext={submit}
        onBack={() => router.back()}
      >
        <View style={styles.row}>
          <View style={styles.half}>
            <GlassInput
              label={t('onboarding.basics.birthYear')}
              value={birthYear}
              onChangeText={setBirthYear}
              keyboardType="number-pad"
              maxLength={4}
              placeholder="1990"
            />
          </View>
          <View style={styles.half}>
            <GlassInput
              label={t('onboarding.basics.heightCm')}
              value={height}
              onChangeText={setHeight}
              keyboardType="decimal-pad"
              unit="cm"
              placeholder="168"
            />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.half}>
            <GlassInput
              label={t('onboarding.basics.weightKg')}
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
              unit="kg"
              placeholder="74"
            />
          </View>
          <View style={styles.half}>
            <GlassInput
              label={t('onboarding.basics.targetWeightKg')}
              value={targetWeight}
              onChangeText={setTargetWeight}
              keyboardType="decimal-pad"
              unit="kg"
              placeholder="68"
            />
          </View>
        </View>

        <GlassView borderRadius={radius.md} style={styles.consentCard} contentStyle={styles.consentContent}>
          <Text style={styles.consentTitle}>{t('onboarding.basics.consentTitle')}</Text>
          <Text style={styles.consentText}>{t('onboarding.basics.consentText')}</Text>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: consent }}
            accessibilityLabel={t('onboarding.basics.consentCheckbox')}
            onPress={() => {
              Haptics.selectionAsync();
              setConsent((c) => !c);
            }}
            style={styles.checkboxRow}
          >
            <View style={[styles.checkbox, consent && styles.checkboxChecked]}>
              {consent ? <Text style={styles.checkmark}>✓</Text> : null}
            </View>
            <Text style={styles.checkboxLabel}>{t('onboarding.basics.consentCheckbox')}</Text>
          </Pressable>
        </GlassView>
      </QuizStep>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  half: {
    flex: 1,
  },
  consentCard: {
    marginTop: spacing.sm,
  },
  consentContent: {
    padding: spacing.lg,
  },
  consentTitle: {
    fontFamily: font.bold,
    fontSize: 13.5,
    color: colors.ink,
    marginBottom: 6,
  },
  consentText: {
    fontFamily: font.regular,
    fontSize: 12.5,
    lineHeight: 19,
    color: colors.muted,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.muted2,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.tintDeep,
    borderColor: colors.tintDeep,
  },
  checkmark: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  checkboxLabel: {
    flex: 1,
    fontFamily: font.semibold,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.ink,
  },
});
