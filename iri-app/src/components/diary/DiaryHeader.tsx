import { useEffect } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { GlassView } from '@/components/glass/GlassView';
import { IriIcon } from '@/components/icons/IriIcon';
import { RoseHeart } from '@/components/ui/RoseHeart';
import { t } from '@/i18n';
import { colors, font, radius, typography } from '@/theme';

/**
 * Herzschlag am Gruss (Sascha 18.08.: „wenigstens etwas soll sich bewegen").
 *
 * Der Trick, warum das dauerhaft laufen darf, obwohl wir gerade alle
 * Endlos-Animationen stillgelegt haben: Es ist ein DOPPELSCHLAG MIT PAUSE,
 * kein Dauerlauf. Waehrend der ~3,5 s Pause aendert sich kein Wert — Reanimated
 * rendert dann schlicht nichts, die Bildschirm-Pipeline darf schlafen. Nur der
 * Schlag selbst (~0,7 s) kostet Bilder, und der ist eine reine
 * Transform-Animation auf dem UI-Thread: kein SVG-Neubau, kein JS.
 */
function BeatingHeart({ size }: { size: number }) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.18, { duration: 160, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 190, easing: Easing.in(Easing.quad) }),
        withTiming(1.1, { duration: 150, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 280, easing: Easing.in(Easing.quad) }),
        // Pause als letzter Schritt der Sequenz — hier ruht die Pipeline
        withDelay(3400, withTiming(1, { duration: 1 })),
      ),
      -1,
    );
    return () => cancelAnimation(scale);
  }, [scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={style}>
      <RoseHeart size={size} color={colors.tint} />
    </Animated.View>
  );
}

/** Flamme statisch (Sascha 18.08.: „braucht kein Mensch") — nur die Farbe
    unterscheidet aktive Serie von der 0er */
function StreakFlame({ active }: { active: boolean }) {
  return (
    <IriIcon
      name="flame"
      size={16}
      color={active ? colors.tintDeep : colors.muted}
      opacity={active ? 1 : 0.7}
    />
  );
}

const MONTHS_SHORT = [
  'Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni',
  'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.',
];

export interface DiaryHeaderProps {
  readonly date: Date;
  readonly isToday: boolean;
  readonly greeting: string;
  readonly streakCount: number;
  readonly onShiftDate: (days: number) => void;
}

/**
 * Kopfbereich (Umbau 09.08. nach Beta-Feedback Sascha): Datum-Chip und
 * Streak-Chip als GLEICHE Pillen auf einer Höhe — beide mit Icon; die
 * Blätter-Pfeile sitzen dezent IN der Datum-Pille. Die Flamme erklärt sich
 * auf Tipp selbst (vorher: totes Element).
 */
export function DiaryHeader({ date, isToday, greeting, streakCount, onShiftDate }: DiaryHeaderProps) {
  const shift = (days: number) => {
    Haptics.selectionAsync();
    onShiftDate(days);
  };

  const explainStreak = () => {
    Haptics.selectionAsync();
    Alert.alert(t('home.streakInfoTitle'), t('home.streakInfoBody'));
  };

  return (
    <View>
      <View style={styles.chipRow}>
        <GlassView borderRadius={radius.pill} contentStyle={styles.dateChip}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            onPress={() => shift(-1)}
            hitSlop={10}
          >
            <Text style={styles.chevron}>‹</Text>
          </Pressable>
          <IriIcon name="calendar" size={15} color={colors.tintDeep} />
          <Text style={styles.dateText}>
            {date.getDate()}. {MONTHS_SHORT[date.getMonth()]}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.next')}
            onPress={() => shift(1)}
            hitSlop={10}
            style={isToday ? styles.hidden : undefined}
            disabled={isToday}
          >
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </GlassView>

        <Pressable accessibilityRole="button" accessibilityLabel={t('home.streakInfoTitle')} onPress={explainStreak}>
          <GlassView borderRadius={radius.pill} contentStyle={styles.streak}>
            <StreakFlame active={streakCount > 0} />
            <Text style={[styles.streakText, streakCount === 0 && styles.streakStart]}>
              {streakCount === 0
                ? t('home.streakStart')
                : streakCount === 1
                  ? t('home.streakOne')
                  : t('home.streak', { count: streakCount })}
            </Text>
          </GlassView>
        </Pressable>
      </View>

      {/* Eigene Zeile statt verschachteltem Text: Transforms (Herz-Breite)
          wirken in RN nicht auf Text-Spans, wohl aber auf eigenstaendige Texte */}
      <View style={styles.greetingRow}>
        {/* Lange Gruesse duerfen schrumpfen statt abgeschnitten zu werden
            (17.08.): „Halben Montag geschafft, Irina" passt bei 26 px nicht in
            eine Zeile. Bis 0,72 herunter bleibt die Display-Schrift lesbar und
            die Zeile ganz; die meisten Gruesse sind kurz und bleiben unberuehrt. */}
        <Text
          style={[typography.displayLg, styles.greeting]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.72}
        >
          {greeting}
        </Text>
        <BeatingHeart size={26} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    // = greetingRow.marginBottom (6) + ringCard.marginTop (12) — gleicher
    // Abstand ueber und unter der Grusszeile (Beta 09.08.)
    marginBottom: 18,
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dateText: {
    fontFamily: font.bold,
    fontSize: 13,
    color: colors.ink,
  },
  chevron: {
    fontFamily: font.bold,
    fontSize: 16,
    lineHeight: 18,
    color: colors.muted,
    paddingHorizontal: 2,
  },
  hidden: {
    opacity: 0,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  greeting: {
    flexShrink: 1,
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  streakText: {
    fontFamily: font.bold,
    fontSize: 13,
    color: colors.ink,
  },
  streakStart: {
    fontFamily: font.semibold,
    fontSize: 12,
    color: colors.muted,
  },
});
