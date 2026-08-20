import { useMemo, useState } from 'react';
import { Pressable, Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ScreenScaffold } from '@/components/ScreenScaffold';
import { AppleLogo } from '@/components/icons/AppleLogo';
import { GoogleLogo } from '@/components/icons/GoogleLogo';
import { GhostButton } from '@/components/ui/GhostButton';
import { GlassInput } from '@/components/ui/GlassInput';
import { IriAvatar } from '@/components/ui/IriAvatar';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { RoseHeart } from '@/components/ui/RoseHeart';
import { schlageAdresseVor } from '@/features/auth/emailTypo';
import { signInWithApple, signInWithGoogle } from '@/features/auth/oauth';
import { useOnboarding } from '@/features/onboarding/OnboardingProvider';
import { t } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { colors, font, spacing, typography } from '@/theme';

/** Login für bestehende Accounts (E-Mail, Apple, Google) */
export default function LoginScreen() {
  const router = useRouter();
  const { answers } = useOnboarding();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  /* Vertipper in der Domain (Sascha 20.08.): Wir verlangen bewusst keine
     Bestaetigung per Mail — dann muss der Fehler hier auffallen, sonst ist
     die Kundin bei vergessenem Passwort dauerhaft ausgesperrt. */
  const vorschlag = useMemo(() => schlageAdresseVor(email), [email]);
  const [busy, setBusy] = useState(false);
  const [codeGesendet, setCodeGesendet] = useState(false);
  const [code, setCode] = useState('');

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
        // Wurde das Quiz in dieser Sitzung schon beantwortet, NICHT von vorn
        // beginnen (Befund Beta 09.08.: „Fragerunde fing von vorne an") —
        // die Antworten liegen im OnboardingProvider und fließen beim
        // Abschluss ins Profil. Direkt weiter zur Paywall; hat der Account
        // bereits Zugang (Beta/Abo), springt die von selbst weiter.
        const quizDone =
          answers.goal != null &&
          answers.birthYear != null &&
          answers.heightCm != null &&
          answers.weightKg != null &&
          answers.activity != null;
        router.replace(quizDone ? '/(onboarding)/paywall' : '/(onboarding)/goal');
      }
    } finally {
      setBusy(false);
    }
  };

  /**
   * Anmelden per Code statt Passwort (Sascha 20.08.).
   *
   * Ersetzt das klassische „Passwort zuruecksetzen" — das gab es bisher gar
   * nicht, wer sein Passwort vergass, kam schlicht nicht mehr in ein bezahltes
   * Abo. Ein Code ist an dieser Stelle auch das Einfachere: Der Gang ins
   * Postfach ist ohnehin unvermeidlich, und danach tippt man sechs Ziffern
   * statt sich ein neues Passwort auszudenken.
   *
   * shouldCreateUser: false ist wichtig — sonst legt ein Vertipper hier stumm
   * einen zweiten, leeren Account an.
   */
  const codeAnfordern = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false },
      });
      if (error) throw error;
      setCodeGesendet(true);
    } catch {
      Alert.alert(t('common.error'), t('onboarding.login.codeError'));
    } finally {
      setBusy(false);
    }
  };

  const codePruefen = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: 'email',
      });
      if (error) throw error;
      // Weiter wie beim Passwort-Login: Die Guards uebernehmen ab hier.
      router.replace('/(tabs)');
    } catch {
      Alert.alert(t('common.error'), t('onboarding.login.codeInvalid'));
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
            {t('onboarding.login.title')} <RoseHeart size={22} />
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
          {vorschlag ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('onboarding.account.typoCta')}
              onPress={() => setEmail(vorschlag)}
              hitSlop={8}
              style={styles.typoRow}
            >
              <Text style={styles.typoText}>
                {t('onboarding.account.typoHint', { suggestion: vorschlag })}
              </Text>
            </Pressable>
          ) : null}
        {codeGesendet ? (
          /* Code-Weg: Das Passwortfeld weicht dem Code-Feld, damit niemand
             raetselt, welches der beiden jetzt gilt. */
          <>
            <GlassInput
              label={t('onboarding.login.codeLabel')}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
            />
            <Text style={styles.codeHint}>
              {t('onboarding.login.codeSent', { email: email.trim() })}
            </Text>
            <PrimaryButton
              label={t('onboarding.login.codeSignIn')}
              onPress={codePruefen}
              disabled={code.trim().length < 6}
              loading={busy}
              style={styles.topGap}
            />
            <GhostButton
              label={t('onboarding.login.codeBack')}
              small
              onPress={() => {
                setCodeGesendet(false);
                setCode('');
              }}
              style={styles.smallGap}
            />
          </>
        ) : (
          <>
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
            {/* Kein „Passwort zuruecksetzen", sondern gleich der Code — ein
                Schritt weniger, und ein neues Passwort muss sich niemand
                ausdenken. Nur anklickbar, wenn eine Adresse dasteht. */}
            <GhostButton
              label={t('onboarding.login.forgot')}
              small
              onPress={() => {
                if (!email.trim() || busy) {
                  Alert.alert(t('common.error'), t('onboarding.login.codeNeedsEmail'));
                  return;
                }
                codeAnfordern();
              }}
              style={styles.smallGap}
            />
          </>
        )}
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
  codeHint: {
    fontFamily: font.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.muted,
    marginTop: -4,
    marginLeft: 6,
  },
  typoRow: {
    marginTop: -6,
    marginBottom: 10,
    marginLeft: 6,
  },
  typoText: {
    fontFamily: font.semibold,
    fontSize: 12.5,
    color: colors.tintDeep,
  },
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
