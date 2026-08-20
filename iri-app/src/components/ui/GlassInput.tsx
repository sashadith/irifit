import { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { IriIcon } from '@/components/icons/IriIcon';
import { t } from '@/i18n';
import { colors, font, radius } from '@/theme';

export interface GlassInputProps extends TextInputProps {
  readonly label: string;
  /** Einheit rechts im Feld, z. B. "cm" oder "kg" */
  readonly unit?: string;
}

/** Eingabefeld im Glas-Look (Suchfeld-Stil des Prototyps) */
export const GlassInput = forwardRef<TextInput, GlassInputProps>(function GlassInput(
  { label, unit, style, secureTextEntry, ...inputProps },
  ref,
) {
  /* Augenzeichen bei Passwortfeldern (Sascha 20.08.). Auf dem Telefon vertippt
     man sich bei verdeckter Eingabe staendig — und wer sein Passwort nicht
     pruefen kann, waehlt ein kuerzeres. Sichtbarkeit ist hier also nicht das
     Gegenteil von Sicherheit, sondern Voraussetzung dafuer.
     Steht in GlassInput statt in den beiden Bildschirmen, damit Registrierung
     und Anmeldung sich nicht auseinanderentwickeln. */
  const [sichtbar, setSichtbar] = useState(false);
  const istPasswort = secureTextEntry === true;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.field}>
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={colors.muted2}
          style={[styles.input, style]}
          secureTextEntry={istPasswort && !sichtbar}
          {...inputProps}
        />
        {istPasswort ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(sichtbar ? 'common.passwordHide' : 'common.passwordShow')}
            onPress={() => setSichtbar((s) => !s)}
            hitSlop={12}
            style={styles.auge}
          >
            <IriIcon name={sichtbar ? 'eyeOff' : 'eye'} size={19} color={colors.muted} />
          </Pressable>
        ) : null}
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
  auge: {
    marginLeft: 8,
  },
  unit: {
    fontFamily: font.bold,
    fontSize: 13,
    color: colors.muted,
    marginLeft: 8,
  },
});
