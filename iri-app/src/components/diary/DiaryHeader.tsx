import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { GlassView } from '@/components/glass/GlassView';
import { IriIcon } from '@/components/icons/IriIcon';
import { t } from '@/i18n';
import { colors, font, radius, typography } from '@/theme';

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
  const dateLabel = `${WEEKDAYS[date.getDay()]}, ${date.getDate()}. ${MONTHS[date.getMonth()]}`;

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
          <Text style={typography.eyebrow}>{dateLabel}</Text>
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
        <Text style={[typography.displayMd, styles.greeting]}>{greeting}</Text>
      </View>
      <GlassView borderRadius={radius.pill} contentStyle={styles.streak}>
        <IriIcon
          name="flame"
          size={16}
          color={streakCount > 0 ? colors.tintDeep : colors.muted}
          opacity={streakCount > 0 ? 1 : 0.7}
        />
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
