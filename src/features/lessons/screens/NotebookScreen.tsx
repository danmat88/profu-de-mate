import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { memo, useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  FlatList,
  Image,
  Keyboard,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
  type ListRenderItem,
} from 'react-native';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import { beginAppTransition } from '../../../shared/context/TransitionMotionContext';
import { useDelayedBusy } from '../../../shared/hooks/useDelayedBusy';
import { useKeyboardHeight } from '../../../shared/hooks/useKeyboardHeight';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { useResponsiveLayout } from '../../../shared/hooks/useResponsiveLayout';
import { useScreenMotionActive, useTransitionSettled } from '../../../shared/hooks/useTransitionSettled';
import { bundledImageSource } from '../../../shared/services/bundledImages';
import { recordDiagnosticError } from '../../../shared/services/diagnostics';
import * as Haptics from '../../../shared/services/haptics';
import { colors, fonts, radii, typography } from '../../../shared/theme';
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
import { SpotlightAura } from '../../../shared/ui/SpotlightAura';
import { Text, TextInput } from '../../../shared/ui/Typography';
import { usePracticeState } from '../../practice/services/practiceStorage';
import type { PracticeQuestion } from '../../practice/types';
import { getPracticeQuestionById } from '../../practice/utils/practiceEngine';
import { FormulaCard } from '../../study/components/FormulaCard';
import { toggleFavoriteFormula, useStudyProfile } from '../../study/services/studyStorage';
import { getFormulaCategoryMeta, type FormulaEntry } from '../../study/types';
import { getFormulaById } from '../../study/utils/studyDocumentBuilder';
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

type Props = Partial<NativeStackScreenProps<RootStackParamList, 'Notebook'>> & {
  embedded?: boolean;
  active?: boolean;
  bottomClearance?: number;
};

