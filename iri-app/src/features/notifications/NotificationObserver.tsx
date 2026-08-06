import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';

import { configureNotificationHandling, resolvePushRoute } from '@/features/notifications/push';

/**
 * Globaler Beobachter (Session 12): zeigt Pushes im Vordergrund an und
 * routet beim Antippen zum Deep Link aus data.route — auch beim Kaltstart.
 */
export function NotificationObserver() {
  const router = useRouter();

  useEffect(() => {
    configureNotificationHandling();

    const open = (response: Notifications.NotificationResponse | null) => {
      const data = response?.notification.request.content.data;
      if (!data) return;
      const route = resolvePushRoute(data as Record<string, unknown>);
      // Guards fangen Fälle ohne Session/Onboarding ab und leiten passend um
      if (route) router.push(route as never);
    };

    Notifications.getLastNotificationResponseAsync().then(open);
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [router]);

  return null;
}
