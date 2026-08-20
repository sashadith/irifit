import { useMemo, useState } from 'react';
import {
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import { GlassView } from '@/components/glass/GlassView';
import { AppleLogo } from '@/components/icons/AppleLogo';
import { GoogleLogo } from '@/components/icons/GoogleLogo';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { GhostButton } from '@/components/ui/GhostButton';
import { GlassInput } from '@/components/ui/GlassInput';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useAuth } from '@/features/auth/AuthProvider';
import { schlageAdresseVor } from '@/features/auth/emailTypo';
import { signInWithApple, signInWithGoogle } from '@/features/auth/oauth';
import { useOnboarding } from '@/features/onboarding/OnboardingProvider';
import { t } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { colors, font, spacing, typography } from '@/theme';

/** Schritt 7 von 7 — Account anlegen (E-Mail, Apple, Google) */
export default function AccountScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { answers, update } = useOnboarding();
  const [name, setName] = useState(answers.displayName ?? '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  /* Vertipper in der Domain (Sascha 20.08.): Wir verlangen bewusst keine
     Bestaetigung per Mail — dann muss der Fehler hier auffallen, sonst ist
     die Kundin bei vergessenem Passwort dauerhaft ausgesperrt. */
  const vorschlag = useMemo(() => schlageAdresseVor(email), [email]);
  const [busy, setBusy] = useState(false);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);

  /** Name in die Antworten spiegeln, bevor ein Signup-Weg (E-Mail/OAuth) startet */
  const persistName = () => update({ displayName: name.trim() || undefined });

  const signUp = async () => {
    persistName();
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      if (data.session) {
        // Session da → Profil entsteht im AuthProvider, weiter zur Paywall
        router.push('/(onboarding)/paywall');
      } else {
        // E-Mail-Bestätigung aktiv → Hinweis zeigen
        setAwaitingConfirm(true);
      }
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const oauth = async (provider: 'apple' | 'google') => {
    persistName();
    setBusy(true);
    try {
      await (provider === 'apple' ? signInWithApple() : signInWithGoogle());
      router.push('/(onboarding)/paywall');
    } catch {
      Alert.alert(t('common.error'), t('onboarding.account.oauthUnavailable'));
    } finally {
      setBusy(false);
    }
  };

  // Bereits angemeldet (z. B. Legacy-Kundin nach Magic-Link): kein zweiter
  // Account — Name sichern und direkt weiter zur Paywall.
  if (session) {
    return (
      <ScreenScaffold withTabBarInset={false}>
        <ProgressBar progress={1} />
        <Text style={typography.eyebrow}>{t('onboarding.stepLabel', { step: 7 })}</Text>
        <Text style={[typography.displayLg, styles.title]}>
          {t('onboarding.account.alreadySignedInTitle')}
        </Text>
        <GlassView style={styles.confirmCard} contentStyle={styles.cardPad}>
          <Text style={styles.hint}>
            {t('onboarding.account.alreadySignedInText', { email: session.user.email ?? '' })}
          </Text>
        </GlassView>
        {/* Luft zwischen Hinweiskarte und Feld (Sascha 17.08.) */}
        <View style={styles.nameGap} />
        <GlassInput
          label={t('onboarding.account.name')}
          value={name}
          onChangeText={setName}
          autoComplete="given-name"
          autoCapitalize="words"
          placeholder={t('onboarding.account.namePlaceholder')}
        />
        <PrimaryButton
          label={t('common.next')}
          onPress={() => {
            persistName();
            router.push('/(onboarding)/paywall');
          }}
          style={styles.topGap}
        />
      </ScreenScaffold>
    );
  }

  if (awaitingConfirm) {
    return (
      <ScreenScaffold withTabBarInset={false}>
        <View style={styles.confirmWrap}>
          <Text style={[typography.displayLg, styles.centered]}>
            {t('onboarding.account.confirmEmailTitle')}
          </Text>
          <GlassView style={styles.confirmCard} contentStyle={styles.cardPad}>
            <Text style={styles.hint}>
              {t('onboarding.account.confirmEmailText', { email: email.trim() })}
            </Text>
          </GlassView>
          <PrimaryButton
            label={t('onboarding.login.signIn')}
            onPress={() => router.push('/(onboarding)/login')}
            style={styles.topGap}
          />
        </View>
      </ScreenScaffold>
    );
  }

  const valid = /\S+@\S+\.\S+/.test(email.trim()) && password.length >= 8;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenScaffold withTabBarInset={false}>
        <ProgressBar progress={1} />
        <Text style={typography.eyebrow}>{t('onboarding.stepLabel', { step: 7 })}</Text>
        <Text style={[typography.displayLg, styles.title]}>{t('onboarding.account.title')}</Text>
        <Text style={[typography.bodyMuted, styles.subtitle]}>
          {t('onboarding.account.subtitle')}
        </Text>

        <View style={styles.form}>
          <GlassInput
            label={t('onboarding.account.name')}
            value={name}
            onChangeText={setName}
            autoComplete="given-name"
            autoCapitalize="words"
            placeholder={t('onboarding.account.namePlaceholder')}
          />
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
          <GlassInput
            label={t('onboarding.account.password')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            placeholder={t('onboarding.account.passwordHint')}
          />
          <PrimaryButton
            label={t('onboarding.account.signUp')}
            onPress={signUp}
            disabled={!valid}
            loading={busy}
            style={styles.topGap}
          />
        </View>

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
          label={t('onboarding.account.toLogin')}
          small
          onPress={() => router.push('/(onboarding)/login')}
          style={styles.topGap}
        />
      </ScreenScaffold>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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
  title: {
    marginTop: 10,
  },
  subtitle: {
    marginTop: 6,
  },
  form: {
    marginTop: spacing.lg,
  },
  nameGap: {
    height: spacing.lg,
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
  confirmWrap: {
    marginTop: 60,
  },
  centered: {
    textAlign: 'center',
  },
  confirmCard: {
    marginTop: spacing.lg,
  },
  cardPad: {
    padding: spacing.lg,
  },
  hint: {
    fontFamily: font.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.muted,
    textAlign: 'center',
  },
});
