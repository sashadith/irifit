import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';

import { GlassView } from '@/components/glass/GlassView';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { WeightChart } from '@/components/progress/WeightChart';
import { Chip } from '@/components/ui/Chip';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { GhostButton } from '@/components/ui/GhostButton';
import { RoseHeart } from '@/components/ui/RoseHeart';
import { useAuth } from '@/features/auth/AuthProvider';
import { deletePhoto, listPhotos, ProgressPhoto, uploadPhoto } from '@/features/progress/photos';
import { fetchWeekStats, WeekStats } from '@/features/progress/stats';
import { addWeightToday, deleteWeight, fetchWeights, WeightEntry } from '@/features/progress/weights';
import { t, TranslationKey } from '@/i18n';
import { colors, font, radius, spacing, typography } from '@/theme';

type Period = '1M' | '3M' | '1Y' | 'all';

const PERIODS: { key: Period; labelKey: TranslationKey; days: number | null }[] = [
  { key: '1M', labelKey: 'progress.period1M', days: 30 },
  { key: '3M', labelKey: 'progress.period3M', days: 90 },
  { key: '1Y', labelKey: 'progress.period1Y', days: 365 },
  { key: 'all', labelKey: 'progress.periodAll', days: null },
];

export default function ProgressScreen() {
  const router = useRouter();
  const { session, profile, refreshProfile } = useAuth();
  const userId = session?.user.id;

  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [period, setPeriod] = useState<Period>('3M');
  const [weightInput, setWeightInput] = useState('');
  const [stats, setStats] = useState<WeekStats | null>(null);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [viewer, setViewer] = useState<ProgressPhoto | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    const [w, s, p] = await Promise.all([
      fetchWeights(userId),
      fetchWeekStats(userId),
      listPhotos(userId).catch(() => [] as ProgressPhoto[]),
    ]);
    setWeights(w);
    setStats(s);
    setPhotos(p);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const visibleWeights = useMemo(() => {
    const days = PERIODS.find((p) => p.key === period)?.days;
    if (!days) return weights;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const filtered = weights.filter((w) => new Date(w.measured_on) >= cutoff);
    // Zeitraum ohne Messung → lieber alles zeigen als eine leere Kurve
    return filtered.length > 0 ? filtered : weights;
  }, [weights, period]);

  const submitWeight = async () => {
    if (!userId) return;
    const value = Number(weightInput.replace(',', '.'));
    if (!Number.isFinite(value) || value < 30 || value > 350) {
      Alert.alert(t('common.error'), t('progress.addWeightInvalid'));
      return;
    }
    setBusy(true);
    try {
      await addWeightToday(userId, Math.round(value * 10) / 10);
      setWeightInput('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await load();
    } catch {
      Alert.alert(t('common.error'), t('common.loading'));
    } finally {
      setBusy(false);
    }
  };

  const pickAndUpload = async (source: 'camera' | 'library') => {
    if (!userId) return;
    const picked =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (picked.canceled || !picked.assets[0]?.uri) return;
    setBusy(true);
    try {
      await uploadPhoto(userId, picked.assets[0].uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await load();
    } catch {
      Alert.alert(t('common.error'), t('progress.photoError'));
    } finally {
      setBusy(false);
    }
  };

  const addPhoto = () => {
    Alert.alert(t('progress.photoSourceTitle'), undefined, [
      { text: t('progress.photoCamera'), onPress: () => pickAndUpload('camera') },
      { text: t('progress.photoLibrary'), onPress: () => pickAndUpload('library') },
      { text: t('home.deleteEntryCancel'), style: 'cancel' },
    ]);
  };

  const confirmDeleteWeight = (entry: WeightEntry) => {
    Alert.alert(
      t('progress.deleteWeightTitle'),
      `${formatDate(entry.measured_on)} · ${entry.weight_kg.toFixed(1).replace('.', ',')} kg`,
      [
        { text: t('home.deleteEntryCancel'), style: 'cancel' },
        {
          text: t('home.deleteEntryConfirm'),
          style: 'destructive',
          onPress: async () => {
            if (!userId) return;
            await deleteWeight(userId, entry.measured_on).catch(() => {});
            await load();
          },
        },
      ],
    );
  };

  const confirmDeletePhoto = (photo: ProgressPhoto) => {
    Alert.alert(t('progress.deletePhotoTitle'), undefined, [
      { text: t('home.deleteEntryCancel'), style: 'cancel' },
      {
        text: t('home.deleteEntryConfirm'),
        style: 'destructive',
        onPress: async () => {
          await deletePhoto(photo).catch(() => {});
          await load();
        },
      },
    ]);
  };

  const latestWeight = weights.length > 0 ? weights[weights.length - 1].weight_kg : null;
  const deltaKg =
    latestWeight !== null && profile?.start_weight_kg != null
      ? Math.round((latestWeight - profile.start_weight_kg) * 10) / 10
      : null;
  const first = photos[0];
  const last = photos.length > 1 ? photos[photos.length - 1] : null;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenScaffold withTabBarInset={false}>
        <Text style={typography.eyebrow}>{t('progress.eyebrow')}</Text>
        <Text style={[typography.displayLg, styles.title]}>{t('progress.title')}</Text>

        {/* Gewicht */}
        <Text style={[typography.eyebrow, styles.sectionLabel]}>{t('progress.weightSection')}</Text>
        <GlassView contentStyle={styles.cardPad}>
          <View style={styles.periodRow}>
            {PERIODS.map((p) => (
              <Chip key={p.key} label={t(p.labelKey)} selected={period === p.key} onPress={() => setPeriod(p.key)} />
            ))}
          </View>
          {weights.length === 0 ? (
            <Animated.View entering={FadeInUp.duration(400)}>
              <Text style={[typography.bodyMuted, styles.emptyText]}>{t('progress.chartEmpty')}</Text>
            </Animated.View>
          ) : (
            <>
              <WeightChart entries={visibleWeights} targetKg={profile?.target_weight_kg ?? null} />
              <View style={styles.weightMetaRow}>
                {deltaKg !== null ? (
                  <Text style={styles.weightMeta}>
                    {t('progress.sinceStart', { delta: '\u0000' }).split('\u0000')[0]}
                    {deltaKg > 0 ? '+' : deltaKg < 0 ? '−' : '±'}
                    <AnimatedNumber value={Math.abs(deltaKg)} decimals={1} duration={700} style={styles.weightMeta} />
                    {t('progress.sinceStart', { delta: '\u0000' }).split('\u0000')[1]}
                  </Text>
                ) : <View />}
                <Text style={styles.weightMeta}>
                  {t('progress.longestStreak', { count: profile?.streak_longest ?? 0 })}
                </Text>
              </View>
            </>
          )}
          <View style={styles.addWeightRow}>
            <View style={styles.weightField}>
              <TextInput
                value={weightInput}
                onChangeText={setWeightInput}
                keyboardType="decimal-pad"
                placeholder={t('progress.addWeightPlaceholder')}
                placeholderTextColor={colors.muted2}
                style={styles.weightInput}
                accessibilityLabel={t('progress.weightSection')}
                maxLength={6}
              />
              <Text style={styles.weightUnit}>kg</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('progress.addWeightCta')}
              onPress={submitWeight}
              disabled={busy || !weightInput.trim()}
              style={[styles.addWeightButton, (busy || !weightInput.trim()) && styles.disabled]}
            >
              <Text style={styles.addWeightButtonText}>{t('progress.addWeightCta')}</Text>
            </Pressable>
          </View>

          {/* Letzte Wiegungen mit sichtbarem Löschen (Feedback 23.07.) */}
          {weights.length > 0 ? (
            <View style={styles.recentWeights}>
              <Text style={styles.recentWeightsTitle}>{t('progress.recentEntries')}</Text>
              {[...weights].slice(-3).reverse().map((entry) => (
                <View key={entry.measured_on} style={styles.recentWeightRow}>
                  <Text style={styles.recentWeightText}>
                    {formatDate(entry.measured_on)} · {entry.weight_kg.toFixed(1).replace('.', ',')} kg
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('progress.deleteWeight')}
                    hitSlop={8}
                    onPress={() => confirmDeleteWeight(entry)}
                  >
                    {({ pressed }) => (
                      <Text style={[styles.recentWeightDelete, pressed && styles.recentWeightDeletePressed]}>
                        {t('progress.deleteWeight')}
                      </Text>
                    )}
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
        </GlassView>

        {/* Wochenstatistik */}
        <Text style={[typography.eyebrow, styles.sectionLabel]}>{t('progress.weekSection')}</Text>
        <GlassView contentStyle={styles.cardPad}>
          {!stats ? (
            <Text style={typography.bodyMuted}>{t('progress.weekEmpty')}</Text>
          ) : (
            <>
              <View style={styles.statRow}>
                <Text style={styles.statBig}>{t('progress.loggedDays', { count: stats.loggedDays })}</Text>
                <Text style={styles.statSub}>{t('progress.avgKcal', { kcal: stats.avgKcal.toLocaleString('de-DE') })}</Text>
              </View>
              <Text style={styles.macroLabel}>{t('progress.macroSplit')}</Text>
              <View style={styles.macroBar}>
                <View style={[styles.macroSegment, { flex: Math.max(stats.proteinShare, 0.02), backgroundColor: colors.tintDeep }]} />
                <View style={[styles.macroSegment, { flex: Math.max(stats.carbsShare, 0.02), backgroundColor: colors.carbs }]} />
                <View style={[styles.macroSegment, { flex: Math.max(stats.fatShare, 0.02), backgroundColor: colors.water }]} />
              </View>
              <View style={styles.macroLegend}>
                <Text style={styles.macroLegendText}>P {Math.round(stats.proteinShare * 100)} %</Text>
                <Text style={styles.macroLegendText}>C {Math.round(stats.carbsShare * 100)} %</Text>
                <Text style={styles.macroLegendText}>F {Math.round(stats.fatShare * 100)} %</Text>
              </View>
              <Text style={styles.consistency}>
                {t('progress.consistency')} <RoseHeart />
              </Text>
            </>
          )}
        </GlassView>

        {/* Progress-Fotos */}
        <Text style={[typography.eyebrow, styles.sectionLabel]}>{t('progress.photosSection')}</Text>
        <GlassView contentStyle={styles.cardPad}>
          <Text style={[typography.bodyMuted, styles.privateHint]}>{t('progress.photosPrivate')}</Text>
          {first && last ? (
            <View style={styles.compareRow}>
              <View style={styles.compareCol}>
                <Image source={{ uri: first.signedUrl }} style={styles.comparePhoto} />
                <Text style={styles.compareLabel}>
                  {t('progress.compareBefore')} · {formatDate(first.taken_on)}
                </Text>
              </View>
              <View style={styles.compareCol}>
                <Image source={{ uri: last.signedUrl }} style={styles.comparePhoto} />
                <Text style={styles.compareLabel}>
                  {t('progress.compareAfter')} · {formatDate(last.taken_on)}
                </Text>
              </View>
            </View>
          ) : null}
          <View style={styles.photoGrid}>
            {photos.map((photo) => (
              <Pressable
                key={photo.id}
                accessibilityRole="imagebutton"
                accessibilityLabel={photo.taken_on}
                onPress={() => setViewer(photo)}
                onLongPress={() => confirmDeletePhoto(photo)}
                style={styles.photoTile}
              >
                <Image source={{ uri: photo.signedUrl }} style={styles.photo} />
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('progress.addPhoto')}
              onPress={addPhoto}
              disabled={busy}
              style={[styles.photoTile, styles.addTile, busy && styles.disabled]}
            >
              <Text style={styles.addTilePlus}>＋</Text>
              <Text style={styles.addTileText}>{t('progress.addPhoto')}</Text>
            </Pressable>
          </View>
        </GlassView>

        <GhostButton label={t('scan.close')} small onPress={() => router.back()} style={styles.closeButton} />
      </ScreenScaffold>

      {/* Vollbild-Viewer: Tippen vergrößert, Löschen als sichtbarer Button */}
      <Modal visible={viewer !== null} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <View style={styles.viewerBackdrop}>
          <Pressable style={styles.viewerClose} accessibilityRole="button" accessibilityLabel={t('scan.close')} onPress={() => setViewer(null)} hitSlop={12}>
            <Text style={styles.viewerCloseText}>✕</Text>
          </Pressable>
          {viewer ? (
            <>
              <Image source={{ uri: viewer.signedUrl }} style={styles.viewerImage} resizeMode="contain" />
              <View style={styles.viewerFooter}>
                <Text style={styles.viewerDate}>{formatDate(viewer.taken_on)}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('home.deleteEntryConfirm')}
                  onPress={() => {
                    const photo = viewer;
                    setViewer(null);
                    confirmDeletePhoto(photo);
                  }}
                  style={styles.viewerDelete}
                >
                  <Text style={styles.viewerDeleteText}>{t('home.deleteEntryConfirm')}</Text>
                </Pressable>
              </View>
            </>
          ) : null}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1}.${String(d.getFullYear()).slice(2)}`;
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  title: {
    marginTop: 8,
  },
  recentWeights: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.track,
    paddingTop: 10,
  },
  recentWeightsTitle: {
    fontFamily: font.bold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.muted,
    marginBottom: 4,
  },
  recentWeightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  recentWeightText: {
    fontFamily: font.regular,
    fontSize: 13,
    color: colors.ink,
  },
  recentWeightDelete: {
    fontFamily: font.bold,
    fontSize: 12.5,
    color: colors.tintDeep,
  },
  recentWeightDeletePressed: {
    opacity: 0.6,
  },
  sectionLabel: {
    marginTop: 20,
    marginBottom: 10,
  },
  cardPad: {
    padding: spacing.lg,
  },
  periodRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  emptyText: {
    paddingVertical: 12,
  },
  weightMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  weightMeta: {
    fontFamily: font.semibold,
    fontSize: 12,
    color: colors.muted,
  },
  addWeightRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  weightField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
  },
  weightInput: {
    flex: 1,
    paddingVertical: 11,
    fontFamily: font.semibold,
    fontSize: 15,
    color: colors.ink,
  },
  weightUnit: {
    fontFamily: font.bold,
    fontSize: 13,
    color: colors.muted,
  },
  addWeightButton: {
    backgroundColor: colors.tintDeep,
    borderRadius: radius.pill,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  addWeightButtonText: {
    fontFamily: font.bold,
    fontSize: 13.5,
    color: colors.white,
  },
  disabled: {
    opacity: 0.4,
  },
  statRow: {
    marginBottom: 12,
  },
  statBig: {
    fontFamily: font.bold,
    fontSize: 16,
    color: colors.ink,
  },
  statSub: {
    fontFamily: font.regular,
    fontSize: 13,
    color: colors.muted,
    marginTop: 3,
  },
  macroLabel: {
    fontFamily: font.bold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.muted,
    marginBottom: 7,
  },
  macroBar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    gap: 2,
  },
  macroSegment: {
    borderRadius: 2,
  },
  macroLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 7,
  },
  macroLegendText: {
    fontFamily: font.semibold,
    fontSize: 11.5,
    color: colors.muted,
  },
  consistency: {
    fontFamily: font.semibold,
    fontSize: 12.5,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 14,
  },
  privateHint: {
    marginBottom: 12,
  },
  viewerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(12,12,16,0.96)',
    justifyContent: 'center',
  },
  viewerClose: {
    position: 'absolute',
    top: 58,
    right: 22,
    zIndex: 2,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerCloseText: {
    color: colors.white,
    fontSize: 16,
    fontFamily: font.semibold,
  },
  viewerImage: {
    width: '100%',
    height: '78%',
  },
  viewerFooter: {
    position: 'absolute',
    bottom: 48,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 26,
  },
  viewerDate: {
    fontFamily: font.bold,
    fontSize: 14,
    color: colors.white,
  },
  viewerDelete: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  viewerDeleteText: {
    fontFamily: font.bold,
    fontSize: 13,
    color: '#FF7A8F',
  },
  compareRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  compareCol: {
    flex: 1,
  },
  comparePhoto: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: radius.md,
  },
  compareLabel: {
    fontFamily: font.semibold,
    fontSize: 11.5,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 6,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoTile: {
    width: '31%',
    aspectRatio: 3 / 4,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  addTile: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.muted2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addTilePlus: {
    fontSize: 22,
    color: colors.muted,
  },
  addTileText: {
    fontFamily: font.semibold,
    fontSize: 10.5,
    color: colors.muted,
    textAlign: 'center',
    paddingHorizontal: 6,
  },
  closeButton: {
    marginTop: 22,
  },
});
