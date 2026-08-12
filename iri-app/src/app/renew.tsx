import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassView } from '@/components/glass/GlassView';
import { Wallpaper } from '@/components/Wallpaper';
import { Chip } from '@/components/ui/Chip';
import { GhostButton } from '@/components/ui/GhostButton';
import { IriAvatar } from '@/components/ui/IriAvatar';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { RoseHeart } from '@/components/ui/RoseHeart';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  fetchOffers,
  isExpoGo,
  Offers,
  purchasePlan,
  restorePurchases,
  waitForSubscriptionRow,
} from '@/features/subscription/purchases';
import { t } from '@/i18n';
import { colors, font, radius, spacing, typography } from '@/theme';

/**
 * Abo-Verlängerung nach Ablauf (Session 24) — eigener Screen, weil die
 * Onboarding-Paywall hinter dem Guard liegt und abgeschlossene Nutzerinnen
 * dort sofort weggeleitet werden. Gleiche Kauf-Logik, schlankere Huelle.
 */
export default function RenewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();

  const [plan, setPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [offers, setOffers] = useState<Offers | null>(null);
  const [storeReady, setStoreReady] = useState(false);
  const [busy, setBusy] = useState(false);

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
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(t('renew.successTitle'), t('renew.successText'), [
      { text: 'OK', onPress: () => router.back() },
    ]);
  };

  const buy = async () => {
    if (!storeReady) {
      Alert.alert(
        t('onboarding.paywall.storeUnavailableTitle'),
        t('onboarding.paywall.storeUnavailableText'),
      );
      return;
    }
    setBusy(true);
    try {
      const outcome = await purchasePlan(plan);
      if (outcome === 'success') {
        await finish();
      } else if (outcome === 'failed') {
        Alert.alert(t('common.error'), t('onboarding.paywall.purchaseFailed'));
      }
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

  const price = (p: 'monthly' | 'yearly') =>
    p === 'monthly' ? (offers?.monthly?.priceString ?? '6,99 €') : (offers?.yearly?.priceString ?? '59,99 €');

  return (
    <View style={styles.flex}>
      <Wallpaper />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 18 }]}>
        <View style={styles.top}>
          <IriAvatar size={74} />
          <Text style={[typography.displayLg, styles.title]}>
            {t('renew.title')} <RoseHeart size={22} />
          </Text>
          <Text style={[typography.bodyMuted, styles.subtitle]}>{t('renew.subtitle')}</Text>
        </View>

        <GlassView borderRadius={radius.md} contentStyle={styles.card}>
          <View style={styles.planChips}>
            <Chip
              label={`${t('renew.yearly')} · ${price('yearly')}`}
              selected={plan === 'yearly'}
              onPress={() => setPlan('yearly')}
            />
            <Chip
              label={`${t('renew.monthly')} · ${price('monthly')}`}
              selected={plan === 'monthly'}
              onPress={() => setPlan('monthly')}
            />
          </View>
          <PrimaryButton label={t('renew.cta')} onPress={buy} loading={busy} style={styles.cta} />
          <GhostButton label={t('onboarding.paywall.restore')} small onPress={restore} style={styles.smallGap} />
        </GlassView>

        <GhostButton label={t('common.back')} small onPress={() => router.back()} style={styles.backButton} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.screenX,
    paddingBottom: 40,
  },
  top: {
    alignItems: 'center',
    marginBottom: 18,
  },
  title: {
    marginTop: 14,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    textAlign: 'center',
  },
  card: {
    padding: spacing.lg,
  },
  planChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  cta: {
    marginTop: 16,
  },
  smallGap: {
    marginTop: 10,
  },
  backButton: {
    marginTop: 18,
  },
});
