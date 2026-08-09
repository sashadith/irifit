import { StyleProp, Text, TextStyle } from 'react-native';

import { colors } from '@/theme';

/**
 * Herz in IRI-Rosé statt Emoji: U+2665 + VS15 erzwingt die Text-Darstellung,
 * dadurch ist das Herz per color färbbar (Emoji ignorieren Textfarbe).
 * Als verschachtelter <Text> erbt es Schriftgröße/Baseline vom Eltern-Text.
 */
export function RoseHeart({
  style,
  wide = false,
}: {
  readonly style?: StyleProp<TextStyle>;
  /** 20 % breiter — Wunsch Sascha 09.08. für die Begrüßung */
  readonly wide?: boolean;
}) {
  return (
    <Text style={[{ color: colors.tint }, wide && { transform: [{ scaleX: 1.2 }] }, style]}>
      {'♥︎'}
    </Text>
  );
}
