import { PropsWithChildren, RefObject } from 'react';
import {
  FlatList,
  FlatListProps,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Wallpaper } from '@/components/Wallpaper';
import { spacing } from '@/theme';

export interface ScreenScaffoldProps {
  /** Platz für die schwebende Tab-Bar am unteren Rand freihalten */
  readonly withTabBarInset?: boolean;
  /** Scrollbar (Standard) oder statischer Screen */
  readonly scroll?: boolean;
  /** Zugriff auf die ScrollView, z. B. um Eingabefelder über die Tastatur zu scrollen */
  readonly scrollRef?: RefObject<ScrollView | null>;
}

/** Wallpaper + Safe-Area-Padding — Grundgerüst jedes Screens */
export function ScreenScaffold({
  withTabBarInset = true,
  scroll = true,
  scrollRef,
  children,
}: PropsWithChildren<ScreenScaffoldProps>) {
  const insets = useSafeAreaInsets();
  const contentStyle = [
    styles.content,
    {
      paddingTop: insets.top + spacing.md,
      paddingBottom: withTabBarInset ? 108 + insets.bottom : insets.bottom + spacing.xl,
    },
  ];

  return (
    <View style={styles.root}>
      <Wallpaper />
      {scroll ? (
        // Android rendert edge-to-edge (SDK 54): adjustResize greift nicht mehr,
        // deshalb schafft das KeyboardAvoidingView den Platz über der Tastatur.
        <KeyboardAvoidingView
          style={styles.fill}
          behavior="padding"
          enabled={Platform.OS === 'android'}
        >
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={contentStyle}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            /* iOS schiebt den Inhalt selbst ueber die Tastatur. Ohne das lag
               das Gutscheinfeld der Paywall unter der Tastatur (Sascha 16.08.,
               Screenshot) — das KeyboardAvoidingView darueber ist bewusst nur
               auf Android aktiv, weil dort adjustResize seit SDK 54 nicht mehr
               greift. Auf iOS ist der contentInset der saubere Weg und wirkt
               auf JEDEN Scroll-Bildschirm, nicht nur auf die Paywall. */
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          >
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <View style={[styles.fill, contentStyle]}>{children}</View>
      )}
      {/* Weicher Fade unter der Statusbar, damit Scroll-Inhalt nicht hart hineinläuft */}
      <LinearGradient
        colors={['rgba(250,243,242,0.96)', 'rgba(250,243,242,0.75)', 'rgba(250,243,242,0)']}
        locations={[0, 0.55, 1]}
        pointerEvents="none"
        style={[styles.topFade, { height: insets.top + 18 }]}
      />
    </View>
  );
}

/**
 * Wie ScreenScaffold, aber mit virtualisierter Liste statt ScrollView
 * (Sascha 18.08.: Die Rezeptseite renderte alle 158 Karten samt Bildern auf
 * einmal — ~30 MB dekodierte Bilder und eine sekundenlange Erst-Renderzeit).
 * FlatList haelt nur die sichtbaren Zeilen plus etwas Vorlauf im Speicher;
 * beim Scrollen werden Karten ein- und ausgehaengt.
 *
 * Safe-Area, Tab-Bar-Abstand, Tastatur-Verhalten und der Fade unter der
 * Statusbar sind identisch zum ScreenScaffold — gleiche Werte, gleiche Optik.
 */
export function ScreenListScaffold<T>({
  withTabBarInset = true,
  ...list
}: FlatListProps<T> & { readonly withTabBarInset?: boolean }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <Wallpaper />
      <KeyboardAvoidingView
        style={styles.fill}
        behavior="padding"
        enabled={Platform.OS === 'android'}
      >
        <FlatList
          {...list}
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: insets.top + spacing.md,
              paddingBottom: withTabBarInset ? 108 + insets.bottom : insets.bottom + spacing.xl,
            },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          // Zurueckhaltende Fenster: 8 Zeilen sofort, kleiner Vorlauf beim
          // Scrollen — auf einem 158er-Katalog der Unterschied zwischen
          // fluessig und Sekunden-Haenger
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews
        />
      </KeyboardAvoidingView>
      <LinearGradient
        colors={['rgba(250,243,242,0.96)', 'rgba(250,243,242,0.75)', 'rgba(250,243,242,0)']}
        locations={[0, 0.55, 1]}
        pointerEvents="none"
        style={[styles.topFade, { height: insets.top + 18 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  fill: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.screenX,
  },
  topFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});
