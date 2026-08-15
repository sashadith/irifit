import { useCallback, useMemo, useRef, useState } from 'react';
import Animated, { FadeInUp } from 'react-native-reanimated';
import {
  Alert,
  KeyboardAvoidingView,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextLayoutEventData,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';

import { IrinaCard } from '@/components/coaching/IrinaCard';
import { GlassView } from '@/components/glass/GlassView';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { ImageViewer } from '@/components/ui/ImageViewer';
import { IriAvatar } from '@/components/ui/IriAvatar';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { RoseHeart } from '@/components/ui/RoseHeart';
import { useAuth } from '@/features/auth/AuthProvider';
import { isSubscriptionLapsed } from '@/features/subscription/lapsed';
import { Chip } from '@/components/ui/Chip';
import {
  Broadcast,
  Course,
  fetchBroadcasts,
  fetchCompletedLessonIds,
  fetchCourses,
  fetchMyQuestions,
  fetchTrainings,
  prefetchStreamUrl,
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

/**
 * RN-Fake-Float (Feinschliff 23.07.): Der Broadcast-Text umfließt das Polaroid.
 * React Native kennt kein float — daher wird der Text unsichtbar in Spaltenbreite
 * vermessen (onTextLayout liefert die Zeilen) und an der Zeilengrenze geteilt:
 * schmale Spalte neben dem Polaroid, Rest volle Breite.
 *
 * WICHTIG (Mini-Fix 23.07.): Trennstelle und Layout speisen sich aus DERSELBEN
 * Geometrie — alle abgeleiteten Werte hängen an den Konstanten hier. Position
 * ändern = nur POLAROID_TOP/RIGHT anfassen, der Umfluss zieht automatisch mit.
 */
const POLAROID_TOP = -40; // Überhang über die Kartenkante
const POLAROID_RIGHT = 4;
const POLAROID_IMG = 108; // quadratisches Foto
const POLAROID_PAD = 4; // weißer Rahmen oben/seitlich
const POLAROID_PAD_BOTTOM = 2;
const POLAROID_CAPTION_H = 15 + 2; // lineHeight + paddingVertical der Handschrift-Zeile
const POLAROID_ROTATION_DEG = 3;
const POLAROID_W = POLAROID_IMG + 2 * POLAROID_PAD;
const POLAROID_H = POLAROID_PAD + POLAROID_IMG + POLAROID_CAPTION_H + POLAROID_PAD_BOTTOM;
// Rotierte Bounding-Box (Rotation um die Mitte): so weit reicht das Polaroid wirklich
const POLAROID_RAD = (POLAROID_ROTATION_DEG * Math.PI) / 180;
const POLAROID_BBOX_H = POLAROID_W * Math.sin(POLAROID_RAD) + POLAROID_H * Math.cos(POLAROID_RAD);
const POLAROID_BOTTOM = POLAROID_TOP + POLAROID_H / 2 + POLAROID_BBOX_H / 2;

// Karten-Geometrie (muss zu den Styles unten passen)
const CARD_PAD = spacing.lg;
const HEADER_H = 40; // Avatar-Durchmesser
const BODY_TOP_MARGIN = 10; // marginTop von broadcastBody
const TEXT_TOP = CARD_PAD + HEADER_H + BODY_TOP_MARGIN;
const FLOAT_GAP = 8;

/** Platz, den das Polaroid rechts im Karteninhalt belegt (inkl. Abstand) */
const POLAROID_CLEARANCE = POLAROID_W + POLAROID_RIGHT - CARD_PAD + FLOAT_GAP;
/** Zeilen, die OBERHALB dieser Höhe beginnen, bleiben in der schmalen Spalte —
 * alles danach startet garantiert unterhalb der echten Polaroid-Unterkante */
const BESIDE_HEIGHT = Math.max(0, POLAROID_BOTTOM + FLOAT_GAP - TEXT_TOP);

function FloatedBroadcastText({ body }: { body: string }) {
  const [split, setSplit] = useState<{ first: string; rest: string } | null>(null);

  // Bei neuem Text neu vermessen
  const measuredBody = useRef(body);
  if (measuredBody.current !== body) {
    measuredBody.current = body;
    if (split !== null) setSplit(null);
  }

  const onMeasure = (e: NativeSyntheticEvent<TextLayoutEventData>) => {
    const lines = e.nativeEvent.lines;
    // Zeilen, die oberhalb der Polaroid-Unterkante BEGINNEN, gehören in die schmale
    // Spalte — so startet das erste Vollbreiten-Segment sicher unter dem Polaroid
    let take = 0;
    for (const line of lines) {
      if (line.y < BESIDE_HEIGHT) take += 1;
      else break;
    }
    if (take >= lines.length) {
      setSplit({ first: body, rest: '' });
      return;
    }
    const first = lines
      .slice(0, take)
      .map((l) => l.text)
      .join('');
    // Rest aus dem Original schneiden (keine Whitespace-Verluste an der Trennstelle)
    setSplit({ first, rest: body.slice(first.length).replace(/^[ \n]/, '') });
  };

  return (
    <View>
      {split === null ? (
        <Text
          style={[styles.broadcastBody, styles.broadcastBodyNarrow, styles.measureHidden]}
          onTextLayout={onMeasure}
        >
          {body}
        </Text>
      ) : (
        <>
          {split.first ? (
            <Text style={[styles.broadcastBody, styles.broadcastBodyNarrow]}>{split.first}</Text>
          ) : null}
          {split.rest ? (
            <Text style={[styles.broadcastBody, split.first ? styles.broadcastBodyRest : null]}>
              {split.rest}
            </Text>
          ) : null}
        </>
      )}
    </View>
  );
}

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
  const [showBroadcastImage, setShowBroadcastImage] = useState(false);
  const [subLapsed, setSubLapsed] = useState(false);

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
    // Standbilder der obersten Trainings schon holen, waehrend die Liste
    // gelesen wird (Sascha 15.08.) — beim Antippen ist dann sofort ein Bild da.
    // Nur die ersten vier, damit wir nicht fuer jede Kachel eine Signatur ziehen.
    tv.slice(0, 4).forEach((v) => prefetchStreamUrl({ trainingId: v.id }));
    isSubscriptionLapsed(userId).then(setSubLapsed);
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

        {/* Broadcast (dunkle Glas-Karte aus dem Prototyp); Bild als Polaroid oben rechts */}
        {latest ? (
          <View style={styles.broadcastCard}>
            <View style={[styles.broadcastHeader, latest.imageUrl != null && styles.broadcastHeaderWithImage]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Irina"
                onPress={() => setShowIrina(true)}
              >
                <IriAvatar size={40} />
              </Pressable>
              <View>
                <Text style={styles.broadcastEyebrow}>{t('coaching.broadcastLabel')}</Text>
                <Text style={styles.broadcastTime}>{formatBroadcastTime(latest.sent_at)}</Text>
              </View>
            </View>
            {latest.imageUrl ? (
              <Pressable
                accessibilityRole="imagebutton"
                accessibilityLabel={t('coaching.broadcastImage')}
                onPress={() => setShowBroadcastImage(true)}
                style={styles.polaroid}
              >
                <Image
                  source={{ uri: latest.imageUrl }}
                  style={styles.polaroidImage}
                  contentFit="cover"
                  contentPosition="top center"
                />
                <Text style={styles.polaroidCaption}>{t('coaching.polaroidCaption')}</Text>
              </Pressable>
            ) : null}
            {latest.imageUrl != null ? (
              <FloatedBroadcastText body={latest.body} />
            ) : (
              <Text style={styles.broadcastBody}>{latest.body}</Text>
            )}
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

        {/* Abo abgelaufen? Freundliche Verlaengerungs-Frage statt stiller Leere (Sascha 12.08.) */}
        {subLapsed ? (
          <GlassView borderRadius={radius.md} style={styles.renewCard} contentStyle={styles.renewContent}>
            <Text style={styles.renewTitle}>{t('renew.cardTitle')}</Text>
            <Text style={[typography.bodyMuted, styles.renewText]}>{t('renew.cardText')}</Text>
            <PrimaryButton label={t('renew.cardCta')} onPress={() => router.push('/renew')} style={styles.renewCta} />
          </GlassView>
        ) : null}

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
                  <Animated.View entering={FadeInUp.duration(400)}>
                    <Text style={typography.bodyMuted}>
                      {t('coaching.trainingsEmpty')} <RoseHeart size={13} />
                    </Text>
                  </Animated.View>
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

        {/* Kurs */}
        <Text style={[typography.eyebrow, styles.sectionLabel]}>
          {courses.length > 0
            ? `${t('coaching.courseSection')} · ${t('coaching.courseProgress', { done: modulesDone, total: courses.length })}`
            : t('coaching.courseSection')}
        </Text>
        {courses.length === 0 ? (
          <GlassView contentStyle={styles.cardPad}>
            <Animated.View entering={FadeInUp.duration(400)}>
              <Text style={typography.bodyMuted}>
                {t('coaching.noCourses')} <RoseHeart size={13} />
              </Text>
            </Animated.View>
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
      <ImageViewer
        visible={showBroadcastImage}
        uri={latest?.imageUrl}
        onClose={() => setShowBroadcastImage(false)}
        accessibilityLabel={t('coaching.broadcastImage')}
      />
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
  // Polaroid-Thumbnail: überlappt die Kartenkante oben rechts (Karte lässt overflow sichtbar);
  // unterer Rand deutlich breiter (echtes Polaroid) mit Handschrift-Gruß
  polaroid: {
    position: 'absolute',
    top: POLAROID_TOP,
    right: POLAROID_RIGHT,
    backgroundColor: colors.white,
    paddingTop: POLAROID_PAD,
    paddingHorizontal: POLAROID_PAD,
    paddingBottom: POLAROID_PAD_BOTTOM,
    borderRadius: 4,
    transform: [{ rotate: `${POLAROID_ROTATION_DEG}deg` }],
    shadowColor: '#14161C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  polaroidImage: {
    width: POLAROID_IMG,
    height: POLAROID_IMG,
    borderRadius: 2,
    backgroundColor: 'rgba(28,28,33,0.08)',
  },
  polaroidCaption: {
    fontFamily: 'DancingScript_600SemiBold',
    fontSize: 12,
    lineHeight: 15,
    color: colors.tintDeep,
    textAlign: 'center',
    paddingVertical: 1,
  },
  broadcastHeaderWithImage: {
    paddingRight: POLAROID_CLEARANCE,
  },
  broadcastBody: {
    fontFamily: font.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.white,
    marginTop: 10,
  },
  // Fake-Float: schmale Spalte neben dem Polaroid, Rest volle Breite
  broadcastBodyNarrow: {
    marginRight: POLAROID_CLEARANCE,
  },
  broadcastBodyRest: {
    marginTop: 0,
  },
  measureHidden: {
    position: 'absolute',
    opacity: 0,
    left: 0,
    right: 0,
  },
  broadcastTime: {
    fontFamily: font.semibold,
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  // App bleibt sichtbar, nur abgedunkelt
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
  renewCard: {
    marginBottom: 18,
  },
  renewContent: {
    padding: 18,
  },
  renewTitle: {
    fontFamily: font.bold,
    fontSize: 16,
    color: colors.ink,
  },
  renewText: {
    marginTop: 6,
  },
  renewCta: {
    marginTop: 12,
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
    backgroundColor: colors.tintDeep,
    borderColor: colors.tintDeep,
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
