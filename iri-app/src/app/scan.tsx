import { useEffect, useMemo, useRef, useState } from 'react';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassView } from '@/components/glass/GlassView';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { Wallpaper } from '@/components/Wallpaper';
import { Chip } from '@/components/ui/Chip';
import { GhostButton } from '@/components/ui/GhostButton';
import { IriIcon } from '@/components/icons/IriIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { FoodSheet } from '@/components/food/FoodSheet';
import { SattScoreDots } from '@/components/recipes/SattScoreDots';
import { sattScore } from '@/features/recipes/sattScore';
import { useAuth } from '@/features/auth/AuthProvider';
import { MealSlot } from '@/features/diary/useDiaryDay';
import {
  addFoodFavorite,
  fetchFoodFavorites,
  FoodFavorite,
  foodKey,
  removeFoodFavorite,
} from '@/features/food/foodData';
import { FoodItem, lookupBarcode } from '@/features/food/off';
import { InventoryResultView } from '@/components/scan/InventoryResultView';
import { fetchRecipes, RecipeListItem } from '@/features/recipes/recipesData';
import { analyzeFood, analyzeInventory, compressPhoto, ScanError } from '@/features/scan/api';
import { InventoryResult } from '@/features/scan/types';
import {
  gramStep,
  scaleIngredient,
  ScanIngredient,
  ScanResult,
  sumIngredients,
} from '@/features/scan/types';
import { t, TranslationKey } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { colors, font, radius, spacing, typography } from '@/theme';

type Phase = 'camera' | 'analyzing' | 'result' | 'food' | 'inventory';
type CameraMode = 'photo' | 'barcode' | 'inventory';

const SLOT_LABELS: Record<MealSlot, TranslationKey> = {
  breakfast: 'home.slotBreakfast',
  lunch: 'home.slotLunch',
  dinner: 'home.slotDinner',
  snack: 'home.slotSnack',
};

/** Vorbelegung des Mahlzeiten-Slots nach Uhrzeit */
function defaultSlot(now = new Date()): MealSlot {
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes < 10.5 * 60) return 'breakfast';
  if (minutes < 15 * 60) return 'lunch';
  if (minutes < 21.5 * 60) return 'dinner';
  return 'snack';
}

const CONFIDENCE_LABEL: Record<ScanResult['confidence'], TranslationKey> = {
  high: 'scan.confidenceHigh',
  medium: 'scan.confidenceMedium',
  low: 'scan.confidenceLow',
};

