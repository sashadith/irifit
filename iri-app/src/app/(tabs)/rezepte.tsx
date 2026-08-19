import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

/** Wie lange ein Rezept als „neu" gilt */
const NEW_BADGE_DAYS = 21;

import { IriIcon } from '@/components/icons/IriIcon';
import { RecipeCard } from '@/components/recipes/RecipeCard';
import { ScreenListScaffold } from '@/components/ScreenScaffold';
import { Chip } from '@/components/ui/Chip';
import { RoseHeart } from '@/components/ui/RoseHeart';
import { useAuth } from '@/features/auth/AuthProvider';
import { toIsoDate } from '@/features/diary/useDiaryDay';
import {
  CATEGORY_ORDER,
  fetchRecipes,
  isVegetarian,
  RecipeListItem,
  violatesAllergies,
} from '@/features/recipes/recipesData';
import { fetchRecipeFavoriteIds } from '@/features/recipes/recipesData';
import { matchesSearch } from '@/features/search/match';
import { suggestRecipes } from '@/features/recipes/suggest';
import { loadShoppingList } from '@/features/shopping/shoppingList';
import { LockedScreen } from '@/components/subscription/LockedScreen';
import { useSubscriptionGate } from '@/features/subscription/useSubscriptionGate';
import { t } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { colors, font, radius, spacing, typography } from '@/theme';

type KcalFilter = null | 350 | 500;

