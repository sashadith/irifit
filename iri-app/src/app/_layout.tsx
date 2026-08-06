import { useEffect } from 'react';
import { DancingScript_600SemiBold } from '@expo-google-fonts/dancing-script';
import { Italiana_400Regular } from '@expo-google-fonts/italiana';
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

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    DancingScript_600SemiBold,
    Italiana_400Regular,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
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
