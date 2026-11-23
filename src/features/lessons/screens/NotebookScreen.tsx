import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { memo, useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
  type ListRenderItem,
} from 'react-native';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTransitionMotion } from '../../../shared/context/TransitionMotionContext';
import { useDelayedBusy } from '../../../shared/hooks/useDelayedBusy';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { useResponsiveLayout } from '../../../shared/hooks/useResponsiveLayout';
import { useScreenMotionActive, useTransitionSettled } from '../../../shared/hooks/useTransitionSettled';
import { bundledImageSource } from '../../../shared/services/bundledImages';
import { recordDiagnosticError } from '../../../shared/services/diagnostics';
import * as Haptics from '../../../shared/services/haptics';
import { borders, colors, fonts, shadows, typography } from '../../../shared/theme';
import type { FlowMode, RootStackParamList, StoredLesson } from '../../../shared/types';
import { AppIcon } from '../../../shared/ui/AppIcon';
import { Chip } from '../../../shared/ui/Chip';
import { ComicBackdrop } from '../../../shared/ui/ComicBackdrop';
import { ComicButton } from '../../../shared/ui/ComicButton';
import { ComicTabBar, type ComicTabOption } from '../../../shared/ui/ComicTabBar';
import { Mascot, mascotAssets } from '../../../shared/ui/Mascot';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { PlayfulLoader } from '../../../shared/ui/PlayfulLoader';
import { PressableScale } from '../../../shared/ui/PressableScale';
import { ScreenHeader } from '../../../shared/ui/ScreenHeader';
import { Text, TextInput } from '../../../shared/ui/Typography';
import { RemoveFromNotebookModal } from '../components/RemoveFromNotebookModal';
import { getCachedFavoriteLessons, setLessonFavorite, subscribeToFavoriteLessons } from '../services/lessons';
import { formatLessonShareMessage } from '../utils/lessonShare';
import {
  filterNotebookLessons,
  notebookFilterCounts,
  notebookProblemPresentation,
  notebookTopicCounts,
  notebookVerdictPresentation,
  type NotebookFilter,
} from '../utils/notebookPresentation';

type Props = NativeStackScreenProps<RootStackParamList, 'Notebook'>;

const FILTER_ORDER: Record<NotebookFilter, number> = { all: 0, solve: 1, check: 2 };

const TOPIC_DOT_TONES = [
  colors.violet,
  colors.cyan,
  colors.peach,
  colors.limeDeep,
  colors.gold,
  colors.mintDeep,
] as const;

const verdictTones = {
  correct: { bg: colors.lime, color: colors.ink, mark: '✓' },
  partial: { bg: colors.gold, color: colors.ink, mark: '◐' },
  incorrect: { bg: colors.roseSoft, color: colors.berryDeep, mark: '!' },
} as const;

const answerPreviewTones = {
  default: { bg: '#F4FFD6', border: '#CBE289', badgeBg: colors.lime, text: colors.ink },
  partial: { bg: '#FFF8DB', border: '#EAD07D', badgeBg: colors.gold, text: colors.ink },
  incorrect: { bg: '#FFF1EC', border: '#F0BFB0', badgeBg: colors.peach, text: colors.peachDeep },
} as const;

const SHORT_MONTHS_RO = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'nov', 'dec'] as const;

function padTwo(value: number): string {
  return value < 10 ? `0${value}` : `${value}`;
}

function lessonTime(lesson: StoredLesson): string {
  const date = lesson.createdAt?.toDate?.();
  if (!date) return 'Recent';
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startLesson = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  if (startLesson === startToday) return `Astăzi · ${padTwo(date.getHours())}:${padTwo(date.getMinutes())}`;
  if (startLesson === startToday - 24 * 60 * 60 * 1000) return 'Ieri';
  return `${date.getDate()} ${SHORT_MONTHS_RO[date.getMonth()]}`;
}

function sameLessonList(previous: StoredLesson[], next: StoredLesson[]): boolean {
  if (previous === next) return true;
  if (previous.length !== next.length) return false;
  for (let index = 0; index < previous.length; index += 1) {
    const a = previous[index];
    const b = next[index];
    if (
      a.id !== b.id
      || a.title !== b.title
      || a.topic !== b.topic
      || a.mode !== b.mode
      || a.verdict !== b.verdict
      || a.steps.length !== b.steps.length
      || a.takeaways.length !== b.takeaways.length
      || a.createdAt?.toDate?.().getTime() !== b.createdAt?.toDate?.().getTime()
    ) {
      return false;
    }
  }
  return true;
}

function sameProblemPreview(previous: StoredLesson, next: StoredLesson) {
  const previousPreview = notebookProblemPresentation(previous);
  const nextPreview = notebookProblemPresentation(next);
  return previousPreview.identity === nextPreview.identity
    && previousPreview.title === nextPreview.title
    && previousPreview.prettySnippet === nextPreview.prettySnippet
    && previousPreview.answerPreview === nextPreview.answerPreview
    && previousPreview.takeawayCount === nextPreview.takeawayCount;
}

/**
 * Pure GPU-transform staggered card entrance used on tab switches for the
 * first 4 visible rows. Always keeps a stable Animated.View wrapper for
 * `index < 4` (so LessonRow never remounts on tab change) and animates ONLY
 * transform (translateX, translateY, scale) — never opacity: 0 — eliminating
 * Android Fabric offscreen-alpha text culling inside badges.
 */
function StaggerCardSlot({
  index,
  generation,
  direction,
  motionActive,
  reducedMotion,
  children,
}: {
  index: number;
  generation: number;
  direction: -1 | 0 | 1;
  motionActive: boolean;
  reducedMotion: boolean;
  children: ReactNode;
}) {
  const animateOnMount = generation > 0 && motionActive && !reducedMotion && index < 4;
  const progress = useRef(new Animated.Value(animateOnMount ? 0 : 1)).current;
  const lastGeneration = useRef(animateOnMount ? -1 : generation);

  useLayoutEffect(() => {
    if (!motionActive) {
      progress.stopAnimation();
      progress.setValue(1);
      lastGeneration.current = generation;
      return undefined;
    }
    if (generation === 0 || reducedMotion || index >= 4 || lastGeneration.current === generation) {
      lastGeneration.current = generation;
      progress.setValue(1);
      return undefined;
    }
    lastGeneration.current = generation;
    progress.stopAnimation();
    progress.setValue(0);
    const delay = index * 44;
    const anim = Animated.sequence([
      ...(delay > 0 ? [Animated.delay(delay)] : []),
      Animated.spring(progress, {
        toValue: 1,
        tension: 245,
        friction: 21,
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => {
      anim.stop();
    };
  }, [generation, index, motionActive, progress, reducedMotion]);

  if (reducedMotion || index >= 4) {
    return <>{children}</>;
  }

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [direction * 26, 0],
  });
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [8, 0],
  });
  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.968, 1],
  });

  return (
    <Animated.View
      collapsable={false}
      style={{
        transform: [{ translateX }, { translateY }, { scale }],
      }}
    >
      {children}
    </Animated.View>
  );
}

