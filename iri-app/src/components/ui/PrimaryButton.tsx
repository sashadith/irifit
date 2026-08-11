import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, radius, typography } from '@/theme';

export interface PrimaryButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
  readonly loading?: boolean;
  readonly style?: ViewStyle;
  /** Optionales Symbol links vom Text (z. B. KI-Sternchen) */
  readonly icon?: ReactNode;
}

/** Pill-CTA im Rosé-Verlauf (Design-Entscheidung Sascha 05.08.: ein Akzent statt dunkler Buttons) */
export function PrimaryButton({ label, onPress, disabled, loading, style, icon }: PrimaryButtonProps) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive }}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      disabled={inactive}
      style={({ pressed }) => [styles.shadow, pressed && styles.pressed, inactive && styles.disabled, style]}
    >
      <LinearGradient
        colors={colors.roseGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.inner}
      >
        {loading ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <>
            {icon}
            <Text style={typography.button}>{label}</Text>
          </>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadow: {
    borderRadius: radius.pill,
    shadowColor: '#D25578',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 13,
    elevation: 6,
  },
  inner: {
    flexDirection: 'row',
    gap: 8,
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.18)',
  },
  pressed: {
    transform: [{ translateY: 1 }],
  },
  disabled: {
    opacity: 0.4,
  },
});
