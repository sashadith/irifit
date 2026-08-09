import { useEffect } from 'react';
import { DancingScript_600SemiBold } from '@expo-google-fonts/dancing-script';
import { AnticDidone_400Regular } from '@expo-google-fonts/antic-didone';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider } from '@/features/auth/AuthProvider';
import { NotificationObserver } from '@/features/notifications/NotificationObserver';
import { initSounds } from '@/features/sound/sounds';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    DancingScript_600SemiBold,
    AnticDidone_400Regular,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Failsafe (Befund 09.08., iOS hing im Splash): Egal was beim Start klemmt —
  // nach 5 s wird der Splash zwangsweise entfernt, damit ein Fehler sichtbar
  // wird statt als eingefrorenes Startbild zu erscheinen.
  useEffect(() => {
    const timer = setTimeout(() => SplashScreen.hideAsync(), 5000);
    return () => clearTimeout(timer);
  }, []);

  // Ton-Einstellung einmal laden (S18)
  useEffect(() => {
    initSounds();
  }, []);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <AuthProvider>
      <NotificationObserver />
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="scan" options={{ presentation: 'modal' }} />
        <Stack.Screen name="food-search" options={{ presentation: 'modal' }} />
        <Stack.Screen name="progress" />
        <Stack.Screen name="reminders" />
        <Stack.Screen name="legal" />
        <Stack.Screen name="recipe/[id]" />
        <Stack.Screen name="shopping-list" options={{ presentation: 'modal' }} />
        <Stack.Screen name="legacy" />
        <Stack.Screen name="course/[id]" />
        <Stack.Screen name="lesson/[id]" />
        <Stack.Screen name="training/[id]" />
      </Stack>
    </AuthProvider>
  );
}