type LessonRowProps = {
  lesson: StoredLesson;
  cardNumber: number;
  newest: boolean;
  motionActive: boolean;
  isNarrow: boolean;
  onOpen: (lesson: StoredLesson) => void;
  onOpenSummary: (lesson: StoredLesson) => void;
  onShare: (lesson: StoredLesson) => void;
  onRemove: (lesson: StoredLesson) => void;
};

/**
 * Collectible 3D comic notebook page card: color-coded spiral spine, bookmark
 * ribbon on the newest entry, tilted page stamp, readable Unicode formula
 * snippet, final answer preview pedestal, collapsable-safe study chips, quick
 * result/share/remove controls, and zero Reanimated worklets.
 */
const LessonRow = memo(function LessonRow({
  lesson,
  cardNumber,
  newest,
  motionActive,
  isNarrow,
  onOpen,
  onOpenSummary,
  onShare,
  onRemove,
}: LessonRowProps) {
  const presentation = notebookProblemPresentation(lesson);
  const verdict = notebookVerdictPresentation(lesson);
  const checked = lesson.mode === 'check';
  const spineTone = verdict?.tone === 'correct'
    ? colors.lime
    : verdict?.tone === 'incorrect'
      ? colors.rose
      : verdict?.tone === 'partial'
        ? colors.gold
        : checked ? colors.peach : colors.cyan;
  const answerTone = verdict?.tone === 'incorrect'
    ? answerPreviewTones.incorrect
    : verdict?.tone === 'partial'
      ? answerPreviewTones.partial
      : answerPreviewTones.default;
  const modePillBg = checked ? colors.peachSoft : colors.cyanSoft;
  const modeGlyph = checked ? '✓' : '✦';
  const modeLabel = checked ? 'VERIFICATĂ' : 'REZOLVATĂ';
  const watermarkGlyph = verdict?.tone === 'correct' ? '✓' : checked ? '∑' : 'π';
  const actionLabel = checked ? 'Vezi verificarea' : 'Vezi rezolvarea';
  const stepLabel = `${lesson.steps.length} ${lesson.steps.length === 1 ? 'pas' : 'pași'}`;
  const takeawayLabel = presentation.takeawayCount > 0
    ? `${presentation.takeawayCount} ${presentation.takeawayCount === 1 ? 'idee' : 'idei'}`
    : null;
  const requestLabel = presentation.requestCount > 1 ? `${presentation.requestCount} cerințe` : null;
  const snippetDisplay = presentation.prettySnippet ?? presentation.snippet;
  const pressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!motionActive) {
      pressAnim.stopAnimation();
      pressAnim.setValue(0);
    }
    return () => {
      pressAnim.stopAnimation();
    };
  }, [motionActive, pressAnim]);

  const animatePress = (pressed: boolean) => {
    if (!motionActive) return;
    pressAnim.stopAnimation();
    Animated.spring(pressAnim, {
      toValue: pressed ? 1 : 0,
      tension: pressed ? 340 : 250,
      friction: pressed ? 24 : 18,
      useNativeDriver: true,
    }).start();
  };

  const cardTranslateY = pressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 3.5],
  });
  const cardScale = pressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.986],
  });

  return (
    <View style={styles.lessonRowWrap}>
      <View pointerEvents="none" style={styles.lessonRowShadow} />
      <Animated.View style={{ transform: [{ translateY: cardTranslateY }, { scale: cardScale }] }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${modeLabel}: ${presentation.identity}. ${lesson.topic}. ${verdict ? `${verdict.label}. ` : ''}${stepLabel}.`}
          accessibilityHint={actionLabel}
          onPressIn={() => animatePress(true)}
          onPressOut={() => animatePress(false)}
          onPress={() => {
            pressAnim.stopAnimation();
            pressAnim.setValue(0);
            Haptics.impact(Haptics.ImpactFeedbackStyle.Light);
            onOpen(lesson);
          }}
          style={styles.lessonCard}
        >
        <View style={[styles.lessonRail, { backgroundColor: spineTone }]}>
          <View pointerEvents="none" style={styles.railGloss} />
          <View style={styles.railHole} />
          <View style={styles.railHole} />
          <View style={styles.railHole} />
        </View>

        <View style={styles.lessonBody}>
          <View pointerEvents="none" style={styles.cardShine} />
          {newest ? (
            <View pointerEvents="none" style={styles.bookmarkRibbon}>
              <View style={styles.bookmarkNotch} />
            </View>
          ) : null}
          <Text accessible={false} style={styles.cardWatermark}>{watermarkGlyph}</Text>

          <View style={[styles.lessonMeta, newest && styles.lessonMetaNewest]}>
            <View style={styles.metaLeft}>
              <View collapsable={false} style={[styles.modeStamp, { backgroundColor: modePillBg }]}>
                <Text style={styles.modeGlyph}>{modeGlyph}</Text>
                <Text style={styles.modeText}>{modeLabel}</Text>
              </View>
              {newest ? (
                <View collapsable={false} style={styles.newDot}>
                  <Text style={styles.newDotText}>★ NOUĂ</Text>
                </View>
              ) : null}
            </View>
            <View collapsable={false} style={styles.timePill}>
              <Text style={styles.timeText}>{lessonTime(lesson)}</Text>
            </View>
          </View>

          <View style={styles.titleRow}>
            <View collapsable={false} style={[styles.pageNumBadge, newest && styles.pageNumBadgeNew]}>
              <Text style={styles.pageNumText}>#{cardNumber}</Text>
            </View>
            <Text numberOfLines={2} style={styles.problemIdentity}>{presentation.title}</Text>
          </View>

          {snippetDisplay ? (
            <View style={styles.snippetBox}>
              <View style={[styles.snippetAccent, { backgroundColor: spineTone }]} />
              <View collapsable={false} style={styles.snippetFormulaBadge}>
                <Text style={styles.snippetFormulaGlyph}>ƒ</Text>
              </View>
              <Text numberOfLines={2} style={styles.snippetText}>{snippetDisplay}</Text>
            </View>
          ) : null}

          {presentation.answerPreview ? (
            <View
              collapsable={false}
              style={[
                styles.answerStrip,
                { backgroundColor: answerTone.bg, borderColor: answerTone.border },
              ]}
            >
              <View collapsable={false} style={[styles.answerBadge, { backgroundColor: answerTone.badgeBg }]}>
                <Text style={styles.answerBadgeText}>★ RĂSPUNS</Text>
              </View>
              <Text numberOfLines={1} style={[styles.answerPreviewText, { color: answerTone.text }]}>
                {presentation.answerPreview}
              </Text>
            </View>
          ) : null}

          <View style={styles.topicRow}>
            <View collapsable={false} style={styles.topicTag}>
              <View style={[styles.topicMarker, { backgroundColor: spineTone }]} />
              <Text numberOfLines={1} style={styles.topicText}>{lesson.topic}</Text>
            </View>
            {verdict ? (
              <View collapsable={false} style={[styles.verdictBadge, { backgroundColor: verdictTones[verdict.tone].bg }]}>
                <Text style={[styles.verdictText, { color: verdictTones[verdict.tone].color }]}>
                  {verdictTones[verdict.tone].mark} {verdict.label}
                </Text>
              </View>
            ) : null}
            <View collapsable={false} style={styles.detailChip}>
              <View style={styles.detailDot} />
              <Text style={styles.detailText}>{stepLabel}</Text>
            </View>
            {takeawayLabel ? (
              <View collapsable={false} style={styles.detailChip}>
                <Text style={styles.detailSpark}>✦</Text>
                <Text style={styles.detailText}>{takeawayLabel}</Text>
              </View>
            ) : null}
            {requestLabel ? (
              <View collapsable={false} style={styles.detailChip}>
                <Text style={styles.detailText}>{requestLabel}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.lessonFooter}>
            <View style={styles.quickActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Vezi rezultatul pentru ${presentation.title}`}
                hitSlop={6}
                onPress={(event) => {
                  event.stopPropagation();
                  onOpenSummary(lesson);
                }}
                style={({ pressed }) => [
                  styles.summaryAction,
                  isNarrow && styles.summaryActionNarrow,
                  pressed && styles.actionPressed,
                ]}
              >
                <View collapsable={false} style={styles.summaryActionInner}>
                  <Text style={styles.summaryActionStar}>★</Text>
                  <Text style={styles.summaryActionText}>Rezultat</Text>
                </View>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Trimite ${presentation.title}`}
                hitSlop={6}
                onPress={(event) => {
                  event.stopPropagation();
                  onShare(lesson);
                }}
                style={({ pressed }) => [
                  styles.shareIconAction,
                  isNarrow && styles.iconActionNarrow,
                  pressed && styles.actionPressed,
                ]}
              >
                <Text style={styles.shareIconGlyph}>↗</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Scoate ${presentation.title} din Caiet`}
                hitSlop={6}
                onPress={(event) => {
                  event.stopPropagation();
                  onRemove(lesson);
                }}
                style={({ pressed }) => [
                  styles.removeIconAction,
                  isNarrow && styles.iconActionNarrow,
                  pressed && styles.actionPressed,
                ]}
              >
                <MiniGlyph name="close" size={13} color={colors.berryDeep} />
              </Pressable>
            </View>

            <View
              collapsable={false}
              style={[
                styles.openPill,
                isNarrow && styles.openPillNarrow,
              ]}
            >
              <View pointerEvents="none" style={styles.openPillShine} />
              <Text style={styles.openPillText}>Deschide</Text>
              <View collapsable={false} style={styles.openArrowBadge}>
                <Text style={styles.openArrowGlyph}>→</Text>
              </View>
            </View>
          </View>
        </View>
      </Pressable>
      </Animated.View>
    </View>
  );
}, (previous, next) => (
  previous.lesson.id === next.lesson.id
  && previous.cardNumber === next.cardNumber
  && previous.lesson.topic === next.lesson.topic
  && previous.lesson.mode === next.lesson.mode
  && previous.lesson.verdict === next.lesson.verdict
  && previous.lesson.steps.length === next.lesson.steps.length
  && previous.lesson.takeaways.length === next.lesson.takeaways.length
  && previous.lesson.createdAt?.toDate?.().getTime() === next.lesson.createdAt?.toDate?.().getTime()
  && previous.newest === next.newest
  && previous.motionActive === next.motionActive
  && previous.isNarrow === next.isNarrow
  && previous.onOpen === next.onOpen
  && previous.onOpenSummary === next.onOpenSummary
  && previous.onShare === next.onShare
  && previous.onRemove === next.onRemove
  && sameProblemPreview(previous.lesson, next.lesson)
));

