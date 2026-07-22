import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/features/auth/AuthProvider';
import { OnboardingProvider } from '@/features/onboarding/OnboardingProvider';

export default function OnboardingLayout() {
  const { session, profile, loading } = useAuth();

  if (loading) return null;
  if (session && profile?.onboarding_completed_at) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <OnboardingProvider>
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
    </OnboardingProvider>
  );
}
