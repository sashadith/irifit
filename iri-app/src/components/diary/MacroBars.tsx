import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

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

/** S16: Balken wächst von links, je Karte ~100 ms versetzt */
function MacroFill({ ratio, color, index }: { ratio: number; color: string; index: number }) {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withDelay(
      index * 100,
      withTiming(ratio, { duration: 500, easing: Easing.out(Easing.cubic) }),
    );
  }, [ratio, index, width]);

  const style = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));

  return <Animated.View style={[styles.fill, { backgroundColor: color }, style]} />;
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
      {macros.map((macro, index) => {
        const ratio = macro.goal > 0 ? Math.min(1, macro.current / macro.goal) : 0;
        return (
          <GlassView key={macro.label} borderRadius={radius.md} style={styles.card} contentStyle={styles.content}>
            <Text style={styles.label}>{macro.label}</Text>
            <Text style={styles.value}>
              {t('home.macroValue', { current: Math.round(macro.current), goal: macro.goal })}
            </Text>
            <View style={styles.track}>
              <MacroFill ratio={ratio} color={macro.color} index={index} />
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
    alignItems: 'center', // Beta-Feedback 09.08.: Inhalte zentriert
  },
  label: {
    fontFamily: font.bold,
    fontSize: 9,
    letterSpacing: 0.4,
    color: colors.muted,
    textAlign: 'center',
  },
  value: {
    fontFamily: font.bold,
    fontSize: 13.5,
    color: colors.ink,
    marginVertical: 5,
  },
  track: {
    alignSelf: 'stretch',
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.track,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
});
