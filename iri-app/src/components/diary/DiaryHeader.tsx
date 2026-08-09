import { useEffect } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { GlassView } from '@/components/glass/GlassView';
import { IriIcon } from '@/components/icons/IriIcon';
import { RoseHeart } from '@/components/ui/RoseHeart';
import { t } from '@/i18n';
import { colors, font, radius, typography } from '@/theme';

/** S16: Flamme atmet (Scale 1,0→1,04) — NUR bei aktiver Serie, die 0er bleibt still */
function BreathingFlame({ active }: { active: boolean }) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (active) {
      scale.value = withRepeat(
        withTiming(1.04, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
    } else {
      cancelAnimation(scale);
      scale.value = 1;
    }
    return () => cancelAnimation(scale);
  }, [active, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={style}>
      <IriIcon
        name="flame"
        size={16}
        color={active ? colors.tintDeep : colors.muted}
        opacity={active ? 1 : 0.7}
      />
    </Animated.View>
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
            <BreathingFlame active={streakCount > 0} />
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
        <Text style={[typography.displayLg, styles.greeting]} numberOfLines={1}>
          {greeting}
        </Text>
        <RoseHeart size={26} color={colors.tint} />
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
