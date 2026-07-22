import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';

import { IrinaCard } from '@/components/coaching/IrinaCard';
import { GlassView } from '@/components/glass/GlassView';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { IriAvatar } from '@/components/ui/IriAvatar';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { useAuth } from '@/features/auth/AuthProvider';
import { Chip } from '@/components/ui/Chip';
import {
  Broadcast,
  Course,
  fetchBroadcasts,
  fetchCompletedLessonIds,
  fetchCourses,
  fetchMyQuestions,
  fetchTrainings,
  isNewTraining,
  Question,
  REACTION_EMOJIS,
  ReactionEmoji,
  submitQuestion,
  toggleReaction,
  TrainingVideo,
  visibleTrainingTags,
} from '@/features/coaching/coachingData';
import { t } from '@/i18n';
import { colors, font, radius, spacing, typography } from '@/theme';

function formatBroadcastTime(iso: string): string {
  const d = new Date(iso);
  const time = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  return isToday
    ? t('coaching.broadcastToday', { time })
    : `${d.getDate()}.${d.getMonth() + 1}. ${time}`;
}

export default function CoachingScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;

  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [questions, setQuestions] = useState<Question[]>([]);
  const [trainings, setTrainings] = useState<TrainingVideo[]>([]);
  const [trainingTag, setTrainingTag] = useState<string | null>(null);
  const [questionText, setQuestionText] = useState('');
  const [qaBusy, setQaBusy] = useState(false);
  const [showIrina, setShowIrina] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    const [b, c, done, q, tv] = await Promise.all([
      fetchBroadcasts(userId).catch(() => [] as Broadcast[]),
      fetchCourses().catch(() => [] as Course[]),
      fetchCompletedLessonIds(userId).catch(() => new Set<string>()),
      fetchMyQuestions(userId).catch(() => [] as Question[]),
      fetchTrainings().catch(() => [] as TrainingVideo[]),
    ]);
    setBroadcasts(b);
    setCourses(c);
    setCompleted(done);
    setQuestions(q);
    setTrainings(tv);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const latest = broadcasts[0] ?? null;

  const react = async (emoji: ReactionEmoji) => {
    if (!userId || !latest) return;
    Haptics.selectionAsync();
    const isSet = latest.mine.has(emoji);
    // optimistisch
    setBroadcasts((prev) =>
      prev.map((b) => {
        if (b.id !== latest.id) return b;
        const mine = new Set(b.mine);
        const counts = { ...b.counts };
        if (isSet) {
          mine.delete(emoji);
          counts[emoji] = Math.max(0, counts[emoji] - 1);
        } else {
          mine.add(emoji);
          counts[emoji] = counts[emoji] + 1;
        }
        return { ...b, mine, counts };
      }),
    );
    await toggleReaction(userId, latest.id, emoji, isSet).catch(() => load());
  };

  const moduleStats = useMemo(
    () =>
      courses.map((course) => {
        const doneCount = course.lessons.filter((l) => completed.has(l.id)).length;
        return { course, doneCount, total: course.lessons.length };
      }),
    [courses, completed],
  );
  const modulesDone = moduleStats.filter((m) => m.total > 0 && m.doneCount === m.total).length;

  const sendQuestion = async () => {
    if (!userId || !questionText.trim()) return;
    setQaBusy(true);
    try {
      await submitQuestion(userId, questionText.trim());
      setQuestionText('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(t('coaching.qaSection'), t('coaching.qaSubmitted'));
      await load();
    } catch {
      Alert.alert(t('common.error'), t('scan.errorGeneric'));
    } finally {
      setQaBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenScaffold>
        <Text style={[typography.displayLg, styles.title]}>{t('coaching.title')}</Text>

        {/* Broadcast (dunkle Glas-Karte aus dem Prototyp) */}
        {latest ? (
          <View style={styles.broadcastCard}>
            <View style={styles.broadcastHeader}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Irina"
                onPress={() => setShowIrina(true)}
              >
                <IriAvatar size={40} />
              </Pressable>
              <Text style={styles.broadcastEyebrow}>
                {t('coaching.broadcastEyebrow', { time: formatBroadcastTime(latest.sent_at) })}
              </Text>
            </View>
            {latest.imageUrl ? (
              <Image
                source={{ uri: latest.imageUrl }}
                style={styles.broadcastImage}
                contentFit="cover"
                accessibilityLabel={t('coaching.broadcastImage')}
              />
            ) : null}
            <Text style={styles.broadcastBody}>{latest.body}</Text>
            <View style={styles.reactions}>
              {REACTION_EMOJIS.map((emoji) => {
                const active = latest.mine.has(emoji);
                const count = latest.counts[emoji];
                return (
                  <Pressable
                    key={emoji}
                    accessibilityRole="button"
                    accessibilityLabel={`${emoji} ${count}`}
                    accessibilityState={{ selected: active }}
                    onPress={() => react(emoji)}
                    style={[styles.reaction, active && styles.reactionActive]}
                  >
                    <Text style={styles.reactionText}>
                      {emoji}
                      {count > 0 ? ` ${count}` : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Kurs */}
        <Text style={[typography.eyebrow, styles.sectionLabel]}>
          {courses.length > 0
            ? `${t('coaching.courseSection')} · ${t('coaching.courseProgress', { done: modulesDone, total: courses.length })}`
            : t('coaching.courseSection')}
        </Text>
        {courses.length === 0 ? (
          <GlassView contentStyle={styles.cardPad}>
            <Text style={typography.bodyMuted}>{t('coaching.noCourses')}</Text>
          </GlassView>
        ) : (
          moduleStats.map(({ course, doneCount, total }, index) => {
            const isDone = total > 0 && doneCount === total;
            const previous = index > 0 ? moduleStats[index - 1] : null;
            const locked =
              !course.is_legacy &&
              previous !== null &&
              !previous.course.is_legacy &&
              previous.doneCount < previous.total;
            const inProgress = !isDone && !locked && doneCount > 0;
            return (
              <Pressable
                key={course.id}
                accessibilityRole="button"
                accessibilityLabel={course.title}
                accessibilityState={{ disabled: locked }}
                disabled={locked}
                onPress={() => router.push(`/course/${course.id}`)}
              >
                {({ pressed }) => (
                  <GlassView
                    borderRadius={radius.md}
                    style={[styles.moduleRow, pressed && styles.pressed, locked && styles.moduleLocked]}
                    contentStyle={[styles.moduleContent, inProgress && styles.moduleActive]}
                  >
                    <View style={[styles.moduleNumber, isDone && styles.moduleNumberDone]}>
                      <Text style={[styles.moduleNumberText, isDone && styles.moduleNumberTextDone]}>
                        {isDone ? '✓' : index + 1}
                      </Text>
                    </View>
                    <View style={styles.moduleText}>
                      <Text style={styles.moduleTitle} numberOfLines={1}>
                        {course.title}
                      </Text>
                      <Text style={styles.moduleMeta}>
                        {locked
                          ? t('coaching.moduleLocked')
                          : isDone
                            ? `${t('coaching.lessonCount', { count: total })} · ${t('coaching.moduleDone')}`
                            : doneCount > 0
                              ? `${t('coaching.lessonProgressOf', { done: doneCount, total })} · ${t('coaching.moduleContinue')}`
                              : t('coaching.lessonCount', { count: total })}
                      </Text>
                    </View>
                  </GlassView>
                )}
              </Pressable>
            );
          })
        )}

        {/* Trainings (Spur 2: flache Bibliothek, neueste zuerst) */}
        <Text style={[typography.eyebrow, styles.sectionLabel]}>{t('coaching.trainingsSection')}</Text>
        {(() => {
          const tags = visibleTrainingTags(trainings);
          const shown = trainingTag
            ? trainings.filter((v) => v.tags.includes(trainingTag))
            : trainings;
          return (
            <>
              {tags.length > 0 ? (
                <View style={styles.tagChips}>
                  {tags.map((tag) => (
                    <Chip
                      key={tag}
                      label={tag}
                      selected={trainingTag === tag}
                      onPress={() => setTrainingTag(trainingTag === tag ? null : tag)}
                    />
                  ))}
                </View>
              ) : null}
              {shown.length === 0 ? (
                <GlassView contentStyle={styles.cardPad}>
                  <Text style={typography.bodyMuted}>{t('coaching.trainingsEmpty')}</Text>
                </GlassView>
              ) : (
                shown.map((video) => (
                  <Pressable
                    key={video.id}
                    accessibilityRole="button"
                    accessibilityLabel={video.title}
                    onPress={() => router.push(`/training/${video.id}`)}
                  >
                    {({ pressed }) => (
                      <GlassView
                        borderRadius={radius.md}
                        style={[styles.moduleRow, pressed && styles.pressed]}
                        contentStyle={styles.trainingContent}
                      >
                        <View style={styles.moduleText}>
                          <View style={styles.trainingTitleRow}>
                            <Text style={styles.moduleTitle} numberOfLines={1}>
                              {video.title}
                            </Text>
                            {isNewTraining(video) ? (
                              <View style={styles.newBadge}>
                                <Text style={styles.newBadgeText}>{t('coaching.trainingNew')}</Text>
                              </View>
                            ) : null}
                          </View>
                          {video.duration_seconds ? (
                            <Text style={styles.moduleMeta}>
                              {t('coaching.trainingMinutes', {
                                min: Math.round(video.duration_seconds / 60),
                              })}
                            </Text>
                          ) : null}
                        </View>
                        <Text style={styles.trainingChevron}>›</Text>
                      </GlassView>
                    )}
                  </Pressable>
                ))
              )}
            </>
          );
        })()}

        {/* Q&A */}
        <Text style={[typography.eyebrow, styles.sectionLabel]}>{t('coaching.qaSection')}</Text>
        <GlassView contentStyle={styles.cardPad}>
          <TextInput
            value={questionText}
            onChangeText={setQuestionText}
            placeholder={t('coaching.qaPlaceholder')}
            placeholderTextColor={colors.muted2}
            style={styles.qaInput}
            multiline
            maxLength={500}
            accessibilityLabel={t('coaching.qaPlaceholder')}
          />
          <PrimaryButton
            label={t('coaching.qaSubmit')}
            onPress={sendQuestion}
            disabled={!questionText.trim()}
            loading={qaBusy}
            style={styles.qaButton}
          />
          {questions.length > 0 ? (
            <View style={styles.qaMine}>
              <Text style={styles.qaMineTitle}>{t('coaching.qaMine')}</Text>
              {questions.map((q) => (
                <View key={q.id} style={styles.qaRow}>
                  <View style={styles.qaRowHead}>
                    <Text style={styles.qaBody} numberOfLines={2}>
                      {q.body}
                    </Text>
                    <Text style={styles.qaStatus}>
                      {q.status === 'new'
                        ? t('coaching.qaStatusNew')
                        : q.status === 'answered'
                          ? t('coaching.qaStatusAnswered')
                          : t('coaching.qaStatusPublished')}
                    </Text>
                  </View>
                  {/* Irinas Antwort — sichtbar ab status=answered, nicht erst published */}
                  {q.answer ? (
                    <View style={styles.qaAnswer}>
                      <Text style={styles.qaAnswerLabel}>{t('coaching.qaAnswerLabel')}</Text>
                      <Text style={styles.qaAnswerText}>{q.answer}</Text>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}
        </GlassView>
      </ScreenScaffold>
      <IrinaCard visible={showIrina} onClose={() => setShowIrina(false)} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  title: {
    marginBottom: 14,
  },
  broadcastCard: {
    backgroundColor: 'rgba(28,28,33,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: 4,
    shadowColor: '#14161C',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },
  broadcastHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  broadcastEyebrow: {
    fontFamily: font.bold,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.55)',
  },
  broadcastImage: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 14,
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  broadcastBody: {
    fontFamily: font.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.white,
    marginTop: 10,
  },
  reactions: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 12,
  },
  reaction: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  reactionActive: {
    backgroundColor: 'rgba(232,127,156,0.38)',
    borderColor: 'rgba(232,127,156,0.6)',
  },
  reactionText: {
    fontSize: 13,
    color: colors.white,
  },
  sectionLabel: {
    marginTop: 20,
    marginBottom: 10,
  },
  cardPad: {
    padding: spacing.lg,
  },
  moduleRow: {
    marginBottom: 10,
  },
  pressed: {
    opacity: 0.75,
  },
  moduleLocked: {
    opacity: 0.55,
  },
  moduleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  moduleActive: {
    borderColor: colors.ink,
  },
  moduleNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: colors.stroke,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moduleNumberDone: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  moduleNumberText: {
    fontFamily: font.bold,
    fontSize: 16,
    color: colors.ink,
  },
  moduleNumberTextDone: {
    color: colors.white,
  },
  moduleText: {
    flex: 1,
  },
  moduleTitle: {
    fontFamily: font.bold,
    fontSize: 14,
    color: colors.ink,
  },
  moduleMeta: {
    fontFamily: font.regular,
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  tagChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  trainingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  trainingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  newBadge: {
    backgroundColor: colors.tintDeep,
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  newBadgeText: {
    fontFamily: font.bold,
    fontSize: 9,
    letterSpacing: 0.8,
    color: colors.white,
  },
  trainingChevron: {
    fontFamily: font.bold,
    fontSize: 16,
    color: colors.muted,
  },
  qaInput: {
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: radius.md,
    padding: 14,
    minHeight: 76,
    fontFamily: font.regular,
    fontSize: 14,
    color: colors.ink,
    textAlignVertical: 'top',
  },
  qaButton: {
    marginTop: 12,
  },
  qaMine: {
    marginTop: 16,
  },
  qaMineTitle: {
    fontFamily: font.bold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.muted,
    marginBottom: 8,
  },
  qaRow: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.track,
  },
  qaRowHead: {},
  qaBody: {
    fontFamily: font.regular,
    fontSize: 13,
    color: colors.ink,
  },
  qaStatus: {
    fontFamily: font.bold,
    fontSize: 10.5,
    color: colors.tintDeep,
    marginTop: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  qaAnswer: {
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: colors.tint,
    padding: 10,
  },
  qaAnswerLabel: {
    fontFamily: font.bold,
    fontSize: 10.5,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.muted,
    marginBottom: 3,
  },
  qaAnswerText: {
    fontFamily: font.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.ink,
  },
});
