import { PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ScreenScaffold } from '@/components/ScreenScaffold';
import { GhostButton } from '@/components/ui/GhostButton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { t } from '@/i18n';
import { spacing, typography } from '@/theme';

export interface QuizStepProps {
  /** 1-basiert, von 7 */
  readonly step: number;
  readonly title: string;
  readonly subtitle?: string;
  readonly nextLabel?: string;
  readonly nextDisabled?: boolean;
  readonly nextLoading?: boolean;
  readonly onNext: () => void;
  readonly onBack?: () => void;
}

const TOTAL_STEPS = 7;

/** Gemeinsames Gerüst der Quiz-Screens: Progress, Eyebrow, Titel, Weiter/Zurück */
export function QuizStep({
  step,
  title,
  subtitle,
  nextLabel,
  nextDisabled,
  nextLoading,
  onNext,
  onBack,
  children,
}: PropsWithChildren<QuizStepProps>) {
  return (
    <ScreenScaffold withTabBarInset={false}>
      <ProgressBar progress={step / TOTAL_STEPS} />
      <Text style={typography.eyebrow}>{t('onboarding.stepLabel', { step })}</Text>
      <Text style={[typography.displayLg, styles.title]}>{title}</Text>
      {subtitle ? <Text style={[typography.bodyMuted, styles.subtitle]}>{subtitle}</Text> : null}
      <View style={styles.body}>{children}</View>
      <View style={styles.actions}>
        <PrimaryButton
          label={nextLabel ?? t('common.next')}
          onPress={onNext}
          disabled={nextDisabled}
          loading={nextLoading}
        />
        {onBack ? (
          <GhostButton label={t('common.back')} onPress={onBack} style={styles.back} />
        ) : null}
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  title: {
    marginTop: 10,
    marginBottom: 6,
  },
  subtitle: {
    marginBottom: 8,
  },
  body: {
    marginTop: spacing.lg,
  },
  actions: {
    marginTop: spacing.xl,
  },
  back: {
    marginTop: 10,
  },
});
