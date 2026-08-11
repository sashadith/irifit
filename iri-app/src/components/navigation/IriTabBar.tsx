import { ComponentProps, Fragment, useEffect, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
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

/** Schwebende Glas-Pill mit zentralem Rosé-Plus (öffnet das Bogen-Menü) */
const BUBBLE_W = 62;
const BUBBLE_H = 54;

/**
 * Plus-Menü (Sascha 11.08.): Halbbogen über dem Plus statt Kamera-Sofortstart —
 * die Kamera läuft erst, wenn wirklich gescannt werden soll.
 */
const ARC_ACTIONS = [
  { icon: 'cameraAi', labelKey: 'tabs.addPhoto', route: '/scan?mode=photo' },
  { icon: 'barcode', labelKey: 'tabs.addBarcode', route: '/scan?mode=barcode' },
  { icon: 'fridgeAi', labelKey: 'tabs.addPantry', route: '/scan?mode=inventory' },
  { icon: 'searchFood', labelKey: 'tabs.addSearch', route: '/food-search' },
] as const;
const ARC_RADIUS = 150;
const ARC_ANGLES = [135, 105, 75, 45]; // Grad, links → rechts
const ARC_CIRCLE = 58;

function ArcItem({
  icon,
  label,
  index,
  centerX,
  centerBottom,
  onPress,
}: {
  icon: IriIconName;
  label: string;
  index: number;
  centerX: number;
  centerBottom: number;
  onPress: () => void;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    // Stagger von innen nach aussen wirkt wie ein Auffaechern
    progress.value = withDelay(index * 45, withSpring(1, { damping: 15, stiffness: 240 }));
  }, [index, progress]);

  const rad = (ARC_ANGLES[index] * Math.PI) / 180;
  const dx = Math.cos(rad) * ARC_RADIUS;
  const dy = Math.sin(rad) * ARC_RADIUS;

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: (1 - progress.value) * 36 },
      { scale: 0.3 + 0.7 * progress.value },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.arcItem,
        { left: centerX + dx - styles.arcItem.width / 2, bottom: centerBottom + dy - ARC_CIRCLE / 2 - 20 },
        style,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={({ pressed }) => [styles.arcCircleWrap, pressed && styles.pressed]}
      >
        <LinearGradient
          colors={colors.roseGradient}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={styles.arcCircle}
        >
          <IriIcon name={icon} size={28} color={colors.white} />
        </LinearGradient>
      </Pressable>
      <Text style={styles.arcLabel}>{label}</Text>
    </Animated.View>
  );
}

export function IriTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width: screenW } = useWindowDimensions();
  const centerIndex = Math.ceil(state.routes.length / 2);

  // Bogen-Menü über dem Plus
  const [menuOpen, setMenuOpen] = useState(false);
  const plusRot = useSharedValue(0);
  const barBottom = Math.max(22, insets.bottom + 6);
  const plusCenterBottom = barBottom + 35; // Bar-Höhe 70, Plus mittig

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
    const next = !menuOpen;
    setMenuOpen(next);
    plusRot.value = withSpring(next ? 45 : 0, { damping: 15, stiffness: 260 });
  };

  const closeMenu = () => {
    setMenuOpen(false);
    plusRot.value = withSpring(0, { damping: 15, stiffness: 260 });
  };

  const onArcAction = (route: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    closeMenu();
    router.push(route as never);
  };

  const plusIconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${plusRot.value}deg` }],
  }));

  return (
    <>
    {menuOpen ? (
      <>
        <Pressable
          accessibilityLabel={t('common.close')}
          onPress={closeMenu}
          style={styles.arcBackdrop}
        />
        {ARC_ACTIONS.map((action, i) => (
          <ArcItem
            key={action.icon}
            icon={action.icon}
            label={t(action.labelKey)}
            index={i}
            centerX={screenW / 2}
            centerBottom={plusCenterBottom}
            onPress={() => onArcAction(action.route)}
          />
        ))}
      </>
    ) : null}
    <Animated.View style={[styles.bar, { bottom: barBottom }, barStyle]}>
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
                  <Animated.View style={plusIconStyle}>
                    <IriIcon name="plus" size={26} color={colors.white} strokeWidth={1.6} />
                  </Animated.View>
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
    </>
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
  arcBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(252,246,249,0.72)', // weich rosé-weiss, Inhalt tritt zurück
  },
  arcItem: {
    position: 'absolute',
    width: 84,
    alignItems: 'center',
    gap: 5,
  },
  // Sascha 11.08.: gleiches Design wie der Plus-Button (Rose-Verlauf, weisses Icon)
  arcCircleWrap: {
    ...tintShadow,
    borderRadius: ARC_CIRCLE / 2,
  },
  arcCircle: {
    width: ARC_CIRCLE,
    height: ARC_CIRCLE,
    borderRadius: ARC_CIRCLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  arcLabel: {
    ...typography.tabLabel,
    color: colors.ink,
  },
});
