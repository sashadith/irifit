import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { IrinaCard } from '@/components/coaching/IrinaCard';
import { GlassView } from '@/components/glass/GlassView';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { GhostButton } from '@/components/ui/GhostButton';
import { IriAvatar } from '@/components/ui/IriAvatar';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { useAuth } from '@/features/auth/AuthProvider';
import { t } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { colors, font, radius, spacing, tintShadow, typography } from '@/theme';

type Plan = 'yearly' | 'monthly';

/**
 * Paywall (Prototyp s-paywall). Design final — der echte Kauf kommt in
 * Session 11 (RevenueCat). Bis dahin schließt der CTA das Onboarding ab,
 * damit Beta-Testerinnen die App nutzen können.
 */
export default function PaywallScreen() {
  const { completeOnboarding } = useAuth();
  const [plan, setPlan] = useState<Plan>('yearly');
  const [busy, setBusy] = useState(false);
  const [showIrina, setShowIrina] = useState(false);

  const startTrial = async () => {
    setBusy(true);
    try {
      // Beta-Trial serverseitig anlegen (schaltet Rezepte/Kurse via RLS frei);
      // ab Session 11 übernimmt hier RevenueCat.
      await supabase.functions.invoke('grant-trial').catch(() => {});
      await completeOnboarding();
      // Navigation übernimmt der Guard im (onboarding)-Layout
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const selectPlan = (next: Plan) => {
    Haptics.selectionAsync();
    setPlan(next);
  };

  return (
    <ScreenScaffold withTabBarInset={false}>
      <View style={styles.top}>
        <Pressable accessibilityRole="button" accessibilityLabel="Irina" onPress={() => setShowIrina(true)}>
          <IriAvatar size={74} />
        </Pressable>
        <Text style={[typography.displayLg, styles.title]}>{t('onboarding.paywall.title')}</Text>
        <Text style={[typography.bodyMuted, styles.subtitle]}>
          {t('onboarding.paywall.subtitle')}
        </Text>
      </View>

      <Pressable accessibilityRole="radio" accessibilityState={{ selected: plan === 'yearly' }} onPress={() => selectPlan('yearly')}>
        <GlassView
          strong={plan === 'yearly'}
          borderRadius={radius.md}
          style={styles.plan}
          contentStyle={[styles.planContent, plan === 'yearly' && styles.planSelected]}
        >
          <Text style={styles.planTitle}>{t('onboarding.paywall.yearly')}</Text>
          <Text style={styles.planHint}>{t('onboarding.paywall.yearlyHint')}</Text>
        </GlassView>
        <LinearGradient
          colors={colors.roseGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.badge, tintShadow]}
        >
          <Text style={styles.badgeText}>{t('onboarding.paywall.yearlyBadge')}</Text>
        </LinearGradient>
      </Pressable>

      <Pressable accessibilityRole="radio" accessibilityState={{ selected: plan === 'monthly' }} onPress={() => selectPlan('monthly')}>
        <GlassView
          strong={plan === 'monthly'}
          borderRadius={radius.md}
          style={styles.plan}
          contentStyle={[styles.planContent, plan === 'monthly' && styles.planSelected]}
        >
          <Text style={styles.planTitle}>{t('onboarding.paywall.monthly')}</Text>
          <Text style={styles.planHint}>{t('onboarding.paywall.monthlyHint')}</Text>
        </GlassView>
      </Pressable>

      <PrimaryButton
        label={t('onboarding.paywall.cta')}
        onPress={startTrial}
        loading={busy}
        style={styles.cta}
      />
      <Text style={styles.reminder}>{t('onboarding.paywall.reminder')}</Text>
      <GhostButton
        label={t('onboarding.paywall.voucher')}
        small
        onPress={() => Alert.alert(t('onboarding.paywall.voucher'), t('onboarding.paywall.voucherSoon'))}
        style={styles.voucher}
      />
      <Text style={styles.testerNote}>{t('onboarding.paywall.testerNote')}</Text>
      <IrinaCard visible={showIrina} onClose={() => setShowIrina(false)} />
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  top: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: spacing.lg,
  },
  title: {
    textAlign: 'center',
    marginTop: 12,
  },
  subtitle: {
    textAlign: 'center',
    marginTop: 10,
  },
  plan: {
    marginBottom: 12,
  },
  planContent: {
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  planSelected: {
    borderColor: colors.ink,
  },
  planTitle: {
    fontFamily: font.bold,
    fontSize: 16,
    color: colors.ink,
  },
  planHint: {
    fontFamily: font.regular,
    fontSize: 13,
    color: colors.muted,
    marginTop: 3,
  },
  badge: {
    position: 'absolute',
    top: -11,
    right: 14,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontFamily: font.bold,
    fontSize: 11,
    color: colors.white,
  },
  cta: {
    marginTop: 6,
  },
  reminder: {
    fontFamily: font.regular,
    fontSize: 11.5,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 10,
  },
  voucher: {
    marginTop: 10,
  },
  testerNote: {
    fontFamily: font.regular,
    fontSize: 11,
    color: colors.muted2,
    textAlign: 'center',
    marginTop: 14,
  },
});
