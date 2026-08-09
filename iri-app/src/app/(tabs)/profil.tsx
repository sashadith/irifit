import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import * as Haptics from 'expo-haptics';

import { IrinaCard, IRINA_LINKS, openIrinaLink } from '@/components/coaching/IrinaCard';
import { GlassView } from '@/components/glass/GlassView';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { Chip } from '@/components/ui/Chip';
import { GhostButton } from '@/components/ui/GhostButton';
import { GlassInput } from '@/components/ui/GlassInput';
import { IriAvatar } from '@/components/ui/IriAvatar';
import { IriIcon } from '@/components/icons/IriIcon';
import { RoseHeart } from '@/components/ui/RoseHeart';
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
  const [birthYear, setBirthYear] = useState(profile?.birth_year ? String(profile.birth_year) : '');
  const [startWeight, setStartWeight] = useState(
    profile?.start_weight_kg != null ? String(profile.start_weight_kg) : '',
  );
  const [targetWeight, setTargetWeight] = useState(
    profile?.target_weight_kg != null ? String(profile.target_weight_kg) : '',
  );
  const [waterGoal, setWaterGoal] = useState(
    profile?.water_goal_ml != null ? (profile.water_goal_ml / 1000).toLocaleString('de-DE') : '',
  );
  const [saving, setSaving] = useState(false);

  const kcalNum = Number.parseInt(kcal, 10);
  const kcalValid = !kcal || (Number.isFinite(kcalNum) && kcalNum >= 1200 && kcalNum <= 10000);
  const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));
  // Wasserziel in Litern eingegeben, in ml gespeichert; 0,5–6 L sind plausibel
  const waterGoalL = num(waterGoal);
  const waterGoalMl = waterGoalL != null ? Math.round(waterGoalL * 1000) : null;
  const waterValid = waterGoalMl == null || (waterGoalMl >= 500 && waterGoalMl <= 6000);
  const dirty =
    name.trim() !== (profile?.display_name ?? '') ||
    (kcal !== '' && kcalNum !== profile?.kcal_goal) ||
    num(birthYear) !== (profile?.birth_year ?? null) ||
    num(startWeight) !== (profile?.start_weight_kg ?? null) ||
    num(targetWeight) !== (profile?.target_weight_kg ?? null) ||
    waterGoalMl !== (profile?.water_goal_ml ?? null);

  const save = async () => {
    if (!session || !kcalValid || !waterValid) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: name.trim() || null,
          ...(kcal !== '' ? { kcal_goal: kcalNum } : {}),
          birth_year: num(birthYear),
          start_weight_kg: num(startWeight),
          target_weight_kg: num(targetWeight),
          ...(waterGoalMl != null ? { water_goal_ml: waterGoalMl } : {}),
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
        <View style={styles.sectionHead}>
          <IriIcon name="user" size={18} color={colors.tintDeep} />
          <Text style={[styles.sectionTitle, styles.noGap]}>{t('profile.accountSection')}</Text>
        </View>
        <View style={styles.emailRow}>
          <Text style={styles.emailAt}>@</Text>
          <Text style={[typography.bodyMuted, styles.emailText]} numberOfLines={1}>
            {session?.user.email}
          </Text>
        </View>
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

        <View style={styles.twoCol}>
          <View style={styles.col}>
            <GlassInput
              label={t('profile.birthYear')}
              value={birthYear}
              onChangeText={setBirthYear}
              keyboardType="number-pad"
              placeholder="1990"
            />
          </View>
          <View style={styles.col}>
            <GlassInput
              label={t('profile.startWeight')}
              value={startWeight}
              onChangeText={setStartWeight}
              keyboardType="decimal-pad"
              unit="kg"
              placeholder="74"
            />
          </View>
        </View>
        <View style={styles.twoCol}>
          <View style={styles.col}>
            <GlassInput
              label={t('profile.targetWeight')}
              value={targetWeight}
              onChangeText={setTargetWeight}
              keyboardType="decimal-pad"
              unit="kg"
              placeholder="68"
            />
          </View>
          <View style={styles.col}>
            <GlassInput
              label={t('profile.waterGoal')}
              value={waterGoal}
              onChangeText={setWaterGoal}
              keyboardType="decimal-pad"
              unit="L"
              placeholder="2"
            />
          </View>
        </View>
        {!waterValid ? <Text style={styles.hintError}>{t('profile.waterRange')}</Text> : null}
        <Text style={styles.hint}>{t('profile.bodyHint')}</Text>
        <Text style={styles.macroLabel}>{t('profile.macroSection')}</Text>
        {/* Beta-Feedback 09.08.: Chips ragten über den Rand — jetzt ein
            Segmentregler mit drei gleich breiten Positionen in Kartenbreite */}
        <View style={styles.segment}>
          {MACRO_PRESETS.map((preset) => {
            const active = presetActive(preset);
            return (
              <Pressable
                key={preset.key}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => applyPreset(preset)}
                style={[styles.segmentItem, active && styles.segmentActive]}
              >
                <Text
                  style={[styles.segmentText, active && styles.segmentTextActive]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {t(preset.labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.hint}>{t('profile.macroHint')}</Text>
        {dirty ? (
          <PrimaryButton
            label={t('common.save')}
            onPress={save}
            loading={saving}
            disabled={!kcalValid || !waterValid}
            style={styles.saveGap}
          />
        ) : null}
      </GlassView>

      <GlassView borderRadius={radius.md} contentStyle={styles.card} style={styles.gap}>
        <Text style={styles.sectionTitle}>{t('profile.kcalExplainTitle')}</Text>
        <Text style={[typography.bodyMuted, styles.explain]}>{t('profile.kcalExplain')}</Text>
      </GlassView>

      <GhostButton
        label={t('profile.reminders')}
        onPress={() => router.push('/reminders')}
        style={styles.gap}
      />

      <GlassView borderRadius={radius.md} contentStyle={styles.card} style={styles.gap}>
        {/* Beta-Feedback 09.08.: Inhalt direkt in der Karte statt hinter einem Tap */}
        <View style={styles.sectionHead}>
          <RoseHeart style={styles.irinaHeart} />
          <Text style={[styles.sectionTitle, styles.noGap]}>{t('profile.irinaSection')}</Text>
        </View>
        <View style={styles.irinaRow}>
          <IriAvatar size={64} />
          <View style={styles.irinaText}>
            <Text style={styles.irinaName}>Irina Dith</Text>
            <Text style={styles.irinaBio}>{t('coaching.irinaCardBio')}</Text>
          </View>
        </View>
        <View style={styles.irinaLinks}>
          {IRINA_LINKS.map((link) => (
            <Chip
              key={link.labelKey}
              label={t(link.labelKey)}
              selected={false}
              onPress={() => openIrinaLink(link.app, link.web)}
            />
          ))}
        </View>
        <GhostButton
          label={t('profile.askIrina')}
          small
          onPress={() => router.push('/(tabs)/coaching')}
          style={styles.smallGap}
        />
      </GlassView>

      <GlassView borderRadius={radius.md} contentStyle={styles.card} style={styles.gap}>
        <View style={styles.legalHead}>
          <Text style={styles.paragraph}>§</Text>
          <Text style={[styles.sectionTitle, styles.noGap]}>{t('profile.legalSection')}</Text>
        </View>
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
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  emailAt: {
    fontFamily: font.bold,
    fontSize: 14,
    color: colors.tintDeep,
  },
  emailText: {
    flexShrink: 1,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.track,
    borderRadius: radius.pill,
    padding: 3,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: radius.pill,
  },
  segmentActive: {
    backgroundColor: colors.tintDeep,
  },
  segmentText: {
    fontFamily: font.semibold,
    fontSize: 12,
    color: colors.muted,
  },
  segmentTextActive: {
    color: colors.white,
    fontFamily: font.bold,
  },
  irinaHeart: {
    fontSize: 18,
  },
  irinaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  irinaText: {
    flex: 1,
  },
  irinaName: {
    fontFamily: font.display,
    fontSize: 19,
    color: colors.ink,
  },
  irinaBio: {
    fontFamily: font.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.muted,
    marginTop: 3,
  },
  irinaLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  twoCol: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  col: {
    flex: 1,
  },
  explain: {
    fontSize: 13,
    lineHeight: 20,
  },
  noGap: {
    marginBottom: 0,
  },
  legalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  paragraph: {
    fontFamily: font.display,
    fontSize: 26,
    lineHeight: 30,
    color: colors.tintDeep,
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
