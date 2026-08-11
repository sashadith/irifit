import { useEffect, useRef } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { colors, font } from '@/theme';

/**
 * Scroll-Rad ohne native Abhängigkeit (Session 22, Mengen-Wahl im FoodSheet):
 * ScrollView mit Snap auf Zeilenhöhe, milchige Mittel-Kapsel als Auswahl,
 * Haptik-Tick pro Rastung — fühlt sich wie der iOS-Picker an, läuft aber
 * im bestehenden Dev-Client ohne neuen Build.
 */
export const WHEEL_ITEM_H = 34;
const VISIBLE = 5; // ungerade, damit eine Zeile exakt in der Mitte liegt

export interface WheelPickerProps {
  readonly values: readonly string[];
  readonly selectedIndex: number;
  readonly onChange: (index: number) => void;
  readonly width?: number;
}

export function WheelPicker({ values, selectedIndex, onChange, width = 96 }: WheelPickerProps) {
  const ref = useRef<ScrollView>(null);
  const lastTick = useRef(selectedIndex);
  const dragging = useRef(false);

  // Programmatische Auswahl (z. B. Einheiten-Wechsel setzt die Menge neu)
  useEffect(() => {
    if (dragging.current) return;
    ref.current?.scrollTo({ y: selectedIndex * WHEEL_ITEM_H, animated: false });
    lastTick.current = selectedIndex;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex, values.join('|')]);

  const indexAt = (y: number) =>
    Math.min(values.length - 1, Math.max(0, Math.round(y / WHEEL_ITEM_H)));

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = indexAt(e.nativeEvent.contentOffset.y);
    if (idx !== lastTick.current) {
      lastTick.current = idx;
      Haptics.selectionAsync();
    }
  };

  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    dragging.current = false;
    onChange(indexAt(e.nativeEvent.contentOffset.y));
  };

  return (
    <View style={[styles.wrap, { width }]}>
      <View pointerEvents="none" style={styles.highlight} />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={WHEEL_ITEM_H}
        decelerationRate="fast"
        contentContainerStyle={styles.content}
        contentOffset={{ x: 0, y: selectedIndex * WHEEL_ITEM_H }}
        onScrollBeginDrag={() => {
          dragging.current = true;
        }}
        onScroll={onScroll}
        scrollEventThrottle={32}
        onMomentumScrollEnd={settle}
      >
        {values.map((value, i) => (
          <View key={`${value}-${i}`} style={styles.item}>
            <Text style={styles.itemText}>{value}</Text>
          </View>
        ))}
      </ScrollView>
      {/* Weiche Verläufe oben/unten, damit das Rad „rund" wirkt */}
      <View pointerEvents="none" style={[styles.fade, styles.fadeTop]} />
      <View pointerEvents="none" style={[styles.fade, styles.fadeBottom]} />
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
    top: WHEEL_ITEM_H * 2,
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
    fontSize: 16,
    color: colors.ink,
  },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: WHEEL_ITEM_H,
  },
  fadeTop: {
    top: 0,
    backgroundColor: 'rgba(255,250,252,0.55)',
  },
  fadeBottom: {
    bottom: 0,
    backgroundColor: 'rgba(255,250,252,0.55)',
  },
});
