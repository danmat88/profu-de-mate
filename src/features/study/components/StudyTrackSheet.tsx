import { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as Haptics from '../../../shared/services/haptics';
import { colors, fonts, radii, typography } from '../../../shared/theme';
import { AppIcon } from '../../../shared/ui/AppIcon';
import { ComicBottomSheet } from '../../../shared/ui/ComicBottomSheet';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { Text } from '../../../shared/ui/Typography';
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

/**
 * Unified native bottom sheet for choosing the active Romanian curriculum track
 * (Evaluarea Nationala, BAC M1/M2/M3, Gimnaziu V-VII, Liceu IX-XI).
 */
export const StudyTrackSheet = memo(function StudyTrackSheet({
  visible,
  selectedTrack,
  onSelect,
  onClose,
}: Props) {
  return (
    <ComicBottomSheet visible={visible} onClose={onClose} maxHeight="84%">
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
        Adaptăm automat formulele recomandate și structura examenului pentru nivelul tău. Poți schimba oricând.
      </Text>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {STUDY_TRACKS.map((track) => {
          const active = track.id === selectedTrack;
          const tone = TRACK_ACCENT_COLORS[track.accent];
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
                  {active ? (
                    <View style={styles.activeCheck}>
                      <MiniGlyph name="check" size={13} color={colors.ink} />
                    </View>
                  ) : null}
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
        })}
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
    backgroundColor: 'rgba(124, 60, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 14,
    fontFamily: fonts.body,
    color: colors.inkSoft,
    fontSize: 13,
    lineHeight: 18.5,
  },
  list: {
    gap: 10,
    paddingBottom: 8,
  },
  trackRow: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  trackRowActive: {
    borderColor: colors.violet,
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
    paddingVertical: 12,
  },
  trackTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
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
  activeCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackLabel: {
    marginTop: 6,
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 17,
    lineHeight: 21,
  },
  trackLabelActive: {
    color: colors.paper,
  },
  trackDesc: {
    marginTop: 3,
    fontFamily: fonts.body,
    color: colors.inkSoft,
    fontSize: 12.5,
    lineHeight: 17,
  },
  trackDescActive: {
    color: 'rgba(244, 238, 255, 0.92)',
  },
  pressed: { opacity: 0.8 },
});