function LessonSeparator() {
  return <View style={styles.lessonSeparator} />;
}

function NotebookLoading({ active }: { active: boolean }) {
  const showProgress = useDelayedBusy(active, 300);
  return (
    <View style={styles.loadingState}>
      <Mascot pose="thinking" size={132} active={active} />
      <Chip label="CAIETUL TĂU" tone="violetSoft" outlined={false} style={styles.stateChip} />
      <Text style={styles.loadingTitle}>Lecțiile tale, la un loc.</Text>
      <View style={styles.notebookProgress}>
        {showProgress ? <PlayfulLoader compact label="Sincronizez lecțiile" style={styles.notebookLoader} /> : null}
      </View>
    </View>
  );
}

type FullStateProps = {
  kind: 'empty' | 'error';
  active: boolean;
  onPrimary: () => void;
  onSecondary?: () => void;
};

function FullNotebookState({ kind, active, onPrimary, onSecondary }: FullStateProps) {
  const error = kind === 'error';
  return (
    <ScrollView
      alwaysBounceVertical={false}
      contentContainerStyle={styles.fullState}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.emptyMascotStage}>
        <View style={[styles.emptyHalo, error && styles.emptyHaloError]} />
        <Mascot pose={error ? 'oops' : 'wave'} size={142} active={active} interactive />
      </View>
      <View>
        <Chip
          label={error ? 'CONEXIUNE ÎNTRERUPTĂ' : 'PRIMA PAGINĂ E LIBERĂ'}
          tone={error ? 'peach' : 'lime'}
          tilt={-2}
        />
      </View>
      <View style={styles.emptyCopyWrap}>
        <Text style={styles.fullStateTitle}>
          {error ? 'Caietul e încă pe raft' : 'Prima lecție merită un loc bun'}
        </Text>
        <Text style={styles.fullStateText}>
          {error
            ? 'Lecțiile tale rămân în siguranță. Verifică internetul și încearcă din nou.'
            : 'Rezolvă ori verifică o problemă, apoi salveaz-o. Revii oricând la enunț și la pașii explicați.'}
        </Text>
      </View>
      <View style={styles.emptyActions}>
        <ComicButton
          compact
          title={error ? 'Reîncearcă' : 'Rezolvă prima problemă'}
          icon={error ? 'scan' : 'camera'}
          tone="lime"
          onPress={onPrimary}
        />
        {!error && onSecondary ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Sau verifică o rezolvare"
            haptic="selection"
            onPress={onSecondary}
            style={styles.secondaryEmptyWrap}
            contentStyle={styles.secondaryEmptyAction}
          >
            <Text style={styles.secondaryEmptyText}>Sau verifică o rezolvare →</Text>
          </PressableScale>
        ) : null}
      </View>
    </ScrollView>
  );
}

type FilterEmptyProps = {
  filter: NotebookFilter;
  query: string;
  topic: string | null;
  onReset: () => void;
  onStart: (mode: FlowMode) => void;
};

