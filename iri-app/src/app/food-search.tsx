import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FoodSheet } from '@/components/food/FoodSheet';
import { GlassView } from '@/components/glass/GlassView';
import { IriIcon } from '@/components/icons/IriIcon';
import { Wallpaper } from '@/components/Wallpaper';
import { GhostButton } from '@/components/ui/GhostButton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  addFoodFavorite,
  copyEntriesToSlot,
  fetchFoodFavorites,
  fetchRecentEntries,
  fetchSlotHistory,
  FoodFavorite,
  foodKey,
  RecentEntry,
  relogEntry,
  removeFoodFavorite,
  SlotMealDay,
} from '@/features/food/foodData';
import { MealSlot } from '@/features/diary/useDiaryDay';
import { FoodItem, searchFoods } from '@/features/food/off';
import { analyzeTextMeal, ScanError } from '@/features/scan/api';
import type { ScanIngredient } from '@/features/scan/types';
import { t, TranslationKey } from '@/i18n';
import { colors, font, radius, spacing, typography } from '@/theme';

type SheetState = { item: FoodItem; source: 'search' | 'favorite' | 'manual' } | null;

const SLOT_LABEL: Record<MealSlot, TranslationKey> = {
  breakfast: 'home.slotBreakfast',
  lunch: 'home.slotLunch',
  dinner: 'home.slotDinner',
  snack: 'home.slotSnack',
};

const isMealSlot = (v: unknown): v is MealSlot =>
  v === 'breakfast' || v === 'lunch' || v === 'dinner' || v === 'snack';

