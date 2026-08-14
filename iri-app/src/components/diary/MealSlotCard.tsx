import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { GlassView } from '@/components/glass/GlassView';
import { IriIcon, IriIconName } from '@/components/icons/IriIcon';
import { FoodLog, MealSlot } from '@/features/diary/useDiaryDay';
import { t, TranslationKey } from '@/i18n';
import { colors, font, radius } from '@/theme';

const SLOT_META: Record<
  MealSlot,
  { icon: IriIconName; labelKey: TranslationKey; range: readonly [number, number] }
> = {
  breakfast: { icon: 'bowl', labelKey: 'home.slotBreakfast', range: [0.2, 0.3] },
  lunch: { icon: 'leaf', labelKey: 'home.slotLunch', range: [0.25, 0.35] },
  dinner: { icon: 'plate', labelKey: 'home.slotDinner', range: [0.27, 0.4] },
  snack: { icon: 'cherry', labelKey: 'home.slotSnack', range: [0, 0.12] },
};

const roundTo10 = (n: number) => Math.round(n / 10) * 10;

export interface MealSlotCardProps {
  readonly slot: MealSlot;
  readonly logs: readonly FoodLog[];
  readonly kcalGoal: number;
  readonly onDeleteLog: (id: string) => void;
  /** Tap auf einen Eintrag → Detail-Sheet mit sichtbarem Löschen (Feedback 23.07.) */
  readonly onSelectLog: (log: FoodLog) => void;
  /** Plus rechts oben: oeffnet die Suche mit diesem Slot (Sascha 14.08.) */
  readonly onAdd: (slot: MealSlot) => void;
}

/**
 * Mahlzeiten-Slot (Prototyp .meal): Icon-Bubble, Einträge bzw. Empfehlung.
 * Das Plus rechts oben ist zurück (Sascha 14.08.) — anders als früher öffnet es
 * nicht die Kamera, sondern die Suche MIT diesem Slot, wo „Frühstück wie
 * gestern" ganz oben steht. Das zentrale Plus-Menü bleibt daneben bestehen.
 */
export function MealSlotCard({ slot, logs, kcalGoal, onDeleteLog, onSelectLog, onAdd }: MealSlotCardProps) {
  const meta = SLOT_META[slot];
  const slotKcal = logs.reduce((sum, l) => sum + l.kcal, 0);
  const hasLogs = logs.length > 0;
  // Slot-Makros hinter den kcal (Sascha 12.08.): 27K · 1E · 0F
  const macroSum = (key: 'carbs_g' | 'protein_g' | 'fat_g') =>
    Math.round(logs.reduce((sum, l) => sum + (l[key] ?? 0), 0));
  const slotMacros = `${macroSum('carbs_g')}K · ${macroSum('protein_g')}E · ${macroSum('fat_g')}F`;

  const emptySubtitle =
    meta.range[0] === 0
      ? t('home.recommendedUpTo', { max: roundTo10(kcalGoal * meta.range[1]) })
      : t('home.recommendedRange', {
          min: roundTo10(kcalGoal * meta.range[0]),
          max: roundTo10(kcalGoal * meta.range[1]),
        });

  const confirmDelete = (log: FoodLog) => {
    Alert.alert(t('home.deleteEntryTitle'), t('home.entryKcal', { title: log.title, kcal: log.kcal }), [
      { text: t('home.deleteEntryCancel'), style: 'cancel' },
      { text: t('home.deleteEntryConfirm'), style: 'destructive', onPress: () => onDeleteLog(log.id) },
    ]);
  };

  return (
    <Pressable
      onLongPress={hasLogs ? () => confirmDelete(logs[logs.length - 1]) : undefined}
      accessibilityLabel={t(meta.labelKey)}
    >
      <GlassView borderRadius={radius.md} style={styles.card} contentStyle={styles.content}>
        <View style={styles.iconBubble}>
          <IriIcon name={meta.icon} size={21} color={colors.tintDeep} />
        </View>
        <View style={styles.textWrap}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{t(meta.labelKey)}</Text>
            {hasLogs ? <Text style={styles.slotKcal}>{slotKcal} kcal</Text> : null}
            {hasLogs ? <Text style={styles.slotMacros}>{slotMacros}</Text> : null}
          </View>
          {hasLogs ? (
            logs.map((log) => (
              <Pressable
                key={log.id}
                accessibilityRole="button"
                accessibilityLabel={t('home.entryKcal', { title: log.title, kcal: log.kcal })}
                accessibilityHint={t('home.entryTapHint')}
                onPress={() => {
                  Haptics.selectionAsync();
                  onSelectLog(log);
                }}
                hitSlop={4}
              >
                {({ pressed }) => {
                  const time = new Date(log.created_at);
                  const timeLabel = `${time.getHours()}:${String(time.getMinutes()).padStart(2, '0')}`;
                  return (
                    <View style={styles.entry}>
                      <Text
                        style={[styles.subtitle, pressed && styles.entryPressed]}
                        numberOfLines={1}
                      >
                        {log.title}
                      </Text>
                      {/* Zweite Zeile (Sascha 11.08.): 110 g · 307 kcal · 13:20 Uhr */}
                      <Text style={[styles.entryMeta, pressed && styles.entryPressed]}>
                        {log.grams ? `${log.grams} ${log.unit ?? 'g'} · ` : ''}
                        {log.kcal} kcal · {timeLabel} Uhr
                      </Text>
                    </View>
                  );
                }}
              </Pressable>
            ))
          ) : (
            <Text style={styles.subtitle}>{emptySubtitle}</Text>
          )}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.addToSlot', { slot: t(meta.labelKey) })}
          hitSlop={10}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onAdd(slot);
          }}
          style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
        >
          <IriIcon name="plus" size={17} color={colors.tintDeep} />
        </Pressable>
      </GlassView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 10,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  // Plus rechts in der Karte, vertikal mittig (Sascha 14.08.). Kein absolutes
  // Positionieren noetig: .content ist eine Zeile mit alignItems 'center', also
  // zentriert sich der Knopf von selbst — auch wenn die Karte durch mehrere
  // Eintraege waechst.
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(232,127,156,0.14)',
  },
  addButtonPressed: {
    opacity: 0.6,
    transform: [{ scale: 0.94 }],
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  title: {
    fontFamily: font.bold,
    fontSize: 15,
    color: colors.ink,
  },
  slotKcal: {
    fontFamily: font.bold,
    fontSize: 12,
    color: colors.tintDeep,
  },
  slotMacros: {
    fontFamily: font.semibold,
    fontSize: 11,
    color: colors.muted,
  },
  subtitle: {
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
    marginTop: 2,
  },
  entry: {
    marginBottom: 3,
  },
  entryMeta: {
    fontFamily: font.semibold,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.muted,
  },
  entryPressed: {
    color: colors.tintDeep,
  },
});