/** Zero-worklet empty state so switching to an empty filter tab stays instant. */
const FilterEmpty = memo(function FilterEmpty({ filter, query, topic, onReset, onStart }: FilterEmptyProps) {
  const searching = Boolean(query);
  const filteredByTopic = Boolean(topic);
  const check = filter === 'check';
  const title = searching
    ? `Nicio problemă pentru „${query}”`
    : filteredByTopic
      ? check
        ? `Nicio verificare la „${topic}”`
        : filter === 'solve'
          ? `Nicio rezolvare la „${topic}”`
          : `Nicio problemă la „${topic}”`
      : check ? 'Nicio verificare salvată' : 'Nicio problemă rezolvată';
  const description = searching
    ? 'Încearcă un capitol, o formulă sau un alt cuvânt din enunț.'
    : filteredByTopic
      ? 'Încearcă un alt capitol sau revino la toate problemele din Caiet.'
      : check ? 'Verifică o rezolvare, apoi păstreaz-o aici pentru recapitulare.' : 'Rezolvă o problemă, apoi salveaz-o în Caiet.';
  const shouldReset = searching || filteredByTopic;

  return (
    <View style={styles.filterEmpty}>
      <View style={styles.filterEmptyBadge}>
        <Image
          accessible={false}
          fadeDuration={0}
          source={bundledImageSource(mascotAssets.thinking)}
          resizeMode="contain"
          style={styles.filterEmptyOwl}
        />
      </View>
      <Text style={styles.filterEmptyTitle}>{title}</Text>
      <Text style={styles.filterEmptyText}>{description}</Text>
      <View style={styles.filterEmptyActionWrap}>
        <View pointerEvents="none" style={styles.filterEmptyActionShadow} />
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            Haptics.selection();
            if (shouldReset) onReset();
            else onStart(check ? 'check' : 'solve');
          }}
          style={({ pressed }) => [styles.filterEmptyAction, pressed && styles.filterEmptyActionPressed]}
        >
          <Text style={styles.filterEmptyActionText}>
            {searching ? 'Șterge căutarea' : filteredByTopic ? 'Arată toate problemele' : check ? 'Verifică o rezolvare' : 'Rezolvă o problemă'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
});

