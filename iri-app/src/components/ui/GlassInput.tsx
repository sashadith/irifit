import { forwardRef } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { colors, font, radius } from '@/theme';

export interface GlassInputProps extends TextInputProps {
  readonly label: string;
  /** Einheit rechts im Feld, z. B. "cm" oder "kg" */
  readonly unit?: string;
}

/** Eingabefeld im Glas-Look (Suchfeld-Stil des Prototyps) */
export const GlassInput = forwardRef<TextInput, GlassInputProps>(function GlassInput(
  { label, unit, style, ...inputProps },
  ref,
) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.field}>
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={colors.muted2}
          style={[styles.input, style]}
          {...inputProps}
        />
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 12,
  },
  label: {
    fontFamily: font.bold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.muted,
    marginBottom: 6,
    marginLeft: 6,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: radius.pill,
    paddingHorizontal: 18,
  },
  input: {
    flex: 1,
    paddingVertical: 13,
    fontFamily: font.semibold,
    fontSize: 15,
    color: colors.ink,
  },
  unit: {
    fontFamily: font.bold,
    fontSize: 13,
    color: colors.muted,
    marginLeft: 8,
  },
});
