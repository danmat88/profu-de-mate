import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { memo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsiveLayout } from '../../../shared/hooks/useResponsiveLayout';
import * as Haptics from '../../../shared/services/haptics';
import { colors, fonts, radii, typography } from '../../../shared/theme';
import { AppIcon } from '../../../shared/ui/AppIcon';
import { ComicBackdrop } from '../../../shared/ui/ComicBackdrop';
import { ComicButton } from '../../../shared/ui/ComicButton';
import { Mascot } from '../../../shared/ui/Mascot';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { SpotlightAura } from '../../../shared/ui/SpotlightAura';
import { Text } from '../../../shared/ui/Typography';
import {
  canConfirmAgeEligibility,
  type AgeEligibilityGroup,
} from '../../../shared/utils/ageEligibility';
import { STUDY_TRACKS, type StudyTrackId } from '../../study/types';

type Props = {
  active?: boolean;
  onConfirm: (group: AgeEligibilityGroup, track: StudyTrackId | null) => void;
  onOpenLegal: () => void;
};

type AgeOptionConfig = {
  id: AgeEligibilityGroup;
  title: string;
  subtitle: string;
  accent: string;
};

const AGE_OPTIONS: readonly AgeOptionConfig[] = [
  {
    id: '16_plus',
    title: '16+ ani',
    subtitle: 'Elev / student',
    accent: colors.violet,
  },
  {
    id: '13_15_parental',
    title: '13–15 ani',
    subtitle: 'Cu acord părinte',
    accent: colors.cyanDeep,
  },
  {
    id: 'parent',
    title: 'Părinte',
    subtitle: 'Pentru copil',
    accent: colors.limeDeep,
  },
];

const TRACK_CHIPS: readonly { id: StudyTrackId; label: string }[] = [
  { id: 'en', label: 'EN · Clasa VIII' },
  { id: 'bac_m1', label: 'BAC · M1' },
  { id: 'bac_m2', label: 'BAC · M2' },
  { id: 'bac_m3', label: 'BAC · M3' },
  { id: 'liceu', label: 'Liceu (IX–XI)' },
  { id: 'gimnaziu', label: 'Gimnaziu (V–VII)' },
];

/**
 * Full-screen first-launch onboarding shown strictly BEFORE Home mounts so the
 * user can never interact with underlying tabs before confirming age eligibility
 * (Romania GDPR 16+ / 13–15 parental consent / Play 13+). Also lets students
 * optionally personalize their curriculum track in one tap.
 */
