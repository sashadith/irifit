import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import * as Haptics from 'expo-haptics';

import { IrinaCard } from '@/components/coaching/IrinaCard';
import { GlassView } from '@/components/glass/GlassView';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { Chip } from '@/components/ui/Chip';
import { GhostButton } from '@/components/ui/GhostButton';
import { GlassInput } from '@/components/ui/GlassInput';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { useAuth } from '@/features/auth/AuthProvider';
import { t } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { colors, font, radius, spacing, typography } from '@/theme';

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

  // S16: Makro-Voreinstellungen — Anteile von kcal, umgerechnet in Gramm (4/4/9 kcal je g).
  // „Ausgewogen" = exakt der Onboarding-Startwert (calorieGoal.ts: 23/47/30).
  const MACRO_PRESETS = [
    { key: 'balanced', labelKey: 'profile.macroBalanced', p: 0.23, c: 0.47, f: 0.3 },
    { key: 'protein', labelKey: 'profile.macroProtein', p: 0.32, c: 0.38, f: 0.3 },
    { key: 'lowcarb', labelKey: 'profile.macroLowCarb', p: 0.28, c: 0.3, f: 0.42 },
  ] as const;

  const presetGrams = (preset: (typeof MACRO_PRESETS)[number]) => {
    const base = profile?.kcal_goal ?? 1600;
    const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);
    return {
      protein_goal_g: round5((base * preset.p) / 4),
      carbs_goal_g: round5((base * preset.c) / 4),
      fat_goal_g: round5((base * preset.f) / 9),
    };
  };

  const presetActive = (preset: (typeof MACRO_PRESETS)[number]) => {
    const g = presetGrams(preset);
    return (
      profile?.protein_goal_g === g.protein_goal_g &&
      profile?.carbs_goal_g === g.carbs_goal_g &&
      profile?.fat_goal_g === g.fat_goal_g
    );
  };

  const applyPreset = async (preset: (typeof MACRO_PRESETS)[number]) => {
    if (!session) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { error } = await supabase
      .from('profiles')
      .update(presetGrams(preset))
      .eq('id', session.user.id);
    if (error) {
      Alert.alert(t('common.error'), t('profile.saveFailed'));
      return;
    }
    await refreshProfile();
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
        <Text style={styles.macroLabel}>{t('profile.macroSection')}</Text>
        <View style={styles.macroChips}>
          {MACRO_PRESETS.map((preset) => (
            <Chip
              key={preset.key}
              label={t(preset.labelKey)}
              selected={presetActive(preset)}
              onPress={() => applyPreset(preset)}
            />
          ))}
        </View>
        <Text style={styles.hint}>{t('profile.macroHint')}</Text>
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
          onPress={() => router.push('/legal?doc=privacy')}
        />
        <GhostButton
          label={t('profile.terms')}
          small
          onPress={() => router.push('/legal?doc=terms')}
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
  macroLabel: {
    fontFamily: font.bold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.muted,
    marginTop: 16,
    marginBottom: 8,
  },
  macroChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
