import { StyleProp, View, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors } from '@/theme';

/**
 * Herz in IRI-Rosé — seit 09.08. als SVG statt Textglyphe: die ♥-Glyphe sah je
 * nach Kontext/Schrift unterschiedlich aus (Beta-Befund; das runde, volle Herz
 * aus dem Profil ist die Referenz). Als View mit fester Groesse funktioniert es
 * auch inline in <Text>.
 */
export function RoseHeart({
  size = 16,
  color = colors.tint,
  style,
}: {
  readonly size?: number;
  readonly color?: string;
  readonly style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d="M12 21C6.6 16.5 2 12.7 2 8.3 2 5.3 4.4 3 7.3 3 9.2 3 10.9 3.9 12 5.4 13.1 3.9 14.8 3 16.7 3 19.6 3 22 5.3 22 8.3 22 12.7 17.4 16.5 12 21Z"
          fill={color}
        />
      </Svg>
    </View>
  );
}
