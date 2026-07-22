import { StyleSheet, Text, View } from 'react-native';

import { GlassView } from '@/components/glass/GlassView';
import { t } from '@/i18n';
import { colors, font, radius } from '@/theme';

interface Macro {
  readonly label: string;
  readonly current: number;
  readonly goal: number;
  readonly color: string;
}

export interface MacroBarsProps {
  readonly protein: { current: number; goal: number };
  readonly carbs: { current: number; goal: number };
  readonly fat: { current: number; goal: number };
}

/** Drei Makro-Balken (Prototyp .macros): Carbs Gelb · Protein Rosé · Fett Türkis */
export function MacroBars({ protein, carbs, fat }: MacroBarsProps) {
  const macros: Macro[] = [
    { label: t('home.macroCarbs'), ...carbs, color: colors.carbs },
    { label: t('home.macroProtein'), ...protein, color: colors.tintDeep },
    { label: t('home.macroFat'), ...fat, color: colors.water },
  ];

  return (
    <View style={styles.row}>
      {macros.map((macro) => {
        const ratio = macro.goal > 0 ? Math.min(1, macro.current / macro.goal) : 0;
        return (
          <GlassView key={macro.label} borderRadius={radius.md} style={styles.card} contentStyle={styles.content}>
            <Text style={styles.label}>{macro.label}</Text>
            <Text style={styles.value}>
              {t('home.macroValue', { current: Math.round(macro.current), goal: macro.goal })}
            </Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: macro.color }]} />
            </View>
          </GlassView>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 18,
  },
  card: {
    flex: 1,
  },
  content: {
    padding: 12,
  },
  label: {
    fontFamily: font.bold,
    fontSize: 10,
    letterSpacing: 0.5,
    color: colors.muted,
  },
  value: {
    fontFamily: font.bold,
    fontSize: 13.5,
    color: colors.ink,
    marginVertical: 5,
  },
  track: {
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.track,
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
});
