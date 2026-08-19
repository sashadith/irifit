import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { StreamPlayer } from '@/components/coaching/StreamPlayer';
import { GlassView } from '@/components/glass/GlassView';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { GhostButton } from '@/components/ui/GhostButton';
import { track } from '@/features/analytics/track';
import {
  fetchStreamUrl,
  fetchTrainings,
  StreamSource,
  TrainingVideo,
} from '@/features/coaching/coachingData';
import { t } from '@/i18n';
import { colors, font, spacing, typography } from '@/theme';

export default function TrainingScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [video, setVideo] = useState<TrainingVideo | null>(null);
  const [source, setSource] = useState<StreamSource | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const all = await fetchTrainings();
        if (!cancelled) setVideo(all.find((v) => v.id === id) ?? null);
        const streamSource = await fetchStreamUrl({ trainingId: id });
        if (!cancelled) setSource(streamSource);
        // Trainings haben keine Fortschrittstabelle — hier ist die einzige
        // Stelle, an der ueberhaupt sichtbar wird, welches Video laeuft.
        track('training_start', { training_id: id });
      } catch {
        if (!cancelled) setFailed(true);
        track('app_error', { where: 'training.load', code: 'stream_failed' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <ScreenScaffold withTabBarInset={false}>
      <Text style={typography.eyebrow}>{t('coaching.trainingsSection')}</Text>
      <Text style={[typography.displayLg, styles.title]}>{video?.title ?? ''}</Text>

      <StreamPlayer
        source={source}
        failed={failed}
        portrait={video?.video_format !== 'landscape'}
      />

      {video?.description ? (
        <GlassView style={styles.descriptionCard} contentStyle={styles.cardPad}>
          <Text style={styles.description}>{video.description}</Text>
        </GlassView>
      ) : null}

      <GhostButton label={t('common.back')} small onPress={() => router.back()} style={styles.back} />
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  title: {
    marginTop: 6,
    marginBottom: 14,
  },
  descriptionCard: {
    marginTop: 14,
  },
  cardPad: {
    padding: spacing.lg,
  },
  description: {
    fontFamily: font.regular,
    fontSize: 13.5,
    lineHeight: 21,
    color: colors.ink,
  },
  back: {
    marginTop: 14,
  },
});
