import { StyleSheet, Text } from 'react-native';

import { GlassView } from '@/components/glass/GlassView';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { GhostButton } from '@/components/ui/GhostButton';
import { useAuth } from '@/features/auth/AuthProvider';
import { t } from '@/i18n';
import { spacing, typography } from '@/theme';

export default function ProfilScreen() {
  const { signOut, session } = useAuth();

  return (
    <ScreenScaffold>
      <Text style={[typography.displayLg, styles.title]}>{t('profile.title')}</Text>
      <GlassView contentStyle={styles.cardContent}>
        <Text style={typography.bodyMuted}>{session?.user.email}</Text>
        <Text style={[typography.bodyMuted, styles.placeholder]}>{t('profile.placeholder')}</Text>
      </GlassView>
      <GhostButton label={t('profile.signOut')} onPress={signOut} style={styles.signOut} />
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
  placeholder: {
    marginTop: spacing.sm,
  },
  signOut: {
    marginTop: spacing.lg,
  },
});
