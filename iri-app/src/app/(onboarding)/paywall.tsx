import { useEffect, useRef, useState } from 'react';
import { Alert, Keyboard, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { IrinaCard } from '@/components/coaching/IrinaCard';
import { GlassView } from '@/components/glass/GlassView';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { GhostButton } from '@/components/ui/GhostButton';
import { GlassInput } from '@/components/ui/GlassInput';
import { IriAvatar } from '@/components/ui/IriAvatar';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  fetchOffers,
  isExpoGo,
  Offers,
  purchasePlan,
  redeemVoucher,
  restorePurchases,
  waitForSubscriptionRow,
} from '@/features/subscription/purchases';
import { t } from '@/i18n';
import { colors, font, radius, spacing, tintShadow, typography } from '@/theme';

type Plan = 'yearly' | 'monthly';

/**
 * Paywall (Prototyp s-paywall) — seit Session 11 mit echtem RevenueCat-Kauf.
 * In Expo Go (kein natives Modul) zeigen wir statische Preise + Hinweis.
 */
export default function PaywallScreen() {
  const { session, completeOnboarding } = useAuth();
  const [plan, setPlan] = useState<Plan>('yearly');
  const [busy, setBusy] = useState(false);
  const [showIrina, setShowIrina] = useState(false);
  const [offers, setOffers] = useState<Offers | null>(null);
  const [storeReady, setStoreReady] = useState<boolean | null>(isExpoGo ? false : null);
  const [showVoucher, setShowVoucher] = useState(false);
  const [voucherCode, setVoucherCode] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  // Das Gutschein-Feld liegt unter dem Falz — ohne Nachscrollen verdeckt es die Tastatur
  // komplett. Erst NACH dem Resize durch die Tastatur (keyboardDidShow) ans Ende scrollen.
  useEffect(() => {
    if (!showVoucher) return;
    const scrollToEnd = () => scrollRef.current?.scrollToEnd({ animated: true });
    const sub = Keyboard.addListener('keyboardDidShow', scrollToEnd);
    scrollToEnd();
    return () => sub.remove();
  }, [showVoucher]);

  useEffect(() => {
    if (isExpoGo) return;
    let cancelled = false;
    fetchOffers()
      .then((o) => {
        if (cancelled) return;
        setOffers(o);
        setStoreReady(o != null);
      })
      .catch(() => {
        if (!cancelled) setStoreReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const finish = async () => {
    if (session) await waitForSubscriptionRow(session.user.id);
    await completeOnboarding();
    // Navigation übernimmt der Guard im (onboarding)-Layout
  };

  const buy = async () => {
    if (!storeReady) {
      Alert.alert(t('onboarding.paywall.storeUnavailableTitle'), t('onboarding.paywall.storeUnavailableText'));
      return;
    }
    setBusy(true);
    try {
      const outcome = await purchasePlan(plan);
      if (outcome === 'success') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await finish();
      } else if (outcome === 'failed') {
        Alert.alert(t('common.error'), t('onboarding.paywall.purchaseFailed'));
      }
      // 'cancelled': Nutzerin hat den Store-Dialog geschlossen — kein Fehler
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setBusy(true);
    try {
      if (await restorePurchases()) {
        await finish();
      } else {
        Alert.alert(t('onboarding.paywall.restoreTitle'), t('onboarding.paywall.restoreNothing'));
      }
    } finally {
      setBusy(false);
    }
  };

  const submitVoucher = async () => {
    setBusy(true);
    try {
      const result = await redeemVoucher(voucherCode);
      if (result.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          t('onboarding.paywall.voucherSuccessTitle'),
          t('onboarding.paywall.voucherSuccessText', { months: result.months ?? 1 }),
        );
        await completeOnboarding();
      } else {
        const key =
          result.error === 'already_redeemed'
            ? 'onboarding.paywall.voucherUsed'
            : result.error === 'exhausted'
              ? 'onboarding.paywall.voucherExhausted'
              : 'onboarding.paywall.voucherInvalid';
        Alert.alert(t('common.error'), t(key));
      }
    } finally {
      setBusy(false);
    }
  };

  const selectPlan = (next: Plan) => {
    Haptics.selectionAsync();
    setPlan(next);
  };

  const yearlyPrice = offers?.yearly?.priceString ?? t('onboarding.paywall.yearlyFallbackPrice');
  const monthlyPrice = offers?.monthly?.priceString ?? t('onboarding.paywall.monthlyFallbackPrice');
  const hasTrial = offers ? (plan === 'yearly' ? offers.yearly?.hasFreeTrial : offers.monthly?.hasFreeTrial) : true;

  // Monats-Äquivalent + Spar-Badge aus den echten Store-Preisen ableiten —
  // statische Texte würden bei Preisänderungen im Store lügen (Befund Sandbox-Test 05.08.).
  const perMonth =
    offers?.yearly != null
      ? formatCurrency(Math.floor((offers.yearly.price / 12) * 100) / 100, offers.yearly.currencyCode)
      : null;
  const savingsPercent =
    offers?.yearly != null && offers?.monthly != null && offers.monthly.price > 0
      ? Math.round((1 - offers.yearly.price / (offers.monthly.price * 12)) * 100)
      : null;
  const yearlyHint =
    perMonth != null ? t('onboarding.paywall.yearlyHint', { price: perMonth }) : t('onboarding.paywall.yearlyHintFallback');
  const yearlyBadge =
    savingsPercent != null && savingsPercent > 0
      ? t('onboarding.paywall.yearlyBadge', { percent: savingsPercent })
      : t('onboarding.paywall.yearlyBadgeFallback');

  return (
    <ScreenScaffold withTabBarInset={false} scrollRef={scrollRef}>
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
          <Text style={styles.planTitle}>{t('onboarding.paywall.yearlyWithPrice', { price: yearlyPrice })}</Text>
          <Text style={styles.planHint}>{yearlyHint}</Text>
        </GlassView>
        <LinearGradient
          colors={colors.roseGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.badge, tintShadow]}
        >
          <Text style={styles.badgeText}>{yearlyBadge}</Text>
        </LinearGradient>
      </Pressable>

      <Pressable accessibilityRole="radio" accessibilityState={{ selected: plan === 'monthly' }} onPress={() => selectPlan('monthly')}>
        <GlassView
          strong={plan === 'monthly'}
          borderRadius={radius.md}
          style={styles.plan}
          contentStyle={[styles.planContent, plan === 'monthly' && styles.planSelected]}
        >
          <Text style={styles.planTitle}>{t('onboarding.paywall.monthlyWithPrice', { price: monthlyPrice })}</Text>
          <Text style={styles.planHint}>{t('onboarding.paywall.monthlyHint')}</Text>
        </GlassView>
      </Pressable>

      <PrimaryButton
        label={hasTrial ? t('onboarding.paywall.cta') : t('onboarding.paywall.ctaNoTrial')}
        onPress={buy}
        loading={busy}
        disabled={storeReady === null}
        style={styles.cta}
      />
      <Text style={styles.reminder}>{t('onboarding.paywall.reminder')}</Text>

      {isExpoGo || storeReady === false ? (
        <Text style={styles.testerNote}>{t('onboarding.paywall.expoGoNote')}</Text>
      ) : null}

      {showVoucher ? (
        <View style={styles.voucherWrap}>
          <GlassInput
            label={t('onboarding.paywall.voucherLabel')}
            value={voucherCode}
            onChangeText={setVoucherCode}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="IRINA3"
            autoFocus
          />
          <PrimaryButton
            label={t('onboarding.paywall.voucherRedeem')}
            onPress={submitVoucher}
            disabled={!voucherCode.trim()}
            loading={busy}
          />
        </View>
      ) : (
        <GhostButton
          label={t('onboarding.paywall.voucher')}
          small
          onPress={() => setShowVoucher(true)}
          style={styles.voucher}
        />
      )}

      <GhostButton
        label={t('onboarding.paywall.restore')}
        small
        onPress={restore}
        style={styles.restore}
      />
      <IrinaCard visible={showIrina} onClose={() => setShowIrina(false)} />
    </ScreenScaffold>
  );
}

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
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
    borderColor: colors.tintDeep,
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
  voucherWrap: {
    marginTop: 14,
  },
  restore: {
    marginTop: 8,
  },
  testerNote: {
    fontFamily: font.regular,
    fontSize: 11,
    color: colors.muted2,
    textAlign: 'center',
    marginTop: 14,
  },
});
