import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { GlassView } from '@/components/glass/GlassView';
import { IriIcon } from '@/components/icons/IriIcon';
import { t } from '@/i18n';
import { colors, font, radius } from '@/theme';

export interface WaterCardProps {
  readonly currentMl: number;
  readonly goalMl: number;
  readonly glassMl: number;
  readonly onSetAmount: (amountMl: number) => void;
}

const formatLiters = (ml: number) =>
  (ml / 1000).toLocaleString('de-DE', { maximumFractionDigits: 2 });

/**
 * Wasser-Widget (Prototyp .water): Reihe von Gläsern, Tap füllt bis zum
 * angetippten Glas; Tap auf das letzte volle Glas leert es wieder.
 */
export function WaterCard({ currentMl, goalMl, glassMl, onSetAmount }: WaterCardProps) {
  const glassCount = Math.max(1, Math.round(goalMl / glassMl));
  const filled = Math.round(currentMl / glassMl);

  const tapGlass = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = index + 1 === filled ? index : index + 1;
    onSetAmount(next * glassMl);
  };

  return (
    <GlassView borderRadius={radius.md} style={styles.card} contentStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <IriIcon name="drop" size={17} color={colors.water} />
          <Text style={styles.title}>{t('home.water')}</Text>
        </View>
        <Text style={styles.amount}>
          {t('home.waterAmount', { current: formatLiters(currentMl), goal: formatLiters(goalMl) })}
        </Text>
      </View>
      <View style={styles.glasses}>
        {Array.from({ length: glassCount }, (_, i) => {
          const isFull = i < filled;
          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={`${t('home.water')} ${i + 1}`}
              accessibilityState={{ selected: isFull }}
              onPress={() => tapGlass(i)}
              style={styles.glassSlot}
            >
              {isFull ? (
                <LinearGradient
                  colors={['rgba(122,206,222,0.85)', 'rgba(90,178,200,0.9)']}
                  style={styles.glass}
                />
              ) : (
                <View style={[styles.glass, styles.glassEmpty]} />
              )}
            </Pressable>
          );
        })}
      </View>
    </GlassView>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 14,
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  title: {
    fontFamily: font.bold,
    fontSize: 14,
    color: colors.ink,
  },
  amount: {
    fontFamily: font.bold,
    fontSize: 12,
    color: colors.muted,
  },
  glasses: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 10,
  },
  glassSlot: {
    flex: 1,
    maxWidth: 34,
  },
  glass: {
    height: 38,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 11,
    borderBottomRightRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  glassEmpty: {
    backgroundColor: colors.track,
  },
});
