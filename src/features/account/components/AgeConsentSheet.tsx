import { memo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as Haptics from '../../../shared/services/haptics';
import { colors, fonts, radii, typography } from '../../../shared/theme';
import { AppIcon } from '../../../shared/ui/AppIcon';
import { ComicBottomSheet } from '../../../shared/ui/ComicBottomSheet';
import { ComicButton } from '../../../shared/ui/ComicButton';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { Text } from '../../../shared/ui/Typography';
import {
  canConfirmAgeEligibility,
  type AgeEligibilityGroup,
} from '../../../shared/utils/ageEligibility';

type Props = {
  visible: boolean;
  onConfirm: (group: AgeEligibilityGroup) => void;
  onOpenLegal: () => void;
};

type OptionConfig = {
  id: AgeEligibilityGroup;
  badge: string;
  title: string;
  description: string;
  accentDot: string;
  accentTint: string;
};

const AGE_OPTIONS: readonly OptionConfig[] = [
  {
    id: '16_plus',
    badge: '16+ ANI',
    title: 'Am 16 ani sau mai mult',
    description: 'Folosesc aplicația independent și accept regulile de utilizare.',
    accentDot: colors.violet,
    accentTint: colors.violetSoft,
  },
  {
    id: '13_15_parental',
    badge: '13–15 ANI',
    title: 'Am între 13 și 15 ani',
    description: 'Folosesc aplicația cu acordul părintelui sau tutorelui legal.',
    accentDot: colors.cyanDeep,
    accentTint: colors.cyanSoft,
  },
  {
    id: 'parent',
    badge: 'PĂRINTE',
    title: 'Sunt părinte sau tutore',
    description: 'Configurez și supraveghez aplicația pentru copilul meu.',
    accentDot: colors.limeDeep,
    accentTint: colors.limeSoft,
  },
];

/**
 * First-launch, privacy-minimized age eligibility & parental-consent sheet
 * aligned with Romania GDPR (16+ digital consent), OpenAI Under-18 guidance,
 * and Play Store transparency. Never asks for or stores a date of birth.
 */
export const AgeConsentSheet = memo(function AgeConsentSheet({
  visible,
  onConfirm,
  onOpenLegal,
}: Props) {
  const [selectedGroup, setSelectedGroup] = useState<AgeEligibilityGroup | null>(null);
  const [parentalConfirmed, setParentalConfirmed] = useState(false);

  const canProceed = canConfirmAgeEligibility(selectedGroup, parentalConfirmed);

  const handleSelectOption = (group: AgeEligibilityGroup) => {
    Haptics.selection();
    setSelectedGroup(group);
    if (group !== '13_15_parental') {
      setParentalConfirmed(false);
    }
  };

  const handleSubmit = () => {
    if (!selectedGroup || !canProceed) return;
    Haptics.impact(Haptics.ImpactFeedbackStyle.Medium);
    onConfirm(selectedGroup);
  };

  return (
    <ComicBottomSheet
      visible={visible}
      dismissible={false}
      showHandle={false}
      accessibilityRole="alert"
      maxHeight="92%"
      onClose={() => undefined}
    >
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <AppIcon name="privacy" size={28} />
        </View>
        <View style={styles.headerCopy}>
          <Text maxFontSizeMultiplier={1.25} style={styles.eyebrow}>
            ÎNAINTE SĂ ÎNCEPEM
          </Text>
          <Text maxFontSizeMultiplier={1.25} style={styles.title}>
            Confirmare de vârstă
          </Text>
        </View>
      </View>

      <Text style={styles.subtitle}>
        Profu’ de mate este creat pentru elevi de cel puțin 13 ani și părinți. Nu cerem data nașterii — alege varianta care ți se potrivește:
      </Text>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.optionsList}>
          {AGE_OPTIONS.map((option) => {
            const active = selectedGroup === option.id;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                onPress={() => handleSelectOption(option.id)}
                style={({ pressed }) => [
                  styles.optionCard,
                  active && styles.optionCardActive,
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.optionRail, { backgroundColor: active ? colors.lime : option.accentDot }]} />
                <View style={styles.optionBody}>
                  <View style={styles.optionTop}>
                    <View
                      style={[
                        styles.badge,
                        { backgroundColor: active ? 'rgba(255, 255, 255, 0.16)' : option.accentTint },
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          { color: active ? colors.lime : option.accentDot },
                        ]}
                      >
                        {option.badge}
                      </Text>
                    </View>
                    {active ? (
                      <View style={styles.activeCheck}>
                        <MiniGlyph name="check" size={13} color={colors.ink} />
                      </View>
                    ) : (
                      <View style={styles.inactiveDot} />
                    )}
                  </View>
                  <Text style={[styles.optionTitle, active && styles.optionTitleActive]}>
                    {option.title}
                  </Text>
                  <Text style={[styles.optionDesc, active && styles.optionDescActive]}>
                    {option.description}
                  </Text>
                </View>
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
              setParentalConfirmed((current) => !current);
            }}
            style={({ pressed }) => [
              styles.parentalBox,
              parentalConfirmed && styles.parentalBoxChecked,
              pressed && styles.pressed,
            ]}
          >
            <View style={[styles.checkbox, parentalConfirmed && styles.checkboxChecked]}>
              {parentalConfirmed ? <MiniGlyph name="check" size={14} color={colors.ink} /> : null}
            </View>
            <Text style={styles.parentalText}>
              Confirm că am acordul părintelui sau tutorelui legal pentru a folosi Profu’ de mate, inclusiv analiza AI a problemelor de matematică.
            </Text>
          </Pressable>
        ) : null}

        <View style={styles.safetyCard}>
          <Text style={styles.safetyTitle}>Folosire în siguranță</Text>
          <Text style={styles.safetyText}>
            Încadrează doar enunțul sau rezolvarea matematică — fără fețe, nume ori date personale. Explicațiile AI sunt orientative și nu înlocuiesc profesorul.
          </Text>
        </View>

        <Text style={styles.underThirteenNote}>
          Ai sub 13 ani? Folosește aplicația doar împreună cu un părinte sau tutore.
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Deschide Confidențialitatea și Termenii"
          onPress={() => {
            Haptics.selection();
            onOpenLegal();
          }}
          style={({ pressed }) => [styles.legalLink, pressed && styles.pressed]}
        >
          <Text style={styles.legalLinkText}>Citește Confidențialitatea și Termenii</Text>
          <MiniGlyph name="next" size={14} color={colors.violetDeep} />
        </Pressable>
      </ScrollView>

      <View style={styles.footer}>
        <ComicButton
          title="Continuă în aplicație"
          tone="violet"
          trailingIcon="check"
          compact
          disabled={!canProceed}
          accessibilityHint="Confirmă vârsta și deschide aplicația"
          onPress={handleSubmit}
        />
      </View>
    </ComicBottomSheet>
  );
});

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 4,
  },
  headerIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    borderWidth: 1.4,
    borderBottomWidth: 3.2,
    borderColor: '#DDF68E',
    borderBottomColor: '#B1D63D',
    backgroundColor: colors.limeSoft,
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
    fontSize: 21,
    lineHeight: 25,
  },
  subtitle: {
    marginTop: 9,
    marginBottom: 12,
    fontFamily: fonts.body,
    color: colors.inkSoft,
    fontSize: 13.2,
    lineHeight: 18.8,
  },
  scrollContent: {
    paddingBottom: 10,
    gap: 10,
  },
  optionsList: {
    gap: 9,
  },
  optionCard: {
    borderRadius: 22,
    borderWidth: 1.4,
    borderBottomWidth: 3.8,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  optionCardActive: {
    borderColor: '#9158FF',
    borderBottomColor: '#3C12A8',
    backgroundColor: colors.violet,
  },
  optionRail: {
    width: 5,
    alignSelf: 'stretch',
  },
  optionBody: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  optionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: radii.pill,
  },
  badgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9.5,
    letterSpacing: 0.7,
    includeFontPadding: false,
  },
  activeCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inactiveDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.8,
    borderColor: '#D4C5F5',
    backgroundColor: '#FAF7FF',
  },
  optionTitle: {
    marginTop: 5,
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 16.5,
    lineHeight: 20.5,
  },
  optionTitleActive: {
    color: colors.paper,
  },
  optionDesc: {
    marginTop: 2.5,
    fontFamily: fonts.body,
    color: colors.inkSoft,
    fontSize: 12.4,
    lineHeight: 16.8,
  },
  optionDescActive: {
    color: 'rgba(244, 238, 255, 0.92)',
  },
  parentalBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    padding: 13,
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
    fontSize: 12.6,
    lineHeight: 17.5,
  },
  safetyCard: {
    borderRadius: 18,
    borderWidth: 1.2,
    borderColor: '#E5DCFF',
    backgroundColor: '#FAF7FF',
    paddingHorizontal: 13,
    paddingVertical: 10,
    gap: 3,
  },
  safetyTitle: {
    fontFamily: fonts.displaySemi,
    color: colors.violetDeep,
    fontSize: 13.2,
    lineHeight: 17,
  },
  safetyText: {
    fontFamily: fonts.body,
    color: colors.inkSoft,
    fontSize: 12.2,
    lineHeight: 17,
  },
  underThirteenNote: {
    fontFamily: fonts.bodyMedium,
    color: colors.inkMuted,
    fontSize: 11.8,
    lineHeight: 16,
    textAlign: 'center',
    paddingHorizontal: 6,
  },
  legalLink: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 4,
  },
  legalLinkText: {
    fontFamily: fonts.bodyBold,
    color: colors.violetDeep,
    fontSize: 13,
  },
  footer: {
    paddingTop: 8,
  },
  pressed: { opacity: 0.82 },
});
