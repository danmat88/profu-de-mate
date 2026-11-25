import { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as Haptics from '../../../shared/services/haptics';
import { colors, fonts, radii, typography } from '../../../shared/theme';
import { AppIcon } from '../../../shared/ui/AppIcon';
import { ComicBottomSheet } from '../../../shared/ui/ComicBottomSheet';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { Text } from '../../../shared/ui/Typography';
import { PRACTICE_BANK } from '../../practice/data/practiceBank';
import { FORMULAS_CATALOG } from '../data/formulasCatalog';
import { STUDY_TRACKS, type StudyTrackId, type StudyTrackMeta } from '../types';

type Props = {
  visible: boolean;
  selectedTrack: StudyTrackId;
  onSelect: (track: StudyTrackId) => void;
  onClose: () => void;
};

const TRACK_ACCENT_COLORS: Record<StudyTrackMeta['accent'], { dot: string; tint: string }> = {
  violet: { dot: colors.violet, tint: colors.violetSoft },
  cyan: { dot: colors.cyanDeep, tint: colors.cyanSoft },
  lime: { dot: colors.limeDeep, tint: colors.limeSoft },
  peach: { dot: colors.peachDeep, tint: colors.peachSoft },
  gold: { dot: '#A36A00', tint: colors.goldSoft },
};

const EXAM_TRACK_IDS = new Set<StudyTrackId>(['en', 'bac_m1', 'bac_m2', 'bac_m3']);

const EXAM_TRACKS = STUDY_TRACKS.filter((track) => EXAM_TRACK_IDS.has(track.id));
const CLASS_TRACKS = STUDY_TRACKS.filter((track) => !EXAM_TRACK_IDS.has(track.id));

const TRACK_COUNTS: Record<StudyTrackId, { formulas: number; questions: number }> = {
  gimnaziu: {
    formulas: FORMULAS_CATALOG.filter((f) => f.tracks.includes('gimnaziu')).length,
    questions: PRACTICE_BANK.filter((q) => q.tracks.includes('gimnaziu')).length,
  },
  en: {
    formulas: FORMULAS_CATALOG.filter((f) => f.tracks.includes('en')).length,
    questions: PRACTICE_BANK.filter((q) => q.tracks.includes('en')).length,
  },
  liceu: {
    formulas: FORMULAS_CATALOG.filter((f) => f.tracks.includes('liceu')).length,
    questions: PRACTICE_BANK.filter((q) => q.tracks.includes('liceu')).length,
  },
  bac_m1: {
    formulas: FORMULAS_CATALOG.filter((f) => f.tracks.includes('bac_m1')).length,
    questions: PRACTICE_BANK.filter((q) => q.tracks.includes('bac_m1')).length,
  },
  bac_m2: {
    formulas: FORMULAS_CATALOG.filter((f) => f.tracks.includes('bac_m2')).length,
    questions: PRACTICE_BANK.filter((q) => q.tracks.includes('bac_m2')).length,
  },
  bac_m3: {
    formulas: FORMULAS_CATALOG.filter((f) => f.tracks.includes('bac_m3')).length,
    questions: PRACTICE_BANK.filter((q) => q.tracks.includes('bac_m3')).length,
  },
};

/**
 * Unified native bottom sheet for choosing the active Romanian curriculum track,
 * cleanly separated into National Exams (EN VIII, BAC M1/M2/M3) and General
 * Classes (Gimnaziu V-VII, Liceu IX-XI) with live content counts per track.
 */
export const StudyTrackSheet = memo(function StudyTrackSheet({
  visible,
  selectedTrack,
  onSelect,
  onClose,
}: Props) {
  const renderTrackRow = (track: StudyTrackMeta) => {
    const active = track.id === selectedTrack;
    const tone = TRACK_ACCENT_COLORS[track.accent];
    const counts = TRACK_COUNTS[track.id];

    return (
      <Pressable
        key={track.id}
        accessibilityRole="radio"
        accessibilityState={{ checked: active }}
        onPress={() => {
          Haptics.impact(Haptics.ImpactFeedbackStyle.Light);
          onSelect(track.id);
          onClose();
        }}
        style={({ pressed }) => [
          styles.trackRow,
          active && styles.trackRowActive,
          pressed && styles.pressed,
        ]}
      >
        <View style={[styles.trackRail, { backgroundColor: active ? colors.lime : tone.dot }]} />
        <View style={styles.trackBody}>
          <View style={styles.trackTop}>
            <View style={[styles.eyebrowBadge, { backgroundColor: active ? 'rgba(255,255,255,0.16)' : tone.tint }]}>
              <Text style={[styles.trackEyebrow, { color: active ? colors.lime : tone.dot }]}>
                {track.eyebrow}
              </Text>
            </View>
            <View style={styles.trackTopRight}>
              <Text style={[styles.trackCountMeta, active && styles.trackCountMetaActive]}>
                {counts.formulas} fișe · {counts.questions} ex.
              </Text>
              {active ? (
                <View style={styles.activeCheck}>
                  <MiniGlyph name="check" size={13} color={colors.ink} />
                </View>
              ) : null}
            </View>
          </View>
          <Text style={[styles.trackLabel, active && styles.trackLabelActive]}>
            {track.label}
          </Text>
          <Text style={[styles.trackDesc, active && styles.trackDescActive]}>
            {track.description}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <ComicBottomSheet visible={visible} onClose={onClose} maxHeight="86%">
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <AppIcon name="class" size={28} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>NIVELUL TĂU DE STUDIU</Text>
          <Text style={styles.title}>Alege clasa sau examenul</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Închide fereastra"
          hitSlop={8}
          onPress={() => {
            Haptics.selection();
            onClose();
          }}
          style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
        >
          <MiniGlyph name="close" size={16} color={colors.ink} />
        </Pressable>
      </View>

      <Text style={styles.subtitle}>
        Adaptăm instant formulele, testele fulger, ghidul și simulările pentru nivelul tău. Poți schimba oricând.
      </Text>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        <Text style={styles.groupHeading}>EXAMENE NAȚIONALE</Text>
        <View style={styles.groupList}>
          {EXAM_TRACKS.map(renderTrackRow)}
        </View>

        <Text style={[styles.groupHeading, styles.groupHeadingSpaced]}>CLASE GENERALE</Text>
        <View style={styles.groupList}>
          {CLASS_TRACKS.map(renderTrackRow)}
        </View>
      </ScrollView>
    </ComicBottomSheet>
  );
});

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    borderWidth: 1.3,
    borderBottomWidth: 3,
    borderColor: '#DFD2FA',
    borderBottomColor: '#C2ADF4',
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: {
    ...typography.kicker,
    fontSize: 10,
    color: colors.violetDeep,
  },
  title: {
    marginTop: 1,
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 20,
    lineHeight: 24,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.3,
    borderBottomWidth: 3,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 12,
    fontFamily: fonts.body,
    color: colors.inkSoft,
    fontSize: 13,
    lineHeight: 18.5,
  },
  list: {
    paddingBottom: 12,
  },
  groupHeading: {
    fontFamily: fonts.bodyBold,
    fontSize: 10.5,
    letterSpacing: 0.85,
    color: colors.violetDeep,
    marginBottom: 8,
    marginLeft: 2,
  },
  groupHeadingSpaced: {
    marginTop: 16,
  },
  groupList: {
    gap: 9,
  },
  trackRow: {
    borderRadius: 22,
    borderWidth: 1.4,
    borderBottomWidth: 3.8,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  trackRowActive: {
    borderColor: '#9158FF',
    borderBottomColor: '#3C12A8',
    backgroundColor: colors.violet,
  },
  trackRail: {
    width: 5,
    alignSelf: 'stretch',
  },
  trackBody: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  trackTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  trackTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  eyebrowBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: radii.pill,
  },
  trackEyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 9.5,
    letterSpacing: 0.7,
    includeFontPadding: false,
  },
  trackCountMeta: {
    fontFamily: fonts.bodyBold,
    fontSize: 10.5,
    color: colors.inkMuted,
  },
  trackCountMetaActive: {
    color: 'rgba(244, 238, 255, 0.88)',
  },
  activeCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackLabel: {
    marginTop: 5,
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 16.5,
    lineHeight: 20.5,
  },
  trackLabelActive: {
    color: colors.paper,
  },
  trackDesc: {
    marginTop: 2.5,
    fontFamily: fonts.body,
    color: colors.inkSoft,
    fontSize: 12.2,
    lineHeight: 16.5,
  },
  trackDescActive: {
    color: 'rgba(244, 238, 255, 0.92)',
  },
  pressed: { opacity: 0.8 },
});
