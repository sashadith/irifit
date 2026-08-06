import { StyleProp, Text, TextStyle } from 'react-native';

import { colors } from '@/theme';

/**
 * Herz in IRI-Rosé statt Emoji: U+2665 + VS15 erzwingt die Text-Darstellung,
 * dadurch ist das Herz per color färbbar (Emoji ignorieren Textfarbe).
 * Als verschachtelter <Text> erbt es Schriftgröße/Baseline vom Eltern-Text.
 */
export function RoseHeart({ style }: { readonly style?: StyleProp<TextStyle> }) {
  return <Text style={[{ color: colors.tint }, style]}>{'♥︎'}</Text>;
}
