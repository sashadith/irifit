import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

/**
 * Sign in with Apple → Supabase signInWithIdToken.
 * Läuft nativ ab iOS 13; in Expo Go nutzbar, sobald der Apple-Provider im
 * Supabase-Dashboard konfiguriert ist (Services-ID host.exp.Exponent für Go).
 */
export async function signInWithApple(): Promise<void> {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });
  if (!credential.identityToken) {
    throw new Error('Apple hat kein Identity-Token geliefert');
  }
  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });
  if (error) throw error;
}

/**
 * Google-Login über den System-Browser (PKCE-Flow) — funktioniert in Expo Go.
 * Voraussetzung: Google-Provider im Supabase-Dashboard konfiguriert und die
 * Redirect-URL der App dort eingetragen.
 */
export async function signInWithGoogle(): Promise<void> {
  const redirectTo = Linking.createURL('auth/callback');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return; // Abbruch durch Nutzerin

  const code = new URL(result.url).searchParams.get('code');
  if (!code) throw new Error('Kein Auth-Code in der Redirect-URL');
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw exchangeError;
}
