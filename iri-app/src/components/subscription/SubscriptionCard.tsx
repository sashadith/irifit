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
      {/* Kopfzeile: links die Ueberschrift, rechts gegenueber der Verweis als
          feiner Chip (Sascha 20.08.). Der spart der Karte eine ganze Zeile und
          nutzt den Platz, der neben „DEIN ZUGANG" ohnehin leer stand. */}
      <View style={styles.head}>
        <View style={styles.headLinks}>
          {/* Herz statt Kalender: Ein Kalender signalisiert Termin, hier geht
              es um Zugehoerigkeit. */}
          <RoseHeart size={16} color={colors.tint} />
          <Text style={styles.sectionTitle}>{t('subscription.section')}</Text>
        </View>
        <Pressable
          accessibilityRole={sub.active ? 'link' : 'button'}
          onPress={() =>
            sub.active ? Linking.openURL(APPLE_SUBSCRIPTIONS) : router.push('/renew')
          }
          hitSlop={10}
          style={({ pressed }) => [styles.chip, pressed && styles.chipGedrueckt]}
        >
          <Text style={styles.chipText}>
            {sub.active ? t('subscription.manage') : t('subscription.renew')}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.produkt}>{produktName(sub)}</Text>
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
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  headLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  /* Feiner Chip statt blossem Text (Sascha 20.08.): als Pille erkennbar
     antippbar, aber blass genug, um nicht mit dem Produktnamen zu konkurrieren
     — der Weg zur Kuendigung gehoert sichtbar in die App, hervorgehoben
     gehoert er nicht. */
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(28,28,33,0.07)',
  },
  chipGedrueckt: {
    opacity: 0.6,
  },
  chipText: {
    fontFamily: font.semibold,
    fontSize: 12,
    color: colors.muted,
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
});
