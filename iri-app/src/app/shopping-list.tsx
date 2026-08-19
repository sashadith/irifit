import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';

import { GlassView } from '@/components/glass/GlassView';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { GhostButton } from '@/components/ui/GhostButton';
import {
  loadShoppingList,
  saveShoppingList,
  ShoppingItem,
} from '@/features/shopping/shoppingList';
import { t } from '@/i18n';
import { colors, font, radius, spacing, typography } from '@/theme';
import { useSubscriptionGate } from '@/features/subscription/useSubscriptionGate';

export default function ShoppingListScreen() {
  const router = useRouter();
  const { lapsed } = useSubscriptionGate();
  const [items, setItems] = useState<ShoppingItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadShoppingList().then(setItems);
    }, []),
  );

  const persist = (next: ShoppingItem[]) => {
    setItems(next);
    saveShoppingList(next).catch(() => {});
  };

  const toggle = (id: string) => {
    // Abhaken ist der Kern-Moment der Liste → spürbarer Impact statt leiser Selection
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    persist(items.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)));
  };

  const clearChecked = () => persist(items.filter((i) => !i.checked));

  const clearAll = () => {
    Alert.alert(t('shopping.clearAll'), t('shopping.clearAllConfirm'), [
      { text: t('home.deleteEntryCancel'), style: 'cancel' },
      { text: t('shopping.clearAll'), style: 'destructive', onPress: () => persist([]) },
    ]);
  };

  const checkedCount = items.filter((i) => i.checked).length;

  // Abgelaufener Zugang (Sascha 17.08.): raus zum Verlaengerungsbildschirm.
  // Der Redirect steht nach allen Hooks, damit deren Reihenfolge stabil bleibt.
  if (lapsed) return <Redirect href="/renew" />;

  return (
    <ScreenScaffold withTabBarInset={false}>
      <Text style={typography.eyebrow}>{t('recipes.title')}</Text>
      <Text style={[typography.displayLg, styles.title]}>{t('shopping.title')}</Text>

      {items.length === 0 ? (
        <GlassView contentStyle={styles.cardPad}>
          <Text style={typography.bodyMuted}>{t('shopping.empty')}</Text>
        </GlassView>
      ) : (
        <GlassView contentStyle={styles.listPad}>
          {items.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: item.checked }}
              accessibilityLabel={item.text}
              onPress={() => toggle(item.id)}
              style={styles.row}
            >
              <View style={[styles.checkbox, item.checked && styles.checkboxChecked]}>
                {item.checked ? <Text style={styles.checkmark}>✓</Text> : null}
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.itemText, item.checked && styles.itemChecked]}>{item.text}</Text>
                {item.recipeTitle ? (
                  <Text style={styles.itemSource}>
                    {t('shopping.fromRecipe', { title: item.recipeTitle })}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))}
        </GlassView>
      )}

      {checkedCount > 0 ? (
        <GhostButton label={t('shopping.clearChecked')} onPress={clearChecked} style={styles.topGap} />
      ) : null}
      {items.length > 0 ? (
        <GhostButton label={t('shopping.clearAll')} small onPress={clearAll} style={styles.smallGap} />
      ) : null}
      <GhostButton label={t('scan.close')} small onPress={() => router.back()} style={styles.smallGap} />
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  title: {
    marginTop: 6,
    marginBottom: 14,
  },
  cardPad: {
    padding: spacing.lg,
  },
  listPad: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.track,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.muted2,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.tintDeep,
    borderColor: colors.tintDeep,
  },
  checkmark: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  rowText: {
    flex: 1,
  },
  itemText: {
    fontFamily: font.semibold,
    fontSize: 14,
    color: colors.ink,
  },
  itemChecked: {
    textDecorationLine: 'line-through',
    color: colors.muted2,
  },
  itemSource: {
    fontFamily: font.regular,
    fontSize: 11,
    color: colors.muted2,
    marginTop: 1,
  },
  topGap: {
    marginTop: 16,
  },
  smallGap: {
    marginTop: 10,
  },
});
