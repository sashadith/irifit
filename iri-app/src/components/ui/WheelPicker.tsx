import { ReactNode, useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  runOnJS,
  SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { colors, font } from '@/theme';

/**
 * Scroll-Rad im nativen iOS-Picker-Look (Session 22): ScrollView mit Snap,
 * dazu die Trommel-Optik per Reanimated — jede Zeile kippt perspektivisch
 * aus der Mitte weg (rotateX), schrumpft und blendet aus. Kein natives
 * Modul nötig, läuft im bestehenden Dev-Client.
 */
/**
 * 24 px bei fuenf Zeilen — der Versuch vom 17.08. mit 42 px bei drei Zeilen
 * und 27er-Schrift ist zurueckgedreht (Sascha: „sieht schlimm aus"). Die
 * Trommel verlor mit drei Zeilen ihren Rad-Charakter, und das Auswahlband im
 * FoodSheet sass auf der falschen Zeile. Auch breitere Raeder (160/130 statt
 * 104/92) fielen durch: Jedes Rad zentriert seinen Inhalt, Zahl und Einheit
 * rueckten dadurch optisch auseinander. Es bleibt beim Original — gegen
 * „schwer zu treffen" (16.08.) hilft bereits, dass die Tastatur beim
 * Treffer-Tap jetzt verschwindet und das Rad frei liegt.
 */
export const WHEEL_ITEM_H = 24;
export const WHEEL_VISIBLE = 5; // ungerade, damit eine Zeile exakt in der Mitte liegt
const VISIBLE = WHEEL_VISIBLE;

export interface WheelPickerProps {
  readonly values: readonly string[];
  readonly selectedIndex: number;
  readonly onChange: (index: number) => void;
  readonly width?: number;
  /** false, wenn der Eltern-Container EIN gemeinsames Auswahlband zeichnet (iOS-Picker-Look) */
  readonly showHighlight?: boolean;
}

/** Eine Rad-Zeile: kippt/schrumpft abhängig vom Abstand zur Mitte */
function WheelItem({
  index,
  offset,
  children,
}: {
  index: number;
  offset: SharedValue<number>;
  children: ReactNode;
}) {
  const style = useAnimatedStyle(() => {
    'worklet';
    const distance = (index * WHEEL_ITEM_H - offset.value) / WHEEL_ITEM_H;
    const clamped = Math.max(-2.6, Math.min(2.6, distance));
    // Zylinder-Projektion wie beim nativen Picker: Zeilen liegen auf einer
    // Trommel mit Radius R — je weiter aussen, desto staerker ruecken sie
    // Richtung Mitte (sin statt linear), statt flach weiterzulaufen.
    const angle = clamped * 0.4538; // 26 Grad pro Zeile in rad
    const radius = WHEEL_ITEM_H / 0.4538;
    const pull = clamped * WHEEL_ITEM_H - radius * Math.sin(angle);
    return {
      transform: [
        { translateY: -pull },
        { perspective: 420 },
        { rotateX: `${clamped * 26}deg` },
        { scale: 1 - Math.abs(clamped) * 0.08 },
      ],
      opacity: 1 - Math.abs(clamped) * 0.28,
    };
  });
  return <Animated.View style={[styles.item, style]}>{children}</Animated.View>;
}

export function WheelPicker({
  values,
  selectedIndex,
  onChange,
  width = 96,
  showHighlight = true,
}: WheelPickerProps) {
  const ref = useRef<Animated.ScrollView>(null);
  const offset = useSharedValue(selectedIndex * WHEEL_ITEM_H);
  const lastTick = useSharedValue(selectedIndex);
  const dragging = useRef(false);

  // Programmatische Auswahl (z. B. Einheiten-Wechsel setzt die Menge neu)
  useEffect(() => {
    if (dragging.current) return;
    ref.current?.scrollTo({ y: selectedIndex * WHEEL_ITEM_H, animated: false });
    lastTick.value = selectedIndex;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex, values.join('|')]);

  const maxIndex = values.length - 1;

  const settle = (y: number) => {
    dragging.current = false;
    onChange(Math.min(maxIndex, Math.max(0, Math.round(y / WHEEL_ITEM_H))));
  };

  const tick = () => Haptics.selectionAsync();

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      'worklet';
      offset.value = e.contentOffset.y;
      const idx = Math.min(maxIndex, Math.max(0, Math.round(e.contentOffset.y / WHEEL_ITEM_H)));
      if (idx !== lastTick.value) {
        lastTick.value = idx;
        runOnJS(tick)();
      }
    },
    onMomentumEnd: (e) => {
      'worklet';
      runOnJS(settle)(e.contentOffset.y);
    },
  });

  return (
    <View style={[styles.wrap, { width }]}>
      {showHighlight ? <View pointerEvents="none" style={styles.highlight} /> : null}
      <Animated.ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={WHEEL_ITEM_H}
        decelerationRate="fast"
        contentContainerStyle={styles.content}
        contentOffset={{ x: 0, y: selectedIndex * WHEEL_ITEM_H }}
        onScrollBeginDrag={() => {
          dragging.current = true;
        }}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {values.map((value, i) => (
          <WheelItem key={`${value}-${i}`} index={i} offset={offset}>
            <Text style={styles.itemText}>{value}</Text>
          </WheelItem>
        ))}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: WHEEL_ITEM_H * VISIBLE,
  },
  content: {
    paddingVertical: (WHEEL_ITEM_H * (VISIBLE - 1)) / 2,
  },
  highlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: WHEEL_ITEM_H * ((VISIBLE - 1) / 2),
    height: WHEEL_ITEM_H,
    borderRadius: WHEEL_ITEM_H / 2,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  item: {
    height: WHEEL_ITEM_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    fontFamily: font.bold,
    fontSize: 15,
    color: colors.ink,
  },
});
