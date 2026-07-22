import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

import { GlassView } from '@/components/glass/GlassView';
import { colors, font, radius } from '@/theme';

export interface GhostButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly small?: boolean;
  readonly style?: ViewStyle;
}

/** Glas-Pill-Button (.btn.ghost im Prototyp) */
export function GhostButton({ label, onPress, small, style }: GhostButtonProps) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={style}>
      {({ pressed }) => (
        <GlassView
          borderRadius={radius.pill}
          style={pressed ? styles.pressed : undefined}
          contentStyle={styles.inner}
        >
          <Text style={[styles.label, small && styles.small]}>{label}</Text>
        </GlassView>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  inner: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  label: {
    fontFamily: font.semibold,
    fontSize: 15.5,
    color: colors.ink,
  },
  small: {
    fontSize: 13,
  },
  pressed: {
    opacity: 0.75,
  },
});