export const WelcomeOnboardingScreen = memo(function WelcomeOnboardingScreen({
  active = true,
  onConfirm,
  onOpenLegal,
}: Props) {
  const frame = useSafeAreaFrame();
  const { gutter, contentWidth } = useResponsiveLayout(frame);
  const insets = useSafeAreaInsets();

  const [selectedGroup, setSelectedGroup] = useState<AgeEligibilityGroup | null>(null);
  const [parentalConfirmed, setParentalConfirmed] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<StudyTrackId | null>(null);

  const canProceed = canConfirmAgeEligibility(selectedGroup, parentalConfirmed);

  const handleSelectAge = (group: AgeEligibilityGroup) => {
    Haptics.selection();
    setSelectedGroup(group);
    if (group !== '13_15_parental') {
      setParentalConfirmed(false);
    }
  };

  const handleToggleTrack = (track: StudyTrackId) => {
    Haptics.selection();
    setSelectedTrack((current) => (current === track ? null : track));
  };

  const handleSubmit = () => {
    if (!selectedGroup || !canProceed) return;
    Haptics.impact(Haptics.ImpactFeedbackStyle.Medium);
    onConfirm(selectedGroup, selectedTrack);
  };

  const chosenTrackLabel = selectedTrack
    ? STUDY_TRACKS.find((item) => item.id === selectedTrack)?.shortLabel ?? null
    : null;

  return (
    <View style={styles.safe}>
      <StatusBar style="light" />
      <ComicBackdrop />

      {/* Full-bleed curved Royal-Violet welcome canopy */}
      <View style={[styles.canopy, { paddingTop: insets.top ?? 0 }]}>
        <LinearGradient
          colors={['#8A3DFF', '#5F1EE8', '#3A10AA']}
          start={{ x: 0.06, y: 0 }}
          end={{ x: 0.94, y: 1 }}
          style={styles.fill}
        />
        <View pointerEvents="none" style={styles.canopyGlowCyan} />
        <View pointerEvents="none" style={styles.canopyGlowLime} />
        <View pointerEvents="none" style={styles.canopyOrbitArc} />
        <Text accessible={false} style={styles.canopyGlyphPi}>π</Text>
        <Text accessible={false} style={styles.canopyGlyphRoot}>√</Text>

        <View style={[styles.canopyInner, { width: contentWidth, paddingHorizontal: gutter }]}>
          <View style={styles.heroRow}>
            <View style={styles.heroCopy}>
              <View style={styles.welcomeBadge}>
                <Text maxFontSizeMultiplier={1.1} style={styles.welcomeBadgeText}>
                  ✦ BUN VENIT
                </Text>
              </View>
              <Text maxFontSizeMultiplier={1.2} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={styles.heroTitle}>
                Profu’ <Text style={styles.heroTitleAccent}>de mate</Text>
              </Text>
              <Text maxFontSizeMultiplier={1.2} style={styles.heroSubtitle}>
                Pregătim aplicația pentru tine în câteva secunde.
              </Text>
            </View>

            <View pointerEvents="none" style={styles.mascotWrap}>
              <SpotlightAura size={80} tone="onViolet" active={active} />
              <Mascot pose="wave" size={76} active={active} />
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal: gutter }]}
      >
        <View style={[styles.page, { maxWidth: contentWidth }]}>
          {/* Step 1: Age eligibility (privacy-minimized — never asks for date of birth) */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text maxFontSizeMultiplier={1.15} style={styles.sectionKicker}>
                1. CINE FOLOSEȘTE APLICAȚIA?
              </Text>
              <View style={styles.requiredPill}>
                <Text maxFontSizeMultiplier={1.05} style={styles.requiredPillText}>NECESAR</Text>
              </View>
            </View>

            <View
              accessibilityRole="radiogroup"
              accessibilityLabel="Alege categoria de vârstă"
              style={styles.ageGrid}
            >
              {AGE_OPTIONS.map((option) => {
                const selected = selectedGroup === option.id;
                return (
                  <Pressable
                    key={option.id}
                    accessibilityRole="radio"
                    accessibilityLabel={`${option.title}, ${option.subtitle}`}
                    accessibilityState={{ checked: selected }}
                    onPress={() => handleSelectAge(option.id)}
                    style={({ pressed }) => [
                      styles.ageCard,
                      selected && styles.ageCardSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.ageCardTop}>
                      <View style={[styles.ageDot, { backgroundColor: selected ? colors.lime : option.accent }]} />
                      {selected ? (
                        <View style={styles.ageCheck}>
                          <MiniGlyph name="check" size={11} color={colors.ink} />
                        </View>
                      ) : (
                        <View style={styles.ageRadioEmpty} />
                      )}
                    </View>
                    <Text
                      maxFontSizeMultiplier={1.15}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.8}
                      style={[styles.ageTitle, selected && styles.ageTitleSelected]}
                    >
                      {option.title}
                    </Text>
                    <Text
                      maxFontSizeMultiplier={1.1}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.82}
                      style={[styles.ageSubtitle, selected && styles.ageSubtitleSelected]}
                    >
                      {option.subtitle}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {selectedGroup === '13_15_parental' ? (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: parentalConfirmed }}
                onPress={() => {
                  Haptics.selection();
                  setParentalConfirmed((value) => !value);
                }}
                style={({ pressed }) => [
                  styles.parentalBox,
                  parentalConfirmed && styles.parentalBoxChecked,
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.checkbox, parentalConfirmed && styles.checkboxChecked]}>
                  {parentalConfirmed ? <MiniGlyph name="check" size={13} color={colors.ink} /> : null}
                </View>
                <Text maxFontSizeMultiplier={1.2} style={styles.parentalText}>
                  Confirm că am acordul părintelui sau tutorelui legal pentru a folosi Profu’ de mate, inclusiv analiza AI.
                </Text>
              </Pressable>
            ) : null}

            <Text maxFontSizeMultiplier={1.15} style={styles.ageNote}>
              Pentru elevi de cel puțin 13 ani și părinți · sub 13 ani doar împreună cu un părinte.
            </Text>
          </View>

          {/* Step 2: Optional curriculum personalization */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text maxFontSizeMultiplier={1.15} style={styles.sectionKicker}>
                2. PENTRU CE TE PREGĂTEȘTI?
              </Text>
              <View style={styles.optionalPill}>
                <Text maxFontSizeMultiplier={1.05} style={styles.optionalPillText}>OPȚIONAL</Text>
              </View>
            </View>

            <View style={styles.tracksWrap}>
              {TRACK_CHIPS.map((item) => {
                const activeTrack = selectedTrack === item.id;
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: activeTrack }}
                    onPress={() => handleToggleTrack(item.id)}
                    style={({ pressed }) => [
                      styles.trackChip,
                      activeTrack && styles.trackChipActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    {activeTrack ? (
                      <View style={styles.trackCheckDot}>
                        <MiniGlyph name="check" size={10} color={colors.ink} />
                      </View>
                    ) : null}
                    <Text
                      maxFontSizeMultiplier={1.15}
                      numberOfLines={1}
                      style={[styles.trackChipText, activeTrack && styles.trackChipTextActive]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text maxFontSizeMultiplier={1.15} style={styles.trackHint}>
              {chosenTrackLabel
                ? `Adaptăm formulele, testele și simulările pentru ${chosenTrackLabel}.`
                : 'Poți alege acum sau mai târziu din aplicație — formulele și simulările se adaptează instant.'}
            </Text>
          </View>

          {/* Compact privacy & safety reassurance */}
          <View style={styles.safetyBar}>
            <View style={styles.safetyIcon}>
              <AppIcon name="privacy" size={20} />
            </View>
            <Text maxFontSizeMultiplier={1.15} style={styles.safetyText}>
              Nu cerem data nașterii. Fotografiază doar probleme de matematică, fără fețe sau date personale.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingHorizontal: gutter, paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={[styles.footerInner, { maxWidth: contentWidth }]}>
          <ComicButton
            title="Începe să rezolvi"
            tone="lime"
            trailingIcon="next"
            compact
            disabled={!canProceed}
            accessibilityHint="Confirmă selecția și intră în aplicație"
            onPress={handleSubmit}
          />
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Citește Termenii și Politica de confidențialitate"
            onPress={() => {
              Haptics.selection();
              onOpenLegal();
            }}
            style={({ pressed }) => [styles.legalBtn, pressed && styles.pressed]}
          >
            <Text maxFontSizeMultiplier={1.15} style={styles.legalText}>
              Continuând, accepți <Text style={styles.legalLink}>Termenii și Confidențialitatea</Text>.
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  scroll: { flex: 1 },

  canopy: {
    width: '100%',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
    paddingBottom: 16,
    position: 'relative',
    zIndex: 4,
  },
  canopyGlowCyan: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 105,
    top: -95,
    left: -55,
    backgroundColor: 'rgba(67, 214, 230, 0.22)',
  },
  canopyGlowLime: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    bottom: -95,
    right: -10,
    backgroundColor: 'rgba(216, 255, 62, 0.16)',
  },
  canopyOrbitArc: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    top: -120,
    right: -75,
  },
  canopyGlyphPi: {
    position: 'absolute',
    left: 20,
    bottom: 10,
    fontFamily: fonts.display,
    fontSize: 24,
    color: 'rgba(255, 255, 255, 0.12)',
    transform: [{ rotate: '-10deg' }],
  },
  canopyGlyphRoot: {
    position: 'absolute',
    right: 112,
    top: 26,
    fontFamily: fonts.display,
    fontSize: 22,
    color: 'rgba(216, 255, 62, 0.2)',
    transform: [{ rotate: '12deg' }],
  },
  canopyInner: {
    alignSelf: 'center',
    paddingTop: 12,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  welcomeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(216, 255, 62, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(216, 255, 62, 0.55)',
  },
  welcomeBadgeText: {
    ...typography.kicker,
    fontSize: 9.5,
    lineHeight: 12,
    color: colors.lime,
  },
  heroTitle: {
    fontFamily: fonts.display,
    fontSize: 26,
    lineHeight: 30,
    color: colors.paper,
    textShadowColor: 'rgba(18, 6, 62, 0.28)',
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 3,
  },
  heroTitleAccent: {
    color: colors.lime,
  },
  heroSubtitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 17.5,
    color: 'rgba(244, 238, 255, 0.92)',
  },
  mascotWrap: {
    width: 82,
    height: 82,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    flexShrink: 0,
  },

  scrollContent: {
    paddingTop: 16,
    paddingBottom: 14,
  },
  page: {
    width: '100%',
    alignSelf: 'center',
    gap: 16,
  },

  section: {
    gap: 9,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sectionKicker: {
    ...typography.kicker,
    fontSize: 10.5,
    color: colors.violetDeep,
  },
  requiredPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.violetSoft,
  },
  requiredPillText: {
    ...typography.kicker,
    fontSize: 8.5,
    lineHeight: 11,
    color: colors.violetDeep,
  },
  optionalPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: '#F3EEFF',
  },
  optionalPillText: {
    ...typography.kicker,
    fontSize: 8.5,
    lineHeight: 11,
    color: colors.inkMuted,
  },

  ageGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  ageCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 84,
    borderRadius: 20,
    borderWidth: 1.4,
    borderBottomWidth: 3.5,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 10,
    justifyContent: 'space-between',
    gap: 4,
  },
  ageCardSelected: {
    borderColor: '#9158FF',
    borderBottomColor: '#3C12A8',
    backgroundColor: colors.violet,
  },
  ageCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  ageCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ageRadioEmpty: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.6,
    borderColor: '#D4C5F5',
    backgroundColor: '#FAF7FF',
  },
  ageTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    lineHeight: 19.5,
    color: colors.ink,
  },
  ageTitleSelected: {
    color: colors.paper,
  },
  ageSubtitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    lineHeight: 14,
    color: colors.inkSoft,
  },
  ageSubtitleSelected: {
    color: 'rgba(244, 238, 255, 0.92)',
  },

  parentalBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1.5,
    borderBottomWidth: 3,
    borderColor: '#A9EAF2',
    borderBottomColor: '#6FD4E2',
    backgroundColor: '#EFFDFE',
  },
  parentalBoxChecked: {
    borderColor: '#A8DC2B',
    borderBottomColor: '#7EA508',
    backgroundColor: '#F5FFD2',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.8,
    borderColor: colors.cyanDeep,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  checkboxChecked: {
    borderColor: '#7EA508',
    backgroundColor: colors.lime,
  },
  parentalText: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    color: colors.ink,
    fontSize: 12.4,
    lineHeight: 17,
  },
  ageNote: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    lineHeight: 15.5,
    color: colors.inkMuted,
  },

  tracksWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  trackChip: {
    minHeight: 38,
    borderRadius: radii.pill,
    borderWidth: 1.3,
    borderBottomWidth: 3,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 13,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trackChipActive: {
    borderColor: '#9158FF',
    borderBottomColor: '#3C12A8',
    backgroundColor: colors.violet,
  },
  trackCheckDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackChipText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12.5,
    lineHeight: 16,
    color: colors.ink,
    includeFontPadding: false,
  },
  trackChipTextActive: {
    color: colors.paper,
  },
  trackHint: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.inkSoft,
  },

  safetyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 18,
    borderWidth: 1.2,
    borderColor: '#E5DCFF',
    backgroundColor: '#FAF7FF',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  safetyIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: colors.limeSoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  safetyText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 11.8,
    lineHeight: 16.2,
    color: colors.inkSoft,
  },

  footer: {
    paddingTop: 10,
    backgroundColor: colors.canvas,
    borderTopWidth: 1,
    borderTopColor: 'rgba(124, 60, 255, 0.08)',
  },
  footerInner: {
    width: '100%',
    alignSelf: 'center',
    gap: 6,
  },
  legalBtn: {
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  legalText: {
    fontFamily: fonts.body,
    fontSize: 11.8,
    lineHeight: 16,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  legalLink: {
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
  },
  pressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
});
