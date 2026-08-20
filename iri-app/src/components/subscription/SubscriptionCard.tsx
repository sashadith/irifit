import { useCallback, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { GlassView } from '@/components/glass/GlassView';
import { RoseHeart } from '@/components/ui/RoseHeart';
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
        {/* Herz statt Kalender (Sascha 20.08.): Ein Kalender signalisiert
            Termin, hier geht es um Zugehoerigkeit. */}
        <RoseHeart size={16} color={colors.tint} />
        <Text style={styles.sectionTitle}>{t('subscription.section')}</Text>
      </View>

      {/* Verweis auf gleicher Hoehe wie der Produktname (Sascha 20.08.): Als
          eigene Zeile darunter machte er die Karte unnoetig hoch, obwohl
          rechts neben „Jahresabo" die halbe Breite frei stand. */}
      <View style={styles.zeile}>
        <Text style={styles.produkt}>{produktName(sub)}</Text>
        {sub.active ? (
          <Pressable
            accessibilityRole="link"
            onPress={() => Linking.openURL(APPLE_SUBSCRIPTIONS)}
            hitSlop={10}
          >
            <Text style={styles.link}>{t('subscription.manage')}</Text>
          </Pressable>
        ) : (
          <Pressable accessibilityRole="button" onPress={() => router.push('/renew')} hitSlop={10}>
            <Text style={styles.link}>{t('subscription.renew')}</Text>
          </Pressable>
        )}
      </View>
      <Text style={[styles.verlauf, !sub.active && styles.verlaufAus]}>{verlauf(sub)}</Text>

      {legacy ? <Text style={styles.legacy}>{t('subscription.legacyHint')}</Text> : null}
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
  zeile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  // Auffindbar, aber kein Blickfang (Sascha 20.08.): Der Weg zur Kuendigung
  // gehoert sichtbar in die App, ihn hervorzuheben waere gegen unser Interesse.
  // Ohne Unterstrich — der wirkte wie ein Formularfeld statt wie ein Verweis.
  link: {
    fontFamily: font.semibold,
    fontSize: 13,
    color: colors.muted,
  },
});
