import { StyleSheet, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { GlassView } from '@/components/glass/GlassView';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { t } from '@/i18n';
import { colors, font, radius, spacing, typography } from '@/theme';

/**
 * Rechtstexte in der App (Session 15). Supabase liefert Browsern für HTML
 * grundsätzlich text/plain (Anti-Phishing) — darum natives Rendering statt
 * Web-Link; die kanonische Web-Fassung zieht mit S17 auf irinaskorik.com.
 * Format der Strings in de.json: "## " beginnt eine Überschrift,
 * Leerzeilen trennen Absätze.
 */
export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc?: string }>();
  const isTerms = doc === 'terms';
  const title = t(isTerms ? 'legal.termsTitle' : 'legal.privacyTitle');
  const body = t(isTerms ? 'legal.termsBody' : 'legal.privacyBody');
  const blocks = body.split('\n\n');

  return (
    <ScreenScaffold withTabBarInset={false}>
      <Text style={[typography.displayLg, styles.title]}>{title}</Text>
      <GlassView borderRadius={radius.md} contentStyle={styles.card}>
        {blocks.map((block, i) =>
          block.startsWith('## ') ? (
            <Text key={i} style={styles.heading}>
              {block.slice(3)}
            </Text>
          ) : (
            <Text key={i} style={styles.paragraph}>
              {block}
            </Text>
          ),
        )}
      </GlassView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  title: {
    marginBottom: spacing.lg,
  },
  card: {
    padding: spacing.lg,
  },
  heading: {
    fontFamily: font.bold,
    fontSize: 15,
    color: colors.ink,
    marginTop: 16,
    marginBottom: 4,
  },
  paragraph: {
    fontFamily: font.regular,
    fontSize: 13.5,
    lineHeight: 21,
    color: colors.muted,
    marginBottom: 8,
  },
});
