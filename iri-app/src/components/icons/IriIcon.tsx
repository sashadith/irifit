import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '@/theme';

/** Pfade 1:1 aus IRI-Prototyp.html (svg.iri, viewBox 24, stroke 1.3, round) */
const ICONS = {
  home: {
    paths: [
      'M4.5 11.5C7 8.8 9.5 6.3 12 4.2c2.5 2.1 5 4.6 7.5 7.3M6.3 10.2V18a2 2 0 0 0 2 2h7.4a2 2 0 0 0 2-2v-7.8M10.3 20v-4.2a1.7 1.7 0 0 1 3.4 0V20',
    ],
  },
  book: {
    paths: [
      'M12 6.8C10.3 5.1 7.8 4.6 5 4.7v13.2c2.8-.1 5.3.4 7 2.1 1.7-1.7 4.2-2.2 7-2.1V4.7c-2.8-.1-5.3.4-7 2.1zM12 6.8v13.2M7.3 8.6c1.2.1 2.3.4 3.2.9M16.7 8.6c-1.2.1-2.3.4-3.2.9',
    ],
  },
  play: {
    circles: [{ cx: 12, cy: 12, r: 8.7 }],
    paths: ['M10.4 8.9c1.7.9 3.2 1.9 4.6 3.1-1.4 1.2-2.9 2.2-4.6 3.1z'],
  },
  user: {
    circles: [{ cx: 12, cy: 7.9, r: 3.4 }],
    paths: ['M5.2 20.2c1-3.9 3.6-5.9 6.8-5.9s5.8 2 6.8 5.9'],
  },
  bowl: {
    paths: [
      'M4.5 12.8h15a7.5 7.5 0 0 1-15 0zM9.5 20.4h5M10.1 9.4c-.6-.8-.6-1.7.1-2.4.6-.6.7-1.4.2-2.1M13.8 9.4c-.6-.8-.6-1.7.1-2.4.6-.6.7-1.4.2-2.1',
    ],
  },
  leaf: {
    paths: [
      'M6.2 16.2C6 9.5 11 5.8 18 6c.3 7-3.4 12-10.1 11.8-.7 0-1.3-.1-1.7-.2M6.2 16.2C8.7 13 12 10.5 15.3 9',
    ],
  },
  plate: {
    circles: [
      { cx: 12, cy: 12, r: 8.6 },
      { cx: 12, cy: 12, r: 4.2 },
    ],
  },
  cherry: {
    circles: [
      { cx: 8.8, cy: 16.2, r: 2.9 },
      { cx: 15.8, cy: 15.4, r: 2.9 },
    ],
    paths: [
      'M8.8 13.3c.4-3.4 2.4-6.1 5.7-7.9M15.8 12.5c-.3-2.5.2-4.8 1.7-6.7M14.5 5.4c1.4-.9 2.9-1.2 4.4-.8-.5 1.5-1.6 2.6-3.2 3',
    ],
  },
  drop: {
    paths: [
      'M12 3.8c3.4 4 5.7 7 5.7 10a5.7 5.7 0 0 1-11.4 0c0-3 2.3-6 5.7-10zM9.4 13.4c0 1.7.9 3 2.4 3.5',
    ],
  },
  flame: {
    paths: [
      'M12 3.6c.5 2.9 2.1 4.5 3.6 6.1 1.4 1.5 2.4 3 2.4 5a6 6 0 0 1-12 0c0-1.7.7-3.2 1.8-4.4.2 1 .7 1.8 1.4 2.3-.2-3.3 1-6.5 2.8-9z',
    ],
  },
  chart: {
    circles: [{ cx: 19.5, cy: 6.5, r: 1.1 }],
    paths: ['M4.5 17.5C8 17 9.5 12.5 12.5 11s5-1.5 6.8-4.3'],
  },
  search: {
    circles: [{ cx: 10.8, cy: 10.8, r: 5.8 }],
    paths: ['M15.2 15.2 19.8 19.8'],
  },
  scales: {
    paths: [
      'M12 4.6v14.8M7.8 19.4h8.4M12 5.2 6.2 7.3M12 5.2l5.8 2.1M6.2 7.3l-1.9 4.6a2.75 2.75 0 0 0 3.8 0zM17.8 7.3l-1.9 4.6a2.75 2.75 0 0 0 3.8 0z',
    ],
  },
  sparkle: {
    paths: [
      'M12 4.5c.7 3.4 3.1 5.8 6.5 6.5-3.4.7-5.8 3.1-6.5 6.5-.7-3.4-3.1-5.8-6.5-6.5 3.4-.7 5.8-3.1 6.5-6.5z',
    ],
  },
  sparkleDuo: {
    paths: [
      'M15.2 2.6c.8 3.5 3.1 5.8 6.6 6.6-3.5.8-5.8 3.1-6.6 6.6-.8-3.5-3.1-5.8-6.6-6.6 3.5-.8 5.8-3.1 6.6-6.6z',
      'M6.6 14.4c.5 2.1 1.9 3.5 4 4-2.1.5-3.5 1.9-4 4-.5-2.1-1.9-3.5-4-4 2.1-.5 3.5-1.9 4-4z',
    ],
  },
  plus: {
    paths: ['M12 5v14M5 12h14'],
  },
  calendar: {
    paths: [
      'M5 6.8h14a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7.8a1 1 0 0 1 1-1zM4 10.6h16M8.3 4.4v3.4M15.7 4.4v3.4',
    ],
  },
  target: {
    circles: [
      { cx: 12, cy: 12, r: 8.5 },
      { cx: 12, cy: 12, r: 4.8 },
    ],
    paths: ['M12 11.2a.8.8 0 1 0 0 1.6.8.8 0 0 0 0-1.6z'],
  },
  bell: {
    paths: [
      'M12 4.2a5.4 5.4 0 0 1 5.4 5.4c0 3.1.7 4.7 1.6 5.8H5c.9-1.1 1.6-2.7 1.6-5.8A5.4 5.4 0 0 1 12 4.2zM10 18.6a2.1 2.1 0 0 0 4 0',
    ],
  },
  // Plus-Menue (Sascha 11.08.): Kamera/Kuehlschrank mit KI-Sternchen,
  // Barcode, Lupe mit Apfel — Bogen-Auswahl statt Kamera-Sofortstart
  cameraAi: {
    circles: [{ cx: 10.4, cy: 13, r: 2.7 }],
    paths: [
      'M6.4 8.6 7.7 6.7h5.4l1.3 1.9h1.9a1.2 1.2 0 0 1 1.2 1.2v7.2a1.2 1.2 0 0 1-1.2 1.2H4.5a1.2 1.2 0 0 1-1.2-1.2V9.8a1.2 1.2 0 0 1 1.2-1.2z',
      'M19.5 3.2c.3 1.3 1.2 2.2 2.5 2.5-1.3.3-2.2 1.2-2.5 2.5-.3-1.3-1.2-2.2-2.5-2.5 1.3-.3 2.2-1.2 2.5-2.5z',
    ],
  },
  barcode: {
    paths: [
      'M4.5 6.8v10.4M8 6.8v10.4M11 6.8v6.6M11 16.2v1M14 6.8v10.4M16.8 6.8v6.6M16.8 16.2v1M19.5 6.8v10.4',
    ],
  },
  fridgeAi: {
    paths: [
      'M6.6 4.8h8a1.2 1.2 0 0 1 1.2 1.2v13a1.2 1.2 0 0 1-1.2 1.2h-8A1.2 1.2 0 0 1 5.4 19V6a1.2 1.2 0 0 1 1.2-1.2zM5.4 10.6h10.4M8 7.3v1.4M8 13v2.6',
      'M19.5 3.2c.3 1.3 1.2 2.2 2.5 2.5-1.3.3-2.2 1.2-2.5 2.5-.3-1.3-1.2-2.2-2.5-2.5 1.3-.3 2.2-1.2 2.5-2.5z',
    ],
  },
  searchFood: {
    circles: [{ cx: 10.5, cy: 10.5, r: 6.2 }],
    paths: [
      'M15.2 15.2 19.8 19.8',
      'M10.5 8.9c-1.4-.8-2.8 0-2.8 1.7 0 1.5 1.1 3 2.8 3s2.8-1.5 2.8-3c0-1.7-1.4-2.5-2.8-1.7zM10.5 8.9c0-.9.4-1.6 1.2-2',
    ],
  },
  bag: {
    paths: [
      'M6.5 8.5h11l-.9 10a2 2 0 0 1-2 1.8H9.4a2 2 0 0 1-2-1.8z',
      'M9.3 8.5V7a2.7 2.7 0 0 1 5.4 0v1.5',
    ],
  },
} satisfies Record<string, { paths?: string[]; circles?: { cx: number; cy: number; r: number }[] }>;

export type IriIconName = keyof typeof ICONS;

export interface IriIconProps {
  readonly name: IriIconName;
  readonly size?: number;
  readonly color?: string;
  readonly strokeWidth?: number;
  readonly opacity?: number;
}

export function IriIcon({
  name,
  size = 24,
  color = colors.ink,
  strokeWidth = 1.3,
  opacity = 1,
}: IriIconProps) {
  const icon = ICONS[name] as { paths?: string[]; circles?: { cx: number; cy: number; r: number }[] };
  const strokeProps = {
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    fill: 'none',
  } as const;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" opacity={opacity}>
      {icon.circles?.map((c, i) => (
        <Circle key={`c${i}`} cx={c.cx} cy={c.cy} r={c.r} {...strokeProps} />
      ))}
      {icon.paths?.map((d, i) => (
        <Path key={`p${i}`} d={d} {...strokeProps} />
      ))}
    </Svg>
  );
}
