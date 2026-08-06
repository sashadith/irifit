import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { IrinaCard } from '@/components/coaching/IrinaCard';
import { GlassView } from '@/components/glass/GlassView';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { GhostButton } from '@/components/ui/GhostButton';
import { IriAvatar } from '@/components/ui/IriAvatar';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { RoseHeart } from '@/components/ui/RoseHeart';
import { t } from '@/i18n';
import { colors, font, spacing, typography } from '@/theme';

/** Schritt 1 von 7 — Begrüßung (Prototyp s-welcome) */
export default function WelcomeScreen() {
  const router = useRouter();
  const [showIrina, setShowIrina] = useState(false);

  return (
    <ScreenScaffold withTabBarInset={false}>
      <View style={styles.top}>
        <Pressable accessibilityRole="button" accessibilityLabel="Irina" onPress={() => setShowIrina(true)}>
          <IriAvatar size={110} />
        </Pressable>
        <Text style={[typography.eyebrow, styles.eyebrow]}>{t('onboarding.welcome.eyebrow')}</Text>
        <Text style={[typography.displayXl, styles.title]}>
          {t('onboarding.welcome.title')} <RoseHeart />
        </Text>
      </View>
      <GlassView contentStyle={styles.cardContent}>
        <Text style={styles.intro}>{t('onboarding.welcome.intro')}</Text>
      </GlassView>
      <View style={styles.actions}>
        <PrimaryButton
          label={t('onboarding.welcome.start')}
          onPress={() => router.push('/(onboarding)/goal')}
        />
        <GhostButton
          label={t('onboarding.welcome.haveAccount')}
          small
          onPress={() => router.push('/(onboarding)/login')}
          style={styles.ghost}
        />
        <GhostButton
          label={t('onboarding.welcome.legacyEntry')}
          small
          onPress={() => router.push('/(onboarding)/legacy-login')}
          style={styles.ghost}
        />
      </View>
      <IrinaCard visible={showIrina} onClose={() => setShowIrina(false)} />
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  top: {
    alignItems: 'center',
    marginTop: 26,
    marginBottom: 16,
  },
  eyebrow: {
    marginTop: 14,
    textAlign: 'center',
  },
  title: {
    textAlign: 'center',
    marginTop: 12,
  },
  cardContent: {
    padding: spacing.lg,
  },
  intro: {
    fontFamily: font.regular,
    fontSize: 14.5,
    lineHeight: 23,
    color: colors.muted,
    textAlign: 'center',
  },
  actions: {
    marginTop: spacing.xl,
  },
  ghost: {
    marginTop: 10,
  },
});
