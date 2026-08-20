import { useCallback, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { GlassView } from '@/components/glass/GlassView';
import { IriIcon } from '@/components/icons/IriIcon';
import { useAuth } from '@/features/auth/AuthProvider';
import { loadSubStatus, type SubStatus } from '@/features/subscription/status';
import { t } from '@/i18n';
import { colors, font, radius, spacing } from '@/theme';

/** Apples Abo-Verwaltung. Kuendigen darf und soll die App nicht selbst — das
    laeuft ueber den Store, und Apple erwartet genau diesen Weg. */
const APPLE_SUBSCRIPTIONS = 'https://apps.apple.com/account/subscriptions';

function datum(d: Date): string {
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function produktName(sub: SubStatus): string {
  switch (sub.kind) {
    case 'yearly':
      return t('subscription.yearly');
    case 'monthly':
      return t('subscription.monthly');
    case 'voucher':
      return t('subscription.voucher');
    default:
      return t('subscription.generic');
  }
}

/**
 * Zweite Zeile: was mit dem Zugang als Naechstes passiert. Die Unterscheidung
 * verlaengert/laeuft aus ist der ganze Grund fuer diese Karte — „bis 21.08."
 * allein liest sich fuer die eine wie eine Drohung und fuer die andere wie
 * eine Zusage.
 */
function verlauf(sub: SubStatus): string {
  const bis = sub.endsAt ? datum(sub.endsAt) : null;
  if (!sub.active) return t('subscription.ended');
  if (sub.status === 'in_grace') {
    return bis ? t('subscription.billingIssue', { date: bis }) : t('subscription.billingIssueShort');
  }
  if (!bis) return t('subscription.noEnd');
  if (sub.kind === 'voucher') return t('subscription.voucherUntil', { date: bis });
  if (!sub.willRenew) return t('subscription.untilEnd', { date: bis });
  return t('subscription.renewsOn', { date: bis });
}

/**
 * „Dein Zugang" im Profil (Sascha 20.08.).
 *
 * Absicht: Unsicherheit kostet Abos. Wer nicht sieht, wann abgebucht wird,
 * kuendigt vorsichtshalber — oder schreibt Irina. Deshalb steht hier klar,
 * welches Abo laeuft und was als Naechstes passiert.
 *
 * Bewusst KEIN grosser Kuendigen-Knopf: Der Weg muss auffindbar sein, ihn zu
 * betonen waere gegen Saschas Interesse. Der dezente Verweis fuehrt zu Apple.
 *
 * Nutzerinnen ohne Abo-Zeile (frische Beta-Konten) sehen gar nichts — eine
 * Karte „kein Abo" waere nur eine Aufforderung, ueber Geld nachzudenken.
 */
export function SubscriptionCard() {
  const router = useRouter();
  const { session, legacy } = useAuth();
  const [sub, setSub] = useState<SubStatus | null>(null);

  // Bei jedem Fokus neu: Nach einer Verlaengerung in /renew stimmt die Zeile
  // sofort, ohne dass die App neu gestartet werden muss.
  useFocusEffect(
    useCallback(() => {
      const userId = session?.user.id;
      if (!userId) return;
      let cancelled = false;
      loadSubStatus(userId).then((s) => {
        if (!cancelled) setSub(s);
      });
      return () => {
        cancelled = true;
      };
    }, [session?.user.id]),
  );

  if (!sub) return null;

  return (
    <GlassView borderRadius={radius.md} contentStyle={styles.card} style={styles.gap}>
      <View style={styles.head}>
        <IriIcon name="calendar" size={16} color={colors.tintDeep} />
        <Text style={styles.sectionTitle}>{t('subscription.section')}</Text>
      </View>

      <Text style={styles.produkt}>{produktName(sub)}</Text>
      <Text style={[styles.verlauf, !sub.active && styles.verlaufAus]}>{verlauf(sub)}</Text>

      {legacy ? <Text style={styles.legacy}>{t('subscription.legacyHint')}</Text> : null}

      <View style={styles.links}>
        {sub.active ? (
          <Pressable
            accessibilityRole="link"
            onPress={() => Linking.openURL(APPLE_SUBSCRIPTIONS)}
            hitSlop={8}
          >
            <Text style={styles.link}>{t('subscription.manage')}</Text>
          </Pressable>
        ) : (
          <Pressable accessibilityRole="button" onPress={() => router.push('/renew')} hitSlop={8}>
            <Text style={styles.link}>{t('subscription.renew')}</Text>
          </Pressable>
        )}
      </View>
    </GlassView>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
  },
  gap: {
    marginTop: spacing.md,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontFamily: font.bold,
    fontSize: 12,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  produkt: {
    fontFamily: font.bold,
    fontSize: 16,
    color: colors.ink,
  },
  verlauf: {
    fontFamily: font.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
    marginTop: 2,
  },
  verlaufAus: {
    color: colors.tintDeep,
  },
  legacy: {
    fontFamily: font.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
    marginTop: spacing.sm,
  },
  links: {
    marginTop: spacing.md,
  },
  link: {
    fontFamily: font.semibold,
    fontSize: 14,
    color: colors.tintDeep,
  },
});
