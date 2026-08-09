import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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

const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

export interface DiaryHeaderProps {
  readonly date: Date;
  readonly isToday: boolean;
  readonly greeting: string;
  readonly streakCount: number;
  readonly onShiftDate: (days: number) => void;
}

/** Kopfbereich: blätterbares Datum, Begrüßung, Streak-Flamme (Prototyp s-home) */
export function DiaryHeader({ date, isToday, greeting, streakCount, onShiftDate }: DiaryHeaderProps) {

  const shift = (days: number) => {
    Haptics.selectionAsync();
    onShiftDate(days);
  };

  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <View style={styles.dateRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            onPress={() => shift(-1)}
            hitSlop={10}
          >
            <Text style={styles.chevron}>‹</Text>
          </Pressable>
          {/* S18: Datum als kleines Glas-Kästchen — der Tag in Italiana wie die
              großen Zahlen der App, statt anonymer Versalien-Zeile */}
          <GlassView borderRadius={radius.md} contentStyle={styles.dateCard}>
            <Text style={styles.weekday}>{WEEKDAYS[date.getDay()].slice(0, 2).toUpperCase()}</Text>
            <Text style={styles.dayNumber}>{date.getDate()}</Text>
            <Text style={styles.month}>{MONTHS[date.getMonth()]}</Text>
          </GlassView>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.next')}
            onPress={() => shift(1)}
            hitSlop={10}
            style={!isToday ? undefined : styles.hidden}
          >
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </View>
        <Text style={[typography.displayMd, styles.greeting]}>
          {greeting} <RoseHeart />
        </Text>
      </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  left: {
    flex: 1,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateCard: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  weekday: {
    fontFamily: font.bold,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.muted,
  },
  dayNumber: {
    fontFamily: font.display,
    fontSize: 22,
    lineHeight: 26,
    color: colors.ink,
  },
  month: {
    fontFamily: font.semibold,
    fontSize: 12.5,
    color: colors.muted,
  },
  chevron: {
    fontFamily: font.bold,
    fontSize: 18,
    color: colors.muted,
    paddingHorizontal: 2,
  },
  hidden: {
    opacity: 0,
  },
  greeting: {
    marginTop: 4,
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
