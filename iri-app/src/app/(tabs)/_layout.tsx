import { Redirect, Tabs } from 'expo-router';

import { IriTabBar } from '@/components/navigation/IriTabBar';
import { useAuth } from '@/features/auth/AuthProvider';

export default function TabsLayout() {
  const { session, profile, legacy, loading } = useAuth();

  if (loading) return null;
  // Hard Paywall: ohne Account + abgeschlossenes Onboarding gibt es keine App.
  // Legacy-Käuferinnen ohne Onboarding landen in ihrem Kurs-Bereich.
  if (!session || !profile?.onboarding_completed_at) {
    return <Redirect href={session && legacy ? '/legacy' : '/(onboarding)/welcome'} />;
  }

  return (
    <Tabs
      tabBar={(props) => <IriTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="rezepte" />
      <Tabs.Screen name="coaching" />
      <Tabs.Screen name="profil" />
    </Tabs>
  );
}
