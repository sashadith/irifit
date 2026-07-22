import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { GlassView } from '@/components/glass/GlassView';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { GhostButton } from '@/components/ui/GhostButton';
import { GlassInput } from '@/components/ui/GlassInput';
import { IriAvatar } from '@/components/ui/IriAvatar';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { useAuth } from '@/features/auth/AuthProvider';
import { claimLegacyAccess } from '@/features/auth/legacy';
import { t } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { colors, font, spacing, typography } from '@/theme';

/**
 * Legacy-Zugang (Session 10): Käuferinnen des alten BLEIB-FIT-Kurses melden
 * sich ohne Passwort an — E-Mail rein, 6-stelliger Code aus der Mail, fertig.
 * Der Kauf-Abgleich läuft serverseitig (claim-legacy).
 */
export default function LegacyLoginScreen() {
  const router = useRouter();
  const { refreshLegacy, signOut } = useAuth();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCode = async () => {
    setBusy(true);
    setError(null);
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: true },
      });
      if (otpError) throw otpError;
      setCodeSent(true);
    } catch {
      setError(t('onboarding.legacy.sendFailed'));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: code.trim(),
        type: 'email',
      });
      if (verifyError) {
        setError(t('onboarding.legacy.wrongCode'));
        return;
      }
      const result = await claimLegacyAccess();
      if (result === 'claimed') {
        await refreshLegacy();
        router.replace('/legacy');
        return;
      }
      // Kein Kauf zu dieser E-Mail → wieder abmelden, Hinweis zeigen
      await signOut();
      setError(
        result === 'already_claimed'
          ? t('onboarding.legacy.alreadyClaimed')
          : t('onboarding.legacy.notFound'),
      );
      setCodeSent(false);
      setCode('');
    } catch {
      setError(t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenScaffold withTabBarInset={false}>
        <View style={styles.top}>
          <IriAvatar size={74} />
          <Text style={[typography.displayLg, styles.title]}>{t('onboarding.legacy.title')}</Text>
        </View>
        <GlassView contentStyle={styles.introPad}>
          <Text style={styles.intro}>
            {codeSent ? t('onboarding.legacy.codeSent', { email: email.trim() }) : t('onboarding.legacy.intro')}
          </Text>
        </GlassView>

        {codeSent ? (
          <>
            <View style={styles.fieldGap}>
              <GlassInput
                label={t('onboarding.legacy.codeLabel')}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                placeholder="123456"
              />
            </View>
            <PrimaryButton
              label={t('onboarding.legacy.signIn')}
              onPress={verify}
              disabled={code.trim().length < 6}
              loading={busy}
              style={styles.topGap}
            />
            <GhostButton
              label={t('onboarding.legacy.resend')}
              small
              onPress={sendCode}
              style={styles.smallGap}
            />
          </>
        ) : (
          <>
            <View style={styles.fieldGap}>
              <GlassInput
                label={t('onboarding.legacy.emailLabel')}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                placeholder="du@beispiel.de"
              />
            </View>
            <PrimaryButton
              label={t('onboarding.legacy.sendCode')}
              onPress={sendCode}
              disabled={!email.trim().includes('@')}
              loading={busy}
              style={styles.topGap}
            />
          </>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <GhostButton
          label={t('common.back')}
          small
          onPress={() => router.back()}
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
    marginBottom: spacing.lg,
  },
  title: {
    marginTop: 14,
    textAlign: 'center',
  },
  introPad: {
    padding: spacing.lg,
  },
  // Luft zwischen Hinweis-Karte und Eingabefeld (Abgleich mit den Auth-Screens)
  fieldGap: {
    marginTop: spacing.lg,
  },
  intro: {
    fontFamily: font.regular,
    fontSize: 13.5,
    lineHeight: 21,
    color: colors.muted,
    textAlign: 'center',
  },
  topGap: {
    marginTop: 14,
  },
  smallGap: {
    marginTop: 10,
  },
  error: {
    fontFamily: font.semibold,
    fontSize: 13,
    color: colors.tintDeep,
    textAlign: 'center',
    marginTop: 14,
  },
});