export default function FoodSearchScreen() {
  const router = useRouter();
  // Kam die Suche über das Plus einer Mahlzeit? Dann ist der Slot gesetzt und
  // „Frühstück wie gestern" steht ganz oben (Sascha 14.08.).
  const params = useLocalSearchParams<{ slot?: string; date?: string }>();
  const targetSlot = isMealSlot(params.slot) ? params.slot : undefined;
  // Der Tag, den die Startseite gerade zeigt — sonst landet ein Eintrag beim
  // Blaettern im falschen Tag (und ohne Angabe im UTC-Tag des Servers)
  const targetDate = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? '') ? params.date : undefined;
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const userId = session?.user.id;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [recents, setRecents] = useState<RecentEntry[]>([]);
  const [favorites, setFavorites] = useState<FoodFavorite[]>([]);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [aiBusy, setAiBusy] = useState(false);
  // Popup vor der KI-Berechnung (Sascha 11.08.): Das Suchwort oben ist oft nur
  // ein Stichwort ('Skyr') — hier beschreibt die Nutzerin die echte Mahlzeit.
  const [aiPromptOpen, setAiPromptOpen] = useState(false);
  const [aiText, setAiText] = useState('');
  // KI-Ergebnis als entfernbare Zutatenliste (Sascha 11.08.) — erst danach
  // geht es mit der Gesamtportion ins normale FoodSheet
  const [aiResult, setAiResult] = useState<{ dish: string; ingredients: ScanIngredient[] } | null>(
    null,
  );
  // „Wiederholen": frühere Tage dieses Slots + Auswahlfenster mit abwählbaren
  // Zutaten (Sascha 14.08. — bewusst kein blindes Übernehmen)
  const [slotDays, setSlotDays] = useState<SlotMealDay[]>([]);
  const [copyDay, setCopyDay] = useState<SlotMealDay | null>(null);
  const [dropped, setDropped] = useState<Set<number>>(new Set());
  const [copyBusy, setCopyBusy] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadLists = useCallback(async () => {
    if (!userId) return;
    const [r, f] = await Promise.all([fetchRecentEntries(userId), fetchFoodFavorites(userId)]);
    setRecents(r);
    setFavorites(f);
    if (targetSlot) {
      fetchSlotHistory(userId, targetSlot).then(setSlotDays).catch(() => setSlotDays([]));
    }
  }, [userId, targetSlot]);

  useEffect(() => {
    loadLists();
  }, [loadLists]);

  // Debounced-Suche ab 2 Zeichen
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const items = await searchFoods(trimmed);
        setResults(items);
      } catch {
        Alert.alert(t('common.error'), t('food.searchError'));
      } finally {
        setSearching(false);
      }
    }, 450);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const favoriteFor = (item: FoodItem) => favorites.find((f) => foodKey(f.item) === foodKey(item));

  const toggleFavorite = async (item: FoodItem) => {
    if (!userId) return;
    const existing = favoriteFor(item);
    try {
      if (existing) {
        setFavorites((prev) => prev.filter((f) => f.id !== existing.id));
        await removeFoodFavorite(existing.id);
      } else {
        await addFoodFavorite(userId, item);
      }
      await loadLists();
    } catch {
      await loadLists();
    }
  };

  const relog = async (entry: RecentEntry) => {
    if (!userId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await relogEntry(userId, entry, entry.slot);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      Alert.alert(t('common.error'), t('food.searchError'));
    }
  };

  // Freitext → KI (Session 22): '100 g Hähnchenbrust gebraten, 10 g Öl' wird
  // zerlegt und berechnet; Eintragen läuft über das normale FoodSheet und
  // landet damit automatisch unter „Nochmal essen".
  const openAiPrompt = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Keyboard.dismiss();
    setAiText(query.trim());
    setAiPromptOpen(true);
  };

  const aiCompute = async () => {
    const text = aiText.trim();
    if (!text || aiBusy) return;
    setAiPromptOpen(false);
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAiBusy(true);
    try {
      const { result } = await analyzeTextMeal(text);
      const grams = result.ingredients.reduce((sum, i) => sum + i.grams, 0);
      if (result.ingredients.length === 0 || grams <= 0) {
        Alert.alert(t('common.error'), t('scan.errorGeneric'));
        return;
      }
      setAiResult({ dish: result.dish, ingredients: result.ingredients });
    } catch (e) {
      if (e instanceof ScanError && e.code === 'fair_use_exceeded') {
        Alert.alert(t('scan.fairUseTitle'), t('scan.fairUseText', { limit: e.scansUsed ?? 300 }));
      } else {
        Alert.alert(t('common.error'), t('scan.errorGeneric'));
      }
    } finally {
      setAiBusy(false);
    }
  };

  const showSearch = query.trim().length >= 2;

  const removeAiIngredient = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAiResult((prev) => {
      if (!prev) return prev;
      const ingredients = prev.ingredients.filter((_, i) => i !== index);
      return ingredients.length ? { ...prev, ingredients } : null;
    });
  };

  const aiItem: FoodItem | null = useMemo(() => {
    if (!aiResult) return null;
    const grams = aiResult.ingredients.reduce((sum, i) => sum + i.grams, 0);
    if (grams <= 0) return null;
    const total = (key: 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g') =>
      aiResult.ingredients.reduce((sum, i) => sum + i[key], 0);
    return {
      name: aiResult.dish,
      kcal100: Math.round((total('kcal') / grams) * 100),
      protein100: Math.round((total('protein_g') / grams) * 1000) / 10,
      carbs100: Math.round((total('carbs_g') / grams) * 1000) / 10,
      fat100: Math.round((total('fat_g') / grams) * 1000) / 10,
      servingG: Math.round(grams),
      unit: 'g',
    };
  }, [aiResult]);

  /** „wie gestern" / „wie vorgestern" / „Mo, 11. Aug" */
  const dayLabel = (isoDay: string) => {
    const today = new Date();
    const day = new Date(`${isoDay}T12:00:00`);
    const diff = Math.round((today.setHours(12, 0, 0, 0) - day.getTime()) / 86_400_000);
    if (diff === 1) return t('food.repeatYesterday');
    if (diff === 2) return t('food.repeatDayBefore');
    return day.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const keptEntries = (day: SlotMealDay) => day.entries.filter((_, i) => !dropped.has(i));

  const openCopy = (day: SlotMealDay) => {
    Haptics.selectionAsync();
    setDropped(new Set());
    setCopyDay(day);
  };

  const confirmCopy = async () => {
    if (!copyDay || !userId || !targetSlot) return;
    const keep = keptEntries(copyDay);
    if (keep.length === 0) return;
    setCopyBusy(true);
    try {
      await copyEntriesToSlot(userId, keep, targetSlot, targetDate);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCopyDay(null);
      router.back();
    } catch {
      Alert.alert(t('common.error'), t('food.copyFailed'));
    } finally {
      setCopyBusy(false);
    }
  };

  /** Zuletzt eingetragene Menge für dieses Lebensmittel — kommt ohne
   *  Zusatzabfrage aus der ohnehin geladenen „Zuletzt"-Liste (Stephanie 13.08.) */
  const lastGramsFor = (item: FoodItem) => {
    const title = item.brand ? `${item.name} (${item.brand})` : item.name;
    return recents.find((r) => r.title === title)?.grams ?? null;
  };

  // „Nochmal essen"-Untertitel: 255 kcal · 110 g · 11. Aug. 2026 (Sascha 11.08.)
  const recentSubtitle = (entry: RecentEntry) => {
    const parts = [`${entry.kcal} kcal`];
    if (entry.grams) parts.push(`${entry.grams} ${entry.food?.unit ?? 'g'}`);
    if (entry.loggedAt) {
      parts.push(
        new Date(entry.loggedAt).toLocaleDateString('de-DE', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
      );
    }
    return parts.join(' · ');
  };

  return (
    <View style={styles.flex}>
      <Wallpaper />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={typography.eyebrow}>{t('food.searchEyebrow')}</Text>
          <Text style={[typography.displayMd, styles.title]}>{t('food.searchTitle')}</Text>

          <View style={styles.searchField}>
            <IriIcon name="search" size={16} color={colors.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('food.searchPlaceholder')}
              placeholderTextColor={colors.muted2}
              style={styles.searchInput}
              autoFocus={!sheet}
              accessibilityLabel={t('food.searchTitle')}
            />
            {query ? (
              <Pressable accessibilityRole="button" accessibilityLabel="✕" onPress={() => setQuery('')} hitSlop={8}>
                <Text style={styles.clear}>✕</Text>
              </Pressable>
            ) : (
              /* Barcode direkt im Suchfeld (Sascha 14.08.): null Extra-Taps und
                 er kostet kein KI-Kontingent */
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('food.scanBarcode')}
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push('/scan?mode=barcode');
                }}
                hitSlop={8}
              >
                <IriIcon name="barcode" size={19} color={colors.tintDeep} />
              </Pressable>
            )}
          </View>

          {aiResult && aiItem ? (
            <View style={styles.sheetWrap}>
              <GlassView borderRadius={radius.md} style={styles.aiListCard} contentStyle={styles.aiListContent}>
                <View style={styles.modalTitleRow}>
                  <IriIcon name="sparkleDuo" size={17} color={colors.tintDeep} />
                  <Text style={styles.modalTitle}>{aiResult.dish}</Text>
                </View>
                {aiResult.ingredients.map((ing, i) => (
                  <View key={`${ing.name}-${i}`} style={styles.aiIngredientRow}>
                    <Text style={styles.aiIngredientText} numberOfLines={1}>
                      {Math.round(ing.grams)} g {ing.name}
                    </Text>
                    <Text style={styles.aiIngredientKcal}>{Math.round(ing.kcal)} kcal</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${ing.name} ${t('food.removeIngredient')}`}
                      onPress={() => removeAiIngredient(i)}
                      hitSlop={8}
                      style={styles.aiIngredientRemove}
                    >
                      <Text style={styles.aiIngredientRemoveText}>✕</Text>
                    </Pressable>
                  </View>
                ))}
              </GlassView>
              <FoodSheet
                key={`${aiResult.ingredients.length}-${aiItem.servingG}`}
                item={aiItem}
                source="manual"
                isFavorite={Boolean(favoriteFor(aiItem))}
                onToggleFavorite={() => toggleFavorite(aiItem)}
                onLogged={() => router.back()}
              />
              <GhostButton
                label={t('common.back')}
                small
                onPress={() => setAiResult(null)}
                style={styles.topGap}
              />
            </View>
          ) : sheet ? (
            <View style={styles.sheetWrap}>
              <FoodSheet
                item={sheet.item}
                source={sheet.source}
                isFavorite={Boolean(favoriteFor(sheet.item))}
                onToggleFavorite={() => toggleFavorite(sheet.item)}
                onLogged={() => router.back()}
                presetSlot={targetSlot}
                lastGrams={lastGramsFor(sheet.item)}
                loggedOn={targetDate}
              />
              <GhostButton label={t('common.back')} small onPress={() => setSheet(null)} style={styles.topGap} />
            </View>
          ) : showSearch ? (
            <View style={styles.topGap}>
              {searching ? (
                <View style={styles.centerRow}>
                  <ActivityIndicator color={colors.tintDeep} />
                  <Text style={typography.bodyMuted}> {t('food.searching')}</Text>
                </View>
              ) : results.length === 0 ? (
                <>
                  <Text style={[typography.bodyMuted, styles.emptyText]}>{t('food.noResults')}</Text>
                  {/* KI bewusst als Fallback NACH der Datenbanksuche (Sascha 11.08.):
                      sonst klickt jede sofort auf die teure Analyse */}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('food.aiCompute')}
                    onPress={openAiPrompt}
                    disabled={aiBusy}
                    style={({ pressed }) => [styles.aiButton, pressed && styles.rowPressed]}
                  >
                    {aiBusy ? (
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                      <IriIcon name="sparkleDuo" size={18} color={colors.white} />
                    )}
                    <Text style={styles.aiButtonText}>
                      {aiBusy ? t('food.aiComputing') : t('food.aiCompute')}
                    </Text>
                  </Pressable>
                </>
              ) : (
                <>
                  {results.map((item, i) => (
                    <FoodRow
                      key={`${foodKey(item)}-${i}`}
                      title={item.name}
                      subtitle={`${item.brand ? `${item.brand} · ` : ''}${item.kcal100} kcal / 100 g`}
                      onPress={() => setSheet({ item, source: 'search' })}
                    />
                  ))}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('food.aiCompute')}
                    onPress={openAiPrompt}
                    disabled={aiBusy}
                    style={({ pressed }) => [styles.aiButton, styles.aiButtonBelow, pressed && styles.rowPressed]}
                  >
                    {aiBusy ? (
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                      <IriIcon name="sparkleDuo" size={18} color={colors.white} />
                    )}
                    <Text style={styles.aiButtonText}>
                      {aiBusy ? t('food.aiComputing') : t('food.aiFallback')}
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          ) : (
            <>
              {targetSlot && slotDays.length > 0 ? (
                <>
                  <Text style={[typography.eyebrow, styles.sectionLabel]}>
                    {t('food.repeatSection', { slot: t(SLOT_LABEL[targetSlot]) })}
                  </Text>
                  {slotDays.map((day) => (
                    <FoodRow
                      key={day.loggedOn}
                      title={dayLabel(day.loggedOn)}
                      subtitle={t('food.repeatMeta', {
                        count:
                          day.entries.length === 1
                            ? t('food.repeatItemsOne')
                            : t('food.repeatItemsMany', { count: day.entries.length }),
                        kcal: day.kcal,
                      })}
                      onPress={() => openCopy(day)}
                    />
                  ))}
                </>
              ) : null}

              <Text style={[typography.eyebrow, styles.sectionLabel]}>{t('food.recentSection')}</Text>
              {recents.length === 0 ? (
                <Text style={[typography.bodyMuted, styles.emptyText]}>{t('food.noRecent')}</Text>
              ) : (
                recents.map((entry, i) => (
                  <FoodRow
                    key={`${entry.title}-${i}`}
                    title={entry.title}
                    subtitle={recentSubtitle(entry)}
                    onPress={() =>
                      entry.food
                        ? setSheet({ item: entry.food, source: 'search' })
                        : relog(entry)
                    }
                  />
                ))
              )}

              <Text style={[typography.eyebrow, styles.sectionLabel]}>{t('food.favoritesSection')}</Text>
              {favorites.length === 0 ? (
                <Text style={[typography.bodyMuted, styles.emptyText]}>{t('food.noFavorites')}</Text>
              ) : (
                favorites.map((favorite) => (
                  <FoodRow
                    key={favorite.id}
                    title={favorite.item.name}
                    subtitle={`${favorite.item.brand ? `${favorite.item.brand} · ` : ''}${favorite.item.kcal100} kcal / 100 g`}
                    onPress={() => setSheet({ item: favorite.item, source: 'favorite' })}
                  />
                ))
              )}
            </>
          )}

          {/* Leise Foto-Zeile (Sascha 14.08.): die KI bleibt der letzte Ausweg,
              nicht der erste Griff — sonst fotografiert jede statt zu suchen */}
          {!showSearch && !sheet && !aiResult ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('food.photoHint')}
              onPress={() => {
                Haptics.selectionAsync();
                router.push('/scan?mode=photo');
              }}
              style={styles.photoHintRow}
            >
              <IriIcon name="cameraAi" size={16} color={colors.muted} />
              <Text style={styles.photoHintText}>{t('food.photoHint')}</Text>
            </Pressable>
          ) : null}

          <GhostButton label={t('scan.close')} small onPress={() => router.back()} style={styles.closeButton} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Ganze Mahlzeit übernehmen — mit abwählbaren Zutaten (Sascha 14.08.).
          Bewusst kein blindes Kopieren: Stephanie beschrieb genau den Fall, dass
          man übernimmt und dann einzelne Mengen anpasst. */}
      <Modal visible={copyDay !== null} transparent animationType="fade" onRequestClose={() => setCopyDay(null)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCopyDay(null)} />
          <GlassView strong borderRadius={radius.md} style={styles.modalCard} contentStyle={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {t('food.copyTitle', { slot: targetSlot ? t(SLOT_LABEL[targetSlot]) : '' })}
            </Text>
            <Text style={[typography.bodyMuted, styles.copyHint]}>{t('food.copyHint')}</Text>

            {copyDay?.entries.map((entry, i) => {
              const off = dropped.has(i);
              return (
                <Pressable
                  key={`${entry.title}-${i}`}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: !off }}
                  accessibilityLabel={entry.title}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setDropped((prev) => {
                      const next = new Set(prev);
                      if (next.has(i)) next.delete(i);
                      else next.add(i);
                      return next;
                    });
                  }}
                  style={styles.copyRow}
                >
                  <View style={[styles.copyBox, !off && styles.copyBoxOn]}>
                    {!off ? <Text style={styles.copyCheck}>✓</Text> : null}
                  </View>
                  <View style={styles.copyTexts}>
                    <Text style={[styles.copyTitle, off && styles.copyOff]} numberOfLines={1}>
                      {entry.title}
                    </Text>
                    <Text style={[styles.copyMeta, off && styles.copyOff]}>
                      {entry.grams ? `${entry.grams} g · ` : ''}
                      {entry.kcal} kcal
                    </Text>
                  </View>
                </Pressable>
              );
            })}

            <PrimaryButton
              label={
                copyDay && keptEntries(copyDay).length === copyDay.entries.length
                  ? t('food.copyConfirm')
                  : t('food.copyConfirmSome', { count: copyDay ? keptEntries(copyDay).length : 0 })
              }
              loading={copyBusy}
              disabled={!copyDay || keptEntries(copyDay).length === 0}
              onPress={confirmCopy}
              style={styles.topGap}
            />
            <GhostButton label={t('food.copyCancel')} small onPress={() => setCopyDay(null)} style={styles.smallGap} />
          </GlassView>
        </View>
      </Modal>

      <Modal visible={aiPromptOpen} transparent animationType="fade" onRequestClose={() => setAiPromptOpen(false)}>
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setAiPromptOpen(false)} />
          <GlassView strong borderRadius={radius.md} style={styles.modalCard} contentStyle={styles.modalContent}>
            <View style={styles.modalTitleRow}>
              <IriIcon name="sparkleDuo" size={19} color={colors.tintDeep} />
              <Text style={styles.modalTitle}>{t('food.aiPromptTitle')}</Text>
            </View>
            <Text style={styles.modalText}>{t('food.aiPromptText')}</Text>
            <TextInput
              value={aiText}
              onChangeText={setAiText}
              placeholder={t('food.aiPromptPlaceholder')}
              placeholderTextColor={colors.muted2}
              style={styles.modalInput}
              multiline
              autoFocus
              accessibilityLabel={t('food.aiPromptTitle')}
            />
            <PrimaryButton
              label={t('food.aiCompute')}
              icon={<IriIcon name="sparkleDuo" size={18} color={colors.white} />}
              onPress={aiCompute}
              disabled={!aiText.trim()}
              style={styles.modalCta}
            />
            <GhostButton label={t('common.cancel')} small onPress={() => setAiPromptOpen(false)} style={styles.modalCancel} />
          </GlassView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function FoodRow({
  title,
  subtitle,
  onPress,
}: {
  readonly title: string;
  readonly subtitle: string;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
    >
      {({ pressed }) => (
        <GlassView
          borderRadius={radius.md}
          shadow={false}
          style={[styles.row, pressed && styles.rowPressed]}
          contentStyle={styles.rowContent}
        >
          <View style={styles.rowText}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.rowSubtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </GlassView>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.screenX,
    paddingBottom: 40,
  },
  title: {
    marginTop: 8,
    marginBottom: 14,
  },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: radius.pill,
    paddingHorizontal: 18,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontFamily: font.semibold,
    fontSize: 14,
    color: colors.ink,
  },
  clear: {
    color: colors.muted,
    fontSize: 14,
    padding: 2,
  },
  sheetWrap: {
    marginTop: 16,
  },
  copyHint: {
    marginTop: 4,
    marginBottom: 12,
  },
  copyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
  },
  copyBox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.stroke,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyBoxOn: {
    backgroundColor: colors.tintDeep,
    borderColor: colors.tintDeep,
  },
  copyCheck: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800',
  },
  copyTexts: {
    flex: 1,
  },
  copyTitle: {
    fontFamily: font.semibold,
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
  },
  copyMeta: {
    fontFamily: font.regular,
    fontSize: 12.5,
    color: colors.muted,
  },
  // Abgewählte Zutat bleibt sichtbar, nur zurückgenommen — so sieht man, was
  // man gerade weglässt
  copyOff: {
    opacity: 0.38,
    textDecorationLine: 'line-through',
  },
  smallGap: {
    marginTop: 8,
  },
  photoHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 22,
    paddingHorizontal: 12,
  },
  photoHintText: {
    fontFamily: font.regular,
    fontSize: 12.5,
    color: colors.muted,
    textAlign: 'center',
  },
  topGap: {
    marginTop: 12,
  },
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.tintDeep,
    borderRadius: radius.pill,
    paddingVertical: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  aiButtonText: {
    fontFamily: font.semibold,
    fontSize: 14,
    color: colors.white,
  },
  aiButtonBelow: {
    marginTop: 6,
    marginBottom: 0,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    backgroundColor: 'rgba(60,40,50,0.35)',
  },
  modalCard: {
    borderRadius: radius.md,
  },
  modalContent: {
    padding: spacing.lg,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontFamily: font.bold,
    fontSize: 17,
    color: colors.ink,
  },
  modalText: {
    fontFamily: font.regular,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.muted,
    marginTop: 8,
  },
  modalInput: {
    fontFamily: font.semibold,
    fontSize: 14.5,
    color: colors.ink,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    minHeight: 74,
    textAlignVertical: 'top',
    marginTop: 12,
  },
  modalCta: {
    marginTop: 14,
  },
  modalCancel: {
    marginTop: 8,
  },
  aiListCard: {
    marginBottom: 14, // Abstand ZWISCHEN den Karten, nicht im Karteninneren
  },
  aiListContent: {
    padding: spacing.lg,
  },
  aiIngredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 11,
  },
  aiIngredientText: {
    flex: 1,
    fontFamily: font.semibold,
    fontSize: 14,
    color: colors.ink,
  },
  aiIngredientKcal: {
    fontFamily: font.bold,
    fontSize: 13,
    color: colors.tintDeep,
  },
  aiIngredientRemove: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderWidth: 1,
    borderColor: colors.stroke,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiIngredientRemoveText: {
    fontSize: 12,
    color: colors.muted,
    fontFamily: font.semibold,
  },
  centerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    paddingVertical: 10,
  },
  sectionLabel: {
    marginTop: 20,
    marginBottom: 10,
  },
  row: {
    marginBottom: 8,
  },
  rowPressed: {
    opacity: 0.7,
  },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontFamily: font.semibold,
    fontSize: 14,
    color: colors.ink,
  },
  rowSubtitle: {
    fontFamily: font.regular,
    fontSize: 12,
    color: colors.muted,
    marginTop: 1,
  },
  chevron: {
    fontFamily: font.bold,
    fontSize: 16,
    color: colors.muted,
  },
  closeButton: {
    marginTop: 22,
  },
});