export function NotebookScreen({ navigation }: Props) {
  const frame = useSafeAreaFrame();
  const { gutter, isNarrow } = useResponsiveLayout(frame);
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { beginTransition } = useTransitionMotion();
  const transitionSettled = useTransitionSettled(navigation, reducedMotion);
  const motionActive = useScreenMotionActive(navigation, reducedMotion);
  const [tabState, setTabState] = useState<{
    filter: NotebookFilter;
    direction: -1 | 0 | 1;
    generation: number;
  }>({ filter: 'all', direction: 0, generation: 0 });
  const [queryText, setQueryText] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchActivated, setSearchActivated] = useState(false);
  const deferredQueryText = useDeferredValue(queryText);
  const [initialWarmCache] = useState(() => getCachedFavoriteLessons() !== undefined);
  const [notes, setNotes] = useState<StoredLesson[]>(() => getCachedFavoriteLessons() ?? []);
  const [loading, setLoading] = useState(() => !initialWarmCache);
  const [loadError, setLoadError] = useState(false);
  const [subscriptionAttempt, setSubscriptionAttempt] = useState(0);
  const [pendingRemoval, setPendingRemoval] = useState<StoredLesson>();
  const [removeVisible, setRemoveVisible] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState(false);

  const listRef = useRef<FlatList<StoredLesson>>(null);
  const openingNoteRef = useRef(false);

  useFocusEffect(useCallback(() => {
    openingNoteRef.current = false;
  }, []));

  useEffect(() => {
    // When cached lessons are already ready, wait for the slide transition to
    // finish before attaching the live screen-scoped Firestore subscription.
    if (initialWarmCache && !transitionSettled) return undefined;
    let mounted = true;
    let unsubscribe: (() => void) | undefined;
    subscribeToFavoriteLessons(
      (lessons) => {
        if (!mounted) return;
        setNotes((current) => (sameLessonList(current, lessons) ? current : lessons));
        setLoading(false);
        setLoadError(false);
      },
      (error) => {
        if (!mounted) return;
        recordDiagnosticError('notebook_subscription', error);
        setLoading(false);
        setLoadError(true);
      },
    ).then((stop) => {
      if (mounted) unsubscribe = stop;
      else stop();
    }).catch((error) => {
      if (!mounted) return;
      recordDiagnosticError('notebook_subscription', error);
      setLoading(false);
      setLoadError(true);
    });
    return () => { mounted = false; unsubscribe?.(); };
  }, [initialWarmCache, subscriptionAttempt, transitionSettled]);

  const { filter, direction, generation } = tabState;
  const normalizedQuery = deferredQueryText.trim();
  const topicCounts = useMemo(() => notebookTopicCounts(notes), [notes]);
  const effectiveTopic = useMemo(() => {
    if (!selectedTopic) return null;
    const needle = selectedTopic.toLocaleLowerCase('ro-RO');
    return topicCounts.some((item) => item.topic.toLocaleLowerCase('ro-RO') === needle)
      ? selectedTopic
      : null;
  }, [selectedTopic, topicCounts]);
  const visibleNotes = useMemo(
    () => filterNotebookLessons(notes, filter, normalizedQuery, effectiveTopic),
    [effectiveTopic, filter, normalizedQuery, notes],
  );
  // Keep 100% of the visible viewport filled on Frame 0 while preventing
  // off-screen list items from inflating mid-transition.
  const renderedNotes = useMemo(
    () => (transitionSettled || visibleNotes.length <= 3 ? visibleNotes : visibleNotes.slice(0, 3)),
    [transitionSettled, visibleNotes],
  );
  const counts = useMemo(() => notebookFilterCounts(notes), [notes]);

  const tabOptions = useMemo<readonly ComicTabOption<NotebookFilter>[]>(() => [
    {
      value: 'all',
      label: 'Toate',
      badge: counts.all,
      activeFill: colors.violet,
      activeText: colors.paper,
      badgeFill: colors.lime,
      badgeText: colors.ink,
    },
    {
      value: 'solve',
      label: 'Rezolvate',
      badge: counts.solve,
      activeFill: colors.cyan,
      activeText: colors.ink,
      badgeFill: colors.paper,
      badgeText: colors.ink,
    },
    {
      value: 'check',
      label: 'Verificate',
      badge: counts.check,
      activeFill: colors.peach,
      activeText: colors.ink,
      badgeFill: colors.paper,
      badgeText: colors.ink,
    },
  ], [counts.all, counts.check, counts.solve]);

  const chooseFilter = useCallback((next: NotebookFilter) => {
    setTabState((current) => {
      if (current.filter === next) return current;
      const nextDirection: -1 | 1 = FILTER_ORDER[next] > FILTER_ORDER[current.filter] ? 1 : -1;
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
      return {
        filter: next,
        direction: nextDirection,
        generation: current.generation + 1,
      };
    });
  }, []);

  const chooseTopic = useCallback((nextTopic: string | null) => {
    Haptics.selection();
    setSelectedTopic((current) => {
      if (
        current
        && nextTopic
        && current.toLocaleLowerCase('ro-RO') === nextTopic.toLocaleLowerCase('ro-RO')
      ) {
        return null;
      }
      return nextTopic;
    });
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
    setTabState((current) => ({
      ...current,
      direction: 0,
      generation: current.generation + 1,
    }));
  }, []);

  const openNote = useCallback((lesson: StoredLesson) => {
    if (openingNoteRef.current) return;
    openingNoteRef.current = true;
    // Pause all animations on Caiet immediately and launch the native slide
    // without blocking the main thread on WebView preloading.
    beginTransition();
    navigation.navigate('Lesson', {
      lesson,
      lessonId: lesson.id,
      isFavorite: true,
      source: 'notebook',
    });
  }, [beginTransition, navigation]);

  const openSummary = useCallback((lesson: StoredLesson) => {
    if (openingNoteRef.current) return;
    openingNoteRef.current = true;
    Haptics.impact(Haptics.ImpactFeedbackStyle.Light);
    beginTransition();
    navigation.navigate('Summary', {
      lesson,
      lessonId: lesson.id,
      isFavorite: true,
    });
  }, [beginTransition, navigation]);

  const shareNote = useCallback((lesson: StoredLesson) => {
    Haptics.selection();
    void Share.share({
      title: lesson.title,
      message: formatLessonShareMessage(lesson),
    }).catch(() => undefined);
  }, []);

  const requestRemove = useCallback((lesson: StoredLesson) => {
    Haptics.selection();
    setRemoveError(false);
    setPendingRemoval(lesson);
    setRemoveVisible(true);
  }, []);

  const closeRemoval = useCallback((force = false) => {
    if (removing && !force) return;
    setRemoveVisible(false);
  }, [removing]);

  const handleRemovalClosed = useCallback(() => {
    setPendingRemoval(undefined);
    setRemoveError(false);
  }, []);

  const confirmRemoval = useCallback(async () => {
    const lesson = pendingRemoval;
    if (!lesson || removing) return;
    setRemoving(true);
    setRemoveError(false);
    try {
      await setLessonFavorite(lesson.id, false);
      setNotes((current) => current.filter((note) => note.id !== lesson.id));
      Haptics.notification(Haptics.NotificationFeedbackType.Success);
      setRemoving(false);
      setRemoveVisible(false);
    } catch (error) {
      recordDiagnosticError('notebook_update', error);
      setRemoveError(true);
      setRemoving(false);
      Haptics.notification(Haptics.NotificationFeedbackType.Error);
    }
  }, [pendingRemoval, removing]);

  const startMode = useCallback((mode: FlowMode) => {
    if (openingNoteRef.current) return;
    openingNoteRef.current = true;
    beginTransition();
    navigation.navigate('Capture', { mode });
  }, [beginTransition, navigation]);
  const clearSearch = useCallback(() => setQueryText(''), []);
  const resetFilters = useCallback(() => {
    setQueryText('');
    setSelectedTopic(null);
    chooseFilter('all');
  }, [chooseFilter]);
  const retrySubscription = useCallback(() => {
    setLoadError(false);
    setLoading(notes.length === 0);
    setSubscriptionAttempt((attempt) => attempt + 1);
  }, [notes.length]);

  const newestNoteId = filter === 'all' && !normalizedQuery && !effectiveTopic ? notes[0]?.id : undefined;
  const renderLesson = useCallback<ListRenderItem<StoredLesson>>(({ item, index }) => (
    <StaggerCardSlot
      index={index}
      generation={generation}
      direction={direction}
      motionActive={motionActive}
      reducedMotion={reducedMotion}
    >
      <LessonRow
        lesson={item}
        cardNumber={index + 1}
        newest={item.id === newestNoteId}
        motionActive={motionActive}
        isNarrow={isNarrow}
        onOpen={openNote}
        onOpenSummary={openSummary}
        onShare={shareNote}
        onRemove={requestRemove}
      />
    </StaggerCardSlot>
  ), [direction, generation, isNarrow, motionActive, newestNoteId, openNote, openSummary, reducedMotion, requestRemove, shareNote]);
  const keyExtractor = useCallback((item: StoredLesson) => item.id, []);
  const activeTabLabel = tabOptions.find((tab) => tab.value === filter)?.label ?? 'Toate';
  const resultLabel = normalizedQuery
    ? `„${normalizedQuery}”`
    : effectiveTopic
      ? effectiveTopic
      : filter === 'all'
        ? 'Probleme salvate'
        : activeTabLabel;
  const shelfEyebrow = normalizedQuery
    ? 'CĂUTARE ACTIVĂ'
    : effectiveTopic
      ? 'CAPITOL SELECTAT'
      : 'CAIETUL TĂU';
  const hasResettableFilter = Boolean(normalizedQuery || effectiveTopic);
  const headerCount = loading && notes.length === 0
    ? 'LECȚII SALVATE'
    : topicCounts.length > 1
      ? `${notes.length} ${notes.length === 1 ? 'PROBLEMĂ' : 'PROBLEME'} · ${topicCounts.length} CAPITOLE`
      : `${notes.length} ${notes.length === 1 ? 'PROBLEMĂ SALVATĂ' : 'PROBLEME SALVATE'}`;
  const pendingRemovalTitle = pendingRemoval ? notebookProblemPresentation(pendingRemoval).title : '';
  const searchPlaceholder = isNarrow ? 'Caută în enunțuri' : 'Caută în enunțuri, formule sau capitole';
  const mountSearchInput = transitionSettled || searchActivated;

  if (loading && notes.length === 0) {
    return (
      <View style={[styles.safe, { paddingTop: insets.top ?? 0 }]}>
        <StatusBar style="dark" />
        <ComicBackdrop />
        <ScreenHeader title="Caietul meu" eyebrow={headerCount} onBack={() => navigation.goBack()} rightIcon="camera" rightLabel="Rezolvă o problemă nouă" onRight={() => startMode('solve')} />
        <NotebookLoading active={motionActive} />
      </View>
    );
  }

  if (notes.length === 0) {
    return (
      <View style={[styles.safe, { paddingTop: insets.top ?? 0 }]}>
        <StatusBar style="dark" />
        <ComicBackdrop />
        <ScreenHeader title="Caietul meu" eyebrow={headerCount} onBack={() => navigation.goBack()} rightIcon="camera" rightLabel="Rezolvă o problemă nouă" onRight={() => startMode('solve')} />
        <FullNotebookState kind={loadError ? 'error' : 'empty'} active={motionActive} onPrimary={loadError ? retrySubscription : () => startMode('solve')} onSecondary={() => startMode('check')} />
      </View>
    );
  }

  return (
    <View style={[styles.safe, { paddingTop: insets.top ?? 0 }]}>
      <StatusBar style="dark" />
      <ComicBackdrop />
      <ScreenHeader compact title="Caietul meu" eyebrow={headerCount} onBack={() => navigation.goBack()} rightIcon="camera" rightLabel="Rezolvă o problemă nouă" onRight={() => startMode('solve')} />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.controls, { paddingHorizontal: gutter }]}>
          <View style={[styles.searchShadow, searchFocused && styles.searchShadowFocused]}>
            <View style={[styles.searchBox, searchFocused && styles.searchBoxFocused]}>
              <View pointerEvents="none" style={styles.searchShine} />
              <AppIcon name="search" size={26} />
              {mountSearchInput ? (
                <TextInput
                  autoFocus={searchActivated}
                  autoCorrect={false}
                  returnKeyType="search"
                  value={queryText}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  onChangeText={setQueryText}
                  placeholder={searchPlaceholder}
                  placeholderTextColor={colors.inkSoft}
                  selectionColor={colors.violet}
                  style={styles.searchInput}
                />
              ) : (
                <Pressable
                  accessibilityRole="search"
                  accessibilityLabel={searchPlaceholder}
                  onPress={() => setSearchActivated(true)}
                  style={styles.searchPlaceholderTouch}
                >
                  <Text numberOfLines={1} style={styles.searchPlaceholderText}>{searchPlaceholder}</Text>
                </Pressable>
              )}
              {queryText ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Șterge căutarea" hitSlop={9} onPress={clearSearch} style={styles.clearSearch}>
                  <MiniGlyph name="close" size={14} color={colors.ink} />
                </Pressable>
              ) : null}
            </View>
          </View>

          <ComicTabBar
            compact
            options={tabOptions}
            value={filter}
            onChange={chooseFilter}
          />
        </View>

        {topicCounts.length >= 2 ? (
          <View style={styles.topicStripWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[styles.topicStripContent, { paddingHorizontal: gutter }]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: effectiveTopic === null }}
                onPress={() => chooseTopic(null)}
                style={({ pressed }) => [
                  styles.topicFilterPill,
                  effectiveTopic === null && styles.topicFilterPillActive,
                  pressed && styles.actionPressed,
                ]}
              >
                <View collapsable={false} style={styles.topicFilterPillInner}>
                  <Text style={[styles.topicFilterText, effectiveTopic === null && styles.topicFilterTextActive]}>
                    Toate capitolele
                  </Text>
                </View>
              </Pressable>

              {topicCounts.map((item, index) => {
                const active = effectiveTopic?.toLocaleLowerCase('ro-RO') === item.topic.toLocaleLowerCase('ro-RO');
                const dotColor = TOPIC_DOT_TONES[index % TOPIC_DOT_TONES.length];
                return (
                  <Pressable
                    key={item.topic}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => chooseTopic(item.topic)}
                    style={({ pressed }) => [
                      styles.topicFilterPill,
                      active && styles.topicFilterPillActive,
                      pressed && styles.actionPressed,
                    ]}
                  >
                    <View collapsable={false} style={styles.topicFilterPillInner}>
                      <View style={[styles.topicFilterDot, { backgroundColor: active ? colors.lime : dotColor }]} />
                      <Text numberOfLines={1} style={[styles.topicFilterText, active && styles.topicFilterTextActive]}>
                        {item.topic}
                      </Text>
                      <View collapsable={false} style={[styles.topicFilterCount, active && styles.topicFilterCountActive]}>
                        <Text style={[styles.topicFilterCountText, active && styles.topicFilterCountTextActive]}>
                          {item.count}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {loadError ? (
          <Pressable accessibilityRole="button" onPress={retrySubscription} style={[styles.syncWarning, { marginHorizontal: gutter }]}>
            <MiniGlyph name="spark" size={14} color={colors.ink} />
            <Text style={styles.syncWarningText}>Vezi copia salvată pe telefon. Atinge pentru reconectare.</Text>
          </Pressable>
        ) : null}

        <View style={[styles.listHeading, { paddingHorizontal: gutter }]}>
          <View style={styles.listHeadingLeft}>
            <View collapsable={false} style={styles.miniMascotBadge}>
              <View pointerEvents="none" style={styles.miniMascotShine} />
              <AppIcon name="notebook" size={26} />
            </View>
            <View style={styles.listHeadingCopy}>
              <Text numberOfLines={1} style={styles.listEyebrow}>
                {shelfEyebrow}
              </Text>
              <Text numberOfLines={1} style={styles.listTitle}>{resultLabel}</Text>
            </View>
          </View>
          <View style={styles.listHeadingRight}>
            {hasResettableFilter ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Resetează filtrele"
                hitSlop={6}
                onPress={() => {
                  Haptics.selection();
                  resetFilters();
                }}
                style={({ pressed }) => [styles.resetFilterPill, pressed && styles.actionPressed]}
              >
                <View collapsable={false} style={styles.resetFilterInner}>
                  <Text style={styles.resetFilterText}>× Resetează</Text>
                </View>
              </Pressable>
            ) : null}
            <View collapsable={false} style={styles.visibleCountPill}>
              <Text style={styles.visibleCount}>
                ★ {visibleNotes.length} {visibleNotes.length === 1 ? 'lecție' : 'lecții'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.listMotion}>
          <FlatList
            ref={listRef}
            data={renderedNotes}
            renderItem={renderLesson}
            keyExtractor={keyExtractor}
            ItemSeparatorComponent={LessonSeparator}
            ListEmptyComponent={renderedNotes.length === 0 ? (
              <StaggerCardSlot
                index={0}
                generation={generation}
                direction={direction}
                motionActive={motionActive}
                reducedMotion={reducedMotion}
              >
                <FilterEmpty
                  filter={filter}
                  query={normalizedQuery}
                  topic={effectiveTopic}
                  onReset={resetFilters}
                  onStart={startMode}
                />
              </StaggerCardSlot>
            ) : null}
            ListFooterComponent={<View style={styles.listFooter} />}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={false}
            initialNumToRender={3}
            maxToRenderPerBatch={3}
            windowSize={5}
            contentContainerStyle={[styles.listContent, { paddingHorizontal: gutter, paddingBottom: Math.max(insets.bottom, 16) + 18 }]}
          />
        </View>
      </KeyboardAvoidingView>

      {pendingRemoval ? (
        <RemoveFromNotebookModal
          visible={removeVisible && Boolean(pendingRemoval)}
          lessonTitle={pendingRemovalTitle}
          description="Lecția va dispărea din lista ta. Fotografia nu este păstrată în Caiet."
          removing={removing}
          error={removeError}
          onConfirm={() => void confirmRemoval()}
          onCancel={() => closeRemoval()}
          onAfterClose={handleRemovalClosed}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1, minHeight: 0 },
  controls: { paddingTop: 4, gap: 8 },

  topicStripWrap: { marginTop: 7 },
  topicStripContent: { gap: 7, paddingVertical: 2, alignItems: 'center' },
  topicFilterPill: {
    minHeight: 31,
    borderRadius: 11,
    borderWidth: 1.5,
    borderBottomWidth: 3,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    justifyContent: 'center',
  },
  topicFilterPillActive: {
    borderColor: colors.ink,
    backgroundColor: colors.violet,
  },
  topicFilterPillInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  topicFilterDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: 1.25,
    borderColor: colors.ink,
  },
  topicFilterText: {
    fontFamily: fonts.bodyBold,
    color: colors.inkSoft,
    fontSize: 11.5,
    lineHeight: 15,
    includeFontPadding: false,
  },
  topicFilterTextActive: {
    color: colors.paper,
  },
  topicFilterCount: {
    minWidth: 18,
    minHeight: 18,
    paddingHorizontal: 5,
    borderRadius: 6,
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topicFilterCountActive: {
    backgroundColor: colors.lime,
    borderWidth: 1,
    borderColor: colors.ink,
  },
  topicFilterCountText: {
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
    fontSize: 10,
    lineHeight: 13,
    includeFontPadding: false,
  },
  topicFilterCountTextActive: {
    color: colors.ink,
  },

  searchShadow: { borderRadius: 17, backgroundColor: colors.ink, paddingBottom: shadows.sm },
  searchShadowFocused: { backgroundColor: colors.violetShadow },
  searchBox: {
    height: 46,
    borderWidth: borders.regular,
    borderColor: colors.ink,
    borderRadius: 16,
    backgroundColor: colors.paper,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 6,
    overflow: 'hidden',
  },
  searchBoxFocused: { borderColor: colors.violet },
  searchShine: {
    position: 'absolute',
    top: 2,
    left: 12,
    right: 12,
    height: 4,
    borderRadius: 3,
    backgroundColor: colors.shine,
  },
  searchInput: { flex: 1, height: 42, paddingVertical: 0, fontFamily: fonts.bodyMedium, color: colors.ink, fontSize: 13.5 },
  searchPlaceholderTouch: { flex: 1, height: 42, justifyContent: 'center' },
  searchPlaceholderText: { fontFamily: fonts.bodyMedium, color: colors.inkSoft, fontSize: 13.5 },
  clearSearch: {
    width: 28,
    height: 28,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.ink,
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  syncWarning: {
    minHeight: 40,
    marginTop: 8,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: colors.ink,
    backgroundColor: colors.peachSoft,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  syncWarningText: { flexShrink: 1, fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 11.5, lineHeight: 15 },

  listHeading: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingTop: 6,
    paddingBottom: 3,
  },
  listHeadingLeft: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  miniMascotBadge: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: borders.thin,
    borderBottomWidth: 3.5,
    borderColor: colors.ink,
    backgroundColor: colors.limeSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    transform: [{ rotate: '-3deg' }],
  },
  miniMascotShine: {
    position: 'absolute',
    top: 2,
    left: 6,
    right: 6,
    height: 4,
    borderRadius: 3,
    backgroundColor: colors.shine,
  },
  listHeadingCopy: { flex: 1, minWidth: 0 },
  listEyebrow: { ...typography.kicker, fontSize: 10.5, lineHeight: 14, color: colors.violetDeep },
  listTitle: { fontFamily: fonts.display, color: colors.ink, fontSize: 19.5, lineHeight: 23, marginTop: 1 },
  listHeadingRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  resetFilterPill: {
    minHeight: 26,
    borderRadius: 10,
    borderWidth: 1.5,
    borderBottomWidth: 3,
    borderColor: colors.ink,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetFilterInner: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetFilterText: {
    fontFamily: fonts.bodyBold,
    color: colors.ink,
    fontSize: 11,
    lineHeight: 15,
    includeFontPadding: false,
  },
  visibleCountPill: {
    minHeight: 26,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1.5,
    borderBottomWidth: 3,
    borderColor: colors.ink,
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visibleCount: {
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
    fontSize: 11.5,
    lineHeight: 15,
    paddingHorizontal: 1,
    includeFontPadding: false,
  },

  listMotion: { flex: 1, minHeight: 0 },
  listContent: { flexGrow: 1, paddingTop: 5 },
  lessonSeparator: { height: 14 },

  lessonRowWrap: {
    position: 'relative',
    paddingBottom: shadows.md,
  },
  lessonRowShadow: {
    position: 'absolute',
    top: shadows.md,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 23,
    backgroundColor: colors.ink,
  },
  lessonCard: {
    overflow: 'hidden',
    borderRadius: 23,
    borderWidth: borders.regular,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    flexDirection: 'row',
  },
  lessonRail: {
    width: 18,
    borderRightWidth: borders.thin,
    borderRightColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingVertical: 16,
    position: 'relative',
  },
  railGloss: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 2,
    width: 3,
    borderRadius: 2,
    backgroundColor: colors.shine,
  },
  railHole: {
    width: 8.5,
    height: 8.5,
    borderRadius: 4.5,
    borderWidth: 1.5,
    borderColor: colors.ink,
    backgroundColor: colors.canvas,
  },
  lessonBody: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 13,
    paddingTop: 12,
    paddingBottom: 11,
    position: 'relative',
  },
  cardShine: {
    position: 'absolute',
    top: 3,
    left: 12,
    right: 12,
    height: 5,
    borderRadius: 4,
    backgroundColor: colors.shine,
  },
  bookmarkRibbon: {
    position: 'absolute',
    top: -1,
    right: 16,
    width: 15,
    height: 17,
    backgroundColor: colors.peach,
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: colors.ink,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bookmarkNotch: {
    width: 6,
    height: 4,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    backgroundColor: colors.paper,
    marginBottom: -1,
  },
  cardWatermark: {
    position: 'absolute',
    right: 10,
    bottom: 40,
    fontFamily: fonts.display,
    fontSize: 54,
    lineHeight: 58,
    color: 'rgba(124, 60, 255, 0.055)',
  },
  lessonMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  lessonMetaNewest: {
    paddingRight: 20,
  },
  metaLeft: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  modeStamp: {
    flexShrink: 0,
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9,
    borderWidth: 1.5,
    borderBottomWidth: 2.5,
    borderColor: colors.ink,
  },
  modeGlyph: {
    fontFamily: fonts.display,
    fontSize: 11,
    lineHeight: 15,
    color: colors.ink,
    includeFontPadding: false,
  },
  modeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 0.2,
    paddingHorizontal: 1,
    color: colors.ink,
    includeFontPadding: false,
  },
  newDot: {
    flexShrink: 0,
    minHeight: 24,
    borderRadius: 9,
    borderWidth: 1.5,
    borderBottomWidth: 2.5,
    borderColor: colors.ink,
    backgroundColor: colors.lime,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newDotText: {
    fontFamily: fonts.bodyBold,
    color: colors.ink,
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 0.2,
    paddingHorizontal: 1,
    includeFontPadding: false,
  },
  timePill: {
    flexShrink: 0,
    minHeight: 23,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeText: {
    fontFamily: fonts.bodyMedium,
    color: colors.inkSoft,
    fontSize: 10.5,
    lineHeight: 15,
    includeFontPadding: false,
  },

  titleRow: {
    marginTop: 9,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  pageNumBadge: {
    flexShrink: 0,
    minWidth: 30,
    minHeight: 25,
    marginTop: 1,
    paddingHorizontal: 6,
    borderRadius: 9,
    borderWidth: 1.5,
    borderBottomWidth: 2.5,
    borderColor: colors.ink,
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-3deg' }],
  },
  pageNumBadgeNew: {
    backgroundColor: colors.goldSoft,
  },
  pageNumText: {
    fontFamily: fonts.display,
    fontSize: 11.5,
    lineHeight: 15,
    color: colors.ink,
    includeFontPadding: false,
  },
  problemIdentity: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 18.5,
    lineHeight: 23,
  },

  snippetBox: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5DAF7',
    backgroundColor: '#F7F3FF',
    overflow: 'hidden',
  },
  snippetAccent: {
    width: 4.5,
    alignSelf: 'stretch',
  },
  snippetFormulaBadge: {
    width: 22,
    height: 22,
    marginLeft: 8,
    borderRadius: 7,
    borderWidth: 1.25,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  snippetFormulaGlyph: {
    fontFamily: fonts.display,
    fontSize: 12,
    lineHeight: 15,
    color: colors.violetDeep,
    includeFontPadding: false,
  },
  snippetText: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 7,
    fontFamily: fonts.bodyMedium,
    color: colors.ink,
    fontSize: 13,
    lineHeight: 17.5,
  },

  answerStrip: {
    marginTop: 7,
    minHeight: 33,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 6,
    paddingRight: 10,
    paddingVertical: 5,
    borderRadius: 11,
    borderWidth: 1.5,
  },
  answerBadge: {
    flexShrink: 0,
    minHeight: 21,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 7,
    borderWidth: 1.25,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  answerBadgeText: {
    fontFamily: fonts.bodyBold,
    color: colors.ink,
    fontSize: 9.5,
    lineHeight: 13,
    letterSpacing: 0.25,
    includeFontPadding: false,
  },
  answerPreviewText: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.bodyBold,
    fontSize: 12.5,
    lineHeight: 16,
    includeFontPadding: false,
  },

  topicRow: { minHeight: 26, marginTop: 9, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  topicTag: {
    flexShrink: 1,
    minHeight: 25,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 9,
    borderWidth: 1.25,
    borderColor: colors.line,
    backgroundColor: colors.paperTint,
  },
  topicMarker: {
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: 1.25,
    borderColor: colors.ink,
  },
  topicText: {
    flexShrink: 1,
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
    fontSize: 11.5,
    lineHeight: 15,
    paddingHorizontal: 1,
    includeFontPadding: false,
  },
  verdictBadge: {
    flexShrink: 0,
    minHeight: 25,
    borderRadius: 9,
    borderWidth: 1.5,
    borderBottomWidth: 3,
    borderColor: colors.ink,
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verdictText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 0.2,
    paddingHorizontal: 1,
    includeFontPadding: false,
  },

  lessonFooter: {
    marginTop: 10,
    paddingTop: 9,
    borderTopWidth: 1.5,
    borderTopColor: '#EFEAF8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  detailChip: {
    flexShrink: 0,
    minHeight: 25,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 9,
    backgroundColor: colors.canvas,
    borderWidth: 1.25,
    borderColor: colors.line,
  },
  detailDot: {
    width: 5.5,
    height: 5.5,
    borderRadius: 3,
    backgroundColor: colors.violet,
  },
  detailSpark: {
    fontFamily: fonts.display,
    color: colors.violetDeep,
    fontSize: 10.5,
    lineHeight: 13,
    includeFontPadding: false,
  },
  detailText: {
    fontFamily: fonts.bodyBold,
    color: colors.inkSoft,
    fontSize: 11,
    lineHeight: 14,
    includeFontPadding: false,
  },
  quickActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryAction: {
    height: 36,
    borderRadius: 11,
    borderWidth: 1.5,
    borderBottomWidth: 3,
    borderColor: colors.ink,
    backgroundColor: colors.goldSoft,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryActionNarrow: {
    paddingHorizontal: 8,
  },
  summaryActionInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  summaryActionStar: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 12,
    lineHeight: 15,
    includeFontPadding: false,
  },
  summaryActionText: {
    fontFamily: fonts.bodyBold,
    color: colors.ink,
    fontSize: 11.5,
    lineHeight: 15,
    includeFontPadding: false,
  },
  shareIconAction: {
    width: 36,
    height: 36,
    borderRadius: 11,
    borderWidth: 1.5,
    borderBottomWidth: 3,
    borderColor: colors.ink,
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareIconGlyph: {
    fontFamily: fonts.display,
    color: colors.violetDeep,
    fontSize: 15,
    lineHeight: 18,
    includeFontPadding: false,
  },
  removeIconAction: {
    width: 36,
    height: 36,
    borderRadius: 11,
    borderWidth: 1.5,
    borderBottomWidth: 3,
    borderColor: '#C98A9C',
    backgroundColor: '#FFF1F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconActionNarrow: {
    width: 33,
    height: 35,
  },
  openPill: {
    minWidth: 106,
    height: 36,
    paddingLeft: 11,
    paddingRight: 5,
    borderRadius: 12,
    borderWidth: 1.5,
    borderBottomWidth: 3.5,
    borderColor: colors.ink,
    backgroundColor: colors.violet,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  openPillNarrow: {
    minWidth: 96,
    height: 35,
    paddingLeft: 9,
    gap: 5,
  },
  openPillShine: {
    position: 'absolute',
    top: 2,
    left: 8,
    right: 8,
    height: 4,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  openPillText: { fontFamily: fonts.bodyBold, color: colors.paper, fontSize: 12, lineHeight: 15, includeFontPadding: false },
  openArrowBadge: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.25,
    borderColor: colors.ink,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openArrowGlyph: {
    fontFamily: fonts.display,
    fontSize: 13,
    lineHeight: 16,
    color: colors.ink,
    includeFontPadding: false,
  },

  loadingState: { flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingBottom: 34 },
  stateChip: { marginTop: 12 },
  notebookProgress: { minHeight: 54, alignItems: 'center', justifyContent: 'center' },
  loadingTitle: { marginTop: 8, fontFamily: fonts.display, color: colors.ink, fontSize: 23, lineHeight: 28, textAlign: 'center' },
  notebookLoader: { marginTop: 16 },

  fullState: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingTop: 14, paddingBottom: 32 },
  emptyMascotStage: { width: 170, height: 158, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  emptyHalo: {
    position: 'absolute',
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: colors.violetSoft,
    borderWidth: 2.5,
    borderStyle: 'dashed',
    borderColor: colors.violet,
  },
  emptyHaloError: { backgroundColor: colors.peachSoft, borderColor: colors.peach },
  emptyCopyWrap: { alignItems: 'center' },
  fullStateTitle: { marginTop: 10, fontFamily: fonts.display, color: colors.ink, fontSize: 24, lineHeight: 28, textAlign: 'center' },
  fullStateText: { maxWidth: 330, marginTop: 6, fontFamily: fonts.body, color: colors.inkSoft, fontSize: 13.5, lineHeight: 20, textAlign: 'center' },
  emptyActions: { width: '100%', maxWidth: 340, marginTop: 22, gap: 6 },
  secondaryEmptyWrap: { alignSelf: 'center' },
  secondaryEmptyAction: { minHeight: 44, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  secondaryEmptyText: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 13 },

  filterEmpty: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, paddingTop: 28, paddingBottom: 24 },
  filterEmptyBadge: {
    width: 104,
    height: 104,
    borderRadius: 34,
    borderWidth: borders.regular,
    borderColor: colors.ink,
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterEmptyOwl: { width: 88, height: 88 },
  filterEmptyTitle: { marginTop: 12, fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 20, lineHeight: 24, textAlign: 'center' },
  filterEmptyText: { maxWidth: 300, marginTop: 6, fontFamily: fonts.body, color: colors.inkSoft, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  filterEmptyActionWrap: { marginTop: 16, position: 'relative', paddingBottom: shadows.sm },
  filterEmptyActionShadow: {
    position: 'absolute',
    top: shadows.sm,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 14,
    backgroundColor: colors.ink,
  },
  filterEmptyAction: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: borders.thin,
    borderColor: colors.ink,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterEmptyActionPressed: { transform: [{ translateY: 2.5 }] },
  filterEmptyActionText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 13 },

  listFooter: { height: 10 },
  actionPressed: { opacity: 0.72 },
});
