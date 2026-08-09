import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';

import { GlassView } from '@/components/glass/GlassView';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { Chip } from '@/components/ui/Chip';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Profile, useAuth } from '@/features/auth/AuthProvider';
import { registerForPush } from '@/features/notifications/push';
import { isSoundEnabled, playSound, setSoundEnabled } from '@/features/sound/sounds';
import { t } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { colors, font, radius, spacing, typography } from '@/theme';

type PrefKey = Extract<
  keyof Profile,
  'push_meal_evening' | 'push_water' | 'push_streak' | 'push_broadcast' | 'push_weekly'
>;

/** Abendzeit-Presets; null = aus dem Rhythmus lernen (S12-Kernidee) */
const EVENING_PRESETS: (string | null)[] = [null, '17:30', '18:00', '18:30', '19:00', '19:30', '20:00'];

/** Erinnerungen (Session 12): granulare Opt-ins gemäß Konzept Kapitel 13 */
export default function RemindersScreen() {
  const { session, profile, refreshProfile } = useAuth();
  const [granted, setGranted] = useState<boolean | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [prefs, setPrefs] = useState<Record<PrefKey, boolean>>({
    push_meal_evening: profile?.push_meal_evening ?? true,
    push_water: profile?.push_water ?? true,
    push_streak: profile?.push_streak ?? true,
    push_broadcast: profile?.push_broadcast ?? true,
    push_weekly: profile?.push_weekly ?? true,
  });
  const [eveningTime, setEveningTime] = useState<string | null>(
    profile?.reminder_evening_time?.slice(0, 5) ?? null,
  );

  useEffect(() => {
    Notifications.getPermissionsAsync().then(({ status }) => setGranted(status === 'granted'));
    isSoundEnabled().then(setSoundOn);
  }, []);

  const save = async (patch: Partial<Record<string, unknown>>) => {
    if (!session) return;
    await supabase.from('profiles').update(patch).eq('id', session.user.id);
    refreshProfile().catch(() => {});
  };

  const toggle = (key: PrefKey) => (value: boolean) => {
    Haptics.selectionAsync();
    setPrefs((p) => ({ ...p, [key]: value }));
    save({ [key]: value });
  };

  const pickTime = (time: string | null) => {
    setEveningTime(time);
    save({ reminder_evening_time: time });
  };

  const enable = async () => {
    if (!session) return;
    const ok = await registerForPush(session.user.id);
    setGranted(ok);
  };

  const row = (key: PrefKey, label: string, hint: string) => (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowHint}>{hint}</Text>
      </View>
      <Switch
        value={prefs[key]}
        onValueChange={toggle(key)}
        trackColor={{ false: colors.track, true: colors.tintDeep }}
        thumbColor={colors.white}
        accessibilityLabel={label}
      />
    </View>
  );

  return (
    <ScreenScaffold withTabBarInset={false}>
      <Text style={[typography.displayLg, styles.title]}>{t('reminders.title')}</Text>
      <Text style={[typography.bodyMuted, styles.intro]}>{t('reminders.intro')}</Text>

      {granted === false ? (
        <GlassView borderRadius={radius.md} contentStyle={styles.card}>
          <Text style={styles.sectionTitle}>{t('reminders.permissionTitle')}</Text>
          <Text style={[typography.bodyMuted, styles.permissionBody]}>
            {t('reminders.permissionBody')}
          </Text>
          <PrimaryButton label={t('reminders.permissionCta')} onPress={enable} />
        </GlassView>
      ) : null}

      <GlassView borderRadius={radius.md} contentStyle={styles.card} style={styles.cardGap}>
        <Text style={styles.sectionTitle}>{t('reminders.sectionDaily')}</Text>
        {row('push_meal_evening', t('reminders.mealEvening'), t('reminders.mealEveningHint'))}
        {row('push_water', t('reminders.water'), t('reminders.waterHint'))}
        {row('push_streak', t('reminders.streak'), t('reminders.streakHint'))}
      </GlassView>

      <GlassView borderRadius={radius.md} contentStyle={styles.card} style={styles.cardGap}>
        <Text style={styles.sectionTitle}>{t('reminders.sectionTime')}</Text>
        <Text style={[typography.bodyMuted, styles.permissionBody]}>{t('reminders.timeHint')}</Text>
        <View style={styles.chips}>
          {EVENING_PRESETS.map((preset) => (
            <Chip
              key={preset ?? 'auto'}
              label={preset ?? t('reminders.timeAuto')}
              selected={eveningTime === preset}
              onPress={() => pickTime(preset)}
            />
          ))}
        </View>
      </GlassView>

      <GlassView borderRadius={radius.md} contentStyle={styles.card} style={styles.cardGap}>
        <Text style={styles.sectionTitle}>{t('reminders.sectionSound')}</Text>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>{t('reminders.sound')}</Text>
            <Text style={styles.rowHint}>{t('reminders.soundHint')}</Text>
          </View>
          <Switch
            value={soundOn}
            onValueChange={(v) => {
              Haptics.selectionAsync();
              setSoundOn(v);
              setSoundEnabled(v);
              if (v) playSound('water');
            }}
            trackColor={{ false: colors.track, true: colors.tintDeep }}
            thumbColor={colors.white}
            accessibilityLabel={t('reminders.sound')}
          />
        </View>
      </GlassView>

      <GlassView borderRadius={radius.md} contentStyle={styles.card} style={styles.cardGap}>
        <Text style={styles.sectionTitle}>{t('reminders.sectionNews')}</Text>
        {row('push_broadcast', t('reminders.broadcast'), t('reminders.broadcastHint'))}
        {row('push_weekly', t('reminders.weekly'), t('reminders.weeklyHint'))}
      </GlassView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  title: {
    marginBottom: 6,
  },
  intro: {
    marginBottom: spacing.lg,
  },
  card: {
    padding: spacing.lg,
  },
  cardGap: {
    marginTop: spacing.md,
  },
  sectionTitle: {
    fontFamily: font.bold,
    fontSize: 13.5,
    color: colors.ink,
    marginBottom: 10,
  },
  permissionBody: {
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    fontFamily: font.semibold,
    fontSize: 14.5,
    color: colors.ink,
  },
  rowHint: {
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted,
    marginTop: 2,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
