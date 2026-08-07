import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';

import { IrinaCard } from '@/components/coaching/IrinaCard';
import { GlassView } from '@/components/glass/GlassView';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { GhostButton } from '@/components/ui/GhostButton';
import { GlassInput } from '@/components/ui/GlassInput';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { useAuth } from '@/features/auth/AuthProvider';
import { t } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { colors, font, radius, spacing, typography } from '@/theme';

// Rechtstexte — Interims-Hosting: legal-Edge-Function serviert die Seiten aus dem
// legal-Bucket (Storage direkt erzwingt text/plain für HTML). Quelle: data/legal/.
// Nach juristischer Prüfung ziehen die Texte auf irinaskorik.com um → nur diese
// beiden Konstanten + die URL in der Play Console anpassen.
const PRIVACY_URL = 'https://mzzonwvbacxlpwsmefrn.supabase.co/functions/v1/legal/datenschutz';
const TERMS_URL = 'https://mzzonwvbacxlpwsmefrn.supabase.co/functions/v1/legal/agb';

/** Profil & Einstellungen (Session 15): Konto, Erinnerungen, Irinas Ecke, Recht */
export default function ProfilScreen() {
  const router = useRouter();
  const { signOut, session, profile, refreshProfile } = useAuth();
  const [showIrina, setShowIrina] = useState(false);
  const [name, setName] = useState(profile?.display_name ?? '');
  const [kcal, setKcal] = useState(profile?.kcal_goal ? String(profile.kcal_goal) : '');
  const [saving, setSaving] = useState(false);

  const kcalNum = Number.parseInt(kcal, 10);
  const kcalValid = !kcal || (Number.isFinite(kcalNum) && kcalNum >= 1200 && kcalNum <= 10000);
  const dirty =
    name.trim() !== (profile?.display_name ?? '') ||
    (kcal !== '' && kcalNum !== profile?.kcal_goal);

  const save = async () => {
    if (!session || !kcalValid) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: name.trim() || null,
          ...(kcal !== '' ? { kcal_goal: kcalNum } : {}),
        })
        .eq('id', session.user.id);
      if (error) throw error;
      await refreshProfile();
    } catch {
      Alert.alert(t('common.error'), t('profile.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(t('profile.deleteTitle'), t('profile.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.deleteConfirm1'),
        style: 'destructive',
        onPress: () =>
          Alert.alert(t('profile.deleteTitle2'), t('profile.deleteBody2'), [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('profile.deleteConfirm2'), style: 'destructive', onPress: deleteAccount },
          ]),
      },
    ]);
  };

  const deleteAccount = async () => {
    const { error } = await supabase.functions.invoke('delete-account', { body: {} });
    if (error) {
      Alert.alert(t('common.error'), t('profile.deleteFailed'));
      return;
    }
    await signOut(); // lokale Session weg → Guards leiten zu Welcome
  };

  return (
    <ScreenScaffold>
      <Text style={[typography.displayLg, styles.title]}>{t('profile.title')}</Text>

      <GlassView borderRadius={radius.md} contentStyle={styles.card}>
        <Text style={styles.sectionTitle}>{t('profile.accountSection')}</Text>
        <Text style={[typography.bodyMuted, styles.email]}>{session?.user.email}</Text>
        <GlassInput
          label={t('profile.firstName')}
          value={name}
          onChangeText={setName}
          autoComplete="given-name"
          placeholder="Sandra"
        />
        <GlassInput
          label={t('profile.kcalGoal')}
          value={kcal}
          onChangeText={setKcal}
          keyboardType="number-pad"
          unit="kcal"
          placeholder={profile?.kcal_goal ? String(profile.kcal_goal) : '1600'}
        />
        {!kcalValid ? <Text style={styles.hintError}>{t('profile.kcalMin')}</Text> : null}
        <Text style={styles.hint}>{t('profile.kcalHint')}</Text>
        {dirty ? (
          <PrimaryButton
            label={t('common.save')}
            onPress={save}
            loading={saving}
            disabled={!kcalValid}
            style={styles.saveGap}
          />
        ) : null}
      </GlassView>

      <GhostButton
        label={t('profile.reminders')}
        onPress={() => router.push('/reminders')}
        style={styles.gap}
      />

      <GlassView borderRadius={radius.md} contentStyle={styles.card} style={styles.gap}>
        <Text style={styles.sectionTitle}>{t('profile.irinaSection')}</Text>
        <GhostButton label={t('profile.aboutIrina')} onPress={() => setShowIrina(true)} />
        <GhostButton
          label={t('profile.askIrina')}
          onPress={() => router.push('/(tabs)/coaching')}
          style={styles.smallGap}
        />
      </GlassView>

      <GlassView borderRadius={radius.md} contentStyle={styles.card} style={styles.gap}>
        <Text style={styles.sectionTitle}>{t('profile.legalSection')}</Text>
        <GhostButton
          label={t('profile.privacy')}
          small
          onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)}
        />
        <GhostButton
          label={t('profile.terms')}
          small
          onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)}
          style={styles.smallGap}
        />
      </GlassView>

      <GhostButton label={t('profile.signOut')} onPress={signOut} style={styles.gap} />
      <View style={styles.deleteWrap}>
        <Text style={styles.deleteLink} onPress={confirmDelete}>
          {t('profile.deleteAccount')}
        </Text>
      </View>

      <IrinaCard visible={showIrina} onClose={() => setShowIrina(false)} />
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  title: {
    marginBottom: spacing.lg,
  },
  card: {
    padding: spacing.lg,
  },
  sectionTitle: {
    fontFamily: font.bold,
    fontSize: 13.5,
    color: colors.ink,
    marginBottom: 10,
  },
  email: {
    marginBottom: 12,
  },
  hint: {
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted,
    marginTop: 6,
  },
  hintError: {
    fontFamily: font.semibold,
    fontSize: 12,
    color: colors.tintDeep,
    marginTop: 6,
  },
  saveGap: {
    marginTop: 14,
  },
  gap: {
    marginTop: spacing.md,
  },
  smallGap: {
    marginTop: 10,
  },
  deleteWrap: {
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  deleteLink: {
    fontFamily: font.semibold,
    fontSize: 13,
    color: colors.muted,
    textDecorationLine: 'underline',
  },
});
