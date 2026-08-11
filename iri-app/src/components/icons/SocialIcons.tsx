import Svg, { Circle, Path, Rect } from 'react-native-svg';

/**
 * Kleine Social-Marken in Weiß für die Rosé-Pills (Über Irina, 11.08.).
 * Bewusst als schlichte Outline-Zeichen — vollfarbige Markenlogos wirken auf
 * den Pills unruhig und Instagram/TikTok erlauben einfarbige Glyphen.
 */
export function InstagramIcon({ size = 14, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={3} y={3} width={18} height={18} rx={5.5} fill="none" stroke={color} strokeWidth={2} />
      <Circle cx={12} cy={12} r={4.2} fill="none" stroke={color} strokeWidth={2} />
      <Circle cx={17.2} cy={6.8} r={1.4} fill={color} />
    </Svg>
  );
}

export function TikTokIcon({ size = 14, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M14.5 3v10.6a3.6 3.6 0 1 1-3.6-3.6"
        fill="none"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
      <Path
        d="M14.5 5.2c.7 2 2.4 3.3 4.5 3.5"
        fill="none"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function GlobeIcon({ size = 14, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={8.5} fill="none" stroke={color} strokeWidth={2} />
      <Path
        d="M3.5 12h17M12 3.5c-2.5 2.3-3.8 5.2-3.8 8.5s1.3 6.2 3.8 8.5c2.5-2.3 3.8-5.2 3.8-8.5S14.5 5.8 12 3.5z"
        fill="none"
        stroke={color}
        strokeWidth={1.6}
      />
    </Svg>
  );
}