export default function RezepteScreen() {
  const router = useRouter();
  const { session, profile } = useAuth();
  const { lapsed } = useSubscriptionGate();

  const [recipes, setRecipes] = useState<RecipeListItem[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [forMe, setForMe] = useState(false);
  const [veggie, setVeggie] = useState(false);
  const [kcalMax, setKcalMax] = useState<KcalFilter>(null);
  const [remainingKcal, setRemainingKcal] = useState<number | null>(null);
  const [remainingProtein, setRemainingProtein] = useState(0);
  const [shoppingCount, setShoppingCount] = useState(0);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());

  // Badge-Zahl bei jedem Tab-Fokus aktualisieren (Liste ist lokal)
  useFocusEffect(
    useCallback(() => {
      loadShoppingList().then((items) => setShoppingCount(items.length));
      // Favoriten bei jedem Tab-Fokus frisch — sie können auf der Detailseite
      // oder im FoodSheet geändert worden sein
      if (session) {
        fetchRecipeFavoriteIds(session.user.id).then(setFavoriteIds).catch(() => {});
      }
    }, [session?.user.id]),
  );

  const [loadFailed, setLoadFailed] = useState(false);

  const loadRecipes = useCallback(() => {
    setLoadFailed(false);
    fetchRecipes()
      .then((r) => {
        setRecipes(r);
        if (r.length === 0) setLoadFailed(true);
      })
      .catch(() => setLoadFailed(true));
  }, []);

  useEffect(() => {
    loadRecipes();
  }, [loadRecipes]);

  // Rest-kcal für „Was soll ich noch essen?" bei jedem Tab-Fokus aktualisieren
  useFocusEffect(
    useCallback(() => {
      if (!session || !profile?.kcal_goal) return;
      supabase
        .from('food_logs')
        .select('kcal, protein_g')
        .eq('user_id', session.user.id)
        .eq('logged_on', toIsoDate(new Date()))
        .then(({ data }) => {
          const eaten = (data ?? []).reduce((s, r) => s + r.kcal, 0);
          const protein = (data ?? []).reduce((s, r) => s + (r.protein_g ?? 0), 0);
          setRemainingKcal(Math.max(0, (profile.kcal_goal ?? 0) - eaten));
          setRemainingProtein(Math.max(0, (profile.protein_goal_g ?? 0) - protein));
        });
    }, [session?.user.id, profile?.kcal_goal, profile?.protein_goal_g]),
  );

  const categories = useMemo(() => {
    const present = new Set(recipes.map((r) => r.category));
    return CATEGORY_ORDER.filter((c) => present.has(c));
  }, [recipes]);

  // NEU-Abzeichen an den vier juengsten Rezepten (Sascha 14.08.).
  //
  // Mit Frist, und das aus einem konkreten Grund: 156 der 158 Rezepte tragen
  // denselben Zeitstempel vom Import am 18.07. Ohne Frist bekaemen vier
  // zufaellige Dessert-Rezepte aus diesem Stapel dauerhaft ein NEU — das Wort
  // waere sofort wertlos. Mit Frist heisst NEU wirklich neu.
  const newestIds = useMemo(() => {
    const cutoff = Date.now() - NEW_BADGE_DAYS * 24 * 3600 * 1000;
    return new Set(
      [...recipes]
        // Zweitschluessel ID: bei gleichem Zeitstempel sonst zufaellige Reihenfolge
        .sort((a, b) => (a.created_at === b.created_at ? b.id - a.id : a.created_at < b.created_at ? 1 : -1))
        .filter((r) => new Date(r.created_at).getTime() >= cutoff)
        .slice(0, 4)
        .map((r) => r.id),
    );
  }, [recipes]);

  const filtered = useMemo(() => {
    const q = query.trim();
    const allergies = (forMe ? profile?.allergies : undefined) ?? [];
    return recipes.filter((r) => {
      if (category && r.category !== category) return false;
      // Verzeihende Suche (Sascha 14.08.): „hähn spar" findet den
      // Hähnchen-Spargel-Salat, Umlaute in beide Richtungen. Kategorie mit
      // durchsuchen, damit „dessert" auch ohne Chip-Klick trifft.
      if (q && !matchesSearch(q, r.title, r.category)) return false;
      if (kcalMax && r.kcal_per_serving > kcalMax) return false;
      if (veggie && !isVegetarian(r)) return false;
      if (forMe && violatesAllergies(r, allergies)) return false;
      if (onlyFavorites && !favoriteIds.has(r.id)) return false;
      return true;
    });
  }, [recipes, query, category, kcalMax, veggie, forMe, profile, onlyFavorites, favoriteIds]);

  const suggestions = useMemo(() => {
    if (remainingKcal === null || remainingKcal < 120 || query || category) return [];
    return suggestRecipes(recipes, {
      remainingKcal,
      remainingProteinG: remainingProtein,
      // Tag UND Stunde (Sascha 16.08.: „etwas oefter wechseln"). Vorher wechselte
      // die Auswahl nur einmal taeglich; jetzt bis zu 24-mal, ohne im selben
      // Moment zu springen — innerhalb einer Stunde bleibt sie stabil.
      seed: `${toIsoDate(new Date())}-${new Date().getHours()}`,
      count: 2,
    });
  }, [recipes, remainingKcal, remainingProtein, query, category]);

  // Abgelaufener Zugang: alles zu (Sascha 17.08.)
  if (lapsed) return <LockedScreen />;

  /* Kopfbereich als Listen-Kopf: scrollt mit wie bisher, nur die Karten
     darunter kommen jetzt aus der virtualisierten Liste (Sascha 18.08. —
     vorher wurden alle 158 Karten samt Bildern sofort gerendert). */
  const listenKopf = (
    <>
      <View style={styles.headerRow}>
        <Text style={typography.displayLg}>{t('recipes.title')}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('shopping.title')}
          onPress={() => router.push('/shopping-list')}
          style={styles.shoppingButton}
        >
          <IriIcon name="bag" size={20} color={colors.tintDeep} />
          {shoppingCount > 0 ? (
            <View style={styles.shoppingBadge}>
              <Text style={styles.shoppingBadgeText}>{shoppingCount > 99 ? '99' : shoppingCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <View style={styles.searchField}>
        <IriIcon name="search" size={16} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('recipes.searchPlaceholder', { count: recipes.length })}
          placeholderTextColor={colors.muted2}
          style={styles.searchInput}
          accessibilityLabel={t('recipes.title')}
        />
      </View>

      <View style={styles.chipsRow}>
        <Chip label={t('recipes.categoryAll')} selected={category === null} onPress={() => setCategory(null)} />
        {categories.map((c) => (
          <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(category === c ? null : c)} />
        ))}
      </View>
      <View style={styles.chipsRow}>
        <Chip
          label={t('recipes.filterFavorites')}
          selected={onlyFavorites}
          onPress={() => setOnlyFavorites(!onlyFavorites)}
          // Dasselbe SVG-Herz wie ueberall — keine Textglyphe (Beta-Befund 09.08.)
          icon={<RoseHeart size={14} color={onlyFavorites ? colors.white : colors.tint} />}
        />
        <Chip label={t('recipes.filterForMe')} selected={forMe} onPress={() => setForMe(!forMe)} />
        <Chip label={t('recipes.filterVeggie')} selected={veggie} onPress={() => setVeggie(!veggie)} />
        <Chip
          label={t('recipes.filterKcal350')}
          selected={kcalMax === 350}
          onPress={() => setKcalMax(kcalMax === 350 ? null : 350)}
        />
        <Chip
          label={t('recipes.filterKcal500')}
          selected={kcalMax === 500}
          onPress={() => setKcalMax(kcalMax === 500 ? null : 500)}
        />
      </View>

      {suggestions.length > 0 ? (
        /* Eigener, getoenter Kasten statt loser Ueberschrift (Sascha 16.08.):
           vorher ging der Vorschlag optisch in der Rezeptliste darunter unter. */
        <View style={styles.suggestBox}>
          <Text style={styles.suggestTitle}>{t('recipes.suggestTitle')}</Text>
          <Text style={styles.suggestSubtitle}>
            {t('recipes.suggestSubtitle', { kcal: (remainingKcal ?? 0).toLocaleString('de-DE') })}
          </Text>
          <View style={styles.grid}>
            {suggestions.map((r) => (
              <RecipeCard key={`s-${r.id}`} recipe={r} onPress={() => router.push(`/recipe/${r.id}`)} />
            ))}
          </View>
        </View>
      ) : null}
    </>
  );

  return (
    <ScreenListScaffold
      data={filtered}
      keyExtractor={(r) => String(r.id)}
      numColumns={2}
      columnWrapperStyle={styles.listRow}
      ListHeaderComponent={listenKopf}
      renderItem={({ item }) => (
        <RecipeCard
          recipe={item}
          isNew={newestIds.has(item.id)}
          onPress={() => router.push(`/recipe/${item.id}`)}
        />
      )}
      ListEmptyComponent={
        loadFailed && recipes.length === 0 ? (
          <View>
            <Text style={[typography.bodyMuted, styles.empty]}>{t('recipes.loadError')}</Text>
            <Chip label={t('recipes.retry')} selected={false} onPress={loadRecipes} />
          </View>
        ) : recipes.length > 0 ? (
          <Text style={[typography.bodyMuted, styles.empty]}>{t('recipes.noResults')}</Text>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  shoppingButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderWidth: 1,
    borderColor: colors.stroke,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shoppingBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: colors.tintDeep,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  shoppingBadgeText: {
    fontFamily: font.bold,
    fontSize: 9.5,
    color: colors.white,
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
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontFamily: font.semibold,
    fontSize: 14,
    color: colors.ink,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  /* Tiefe statt Tapete (17.08.): Bei 0,09 Deckkraft ging der Kasten im rosa
     Verlauf des Hintergrunds unter — sichtbar war nur der Rand. Jetzt kraeftiger
     getoent, deutlicherer Rand und ein weicher Schatten, damit der Block ueber
     der Liste zu liegen scheint. */
  suggestBox: {
    backgroundColor: 'rgba(232,127,156,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(232,127,156,0.34)',
    shadowColor: 'rgba(190,80,115,0.18)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    marginTop: 6,
    marginBottom: 18,
  },
  /* Eigene Ueberschrift statt der Rubrikzeile (Sascha 17.08.): normal
     geschrieben, keine Grossbuchstaben, keine gesperrte Laufweite. Deshalb
     nicht mehr typography.eyebrow — dort steckt das textTransform drin.
     Es ist eine Frage an die Nutzerin, keine Rubrik; als Frage soll sie auch
     aussehen. Rose, damit der Kasten einen erkennbaren Kopf hat. */
  suggestTitle: {
    fontFamily: font.bold,
    fontSize: 15.5,
    color: colors.tintDeep,
    textAlign: 'center',
  },
  suggestSubtitle: {
    fontFamily: font.regular,
    fontSize: 12.5,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 3,
    marginBottom: 12,
  },
  /* Zwei Karten je Reihe, egal wie breit der Container ist.
     Vorher: gap 12 px bei Karten mit 48,2 % Breite. 2 × 48,2 % = 96,4 %, fuer
     den Abstand blieben 3,6 % — im Vorschlagskasten (17.08.) sind das 11,95 px
     und damit 0,05 px zu wenig fuer die 12. Ergebnis: Umbruch, eine Karte pro
     Reihe, halber Kasten leer (Screenshot Sascha).
     Jetzt verteilt space-between den Rest selbst. Ein Umbruch ist damit
     unmoeglich, und eine einzelne Karte in der letzten Reihe bleibt links. */
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  /* Eine FlatList-Reihe mit zwei Karten — gleiche Optik wie .grid */
  listRow: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  empty: {
    paddingVertical: 20,
  },
});
