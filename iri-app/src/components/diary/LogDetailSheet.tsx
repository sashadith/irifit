import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { GlassView } from '@/components/glass/GlassView';
import { GhostButton } from '@/components/ui/GhostButton';
import { macroShort } from '@/features/diary/macros';
import { FoodLog, LogSource } from '@/features/diary/useDiaryDay';
import { t, TranslationKey } from '@/i18n';
import { colors, font, radius, spacing, typography } from '@/theme';

const SOURCE_LABEL: Record<LogSource, TranslationKey> = {
  scan: 'home.sourceScan',
  barcode: 'home.sourceBarcode',
  search: 'home.sourceSearch',
  recipe: 'home.sourceRecipe',
  favorite: 'home.sourceFavorite',
  manual: 'home.sourceManual',
};

export interface LogDetailSheetProps {
  readonly log: FoodLog | null;
  readonly onClose: () => void;
  readonly onDelete: (id: string) => void;
}

/**
 * Eintrag-Details als Bottom Sheet (Feedback 23.07.): Löschen muss ohne
 * Geheimwissen auffindbar sein — Tap auf den Eintrag öffnet dieses Sheet,
 * Long-Press bleibt als Shortcut bestehen.
 */
export function LogDetailSheet({ log, onClose, onDelete }: LogDetailSheetProps) {
  if (!log) return null;

  const time = new Date(log.created_at);
  const timeLabel = `${time.getHours()}:${String(time.getMinutes()).padStart(2, '0')}`;

  const macroLine = macroShort(log.carbs_g, log.protein_g, log.fat_g);

  const confirmDelete = () => {
    Alert.alert(t('home.deleteEntryTitle'), t('home.entryKcal', { title: log.title, kcal: log.kcal }), [
      { text: t('home.deleteEntryCancel'), style: 'cancel' },
      {
        text: t('home.deleteEntryConfirm'),
        style: 'destructive',
        onPress: () => {
          onDelete(log.id);
          onClose();
        },
      },
    ]);
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} accessibilityLabel={t('common.close')} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()} style={styles.sheetWrap}>
          <GlassView strong borderRadius={radius.lg} contentStyle={styles.sheet}>
            <View style={styles.handle} />
            <Text style={[typography.displayLg, styles.title]} numberOfLines={2}>
              {log.title}
            </Text>
            <Text style={styles.kcal}>
              {log.grams ? `${log.grams} ${log.unit ?? 'g'} · ` : ''}
              {t('home.entryKcalOnly', { kcal: log.kcal })}
            </Text>
            {macroLine ? <Text style={styles.meta}>{macroLine}</Text> : null}
            <Text style={styles.meta}>
              {t('home.logSheetTime', { time: timeLabel })} · {t(SOURCE_LABEL[log.source] ?? 'home.sourceManual')}
            </Text>

            <Pressable accessibilityRole="button" accessibilityLabel={t('home.deleteEntry')} onPress={confirmDelete}>
              {({ pressed }) => (
                <LinearGradient
                  colors={colors.roseGradient}
                  start={{ x: 0.2, y: 0 }}
                  end={{ x: 0.8, y: 1 }}
                  style={[styles.deleteButton, pressed && styles.pressed]}
                >
                  <Text style={styles.deleteText}>{t('home.deleteEntry')}</Text>
                </LinearGradient>
              )}
            </Pressable>
            <GhostButton label={t('common.close')} small onPress={onClose} style={styles.closeButton} />
          </GlassView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20,20,26,0.45)',
    justifyContent: 'flex-end',
  },
  sheetWrap: {
    padding: 10,
  },
  sheet: {
    padding: spacing.xl,
    paddingBottom: 30,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.muted2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
  },
  kcal: {
    fontFamily: font.extrabold,
    fontSize: 16,
    color: colors.tintDeep,
    marginTop: 6,
  },
  meta: {
    fontFamily: font.regular,
    fontSize: 13,
    color: colors.muted,
    marginTop: 4,
  },
  deleteButton: {
    marginTop: 18,
    borderRadius: radius.pill,
    paddingVertical: 13,
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
  deleteText: {
    fontFamily: font.bold,
    fontSize: 14.5,
    color: colors.white,
  },
  closeButton: {
    marginTop: 10,
  },
});
