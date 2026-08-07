import { StyleSheet, Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { t } from '@/i18n';
import { colors, font } from '@/theme';

export interface SattScoreDotsProps {
  readonly score: number;
  /** Mit Label „Satt-Score" davor (Detail/Scan) oder nackt (Grid-Karte) */
  readonly withLabel?: boolean;
  readonly size?: number;
  /** S16: Punkte füllen sich nacheinander (nur im Scan-Ergebnis — Listen bleiben ruhig) */
  readonly animated?: boolean;
}

/** ●●●●○ — Sättigung pro Kalorie (USP) */
export function SattScoreDots({ score, withLabel = false, size = 6, animated = false }: SattScoreDotsProps) {
  return (
    <View
      style={styles.row}
      accessibilityLabel={`${t('recipes.sattScore')}: ${score} von 5`}
    >
      {withLabel ? <Text style={styles.label}>{t('recipes.sattScore')}</Text> : null}
      <View style={styles.dots}>
        {[1, 2, 3, 4, 5].map((i) => {
          const dotStyle = [
            { width: size, height: size, borderRadius: size / 2 },
            i <= score ? styles.filled : styles.empty,
          ];
          return animated && i <= score ? (
            <Animated.View key={i} entering={ZoomIn.delay(200 + i * 120).springify().damping(12)} style={dotStyle} />
          ) : (
            <View key={i} style={dotStyle} />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  label: {
    fontFamily: font.bold,
    fontSize: 11,
    letterSpacing: 0.5,
    color: colors.muted,
  },
  dots: {
    flexDirection: 'row',
    gap: 3,
  },
  filled: {
    backgroundColor: colors.tintDeep,
  },
  empty: {
    backgroundColor: colors.track,
  },
});