export default function ScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const [phase, setPhase] = useState<Phase>('camera');
  const [mode, setMode] = useState<CameraMode>('photo');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [image, setImage] = useState<{ base64: string; mediaType: string } | null>(null);
  const [ingredients, setIngredients] = useState<ScanIngredient[]>([]);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [note, setNote] = useState('');
  const [slot, setSlot] = useState<MealSlot>(defaultSlot());
  const [busy, setBusy] = useState(false);
  const [foodItem, setFoodItem] = useState<FoodItem | null>(null);
  const [favorites, setFavorites] = useState<FoodFavorite[]>([]);
  const [inventory, setInventory] = useState<InventoryResult | null>(null);
  const [recipes, setRecipes] = useState<RecipeListItem[]>([]);
  const barcodeBusyRef = useRef(false);

  useEffect(() => {
    // Rezept-Cache fürs Kühlschrank-Matching (Session-Cache, meist sofort da)
    fetchRecipes().then(setRecipes).catch(() => {});
  }, []);

  const totals = useMemo(() => sumIngredients(ingredients), [ingredients]);

  const runAnalysis = async (
    img: { base64: string; mediaType: string },
    correction?: { previous: ScanResult; note?: string },
  ) => {
    setPhase('analyzing');
    try {
      const response = await analyzeFood(img, correction);
      setScan(response.result);
      setIngredients(response.result.ingredients);
      setPhase('result');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      const code = e instanceof ScanError ? e.code : 'unknown';
      if (code === 'fair_use_exceeded') {
        Alert.alert(t('scan.fairUseTitle'), t('scan.fairUseText', { limit: 300 }));
        router.back();
        return;
      }
      Alert.alert(t('common.error'), t('scan.errorGeneric'));
      setPhase(correction ? 'result' : 'camera');
    }
  };

  const onBarcodeScanned = async ({ data: code }: BarcodeScanningResult) => {
    if (barcodeBusyRef.current || !code) return;
    barcodeBusyRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const item = await lookupBarcode(code);
      if (!item) {
        Alert.alert(t('food.productNotFoundTitle'), t('food.productNotFoundText'), [
          { text: 'OK', onPress: () => setTimeout(() => (barcodeBusyRef.current = false), 1500) },
        ]);
        return;
      }
      if (session) {
        fetchFoodFavorites(session.user.id).then(setFavorites).catch(() => {});
      }
      setFoodItem(item);
      setPhase('food');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert(t('common.error'), t('food.barcodeError'), [
        { text: 'OK', onPress: () => setTimeout(() => (barcodeBusyRef.current = false), 1500) },
      ]);
    }
  };

  const toggleFoodFavorite = async () => {
    if (!session || !foodItem) return;
    const existing = favorites.find((f) => foodKey(f.item) === foodKey(foodItem));
    try {
      if (existing) {
        setFavorites((prev) => prev.filter((f) => f.id !== existing.id));
        await removeFoodFavorite(existing.id);
      } else {
        await addFoodFavorite(session.user.id, foodItem);
        const fresh = await fetchFoodFavorites(session.user.id);
        setFavorites(fresh);
      }
    } catch {
      // Favoriten sind nicht kritisch — still scheitern lassen
    }
  };

  const runInventory = async (img: { base64: string; mediaType: string }) => {
    setPhase('analyzing');
    try {
      const response = await analyzeInventory(img);
      setInventory(response.result);
      setPhase('inventory');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      const code = e instanceof ScanError ? e.code : 'unknown';
      if (code === 'fair_use_exceeded') {
        Alert.alert(t('scan.fairUseTitle'), t('scan.fairUseText', { limit: 300 }));
        router.back();
        return;
      }
      Alert.alert(t('common.error'), t('scan.errorGeneric'));
      setPhase('camera');
    }
  };

  const analyzeCaptured = async (uri: string) => {
    setPhotoUri(uri);
    const compressed = await compressPhoto(uri);
    setImage(compressed);
    if (mode === 'inventory') {
      await runInventory(compressed);
    } else {
      await runAnalysis(compressed);
    }
  };

  const capture = async () => {
    if (!cameraRef.current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const photo = await cameraRef.current.takePictureAsync();
    if (!photo?.uri) return;
    await analyzeCaptured(photo.uri);
  };

  const pickFromLibrary = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (picked.canceled || !picked.assets[0]?.uri) return;
    await analyzeCaptured(picked.assets[0].uri);
  };

  const adjustIngredient = (index: number, direction: 1 | -1) => {
    Haptics.selectionAsync();
    setIngredients((prev) => {
      const next = [...prev];
      const step = gramStep(next[index].grams);
      const grams = Math.max(0, next[index].grams + direction * step);
      next[index] = scaleIngredient(next[index], grams);
      return next.filter((i) => i.grams > 0);
    });
  };

  const removeIngredient = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  const recalcWithNote = async () => {
    if (!image || !scan || !note.trim()) return;
    await runAnalysis(image, {
      previous: { ...scan, ingredients },
      note: note.trim(),
    });
    setNote('');
  };

  const logMeal = async () => {
    if (!session || !scan) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('food_logs').insert({
        user_id: session.user.id,
        slot,
        source: 'scan',
        title: scan.dish,
        kcal: Math.round(totals.kcal),
        protein_g: Math.round(totals.protein * 10) / 10,
        carbs_g: Math.round(totals.carbs * 10) / 10,
        fat_g: Math.round(totals.fat * 10) / 10,
        details: {
          ingredients,
          portion: scan.portion,
          confidence: scan.confidence,
        },
      });
      if (error) throw error;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      Alert.alert(t('common.error'), t('scan.errorGeneric'));
    } finally {
      setBusy(false);
    }
  };

  // --- Kamera-Phase -------------------------------------------------------

  if (phase === 'camera') {
    if (!permission?.granted) {
      return (
        <ScreenScaffold withTabBarInset={false}>
          <Text style={[typography.eyebrow, styles.eyebrow]}>{t('scan.eyebrow')}</Text>
          <Text style={[typography.displayMd, styles.title]}>{t('scan.permissionTitle')}</Text>
          <GlassView contentStyle={styles.cardPad}>
            <Text style={typography.bodyMuted}>{t('scan.permissionText')}</Text>
          </GlassView>
          <PrimaryButton
            label={t('scan.permissionCta')}
            onPress={requestPermission}
            style={styles.topGap}
          />
          <GhostButton label={t('scan.pickPhoto')} onPress={pickFromLibrary} style={styles.smallGap} />
          <GhostButton label={t('scan.close')} small onPress={() => router.back()} style={styles.smallGap} />
        </ScreenScaffold>
      );
    }

    return (
      <View style={styles.cameraRoot}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={
            mode === 'barcode'
              ? { barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }
              : undefined
          }
          onBarcodeScanned={mode === 'barcode' ? onBarcodeScanned : undefined}
        />
        <View style={[styles.cameraOverlay, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.cameraTop}>
            <GlassView borderRadius={radius.pill} contentStyle={styles.cameraHint}>
              <Text style={styles.cameraHintText}>
                {mode === 'barcode'
                  ? t('scan.barcodeHint')
                  : mode === 'inventory'
                    ? t('scan.inventoryHint')
                    : t('scan.cameraHint')}
              </Text>
            </GlassView>
            <View style={styles.modeChips}>
              <Chip label={t('scan.modePhoto')} selected={mode === 'photo'} onPress={() => setMode('photo')} />
              <Chip label={t('scan.modeBarcode')} selected={mode === 'barcode'} onPress={() => setMode('barcode')} />
              <Chip label={t('scan.modeInventory')} selected={mode === 'inventory'} onPress={() => setMode('inventory')} />
              <Chip label={t('scan.modeSearch')} selected={false} onPress={() => router.push('/food-search')} />
            </View>
          </View>
          {mode === 'barcode' ? <View style={styles.barcodeFrame} pointerEvents="none" /> : null}
          <View style={styles.cameraControls}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('scan.pickPhoto')}
              onPress={pickFromLibrary}
              style={styles.sideButton}
            >
              <IriIcon name="search" size={22} color={colors.white} strokeWidth={1.6} />
            </Pressable>
            {mode !== 'barcode' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('scan.capture')}
                onPress={capture}
                style={styles.shutterOuter}
              >
                <View style={styles.shutterInner} />
              </Pressable>
            ) : (
              <View style={styles.shutterPlaceholder} />
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('scan.close')}
              onPress={() => router.back()}
              style={styles.sideButton}
            >
              <Text style={styles.closeX}>✕</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // --- Barcode-Produkt (FoodSheet) ---------------------------------------

  if (phase === 'food' && foodItem) {
    return (
      <View style={styles.flex}>
        <Wallpaper />
        <ScrollView
          contentContainerStyle={[styles.resultContent, { paddingTop: insets.top + 12 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={typography.eyebrow}>{t('scan.eyebrow')}</Text>
          <Text style={[typography.displayMd, styles.title]}>{t('scan.resultTitle')}</Text>
          <FoodSheet
            item={foodItem}
            source="barcode"
            isFavorite={favorites.some((f) => foodKey(f.item) === foodKey(foodItem))}
            onToggleFavorite={toggleFoodFavorite}
            onLogged={() => router.back()}
          />
          <GhostButton
            label={t('scan.retake')}
            onPress={() => {
              setFoodItem(null);
              barcodeBusyRef.current = false;
              setPhase('camera');
            }}
            style={styles.smallGap}
          />
        </ScrollView>
      </View>
    );
  }

  // --- Analyse-Phase ------------------------------------------------------

  if (phase === 'analyzing') {
    return (
      <ScreenScaffold withTabBarInset={false} scroll={false}>
        <View style={styles.analyzing}>
          {photoUri ? <Image source={{ uri: photoUri }} style={styles.analyzingPhoto} /> : null}
          <ActivityIndicator size="large" color={colors.tintDeep} style={styles.topGap} />
          <Text style={[typography.bodyMuted, styles.analyzingText]}>
            {mode === 'inventory' ? t('scan.inventoryAnalyzing') : t('scan.analyzing')}
          </Text>
        </View>
      </ScreenScaffold>
    );
  }

  // --- Kühlschrank-Ergebnis ----------------------------------------------

  if (phase === 'inventory' && inventory) {
    return (
      <View style={styles.flex}>
        <Wallpaper />
        <ScrollView
          contentContainerStyle={[styles.resultContent, { paddingTop: insets.top + 12 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={typography.eyebrow}>{t('scan.modeInventory')}</Text>
          <Text style={[typography.displayMd, styles.title]}>{t('scan.inventoryTitle')}</Text>
          <InventoryResultView
            data={inventory}
            recipes={recipes}
            onRetake={() => {
              setInventory(null);
              setPhase('camera');
            }}
          />
          <GhostButton label={t('scan.close')} small onPress={() => router.back()} style={styles.smallGap} />
        </ScrollView>
      </View>
    );
  }

  // --- Ergebnis-Phase -----------------------------------------------------

  const noFood = scan !== null && scan.ingredients.length === 0;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.flex}>
        <Wallpaper />
        <ScrollView contentContainerStyle={[styles.resultContent, { paddingTop: insets.top + 12 }]} showsVerticalScrollIndicator={false}>
          <Text style={typography.eyebrow}>{t('scan.eyebrow')}</Text>
          <Text style={[typography.displayMd, styles.title]}>{t('scan.resultTitle')}</Text>

          <View style={styles.photoWrap}>
            {photoUri ? <Image source={{ uri: photoUri }} style={styles.resultPhoto} /> : null}
            {scan ? (
              <View style={styles.confidencePill}>
                <Text style={styles.confidenceText}>{t(CONFIDENCE_LABEL[scan.confidence])}</Text>
              </View>
            ) : null}
          </View>

          <Animated.View entering={FadeInDown.springify().damping(16).mass(0.9)}>
          <GlassView style={styles.resultCard} contentStyle={styles.cardPad}>
            {noFood ? (
              <Text style={typography.bodyMuted}>{t('scan.noFood')}</Text>
            ) : (
              <>
                <Text style={[typography.displayLg, styles.dish]}>{scan?.dish}</Text>
                <Text style={styles.portionHint}>
                  {t('scan.portionHint', { portion: scan?.portion ?? '' })}
                </Text>
                <Text style={[typography.displayMd, styles.kcal]}>
                  {t('scan.approxKcal', { kcal: Math.round(totals.kcal).toLocaleString('de-DE') })}
                </Text>
                <View style={styles.sattRow}>
                  <SattScoreDots
                    withLabel
                    animated
                    size={7}
                    score={sattScore({
                      kcal: totals.kcal,
                      proteinG: totals.protein,
                      totalGrams: ingredients.reduce((s, i) => s + i.grams, 0) || null,
                    })}
                  />
                </View>

                {ingredients.map((ingredient, index) => (
                  <View key={`${ingredient.name}-${index}`} style={styles.ingredientRow}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${ingredient.name} entfernen`}
                      onPress={() => removeIngredient(index)}
                      hitSlop={8}
                    >
                      <Text style={styles.remove}>✕</Text>
                    </Pressable>
                    <View style={styles.ingredientText}>
                      <Text style={styles.ingredientName}>{ingredient.name}</Text>
                      <Text style={styles.ingredientKcal}>{Math.round(ingredient.kcal)} kcal</Text>
                    </View>
                    <View style={styles.stepper}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${ingredient.name} weniger`}
                        onPress={() => adjustIngredient(index, -1)}
                        style={styles.stepButton}
                      >
                        <Text style={styles.stepButtonText}>−</Text>
                      </Pressable>
                      <Text style={styles.grams}>{Math.round(ingredient.grams)} g</Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${ingredient.name} mehr`}
                        onPress={() => adjustIngredient(index, 1)}
                        style={styles.stepButton}
                      >
                        <Text style={styles.stepButtonText}>＋</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}

                <View style={styles.noteRow}>
                  <TextInput
                    value={note}
                    onChangeText={setNote}
                    placeholder={t('scan.notePlaceholder')}
                    placeholderTextColor={colors.muted2}
                    style={styles.noteInput}
                    accessibilityLabel={t('scan.notePlaceholder')}
                  />
                  {note.trim() ? (
                    <Pressable accessibilityRole="button" onPress={recalcWithNote} style={styles.recalcButton}>
                      <Text style={styles.recalcText}>{t('scan.recalc')}</Text>
                    </Pressable>
                  ) : null}
                </View>
              </>
            )}
          </GlassView>
          </Animated.View>

          {!noFood ? (
            <>
              <Text style={[typography.eyebrow, styles.slotLabel]}>{t('scan.slotLabel')}</Text>
              <View style={styles.slotChips}>
                {(Object.keys(SLOT_LABELS) as MealSlot[]).map((s) => (
                  <Chip key={s} label={t(SLOT_LABELS[s])} selected={slot === s} onPress={() => setSlot(s)} />
                ))}
              </View>
              <PrimaryButton label={t('scan.logTo')} onPress={logMeal} loading={busy} style={styles.topGap} />
            </>
          ) : null}
          <GhostButton
            label={t('scan.retake')}
            onPress={() => {
              setScan(null);
              setIngredients([]);
              setPhase('camera');
            }}
            style={styles.smallGap}
          />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  eyebrow: {
    marginTop: 8,
  },
  title: {
    marginTop: 8,
    marginBottom: 14,
  },
  cardPad: {
    padding: spacing.lg,
  },
  topGap: {
    marginTop: 16,
  },
  smallGap: {
    marginTop: 10,
  },
  // Kamera
  cameraRoot: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  cameraTop: {
    alignItems: 'center',
    gap: 10,
  },
  cameraHint: {
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  modeChips: {
    flexDirection: 'row',
    gap: 8,
  },
  barcodeFrame: {
    alignSelf: 'center',
    width: '78%',
    height: 150,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  shutterPlaceholder: {
    width: 76,
    height: 76,
  },
  cameraHintText: {
    fontFamily: font.semibold,
    fontSize: 13,
    color: colors.ink,
  },
  cameraControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    paddingHorizontal: 24,
  },
  sideButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeX: {
    color: colors.white,
    fontSize: 18,
    fontFamily: font.semibold,
  },
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.white,
  },
  // Analyse
  analyzing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyzingPhoto: {
    width: 180,
    height: 180,
    borderRadius: radius.lg,
    opacity: 0.9,
  },
  analyzingText: {
    marginTop: 12,
    textAlign: 'center',
  },
  // Ergebnis
  resultContent: {
    paddingHorizontal: spacing.screenX,
    paddingBottom: 40,
  },
  photoWrap: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    height: 190,
    backgroundColor: colors.track,
  },
  resultPhoto: {
    width: '100%',
    height: '100%',
  },
  confidencePill: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  confidenceText: {
    fontFamily: font.bold,
    fontSize: 11,
    color: colors.ink,
  },
  resultCard: {
    marginTop: -26,
    marginHorizontal: 10,
    zIndex: 2,
  },
  dish: {
    fontSize: 19,
    lineHeight: 24,
  },
  portionHint: {
    fontFamily: font.regular,
    fontSize: 12.5,
    color: colors.muted,
    marginTop: 4,
    marginBottom: 10,
  },
  kcal: {
    fontSize: 27,
    lineHeight: 32,
  },
  sattRow: {
    marginTop: 6,
    marginBottom: 8,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.track,
  },
  remove: {
    color: colors.muted2,
    fontSize: 13,
    padding: 2,
  },
  ingredientText: {
    flex: 1,
  },
  ingredientName: {
    fontFamily: font.semibold,
    fontSize: 14,
    color: colors.ink,
  },
  ingredientKcal: {
    fontFamily: font.regular,
    fontSize: 11.5,
    color: colors.muted,
    marginTop: 1,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepButton: {
    width: 27,
    height: 27,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonText: {
    fontFamily: font.semibold,
    fontSize: 15,
    color: colors.ink,
  },
  grams: {
    fontFamily: font.semibold,
    fontSize: 13,
    color: colors.ink,
    minWidth: 44,
    textAlign: 'center',
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  noteInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontFamily: font.regular,
    fontSize: 13,
    color: colors.ink,
  },
  recalcButton: {
    backgroundColor: colors.tintDeep,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  recalcText: {
    fontFamily: font.bold,
    fontSize: 12,
    color: colors.white,
  },
  slotLabel: {
    marginTop: 18,
    marginBottom: 10,
  },
  slotChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
