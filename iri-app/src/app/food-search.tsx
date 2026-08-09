import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FoodSheet } from '@/components/food/FoodSheet';
import { GlassView } from '@/components/glass/GlassView';
import { IriIcon } from '@/components/icons/IriIcon';
import { Wallpaper } from '@/components/Wallpaper';
import { GhostButton } from '@/components/ui/GhostButton';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  addFoodFavorite,
  fetchFoodFavorites,
  fetchRecentEntries,
  FoodFavorite,
  foodKey,
  RecentEntry,
  relogEntry,
  removeFoodFavorite,
} from '@/features/food/foodData';
import { FoodItem, searchFoods } from '@/features/food/off';
import { t } from '@/i18n';
import { colors, font, radius, spacing, typography } from '@/theme';

type SheetState = { item: FoodItem; source: 'search' | 'favorite' } | null;

export default function FoodSearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const userId = session?.user.id;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [recents, setRecents] = useState<RecentEntry[]>([]);
  const [favorites, setFavorites] = useState<FoodFavorite[]>([]);
  const [sheet, setSheet] = useState<SheetState>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadLists = useCallback(async () => {
    if (!userId) return;
    const [r, f] = await Promise.all([fetchRecentEntries(userId), fetchFoodFavorites(userId)]);
    setRecents(r);
    setFavorites(f);
  }, [userId]);

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

  const showSearch = query.trim().length >= 2;

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
            ) : null}
          </View>

          {sheet ? (
            <View style={styles.sheetWrap}>
              <FoodSheet
                item={sheet.item}
                source={sheet.source}
                isFavorite={Boolean(favoriteFor(sheet.item))}
                onToggleFavorite={() => toggleFavorite(sheet.item)}
                onLogged={() => router.back()}
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
                <Text style={[typography.bodyMuted, styles.emptyText]}>{t('food.noResults')}</Text>
              ) : (
                results.map((item, i) => (
                  <FoodRow
                    key={`${foodKey(item)}-${i}`}
                    title={item.name}
                    subtitle={`${item.brand ? `${item.brand} · ` : ''}${item.kcal100} kcal / 100 g`}
                    onPress={() => setSheet({ item, source: 'search' })}
                  />
                ))
              )}
            </View>
          ) : (
            <>
              <Text style={[typography.eyebrow, styles.sectionLabel]}>{t('food.recentSection')}</Text>
              {recents.length === 0 ? (
                <Text style={[typography.bodyMuted, styles.emptyText]}>{t('food.noRecent')}</Text>
              ) : (
                recents.map((entry, i) => (
                  <FoodRow
                    key={`${entry.title}-${i}`}
                    title={entry.title}
                    subtitle={`${entry.kcal} kcal`}
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

          <GhostButton label={t('scan.close')} small onPress={() => router.back()} style={styles.closeButton} />
        </ScrollView>
      </KeyboardAvoidingView>
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
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress}>
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
  topGap: {
    marginTop: 12,
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