type NotebookSection = 'lessons' | 'formulas' | 'mistakes';

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

  const slotStyle = useMemo(
    () => ({
      transform: [
        {
          translateX: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [direction * 26, 0],
          }),
        },
        {
          translateY: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [8, 0],
          }),
        },
        {
          scale: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0.968, 1],
          }),
        },
      ],
    }),
    [direction, progress],
  );

  if (reducedMotion || index >= 4) {
    return <>{children}</>;
  }

  return (
    <Animated.View
      collapsable={false}
      style={slotStyle}
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
 * Flagship editorial study card: slim color-coded accent bar, single crisp
 * meta line, bold title, clean formula preview, highlighted final answer,
 * minimal chapter/step footer, and zero elevation overdraw for locked 60fps.
 */
const LessonRow = memo(function LessonRow({
  lesson,
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
    ? colors.limeDeep
    : verdict?.tone === 'incorrect'
      ? colors.rose
      : verdict?.tone === 'partial'
        ? colors.gold
        : checked ? colors.peach : colors.violet;
  const answerTone = verdict?.tone === 'incorrect'
    ? answerPreviewTones.incorrect
    : verdict?.tone === 'partial'
      ? answerPreviewTones.partial
      : answerPreviewTones.default;
  const modeLabel = checked ? 'Verificată' : 'Rezolvată';
  const actionLabel = checked ? 'Vezi verificarea' : 'Vezi rezolvarea';
  const stepLabel = `${lesson.steps.length} ${lesson.steps.length === 1 ? 'pas' : 'pași'}`;
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
    Animated.timing(pressAnim, {
      toValue: pressed ? 1 : 0,
      duration: pressed ? 90 : 180,
      useNativeDriver: true,
    }).start();
  };

  const cardPressStyle = useMemo(
    () => ({
      transform: [
        {
          scale: pressAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 0.982],
          }),
        },
      ],
    }),
    [pressAnim],
  );

  return (
    <Animated.View style={[styles.lessonRowWrap, cardPressStyle]}>
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
        <View style={[styles.lessonRail, { backgroundColor: spineTone }]} />

        <View style={styles.lessonBody}>
          <View style={styles.lessonMeta}>
            <View style={styles.metaLeft}>
              <View style={[styles.metaDot, { backgroundColor: spineTone }]} />
              <Text numberOfLines={1} style={styles.metaKindText}>
                {modeLabel}
              </Text>
              {verdict ? (
                <View collapsable={false} style={[styles.verdictBadge, { backgroundColor: verdictTones[verdict.tone].bg }]}>
                  <Text style={[styles.verdictText, { color: verdictTones[verdict.tone].color }]}>
                    {verdictTones[verdict.tone].mark} {verdict.label}
                  </Text>
                </View>
              ) : null}
              {newest ? (
                <View collapsable={false} style={styles.newDot}>
                  <Text style={styles.newDotText}>NOUĂ</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.timeText}>{lessonTime(lesson)}</Text>
          </View>

          <Text numberOfLines={2} style={styles.problemIdentity}>{presentation.title}</Text>

          {snippetDisplay ? (
            <View style={styles.snippetBox}>
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
              <Text style={styles.answerStar}>★</Text>
              <Text numberOfLines={1} style={[styles.answerPreviewText, { color: answerTone.text }]}>
                {presentation.answerPreview}
              </Text>
            </View>
          ) : null}

          <View style={styles.lessonFooter}>
            <Text numberOfLines={1} style={styles.footerMetaText}>
              {lesson.topic} · {stepLabel}
            </Text>

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
                <Text style={styles.summaryActionText}>★ Rezultat</Text>
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
                  pressed && styles.actionPressed,
                ]}
              >
                <MiniGlyph name="close" size={12} color={colors.berryDeep} />
              </Pressable>
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
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
      <View style={styles.emptyMascotStage}>
        <SpotlightAura size={146} tone="violet" active={active} />
        <Mascot pose="thinking" size={132} active={active} />
      </View>
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
        <SpotlightAura size={156} tone={error ? 'peach' : 'violet'} active={active} />
        <Mascot pose={error ? 'oops' : 'wave'} size={140} active={active} interactive />
      </View>
      <View>
        <Chip
          label={error ? 'CONEXIUNE ÎNTRERUPTĂ' : 'PRIMA PAGINĂ E LIBERĂ'}
          tone={error ? 'peach' : 'lime'}
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
    <Pressable accessible={false} onPress={Keyboard.dismiss} style={styles.filterEmpty}>
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
            Keyboard.dismiss();
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
    </Pressable>
  );
});

