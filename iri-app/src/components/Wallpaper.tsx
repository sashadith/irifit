import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

import { colors } from '@/theme';

interface Blob {
  readonly id: string;
  readonly color: string;
  readonly opacity: number;
  readonly cx: string;
  readonly cy: string;
  readonly rx: string;
  readonly ry: string;
}

/** Radial-Verläufe aus dem Prototyp: radial-gradient(RX RY at CX CY, Farbe, transparent 70%) */
const blobs: readonly Blob[] = [
  { id: 'rose', color: colors.wallpaper.rose, opacity: 0.8, cx: '18%', cy: '8%', rx: '56%', ry: '38%' },
  { id: 'lilac', color: colors.wallpaper.lilac, opacity: 0.8, cx: '88%', cy: '22%', rx: '50%', ry: '36%' },
  { id: 'peach', color: colors.wallpaper.peach, opacity: 0.75, cx: '70%', cy: '88%', rx: '60%', ry: '42%' },
  { id: 'mauve', color: colors.wallpaper.mauve, opacity: 0.7, cx: '12%', cy: '72%', rx: '46%', ry: '34%' },
];

/**
 * Weiches Pastell-Wallpaper hinter allen Glas-Panels
 * (Rosé/Flieder/Pfirsich auf warmem Grundverlauf).
 */
export function Wallpaper() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={colors.wallpaper.base}
        start={{ x: 0.4, y: 0 }}
        end={{ x: 0.6, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Svg width="100%" height="100%">
        <Defs>
          {blobs.map((b) => (
            <RadialGradient key={b.id} id={b.id} cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={b.color} stopOpacity={b.opacity} />
              <Stop offset="70%" stopColor={b.color} stopOpacity={b.opacity * 0.35} />
              <Stop offset="100%" stopColor={b.color} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {blobs.map((b) => (
          <Ellipse key={b.id} cx={b.cx} cy={b.cy} rx={b.rx} ry={b.ry} fill={`url(#${b.id})`} />
        ))}
      </Svg>
    </View>
  );
}
