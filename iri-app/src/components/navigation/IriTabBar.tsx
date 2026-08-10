import { ComponentProps, Fragment, useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Tabs, useRouter } from 'expo-router';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
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
const BUBBLE_W = 62;
const BUBBLE_H = 54;

export function IriTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const centerIndex = Math.ceil(state.routes.length / 2);

  // Liquid-Glass-Blase gleitet zum aktiven Tab (Wunsch Sascha 09.08.).
  // Tab-Positionen kommen aus onLayout; erster Stand ohne Animation.
  const tabX = useRef<Record<number, number>>({});
  const bubbleLeft = useSharedValue(-999);
  const bubbleW = useSharedValue(BUBBLE_W);
  // Druck-Effekt (Telefon-App): Beim Halten waechst die Blase ueber die
  // Leiste hinaus und die Leiste selbst schwillt leicht an.
  const bubbleScale = useSharedValue(1);
  const barScale = useSharedValue(1);
  const placed = useRef(false);
  const [, forceRender] = useState(0);

  const placeBubble = (index: number) => {
    const x = tabX.current[index];
    if (x == null) return;
    const target = x - (BUBBLE_W - 56) / 2;
    if (!placed.current) {
      bubbleLeft.value = target;
      placed.current = true;
      return;
    }
    const from = bubbleLeft.value;
    if (Math.abs(target - from) < 1) return;
    // Frame-Analyse der echten Telefon-App (10.08.): Die Kapsel UEBERBRUECKT —
    // Phase 1 (~130 ms): sie dehnt sich, bis sie alten UND neuen Tab umspannt;
    // Phase 2: sie zieht sich vom alten Ende federnd auf den neuen Tab zusammen.
    const span = Math.abs(target - from) + BUBBLE_W;
    if (target > from) {
      // nach rechts: linke Kante bleibt, rechte waechst — dann links nachziehen
      bubbleW.value = withSequence(
        withTiming(span, { duration: 130, easing: Easing.out(Easing.cubic) }),
        withSpring(BUBBLE_W, { damping: 16, stiffness: 220 }),
      );
      bubbleLeft.value = withDelay(130, withSpring(target, { damping: 16, stiffness: 220 }));
    } else {
      // nach links: linke Kante schiesst vor, rechte bleibt — dann rechts nachziehen
      bubbleLeft.value = withTiming(target, { duration: 130, easing: Easing.out(Easing.cubic) });
      bubbleW.value = withSequence(
        withTiming(span, { duration: 130, easing: Easing.out(Easing.cubic) }),
        withSpring(BUBBLE_W, { damping: 16, stiffness: 220 }),
      );
    }
  };

  const onTabLayout = (index: number) => (e: LayoutChangeEvent) => {
    tabX.current[index] = e.nativeEvent.layout.x;
    if (index === state.index) placeBubble(index);
    forceRender((n) => n + 1);
  };

  useEffect(() => {
    placeBubble(state.index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.index]);

  const bubbleStyle = useAnimatedStyle(() => ({
    left: bubbleLeft.value,
    width: bubbleW.value,
    transform: [{ scale: bubbleScale.value }],
  }));

  const barStyle = useAnimatedStyle(() => ({
    transform: [{ scale: barScale.value }],
  }));

  const pressIn = () => {
    bubbleScale.value = withSpring(1.28, { damping: 18, stiffness: 300 });
    barScale.value = withSpring(1.04, { damping: 18, stiffness: 300 });
  };

  const pressOut = () => {
    bubbleScale.value = withSpring(1, { damping: 14, stiffness: 260 });
    barScale.value = withSpring(1, { damping: 14, stiffness: 260 });
  };

  const onPlus = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/scan');
  };

  return (
    <Animated.View style={[styles.bar, { bottom: Math.max(22, insets.bottom + 6) }, barStyle]}>
    <GlassView borderRadius={radius.pill} contentStyle={styles.row}>
      {/* Gleitende Glas-Blase hinter dem aktiven Tab */}
      {/* Kein natives Glas IN Glas — Apple rendert verschachtelte
          UIGlassEffects nicht (Befund 09.08.). Die Blase ist deshalb eine
          klassische Rose-Linse mit Lichtkante, wirkt auf der Glas-Bar identisch. */}
      <Animated.View pointerEvents="none" style={[styles.bubble, bubbleStyle]}>
        <View style={[styles.bubbleFill, styles.bubbleFallback]} />
      </Animated.View>
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
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); // wie Wasserglas
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
              onPressIn={pressIn}
              onPressOut={pressOut}
              onLayout={onTabLayout(index)}
              style={styles.tab}
            >
              <IriIcon
                name={meta.icon}
                size={24}
                color={focused ? colors.tintDeep : colors.ink}
                opacity={focused ? 1 : 0.85}
              />
              <Text
                style={[
                  typography.tabLabel,
                  { color: focused ? colors.tintDeep : colors.ink },
                ]}
              >
                {t(meta.labelKey)}
              </Text>
            </Pressable>
          </Fragment>
        );
      })}
    </GlassView>
    </Animated.View>
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
  bubble: {
    position: 'absolute',
    top: (70 - BUBBLE_H) / 2,
    height: BUBBLE_H,
  },
  bubbleFill: {
    flex: 1,
    borderRadius: BUBBLE_H / 2,
    overflow: 'hidden',
  },
  bubbleFallback: {
    backgroundColor: 'rgba(255,255,255,0.92)', // milchig (Telefon-App-Stil)
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
