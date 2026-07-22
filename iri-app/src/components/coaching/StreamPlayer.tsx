import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useEventListener } from 'expo';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';

import { StreamSource } from '@/features/coaching/coachingData';
import { t } from '@/i18n';
import { colors, font, tintShadow } from '@/theme';

export interface StreamPlayerProps {
  readonly source: StreamSource | null;
  readonly failed: boolean;
  readonly portrait?: boolean;
  readonly onPlayToEnd?: () => void;
}

/**
 * Video-Player mit Poster (signiertes 10-s-Thumbnail statt Greenscreen-Frame)
 * und permanentem Rosé-Play-Button, bis die Wiedergabe startet (Mini-Fix 21.07.).
 */
export function StreamPlayer({ source, failed, portrait = false, onPlayToEnd }: StreamPlayerProps) {
  const [started, setStarted] = useState(false);
  const player = useVideoPlayer(source?.hlsUrl ?? null, () => {});

  useEventListener(player, 'playToEnd', () => onPlayToEnd?.());

  const start = () => {
    if (!source) return;
    setStarted(true);
    player.play();
  };

  return (
    <View style={[styles.wrap, portrait ? styles.portrait : styles.landscape]}>
      {started && source ? (
        <VideoView
          player={player}
          style={styles.fill}
          allowsFullscreen
          allowsPictureInPicture
          contentFit="contain"
          nativeControls
        />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Abspielen"
          onPress={start}
          disabled={!source}
          style={styles.fill}
        >
          {source?.thumbnailUrl ? (
            <Image source={{ uri: source.thumbnailUrl }} style={styles.fill} resizeMode="cover" />
          ) : (
            <View style={[styles.fill, styles.posterFallback]} />
          )}
          <View style={styles.overlay}>
            {failed ? (
              <Text style={styles.overlayText}>{t('coaching.videoError')}</Text>
            ) : source ? (
              <View style={[styles.playButton, tintShadow]}>
                <LinearGradient
                  colors={colors.roseGradient}
                  start={{ x: 0.2, y: 0 }}
                  end={{ x: 0.8, y: 1 }}
                  style={styles.playGradient}
                >
                  <Text style={styles.playIcon}>▶</Text>
                </LinearGradient>
              </View>
            ) : (
              <>
                <ActivityIndicator color={colors.white} />
                <Text style={styles.overlayText}>{t('coaching.videoLoading')}</Text>
              </>
            )}
          </View>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#0E0E12',
  },
  landscape: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  portrait: {
    alignSelf: 'center',
    width: '62%',
    aspectRatio: 9 / 16,
  },
  fill: {
    flex: 1,
  },
  posterFallback: {
    backgroundColor: '#1A1A20',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(10,10,14,0.18)',
  },
  overlayText: {
    fontFamily: font.semibold,
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  playButton: {
    borderRadius: 34,
  },
  playGradient: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  playIcon: {
    fontSize: 24,
    color: colors.white,
    marginLeft: 4,
  },
});
