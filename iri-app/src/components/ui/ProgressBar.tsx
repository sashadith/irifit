import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

export interface ProgressBarProps {
  /** 0..1 */
  readonly progress: number;
}

/** Schmaler Fortschrittsbalken oben im Onboarding (.progress im Prototyp) */
export function ProgressBar({ progress }: ProgressBarProps) {
  return (
    <View style={styles.track} accessibilityRole="progressbar">
      <View style={[styles.fill, { width: `${Math.min(100, Math.max(0, progress * 100))}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.track,
    marginBottom: 34,
  },
  fill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: colors.tintDeep,
  },
});
