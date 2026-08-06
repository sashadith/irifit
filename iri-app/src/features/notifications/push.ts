import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

/**
 * Push-Registrierung (Session 12). Remote-Push braucht einen Store-/Dev-Build —
 * Expo Go (SDK 53+) unterstützt keine Remote-Pushes mehr, dort wird die
 * Registrierung übersprungen (Permissions-UI funktioniert trotzdem).
 */
export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/** Einmal-Merker: Permission-Dialog nur beim ersten Home-Besuch anbieten */
export const PUSH_ASKED_KEY = 'iri.push.asked.v1';

/** Eingehende Pushes auch im Vordergrund als Banner zeigen */
export function configureNotificationHandling() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** Android braucht einen Channel, sonst erscheinen Pushes gar nicht */
async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'IriFit',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200],
  });
}

/**
 * Fragt die System-Permission an (falls nötig), holt das Expo-Push-Token und
 * speichert es in push_tokens. Synchronisiert nebenbei die Zeitzone ins Profil
 * (der Dispatch rechnet Ruhezeiten in lokaler Zeit).
 * @returns true, wenn Pushes jetzt aktiv sind
 */
export async function registerForPush(
  userId: string,
  opts: { silent?: boolean } = {},
): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (status !== 'granted') {
    if (opts.silent) return false; // stiller Sync: nie den System-Dialog auslösen
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') return false;

  await ensureAndroidChannel();

  // Zeitzone immer aktualisieren — auch in Expo Go sinnvoll
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin';
  await supabase.from('profiles').update({ timezone }).eq('id', userId);

  if (isExpoGo) return true; // kein Remote-Token in Expo Go

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    await supabase.from('push_tokens').upsert(
      { token, user_id: userId, platform: Platform.OS === 'ios' ? 'ios' : 'android' },
      { onConflict: 'token' },
    );
    return true;
  } catch {
    return false; // z. B. fehlende FCM-Credentials — Pushes bleiben aus, App läuft
  }
}

/** true, wenn der Einmal-Hinweis auf Home noch nicht gezeigt wurde */
export async function shouldOfferPush(): Promise<boolean> {
  const asked = await AsyncStorage.getItem(PUSH_ASKED_KEY);
  return asked === null;
}

export async function markPushOffered() {
  await AsyncStorage.setItem(PUSH_ASKED_KEY, 'yes');
}

/**
 * Tap auf eine Benachrichtigung → Deep Link (Konzept 13: nie nur „App öffnen").
 * route ist ein App-Pfad; 'manage-subscription' öffnet die Play-Abo-Verwaltung.
 */
export function resolvePushRoute(data: Record<string, unknown>): string | null {
  const route = typeof data.route === 'string' ? data.route : null;
  if (!route) return null;
  if (route === 'manage-subscription') {
    Linking.openURL(
      'https://play.google.com/store/account/subscriptions?package=com.irinadith.irifit',
    );
    return null;
  }
  return route;
}
