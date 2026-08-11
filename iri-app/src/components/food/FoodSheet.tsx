import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { GlassView } from '@/components/glass/GlassView';
import { Chip } from '@/components/ui/Chip';
import { WHEEL_ITEM_H, WheelPicker } from '@/components/ui/WheelPicker';
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

// Zwei Scroll-Räder (Sascha 11.08.): links Menge, rechts Einheit g/ml/Stück.
// So lässt sich auch eine falsch erkannte Einheit (OFF-Datenrauschen wie
// 'Pringles in ml') direkt am Rad korrigieren.
type AmountUnit = 'g' | 'ml' | 'stk';
const UNIT_VALUES: AmountUnit[] = ['g', 'ml', 'stk'];

// 1–19 einzeln (Sascha 11.08.), 20–500 in 5ern (330-ml-Dose), darüber gröber
const GRAM_VALUES: number[] = [
  ...Array.from({ length: 19 }, (_, i) => i + 1),
  ...Array.from({ length: 97 }, (_, i) => 20 + i * 5),
  ...Array.from({ length: 50 }, (_, i) => 510 + i * 10),
  ...Array.from({ length: 20 }, (_, i) => 1050 + i * 50),
];
const PIECE_VALUES: number[] = Array.from({ length: 50 }, (_, i) => i + 1);

const nearestGramIndex = (grams: number) => {
  let best = 0;
  for (let i = 0; i < GRAM_VALUES.length; i += 1) {
    if (Math.abs(GRAM_VALUES[i] - grams) < Math.abs(GRAM_VALUES[best] - grams)) best = i;
  }
  return best;
};

/** Portionieren + Eintragen eines Lebensmittels (Barcode-Treffer oder Suchergebnis) */
export function FoodSheet({ item, source, isFavorite, onToggleFavorite, onLogged }: FoodSheetProps) {
  const { session } = useAuth();
  const [unit, setUnit] = useState<AmountUnit>(item.unit);
  const [amountIndex, setAmountIndex] = useState(() => nearestGramIndex(item.servingG ?? 100));
  const [pieceIndex, setPieceIndex] = useState(0); // Stück beginnt bei 1
  const [slot, setSlot] = useState<MealSlot>(defaultSlot());
  const [busy, setBusy] = useState(false);

  // Stück × Portionsgröße (falls bekannt, sonst 100 g) → Gramm für die Rechnung
  const pieceGrams = item.servingG ?? 100;
  const grams =
    unit === 'stk' ? PIECE_VALUES[pieceIndex] * pieceGrams : GRAM_VALUES[amountIndex];
  const nutrients = useMemo(() => nutrientsForAmount(item, grams), [item, grams]);

  const changeUnit = (index: number) => {
    const next = UNIT_VALUES[index];
    if (next === unit) return;
    if (next === 'stk') {
      setPieceIndex(0); // Wunsch Sascha: Stück startet mit Menge 1
    } else if (unit === 'stk') {
      setAmountIndex(nearestGramIndex(item.servingG ?? 100));
    }
    setUnit(next);
  };

  const submit = async () => {
    if (!session) return;
    setBusy(true);
    try {
      await logFood(session.user.id, item, grams, slot, source);
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
        <View style={styles.wheels}>
          {/* EIN gemeinsames Auswahlband ueber beide Raeder — wie der native iOS-Picker */}
          <View pointerEvents="none" style={styles.wheelBand} />
          {unit === 'stk' ? (
            <WheelPicker
              values={PIECE_VALUES.map(String)}
              selectedIndex={pieceIndex}
              onChange={setPieceIndex}
              width={104}
              showHighlight={false}
            />
          ) : (
            <WheelPicker
              values={GRAM_VALUES.map(String)}
              selectedIndex={amountIndex}
              onChange={setAmountIndex}
              width={104}
              showHighlight={false}
            />
          )}
          <WheelPicker
            values={UNIT_VALUES.map((u) => (u === 'stk' ? t('food.unitPiece') : u))}
            selectedIndex={UNIT_VALUES.indexOf(unit)}
            onChange={changeUnit}
            width={92}
            showHighlight={false}
          />
        </View>
        {unit === 'stk' ? (
          <Text style={styles.pieceHint}>
            {t('food.pieceHint', { grams: pieceGrams.toLocaleString('de-DE') })}
          </Text>
        ) : null}
        <Text style={[typography.displayMd, styles.kcal]}>
          {t('food.approxKcal', { kcal: nutrients.kcal.toLocaleString('de-DE') })}
        </Text>
      </View>

      <View style={styles.slotChips}>
        {(Object.keys(SLOT_LABELS) as MealSlot[]).map((s) => (
          <Chip key={s} label={t(SLOT_LABELS[s])} selected={slot === s} onPress={() => setSlot(s)} />
        ))}
      </View>

      <PrimaryButton label={t('food.logCta')} onPress={submit} loading={busy} style={styles.cta} />
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
  wheels: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    alignSelf: 'stretch',
  },
  wheelBand: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: WHEEL_ITEM_H * 2,
    height: WHEEL_ITEM_H,
    borderRadius: 10,
    backgroundColor: 'rgba(120,120,128,0.12)', // iOS-Picker-Grau
  },
  pieceHint: {
    fontFamily: font.regular,
    fontSize: 12,
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
