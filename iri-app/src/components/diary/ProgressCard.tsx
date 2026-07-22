import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassView } from '@/components/glass/GlassView';
import { IriIcon } from '@/components/icons/IriIcon';
import { t } from '@/i18n';
import { colors, font, radius } from '@/theme';

export interface ProgressCardProps {
  /** Differenz aktuelles Gewicht − Startgewicht (negativ = abgenommen) */
  readonly deltaKg: number | null;
  readonly targetWeightKg: number | null;
  readonly onPress: () => void;
}

const formatDelta = (delta: number) => {
  const rounded = Math.round(delta * 10) / 10;
  const abs = Math.abs(rounded).toLocaleString('de-DE', { minimumFractionDigits: 1 });
  if (rounded === 0) return `±${abs}`;
  return rounded < 0 ? `−${abs}` : `+${abs}`;
};

/** Fortschritts-Karte (Prototyp) — öffnet den Fortschritt-Screen */
export function ProgressCard({ deltaKg, targetWeightKg, onPress }: ProgressCardProps) {
  const text =
    deltaKg !== null && targetWeightKg !== null
      ? t('home.progressText', {
          delta: formatDelta(deltaKg),
          target: targetWeightKg.toLocaleString('de-DE'),
        })
      : t('home.progressNoData');

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t('home.progressTitle')} onPress={onPress}>
      {({ pressed }) => (
        <GlassView
          borderRadius={radius.md}
          style={[styles.card, pressed && styles.pressed]}
          contentStyle={styles.content}
        >
          <View style={styles.iconBubble}>
            <IriIcon name="chart" size={20} color={colors.tintDeep} />
          </View>
          <View style={styles.textWrap}>
            <Text style={styles.title}>{t('home.progressTitle')}</Text>
            <Text style={styles.subtitle}>{text}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </GlassView>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 14,
  },
  pressed: {
    opacity: 0.75,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderWidth: 1,
    borderColor: colors.stroke,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontFamily: font.bold,
    fontSize: 14,
    color: colors.ink,
  },
  subtitle: {
    fontFamily: font.regular,
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  chevron: {
    fontFamily: font.bold,
    fontSize: 18,
    color: colors.muted,
  },
});
