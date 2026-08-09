import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { GlassView } from '@/components/glass/GlassView';
import { Chip } from '@/components/ui/Chip';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { useAuth } from '@/features/auth/AuthProvider';
import { MealSlot } from '@/features/diary/useDiaryDay';
import { FoodSource, logFood } from '@/features/food/foodData';
import { FoodItem, nutrientsForAmount } from '@/features/food/off';
import { t, TranslationKey } from '@/i18n';
import { colors, font, radius, spacing, typography } from '@/theme';

const SLOT_LABELS: Record<MealSlot, TranslationKey> = {
  breakfast: 'home.slotBreakfast',
  lunch: 'home.slotLunch',
  dinner: 'home.slotDinner',
  snack: 'home.slotSnack',
};

function defaultSlot(now = new Date()): MealSlot {
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes < 10.5 * 60) return 'breakfast';
  if (minutes < 15 * 60) return 'lunch';
  if (minutes < 21.5 * 60) return 'dinner';
  return 'snack';
}

export interface FoodSheetProps {
  readonly item: FoodItem;
  readonly source: FoodSource;
  readonly isFavorite: boolean;
  readonly onToggleFavorite: () => void;
  readonly onLogged: () => void;
}

/** Portionieren + Eintragen eines Lebensmittels (Barcode-Treffer oder Suchergebnis) */
export function FoodSheet({ item, source, isFavorite, onToggleFavorite, onLogged }: FoodSheetProps) {
  const { session } = useAuth();
  const [grams, setGrams] = useState(() => String(item.servingG ?? 100));
  const [slot, setSlot] = useState<MealSlot>(defaultSlot());
  const [busy, setBusy] = useState(false);

  const parsedGrams = Number(grams.replace(',', '.'));
  const validGrams = Number.isFinite(parsedGrams) && parsedGrams > 0 && parsedGrams <= 5000;
  const nutrients = useMemo(
    () => (validGrams ? nutrientsForAmount(item, parsedGrams) : null),
    [item, parsedGrams, validGrams],
  );

  // 50er-Raster (Sascha 09.08.): +/- springt auf das nächste Vielfache von 50;
  // krumme Werte (330-ml-Dose) kommen über das antippbare Zahlenfeld
  const adjust = (direction: 1 | -1) => {
    Haptics.selectionAsync();
    const current = validGrams ? parsedGrams : 100;
    const next =
      direction > 0
        ? Math.floor(current / 50) * 50 + 50
        : Math.ceil(current / 50) * 50 - 50;
    setGrams(String(Math.max(50, next)));
  };

  const submit = async () => {
    if (!session || !validGrams) return;
    setBusy(true);
    try {
      await logFood(session.user.id, item, parsedGrams, slot, source);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onLogged();
    } catch {
      Alert.alert(t('common.error'), t('food.searchError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <GlassView strong contentStyle={styles.content}>
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <Text style={[typography.displayLg, styles.name]} numberOfLines={2}>
            {item.name}
          </Text>
          {item.brand ? <Text style={styles.brand}>{item.brand}</Text> : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isFavorite ? t('food.favRemove') : t('food.favAdd')}
          accessibilityState={{ selected: isFavorite }}
          onPress={() => {
            Haptics.selectionAsync();
            onToggleFavorite();
          }}
          hitSlop={8}
          style={styles.starButton}
        >
          <Text style={[styles.star, isFavorite && styles.starActive]}>
            {isFavorite ? '★' : '☆'}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.per100}>
        {t('food.per100', {
          unit: item.unit,
          kcal: item.kcal100,
          protein: item.protein100,
          carbs: item.carbs100,
          fat: item.fat100,
        })}
      </Text>

      <View style={styles.amountRow}>
        <Text style={styles.amountLabel}>{t('food.amountLabel')}</Text>
        <View style={styles.stepper}>
          <Pressable accessibilityRole="button" accessibilityLabel="−" onPress={() => adjust(-1)} style={styles.stepButton}>
            <Text style={styles.stepButtonText}>−</Text>
          </Pressable>
          <View style={styles.gramsField}>
            <TextInput
              value={grams}
              onChangeText={setGrams}
              keyboardType="decimal-pad"
              style={styles.gramsInput}
              accessibilityLabel={t('food.amountLabel')}
              maxLength={5}
            />
            <Text style={styles.gramsUnit}>{item.unit}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="＋" onPress={() => adjust(1)} style={styles.stepButton}>
            <Text style={styles.stepButtonText}>＋</Text>
          </Pressable>
        </View>
        <Text style={[typography.displayMd, styles.kcal]}>
          {nutrients ? t('food.approxKcal', { kcal: nutrients.kcal.toLocaleString('de-DE') }) : '—'}
        </Text>
      </View>

      <View style={styles.slotChips}>
        {(Object.keys(SLOT_LABELS) as MealSlot[]).map((s) => (
          <Chip key={s} label={t(SLOT_LABELS[s])} selected={slot === s} onPress={() => setSlot(s)} />
        ))}
      </View>

      <PrimaryButton
        label={t('food.logCta')}
        onPress={submit}
        disabled={!validGrams}
        loading={busy}
        style={styles.cta}
      />
    </GlassView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  titleWrap: {
    flex: 1,
  },
  name: {
    fontSize: 20,
    lineHeight: 25,
  },
  brand: {
    fontFamily: font.semibold,
    fontSize: 12.5,
    color: colors.muted,
    marginTop: 2,
  },
  starButton: {
    padding: 2,
  },
  star: {
    fontSize: 26,
    color: colors.muted2,
  },
  starActive: {
    color: colors.tintDeep,
  },
  per100: {
    fontFamily: font.regular,
    fontSize: 12.5,
    color: colors.muted,
    marginTop: 8,
  },
  amountRow: {
    marginTop: 14,
    alignItems: 'center',
    gap: 10,
  },
  amountLabel: {
    fontFamily: font.bold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.muted,
    alignSelf: 'flex-start',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonText: {
    fontFamily: font.semibold,
    fontSize: 18,
    color: colors.ink,
  },
  gramsField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
  },
  gramsInput: {
    fontFamily: font.bold,
    fontSize: 17,
    color: colors.ink,
    paddingVertical: 8,
    minWidth: 56,
    textAlign: 'center',
  },
  gramsUnit: {
    fontFamily: font.bold,
    fontSize: 13,
    color: colors.muted,
  },
  kcal: {
    fontSize: 40,
    lineHeight: 47,
    color: colors.tintDeep, // groesser + pink (Sascha 09.08.)
  },
  slotChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  cta: {
    marginTop: 16,
  },
});
