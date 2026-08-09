/**
 * IRI Design-Tokens — Quelle: IRI-Prototyp.html (eingefroren 18.07.2026).
 * Apple Liquid Glass: Glas-Panels über Pastell-Wallpaper, ein Akzent (Rosé-Verlauf).
 */
import { Platform, TextStyle, ViewStyle } from 'react-native';

export const colors = {
  ink: '#1C1C21',
  muted: 'rgba(60,60,67,0.6)',
  muted2: 'rgba(60,60,67,0.4)',
  tint: '#E87F9C',
  tintDeep: '#D25578',
  water: '#5AC8DE',
  ok: '#4CAF7D',
  carbs: '#E8B45C',
  white: '#FFFFFF',
  glass: 'rgba(255,255,255,0.58)',
  glassStrong: 'rgba(255,255,255,0.78)',
  /**
   * Android-Fallback: DECKENDE, vorberechnete Töne aus dem Wallpaper-Pastell —
   * semitransparentes Weiß stapelt bei Karte-in-Karte sichtbar Alpha (Farbstufen).
   * Je Verschachtelungsebene ein fester Ton, Auswahl übernimmt GlassView per Context.
   */
  glassAndroid: '#FBF6F8',
  glassStrongAndroid: '#FDFAFB',
  glassNestedAndroid: '#FDFBFC',
  glassNestedStrongAndroid: '#FFFFFF',
  stroke: 'rgba(255,255,255,0.75)',
  track: 'rgba(120,120,128,0.16)',
  buttonDark: ['#2A2A30', '#1C1C21'] as const,
  roseGradient: ['#E87F9C', '#D25578'] as const,
  wallpaper: {
    base: ['#FAF3F2', '#F4ECEE'] as const,
    rose: '#F4BBCD', // rgba(244,187,205,.8) @ 18% 8%
    lilac: '#D6C6E8', // rgba(214,198,232,.8) @ 88% 22%
    peach: '#FAD6C4', // rgba(250,214,196,.75) @ 70% 88%
    mauve: '#ECD0DE', // rgba(236,208,222,.7) @ 12% 72%
  },
} as const;

export const radius = {
  lg: 28,
  md: 20,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  screenX: 20,
} as const;

/** Headlines + große Zahlen: Antic Didone (Entscheidung Sascha 09.08., vorher Italiana) · ALLER UI-Text inkl. Buttons: Manrope */
export const font = {
  display: 'AnticDidone_400Regular',
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
} as const;

export const typography = {
  displayXl: {
    fontFamily: font.display,
    fontSize: 32,
    lineHeight: 37,
    letterSpacing: 0.2,
    color: colors.ink,
  } satisfies TextStyle,
  displayLg: {
    fontFamily: font.display,
    fontSize: 26,
    lineHeight: 31,
    letterSpacing: 0.2,
    color: colors.ink,
  } satisfies TextStyle,
  displayMd: {
    fontFamily: font.display,
    fontSize: 24,
    lineHeight: 29,
    letterSpacing: 0.2,
    color: colors.ink,
  } satisfies TextStyle,
  /** Große Zahlen (z. B. Kalorien-Ring) */
  displayNum: {
    fontFamily: font.display,
    fontSize: 52,
    color: colors.ink,
  } satisfies TextStyle,
  eyebrow: {
    fontFamily: font.bold,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.muted,
  } satisfies TextStyle,
  body: {
    fontFamily: font.regular,
    fontSize: 14.5,
    lineHeight: 23,
    color: colors.ink,
  } satisfies TextStyle,
  bodyMuted: {
    fontFamily: font.regular,
    fontSize: 13.5,
    lineHeight: 21,
    color: colors.muted,
  } satisfies TextStyle,
  button: {
    fontFamily: font.bold,
    fontSize: 15.5,
    color: colors.white,
  } satisfies TextStyle,
  tabLabel: {
    fontFamily: font.semibold,
    fontSize: 10,
  } satisfies TextStyle,
} as const;

/** --sh: 0 10px 34px rgba(30,32,40,.14) */
export const glassShadow: ViewStyle = Platform.select({
  ios: {
    shadowColor: '#1E2028',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 17,
  },
  default: { elevation: 6, shadowColor: '#1E2028' },
});

/** Rosé-CTA-Schatten: 0 10px 24px rgba(210,85,120,.45) */
export const tintShadow: ViewStyle = Platform.select({
  ios: {
    shadowColor: '#D25578',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
  },
  default: { elevation: 8, shadowColor: '#D25578' },
});

/** --blur: blur(26px) — expo-blur-Intensität (nur iOS wirksam) */
export const blurIntensity = 50;
