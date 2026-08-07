import { useEffect, useState } from 'react';
import { StyleProp, Text, TextStyle } from 'react-native';
import {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

export interface AnimatedNumberProps {
  readonly value: number;
  /** Startwert beim ersten Rendern (z. B. 0 für Hochzählen); default: value */
  readonly from?: number;
  readonly decimals?: number;
  readonly duration?: number;
  readonly style?: StyleProp<TextStyle>;
}

/**
 * Zahl, die zu ihrem Wert rollt statt zu springen (S16: Ring-Zahl, Gewichts-Ticker).
 * Läuft als Timing auf dem UI-Thread; der Anzeigetext wird per Reaction gesetzt.
 */
export function AnimatedNumber({
  value,
  from,
  decimals = 0,
  duration = 800,
  style,
}: AnimatedNumberProps) {
  const sv = useSharedValue(from ?? value);
  const [display, setDisplay] = useState(from ?? value);

  useEffect(() => {
    sv.value = withTiming(value, { duration, easing: Easing.out(Easing.cubic) });
  }, [value, duration, sv]);

  useAnimatedReaction(
    () => sv.value,
    (v) => {
      runOnJS(setDisplay)(v);
    },
  );

  return (
    <Text style={style}>
      {display.toLocaleString('de-DE', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
    </Text>
  );
}
