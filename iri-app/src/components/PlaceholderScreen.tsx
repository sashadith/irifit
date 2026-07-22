import { StyleSheet, Text } from 'react-native';

import { GlassView } from '@/components/glass/GlassView';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { t, TranslationKey } from '@/i18n';
import { spacing, typography } from '@/theme';

export interface PlaceholderScreenProps {
  readonly titleKey: TranslationKey;
  readonly bodyKey: TranslationKey;
}

/** Temporärer Inhalt, bis der jeweilige Screen in seiner Session gebaut wird */
export function PlaceholderScreen({ titleKey, bodyKey }: PlaceholderScreenProps) {
  return (
    <ScreenScaffold>
      <Text style={[typography.displayLg, styles.title]}>{t(titleKey)}</Text>
      <GlassView contentStyle={styles.cardContent}>
        <Text style={typography.bodyMuted}>{t(bodyKey)}</Text>
      </GlassView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  title: {
    marginBottom: spacing.lg,
  },
  cardContent: {
    padding: spacing.lg,
  },
});
