import { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Wallpaper } from '@/components/Wallpaper';
import { spacing } from '@/theme';

export interface ScreenScaffoldProps {
  /** Platz für die schwebende Tab-Bar am unteren Rand freihalten */
  readonly withTabBarInset?: boolean;
  /** Scrollbar (Standard) oder statischer Screen */
  readonly scroll?: boolean;
}

/** Wallpaper + Safe-Area-Padding — Grundgerüst jedes Screens */
export function ScreenScaffold({
  withTabBarInset = true,
  scroll = true,
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
        <ScrollView contentContainerStyle={contentStyle} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
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