export function NotebookScreen({
  navigation: propNavigation,
  embedded = false,
  active = true,
  bottomClearance = 0,
}: Props = {}) {
  const hookNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const navigation = propNavigation ?? hookNavigation;
  const frame = useSafeAreaFrame();
  const { gutter, isNarrow } = useResponsiveLayout(frame);
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { keyboardInset, keyboardVisible } = useKeyboardHeight();
  const transitionSettled = useTransitionSettled(navigation, reducedMotion);
  const screenMotionActive = useScreenMotionActive(navigation, reducedMotion);
  const motionActive = screenMotionActive && active;
  const studyProfile = useStudyProfile();
  const practiceState = usePracticeState();
  const [section, setSection] = useState<NotebookSection>('lessons');
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
    Keyboard.dismiss();
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
    Keyboard.dismiss();
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
    Keyboard.dismiss();
    openingNoteRef.current = true;
    // Pause all animations on Caiet immediately and launch the native slide
    // without blocking the main thread on WebView preloading.
    beginAppTransition();
    navigation.navigate('Lesson', {
      lesson,
      lessonId: lesson.id,
      isFavorite: true,
      source: 'notebook',
    });
  }, [navigation]);

  const openSummary = useCallback((lesson: StoredLesson) => {
    if (openingNoteRef.current) return;
    Keyboard.dismiss();
    openingNoteRef.current = true;
    Haptics.impact(Haptics.ImpactFeedbackStyle.Light);
    beginAppTransition();
    navigation.navigate('Summary', {
      lesson,
      lessonId: lesson.id,
      isFavorite: true,
    });
  }, [navigation]);

  const shareNote = useCallback((lesson: StoredLesson) => {
    Keyboard.dismiss();
    Haptics.selection();
    void Share.share({
      title: lesson.title,
      message: formatLessonShareMessage(lesson),
    }).catch(() => undefined);
  }, []);

  const requestRemove = useCallback((lesson: StoredLesson) => {
    Keyboard.dismiss();
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
    Keyboard.dismiss();
    openingNoteRef.current = true;
    beginAppTransition();
    navigation.navigate('Capture', { mode });
  }, [navigation]);
  const clearSearch = useCallback(() => setQueryText(''), []);
  const resetFilters = useCallback(() => {
    Keyboard.dismiss();
    setQueryText('');
    setSelectedTopic(null);
    chooseFilter('all');
  }, [chooseFilter]);
  const retrySubscription = useCallback(() => {
    Keyboard.dismiss();
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
  const favoriteFormulas = useMemo(
    () => studyProfile.favoriteFormulaIds
      .map((id) => getFormulaById(id))
      .filter((item): item is FormulaEntry => Boolean(item)),
    [studyProfile.favoriteFormulaIds],
  );
  const favoriteFormulaIds = useMemo(
    () => favoriteFormulas.map((item) => item.id),
    [favoriteFormulas],
  );
  const openFavoriteFormula = useCallback((formula: FormulaEntry) => {
    if (openingNoteRef.current) return;
    Keyboard.dismiss();
    openingNoteRef.current = true;
    beginAppTransition();
    navigation.navigate('FormulaDetail', {
      formulaId: formula.id,
      formulaIds: favoriteFormulaIds,
    });
  }, [favoriteFormulaIds, navigation]);
  const openFormulasCatalog = useCallback(() => {
    if (openingNoteRef.current) return;
    Keyboard.dismiss();
    openingNoteRef.current = true;
    beginAppTransition();
    navigation.navigate('Formulas');
  }, [navigation]);
  const toggleStarFormula = useCallback((formulaId: string) => {
    Keyboard.dismiss();
    toggleFavoriteFormula(formulaId);
  }, []);
  const renderFormulaItem = useCallback<ListRenderItem<FormulaEntry>>(({ item }) => (
    <FormulaCard
      formula={item}
      isFavorite
      onOpen={openFavoriteFormula}
      onToggleFavorite={toggleStarFormula}
    />
  ), [openFavoriteFormula, toggleStarFormula]);
  const formulaKeyExtractor = useCallback((item: FormulaEntry) => item.id, []);

  const wrongQuestions = useMemo(
    () => practiceState.wrongQuestionIds
      .map((id) => getPracticeQuestionById(id))
      .filter((item): item is PracticeQuestion => Boolean(item)),
    [practiceState.wrongQuestionIds],
  );
  const startMistakesPractice = useCallback(() => {
    if (openingNoteRef.current) return;
    Keyboard.dismiss();
    openingNoteRef.current = true;
    beginAppTransition();
    navigation.navigate('PracticeSession', { mode: 'mistakes' });
  }, [navigation]);
  const startQuickPractice = useCallback(() => {
    if (openingNoteRef.current) return;
    Keyboard.dismiss();
    openingNoteRef.current = true;
    beginAppTransition();
    navigation.navigate('PracticeSession', { mode: 'quick' });
  }, [navigation]);
  const renderMistakeItem = useCallback<ListRenderItem<PracticeQuestion>>(({ item }) => {
    const cat = getFormulaCategoryMeta(item.category);
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Reia exercițiul ${item.title}`}
        onPress={startMistakesPractice}
        style={({ pressed }) => [styles.mistakeRowCard, pressed && styles.actionPressed]}
      >
        <View style={[styles.mistakeRail, { backgroundColor: cat.accent }]} />
        <View style={styles.mistakeBody}>
          <View style={styles.mistakeTop}>
            <View style={[styles.metaDot, { backgroundColor: cat.accent }]} />
            <Text style={styles.metaKindText}>{cat.shortLabel}</Text>
            <View style={styles.mistakeTag}>
              <Text style={styles.mistakeTagText}>DE REPETAT</Text>
            </View>
          </View>
          <Text numberOfLines={2} style={styles.mistakeTitle}>{item.title}</Text>
          <Text numberOfLines={1} style={styles.mistakeHint}>
            Atinge ca să reiei exercițiul și să-l rezolvi corect
          </Text>
        </View>
        <View style={styles.mistakeArrow}>
          <MiniGlyph name="next" size={15} color={colors.berryDeep} />
        </View>
      </Pressable>
    );
  }, [startMistakesPractice]);
  const mistakeKeyExtractor = useCallback((item: PracticeQuestion) => item.id, []);

  const sectionTabs = useMemo<readonly ComicTabOption<NotebookSection>[]>(() => [
    {
      value: 'lessons',
      label: 'Lecții',
      badge: notes.length,
      activeFill: colors.violet,
      activeText: colors.paper,
      badgeFill: colors.lime,
      badgeText: colors.ink,
    },
    {
      value: 'formulas',
      label: 'Formule',
      badge: favoriteFormulas.length,
      activeFill: colors.gold,
      activeText: colors.ink,
      badgeFill: colors.paper,
      badgeText: colors.ink,
    },
    {
      value: 'mistakes',
      label: isNarrow ? 'Repetă' : 'De repetat',
      badge: wrongQuestions.length,
      activeFill: colors.peach,
      activeText: colors.ink,
      badgeFill: colors.paper,
      badgeText: colors.ink,
    },
  ], [favoriteFormulas.length, isNarrow, notes.length, wrongQuestions.length]);

  const headerBack = embedded ? undefined : () => {
    Keyboard.dismiss();
    navigation.goBack();
  };
  const listBottomPadding = keyboardVisible
    ? 18
    : embedded
      ? bottomClearance + 10
      : Math.max(insets.bottom, 16) + 18;
  const headerCount = section === 'formulas'
    ? `${favoriteFormulas.length} ${favoriteFormulas.length === 1 ? 'FORMULĂ FAVORITĂ' : 'FORMULE FAVORITE'} · OFFLINE`
    : section === 'mistakes'
      ? `${wrongQuestions.length} ${wrongQuestions.length === 1 ? 'EXERCIȚIU DE REPETAT' : 'EXERCIȚII DE REPETAT'}`
      : loading && notes.length === 0
        ? 'LECȚII SALVATE'
        : topicCounts.length > 1
          ? `${notes.length} ${notes.length === 1 ? 'PROBLEMĂ' : 'PROBLEME'} · ${topicCounts.length} CAPITOLE`
          : `${notes.length} ${notes.length === 1 ? 'PROBLEMĂ SALVATĂ' : 'PROBLEME SALVATE'}`;
  const pendingRemovalTitle = pendingRemoval ? notebookProblemPresentation(pendingRemoval).title : '';
  const searchPlaceholder = isNarrow ? 'Caută în enunțuri' : 'Caută în enunțuri, formule sau capitole';
  const mountSearchInput = transitionSettled || searchActivated;

  const handleChangeSection = useCallback((next: NotebookSection) => {
    Keyboard.dismiss();
    setSection(next);
  }, []);

  const sectionSwitchBar = (
    <View style={[styles.sectionSwitchRow, { paddingHorizontal: gutter }]}>
      <ComicTabBar
        compact
        options={sectionTabs}
        value={section}
        onChange={handleChangeSection}
      />
    </View>
  );

  if (section === 'mistakes') {
    return (
      <View style={[styles.safe, { paddingTop: insets.top ?? 0 }]}>
        <ComicBackdrop />
        <ScreenHeader
          compact
          title="Caietul meu"
          eyebrow={headerCount}
          onBack={headerBack}
          rightIcon="practice"
          rightLabel="Începe un test fulger"
          onRight={startQuickPractice}
        />
        {sectionSwitchBar}

        {wrongQuestions.length === 0 ? (
          <ScrollView
            alwaysBounceVertical={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.fullState, { paddingBottom: listBottomPadding }]}
          >
            <View style={styles.emptyMascotStage}>
              <SpotlightAura size={146} tone="lime" active={motionActive} />
              <Mascot pose="cheer" size={132} active={motionActive} interactive />
            </View>
            <Chip label="ZERO GREȘELI RĂMASE" tone="lime" />
            <View style={styles.emptyCopyWrap}>
              <Text style={styles.fullStateTitle}>Lista De repetat e curată!</Text>
              <Text style={styles.fullStateText}>
                Orice întrebare greșită în Teste & Practică se salvează automat aici și dispare imediat ce o rezolvi corect.
              </Text>
            </View>
            <View style={styles.emptyActions}>
              <ComicButton
                compact
                title="Începe un test fulger"
                icon="practice"
                tone="lime"
                onPress={startQuickPractice}
              />
            </View>
          </ScrollView>
        ) : (
          <FlatList
            data={wrongQuestions}
            renderItem={renderMistakeItem}
            keyExtractor={mistakeKeyExtractor}
            ItemSeparatorComponent={LessonSeparator}
            ListHeaderComponent={(
              <View style={styles.mistakesHeaderCtaWrap}>
                <ComicButton
                  compact
                  title={`Reia toate cele ${wrongQuestions.length} greșeli`}
                  icon="retake"
                  tone="lime"
                  onPress={startMistakesPractice}
                />
              </View>
            )}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={false}
            contentContainerStyle={[
              styles.listContent,
              { paddingHorizontal: gutter, paddingBottom: listBottomPadding },
            ]}
          />
        )}
      </View>
    );
  }

  if (section === 'formulas') {
    return (
      <View style={[styles.safe, { paddingTop: insets.top ?? 0 }]}>
        <ComicBackdrop />
        <ScreenHeader
          compact
          title="Caietul meu"
          eyebrow={headerCount}
          onBack={headerBack}
          rightIcon="explain"
          rightLabel="Deschide toate formulele"
          onRight={openFormulasCatalog}
        />
        {sectionSwitchBar}

        {favoriteFormulas.length === 0 ? (
          <ScrollView
            alwaysBounceVertical={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.fullState, { paddingBottom: listBottomPadding }]}
          >
            <View style={styles.emptyMascotStage}>
              <SpotlightAura size={146} tone="lime" active={motionActive} />
              <Mascot pose="point" size={132} active={motionActive} interactive />
            </View>
            <Chip label="FORMULELE TALE OFFLINE" tone="lime" />
            <View style={styles.emptyCopyWrap}>
              <Text style={styles.fullStateTitle}>Păstrează formulele grele aici</Text>
              <Text style={styles.fullStateText}>
                Apasă pe steluța ☆ din dreptul oricărei fișe din Formule & Fișe și o găsești instant înainte de test, chiar fără internet.
              </Text>
            </View>
            <View style={styles.emptyActions}>
              <ComicButton
                compact
                title="Deschide Formule & Fișe"
                icon="explain"
                tone="lime"
                onPress={openFormulasCatalog}
              />
            </View>
          </ScrollView>
        ) : (
          <FlatList
            data={favoriteFormulas}
            renderItem={renderFormulaItem}
            keyExtractor={formulaKeyExtractor}
            ItemSeparatorComponent={LessonSeparator}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={false}
            contentContainerStyle={[
              styles.listContent,
              { paddingHorizontal: gutter, paddingBottom: listBottomPadding },
            ]}
          />
        )}
      </View>
    );
  }

  if (loading && notes.length === 0) {
    return (
      <View style={[styles.safe, { paddingTop: insets.top ?? 0 }]}>
        <ComicBackdrop />
        <ScreenHeader title="Caietul meu" eyebrow={headerCount} onBack={headerBack} rightIcon="camera" rightLabel="Rezolvă o problemă nouă" onRight={() => startMode('solve')} />
        {sectionSwitchBar}
        <NotebookLoading active={motionActive} />
      </View>
    );
  }

  if (notes.length === 0) {
    return (
      <View style={[styles.safe, { paddingTop: insets.top ?? 0 }]}>
        <ComicBackdrop />
        <ScreenHeader title="Caietul meu" eyebrow={headerCount} onBack={headerBack} rightIcon="camera" rightLabel="Rezolvă o problemă nouă" onRight={() => startMode('solve')} />
        {sectionSwitchBar}
        <View style={[styles.flex, embedded && { paddingBottom: bottomClearance }]}>
          <FullNotebookState kind={loadError ? 'error' : 'empty'} active={motionActive} onPrimary={loadError ? retrySubscription : () => startMode('solve')} onSecondary={() => startMode('check')} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.safe, { paddingTop: insets.top ?? 0 }]}>
      <ComicBackdrop />
      <ScreenHeader compact title="Caietul meu" eyebrow={headerCount} onBack={headerBack} rightIcon="camera" rightLabel="Rezolvă o problemă nouă" onRight={() => startMode('solve')} />
      {sectionSwitchBar}

      <View style={[styles.flex, keyboardVisible && { paddingBottom: keyboardInset }]}>
        <Pressable
          accessible={false}
          onPress={Keyboard.dismiss}
          style={[styles.controls, { paddingHorizontal: gutter }]}
        >
          <View style={[styles.searchBox, searchFocused && styles.searchBoxFocused]}>
            <AppIcon name="search" size={24} />
            {mountSearchInput ? (
              <TextInput
                autoFocus={searchActivated}
                autoCorrect={false}
                returnKeyType="search"
                value={queryText}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                onChangeText={setQueryText}
                onSubmitEditing={() => Keyboard.dismiss()}
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
            {searchFocused || keyboardVisible ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ascunde tastatura"
                hitSlop={6}
                onPress={() => {
                  Haptics.selection();
                  Keyboard.dismiss();
                }}
                style={({ pressed }) => [styles.dismissSearchChip, pressed && styles.actionPressed]}
              >
                <Text style={styles.dismissSearchText}>Gata</Text>
              </Pressable>
            ) : null}
          </View>

          <ComicTabBar
            compact
            options={tabOptions}
            value={filter}
            onChange={chooseFilter}
          />
        </Pressable>

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

        <Pressable
          accessible={false}
          onPress={Keyboard.dismiss}
          style={[styles.listHeading, { paddingHorizontal: gutter }]}
        >
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
        </Pressable>

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
            contentContainerStyle={[styles.listContent, { paddingHorizontal: gutter, paddingBottom: listBottomPadding }]}
          />
        </View>
      </View>

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
  sectionSwitchRow: {
    paddingTop: 2,
    paddingBottom: 6,
  },
  mistakesHeaderCtaWrap: {
    marginBottom: 12,
  },
  mistakeRowCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 87, 109, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 13,
    gap: 11,
    overflow: 'hidden',
  },
  mistakeRail: {
    width: 4.5,
    alignSelf: 'stretch',
  },
  mistakeBody: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 12,
    paddingLeft: 2,
  },
  mistakeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mistakeTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.roseSoft,
  },
  mistakeTagText: {
    fontFamily: fonts.bodyBold,
    color: colors.berryDeep,
    fontSize: 9.5,
    letterSpacing: 0.3,
    includeFontPadding: false,
  },
  mistakeTitle: {
    marginTop: 5,
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 17,
    lineHeight: 21,
  },
  mistakeHint: {
    marginTop: 2,
    fontFamily: fonts.bodyMedium,
    color: colors.inkSoft,
    fontSize: 12,
  },
  mistakeArrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.roseSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: { paddingTop: 4, gap: 9 },

  topicStripWrap: { marginTop: 8 },
  topicStripContent: { gap: 7, paddingVertical: 2, alignItems: 'center' },
  topicFilterPill: {
    minHeight: 32,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.11)',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
  },
  topicFilterPillActive: {
    borderColor: colors.violet,
    backgroundColor: colors.violet,
  },
  topicFilterPillInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  topicFilterDot: {
    width: 6.5,
    height: 6.5,
    borderRadius: 4,
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
    borderRadius: radii.pill,
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topicFilterCountActive: {
    backgroundColor: colors.lime,
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

  searchBox: {
    height: 46,
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.12)',
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 8,
    overflow: 'hidden',
  },
  searchBoxFocused: { borderColor: colors.violet },
  searchInput: { flex: 1, height: 42, paddingVertical: 0, fontFamily: fonts.bodyMedium, color: colors.ink, fontSize: 13.5 },
  searchPlaceholderTouch: { flex: 1, height: 42, justifyContent: 'center' },
  searchPlaceholderText: { fontFamily: fonts.bodyMedium, color: colors.inkMuted, fontSize: 13.5 },
  clearSearch: {
    width: 26,
    height: 26,
    borderRadius: radii.pill,
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissSearchChip: {
    minHeight: 28,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.violet,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  dismissSearchText: {
    fontFamily: fonts.bodyBold,
    color: colors.paper,
    fontSize: 11.5,
    includeFontPadding: false,
  },

  syncWarning: {
    minHeight: 38,
    marginTop: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 141, 107, 0.35)',
    backgroundColor: colors.peachSoft,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  syncWarningText: { flexShrink: 1, fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 11.5, lineHeight: 15 },

  listHeading: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingTop: 6,
    paddingBottom: 2,
  },
  listHeadingLeft: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  miniMascotBadge: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: '#F3FFD2',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  miniMascotShine: { display: 'none' },
  listHeadingCopy: { flex: 1, minWidth: 0 },
  listEyebrow: { ...typography.kicker, fontSize: 10, lineHeight: 13, color: colors.violetDeep },
  listTitle: { fontFamily: fonts.display, color: colors.ink, fontSize: 18.5, lineHeight: 22, marginTop: 1 },
  listHeadingRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  resetFilterPill: {
    minHeight: 28,
    borderRadius: radii.pill,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetFilterInner: {
    paddingHorizontal: 10,
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
    minHeight: 28,
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: radii.pill,
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
  listContent: { flexGrow: 1, paddingTop: 6 },
  lessonSeparator: { height: 11 },

  lessonRowWrap: { position: 'relative' },
  lessonCard: {
    overflow: 'hidden',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    flexDirection: 'row',
  },
  lessonRail: {
    width: 4.5,
    alignSelf: 'stretch',
  },
  lessonBody: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 11,
  },
  lessonMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  metaLeft: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  metaDot: { width: 7, height: 7, borderRadius: 4 },
  metaKindText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.inkSoft,
    includeFontPadding: false,
  },
  verdictBadge: {
    flexShrink: 0,
    minHeight: 21,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verdictText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    lineHeight: 14,
    includeFontPadding: false,
  },
  newDot: {
    flexShrink: 0,
    minHeight: 20,
    borderRadius: radii.pill,
    backgroundColor: colors.lime,
    paddingHorizontal: 7,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newDotText: {
    fontFamily: fonts.bodyBold,
    color: colors.ink,
    fontSize: 9.5,
    lineHeight: 13,
    letterSpacing: 0.3,
    includeFontPadding: false,
  },
  timeText: {
    fontFamily: fonts.bodyMedium,
    color: colors.inkMuted,
    fontSize: 11,
    lineHeight: 14,
    includeFontPadding: false,
  },

  problemIdentity: {
    marginTop: 7,
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 18,
    lineHeight: 22.5,
  },

  snippetBox: {
    marginTop: 8,
    borderRadius: 14,
    backgroundColor: '#F8F4FF',
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  snippetText: {
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
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 13,
    borderWidth: 1,
  },
  answerStar: {
    fontFamily: fonts.display,
    color: colors.limeDeep,
    fontSize: 12,
    lineHeight: 15,
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

  lessonFooter: {
    marginTop: 10,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: 'rgba(124, 60, 255, 0.07)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  footerMetaText: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.bodyBold,
    color: colors.inkMuted,
    fontSize: 11.5,
    lineHeight: 15,
  },
  quickActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryAction: {
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: colors.goldSoft,
    paddingHorizontal: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryActionNarrow: {
    paddingHorizontal: 9,
  },
  summaryActionText: {
    fontFamily: fonts.bodyBold,
    color: colors.ink,
    fontSize: 11.5,
    lineHeight: 15,
    includeFontPadding: false,
  },
  shareIconAction: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareIconGlyph: {
    fontFamily: fonts.display,
    color: colors.violetDeep,
    fontSize: 14,
    lineHeight: 17,
    includeFontPadding: false,
  },
  removeIconAction: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF0F3',
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingState: { flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingBottom: 34 },
  stateChip: { marginTop: 12 },
  notebookProgress: { minHeight: 54, alignItems: 'center', justifyContent: 'center' },
  loadingTitle: { marginTop: 8, fontFamily: fonts.display, color: colors.ink, fontSize: 23, lineHeight: 28, textAlign: 'center' },
  notebookLoader: { marginTop: 16 },

  fullState: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingTop: 14, paddingBottom: 32 },
  emptyMascotStage: { width: 168, height: 158, alignItems: 'center', justifyContent: 'center', marginBottom: 10, position: 'relative' },
  emptyCopyWrap: { alignItems: 'center' },
  fullStateTitle: { marginTop: 12, fontFamily: fonts.display, color: colors.ink, fontSize: 24, lineHeight: 28, textAlign: 'center' },
  fullStateText: { maxWidth: 320, marginTop: 6, fontFamily: fonts.body, color: colors.inkSoft, fontSize: 13.5, lineHeight: 20, textAlign: 'center' },
  emptyActions: { width: '100%', maxWidth: 340, marginTop: 22, gap: 6 },
  secondaryEmptyWrap: { alignSelf: 'center' },
  secondaryEmptyAction: { minHeight: 44, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  secondaryEmptyText: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 13 },

  filterEmpty: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, paddingTop: 28, paddingBottom: 24 },
  filterEmptyBadge: {
    width: 102,
    height: 102,
    borderRadius: 51,
    backgroundColor: 'rgba(124, 60, 255, 0.09)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterEmptyOwl: { width: 86, height: 86 },
  filterEmptyTitle: { marginTop: 12, fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 20, lineHeight: 24, textAlign: 'center' },
  filterEmptyText: { maxWidth: 300, marginTop: 6, fontFamily: fonts.body, color: colors.inkSoft, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  filterEmptyActionWrap: { marginTop: 16 },
  filterEmptyActionShadow: { display: 'none' },
  filterEmptyAction: {
    minHeight: 44,
    paddingHorizontal: 22,
    borderRadius: radii.pill,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterEmptyActionPressed: { transform: [{ scale: 0.96 }] },
  filterEmptyActionText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 13 },

  listFooter: { height: 10 },
  actionPressed: { opacity: 0.72 },
});
