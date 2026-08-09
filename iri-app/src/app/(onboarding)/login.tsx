import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ScreenScaffold } from '@/components/ScreenScaffold';
import { AppleLogo } from '@/components/icons/AppleLogo';
import { GoogleLogo } from '@/components/icons/GoogleLogo';
import { GhostButton } from '@/components/ui/GhostButton';
import { GlassInput } from '@/components/ui/GlassInput';
import { IriAvatar } from '@/components/ui/IriAvatar';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { RoseHeart } from '@/components/ui/RoseHeart';
import { signInWithApple, signInWithGoogle } from '@/features/auth/oauth';
import { t } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { colors, font, spacing, typography } from '@/theme';

/** Login für bestehende Accounts (E-Mail, Apple, Google) */
export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        Alert.alert(t('common.error'), t('onboarding.login.invalidCredentials'));
        return;
      }
      // Ohne abgeschlossenes Onboarding greift kein Guard (der Onboarding-Guard
      // redirectet nur bei onboarding_completed_at) — die Session käme an, aber
      // der Login-Screen bliebe stehen. Darum hier selbst weiterleiten:
      // direkt in den ersten Quiz-Schritt, NICHT auf Welcome — dort stünde
      // wieder „Ich habe schon einen Account“ und der Login sähe gescheitert aus.
      // Abgeschlossene Profile leiten die Guards wie bisher zu den Tabs.
      const { data: profileRow } = await supabase
        .from('profiles')
        .select('onboarding_completed_at')
        .eq('id', data.user.id)
        .maybeSingle();
      if (!profileRow?.onboarding_completed_at) {
        router.replace('/(onboarding)/goal');
      }
    } finally {
      setBusy(false);
    }
  };

  const oauth = async (provider: 'apple' | 'google') => {
    setBusy(true);
    try {
      await (provider === 'apple' ? signInWithApple() : signInWithGoogle());
    } catch {
      Alert.alert(t('common.error'), t('onboarding.account.oauthUnavailable'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenScaffold withTabBarInset={false}>
        <View style={styles.top}>
          <IriAvatar size={74} />
          <Text style={[typography.displayLg, styles.title]}>
            {t('onboarding.login.title')} <RoseHeart />
          </Text>
        </View>
        <GlassInput
          label={t('onboarding.account.email')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          placeholder="du@beispiel.de"
        />
        <GlassInput
          label={t('onboarding.account.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
        />
        <PrimaryButton
          label={t('onboarding.login.signIn')}
          onPress={signIn}
          disabled={!email.trim() || !password}
          loading={busy}
          style={styles.topGap}
        />
        <Text style={styles.divider}>{t('onboarding.account.orWith')}</Text>
        {Platform.OS === 'ios' ? (
          <GhostButton
            label={t('onboarding.account.apple')}
            icon={<AppleLogo />}
            onPress={() => oauth('apple')}
          />
        ) : null}
        <GhostButton
          label={t('onboarding.account.google')}
          icon={<GoogleLogo />}
          onPress={() => oauth('google')}
          style={styles.smallGap}
        />
        <GhostButton
          label={t('onboarding.login.noAccount')}
          small
          onPress={() => router.replace('/(onboarding)/welcome')}
          style={styles.topGap}
        />
      </ScreenScaffold>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  top: {
    alignItems: 'center',
    marginTop: 30,
    marginBottom: spacing.xl,
  },
  title: {
    marginTop: 14,
    textAlign: 'center',
  },
  divider: {
    fontFamily: font.semibold,
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    marginVertical: 14,
  },
  smallGap: {
    marginTop: 10,
  },
  topGap: {
    marginTop: 14,
  },
});
