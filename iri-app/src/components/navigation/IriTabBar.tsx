import { ComponentProps, Fragment } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Tabs, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassView } from '@/components/glass/GlassView';
import { IriIcon, IriIconName } from '@/components/icons/IriIcon';
import { t, TranslationKey } from '@/i18n';
import { colors, radius, tintShadow, typography } from '@/theme';

const TAB_META: Record<string, { icon: IriIconName; labelKey: TranslationKey }> = {
  index: { icon: 'home', labelKey: 'tabs.home' },
  rezepte: { icon: 'book', labelKey: 'tabs.recipes' },
  coaching: { icon: 'play', labelKey: 'tabs.coaching' },
  profil: { icon: 'user', labelKey: 'tabs.profile' },
};

/** Props-Typ aus Expo Routers eigener tabBar-Signatur abgeleitet (vermeidet Versionskonflikte) */
type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

/** Schwebende Glas-Pill mit zentralem Rosé-Plus (öffnet den Eintragen-Flow) */
export function IriTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const centerIndex = Math.ceil(state.routes.length / 2);

  const onPlus = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/scan');
  };

  return (
    <GlassView
      borderRadius={radius.pill}
      style={[styles.bar, { bottom: Math.max(22, insets.bottom + 6) }]}
      contentStyle={styles.row}
    >
      {state.routes.map((route, index) => {
        const meta = TAB_META[route.name];
        if (!meta) return null;
        const focused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <Fragment key={route.key}>
            {index === centerIndex && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('tabs.add')}
                onPress={onPlus}
                style={({ pressed }) => [styles.plusWrap, pressed && styles.pressed]}
              >
                <LinearGradient
                  colors={colors.roseGradient}
                  start={{ x: 0.2, y: 0 }}
                  end={{ x: 0.8, y: 1 }}
                  style={styles.plus}
                >
                  <IriIcon name="plus" size={26} color={colors.white} strokeWidth={1.6} />
                </LinearGradient>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="tab"
              accessibilityLabel={t(meta.labelKey)}
              accessibilityState={{ selected: focused }}
              onPress={onPress}
              style={styles.tab}
            >
              <IriIcon
                name={meta.icon}
                size={24}
                color={focused ? colors.ink : colors.muted}
                opacity={focused ? 1 : 0.6}
              />
              <Text
                style={[
                  typography.tabLabel,
                  { color: focused ? colors.ink : colors.muted },
                ]}
              >
                {t(meta.labelKey)}
              </Text>
            </Pressable>
          </Fragment>
        );
      })}
    </GlassView>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 22,
    right: 22,
    height: 70,
  },
  row: {
    height: 70,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  tab: {
    width: 56,
    alignItems: 'center',
    gap: 2,
  },
  plusWrap: {
    ...tintShadow,
    borderRadius: 27,
  },
  plus: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  pressed: {
    transform: [{ scale: 0.94 }],
  },
});
