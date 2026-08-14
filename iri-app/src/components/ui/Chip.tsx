import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { colors, font, radius } from '@/theme';

export interface ChipProps {
  readonly label: string;
  readonly selected: boolean;
  readonly onPress: () => void;
  /** Optionales Symbol vor dem Text (z. B. das Herz bei „Favoriten") */
  readonly icon?: ReactNode;
}

/** Filter-/Auswahl-Chip (.chip im Prototyp) — gewählt: Ink auf Weiß invertiert */
export function Chip({ label, selected, onPress, icon }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      {icon ? (
        <View style={styles.withIcon}>
          {icon}
          <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
        </View>
      ) : (
        <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  withIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  chipSelected: {
    backgroundColor: colors.tintDeep,
    borderColor: colors.tintDeep,
  },
  label: {
    fontFamily: font.semibold,
    fontSize: 13,
    color: colors.ink,
  },
  labelSelected: {
    color: colors.white,
  },
});
