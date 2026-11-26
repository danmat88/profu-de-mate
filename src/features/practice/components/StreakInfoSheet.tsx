import { memo, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as Haptics from '../../../shared/services/haptics';
import { colors, fonts } from '../../../shared/theme';
import { AppIcon } from '../../../shared/ui/AppIcon';
import { ComicBottomSheet } from '../../../shared/ui/ComicBottomSheet';
import { ComicButton } from '../../../shared/ui/ComicButton';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { Text } from '../../../shared/ui/Typography';
import { getActiveStreakDays, type PracticeState } from '../services/practiceStorage';
import { buildWeeklyStreakCalendar, getLocalDateKey } from '../utils/practiceEngine';

type Props = {
  visible: boolean;
  practiceState: PracticeState;
  onClose: () => void;
  onStartQuickPractice?: () => void;
};

/**
 * Interactive daily-streak modal explaining clearly what the streak measures,
 * displaying the current Monday–Sunday Romanian week strip, personal best,
 * and a quick action if today's study habit is not yet checked off.
 */
export const StreakInfoSheet = memo(function StreakInfoSheet({
  visible,
  practiceState,
  onClose,
  onStartQuickPractice,
}: Props) {
  const todayKey = getLocalDateKey();
  const activeStreak = getActiveStreakDays(practiceState, todayKey);
  const doneToday = practiceState.lastPracticeDateKey === todayKey
    || practiceState.activeDateKeys.includes(todayKey);
  const bestStreak = Math.max(practiceState.bestStreakDays, activeStreak);
  const weekDays = useMemo(
    () => buildWeeklyStreakCalendar(
      practiceState.activeDateKeys,
      practiceState.lastPracticeDateKey,
      practiceState.streakDays,
    ),
    [practiceState.activeDateKeys, practiceState.lastPracticeDateKey, practiceState.streakDays],
  );
  const activeThisWeek = useMemo(
    () => weekDays.filter((day) => day.completed).length,
    [weekDays],
  );

  const headline = activeStreak > 0
    ? `${activeStreak} ${activeStreak === 1 ? 'zi' : 'zile'} la rând`
    : 'Începe seria de azi';

  return (
    <ComicBottomSheet visible={visible} onClose={onClose} maxHeight="84%">
      <View style={styles.header}>
        <View style={styles.flameBadge}>
          <AppIcon name="streak" size={28} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>SERIA TA ZILNICĂ</Text>
          <Text numberOfLines={1} style={styles.title}>{headline}</Text>
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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        <View style={[styles.statusBanner, doneToday ? styles.statusBannerDone : styles.statusBannerTodo]}>
          <View style={[styles.statusDot, doneToday ? styles.statusDotDone : styles.statusDotTodo]}>
            <MiniGlyph
              name={doneToday ? 'check' : 'spark'}
              size={13}
              color={doneToday ? colors.ink : colors.peachDeep}
            />
          </View>
          <View style={styles.statusCopy}>
            <Text style={styles.statusTitle}>
              {doneToday ? 'Obiectivul de azi e completat!' : 'Azi nu ai bifat încă seria'}
            </Text>
            <Text style={styles.statusSubtitle}>
              {doneToday
                ? 'Bravo! Revino și mâine cu măcar un exercițiu ca să continui seria.'
                : 'Rezolvă o problemă (poză sau scris), un test fulger ori o simulare ca să bifezi ziua.'}
            </Text>
          </View>
        </View>

        <View style={styles.weekCard}>
          <View style={styles.weekHeader}>
            <Text style={styles.weekKicker}>SĂPTĂMÂNA ACEASTA</Text>
            <Text style={styles.weekCount}>{activeThisWeek} / 7 zile</Text>
          </View>
          <View style={styles.weekRow}>
            {weekDays.map((day) => (
              <View
                key={day.key}
                accessibilityLabel={`${day.fullLabel}: ${day.completed ? 'completat' : day.isToday ? 'azi' : 'inactiv'}`}
                style={styles.dayCol}
              >
                <View
                  style={[
                    styles.dayCircle,
                    day.completed && styles.dayCircleDone,
                    day.isToday && !day.completed && styles.dayCircleToday,
                    day.isFuture && styles.dayCircleFuture,
                  ]}
                >
                  {day.completed ? (
                    <MiniGlyph name="check" size={14} color={colors.ink} />
                  ) : day.isToday ? (
                    <View style={styles.todayInnerDot} />
                  ) : null}
                </View>
                <Text
                  style={[
                    styles.dayLabel,
                    day.isToday && styles.dayLabelToday,
                    day.completed && styles.dayLabelDone,
                  ]}
                >
                  {day.shortLabel}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statTile}>
            <Text style={styles.statEyebrow}>RECORD PERSONAL</Text>
            <Text style={styles.statValue}>
              {bestStreak} {bestStreak === 1 ? 'zi' : 'zile'}
            </Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statEyebrow}>EXERCIȚII LA PRACTICĂ</Text>
            <Text style={styles.statValue}>{practiceState.totalAnswered}</Text>
          </View>
        </View>

        <View style={styles.whyCard}>
          <Text style={styles.whyTitle}>De ce contează 5 minute pe zi?</Text>
          <Text style={styles.whyText}>
            Orice problemă rezolvată (din poză sau din editor), test fulger ori simulare îți prelungește seria. Exersarea scurtă și constantă fixează formulele mult mai ușor decât pregătirea pe ultima sută înainte de teză sau examen.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {!doneToday && onStartQuickPractice ? (
          <ComicButton
            compact
            title="Bifează ziua cu un test fulger"
            icon="practice"
            tone="lime"
            onPress={() => {
              onClose();
              onStartQuickPractice();
            }}
          />
        ) : (
          <ComicButton
            compact
            title={doneToday ? 'Super · Ne vedem și mâine ★' : 'Am înțeles'}
            tone={doneToday ? 'lime' : 'violet'}
            onPress={onClose}
          />
        )}
      </View>
    </ComicBottomSheet>
  );
});

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  flameBadge: {
    width: 44,
    height: 44,
    borderRadius: 15,
    borderWidth: 1.3,
    borderBottomWidth: 3,
    borderColor: '#FFE58A',
    borderBottomColor: '#E2A916',
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 0.85,
    color: colors.violetDeep,
  },
  title: {
    marginTop: 1,
    fontFamily: fonts.display,
    fontSize: 21,
    lineHeight: 25,
    color: colors.ink,
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
    flexShrink: 0,
  },
  body: {
    gap: 12,
    paddingBottom: 14,
  },
  statusBanner: {
    borderRadius: 20,
    borderWidth: 1.3,
    borderBottomWidth: 3.2,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  statusBannerDone: {
    backgroundColor: '#F3FFD0',
    borderColor: '#C8EA68',
    borderBottomColor: '#98C40E',
  },
  statusBannerTodo: {
    backgroundColor: '#FFF5F0',
    borderColor: '#FFD6C4',
    borderBottomColor: '#EEA282',
  },
  statusDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statusDotDone: { backgroundColor: colors.lime },
  statusDotTodo: { backgroundColor: colors.peachSoft },
  statusCopy: { flex: 1, minWidth: 0, gap: 2 },
  statusTitle: {
    fontFamily: fonts.display,
    fontSize: 15,
    lineHeight: 19,
    color: colors.ink,
  },
  statusSubtitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12.5,
    lineHeight: 17.5,
    color: colors.inkSoft,
  },

  weekCard: {
    borderRadius: 20,
    borderWidth: 1.3,
    borderBottomWidth: 3.2,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 12,
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weekKicker: {
    fontFamily: fonts.bodyBold,
    fontSize: 10.5,
    letterSpacing: 0.75,
    color: colors.violetDeep,
  },
  weekCount: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.inkSoft,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  dayCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  dayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.4,
    borderColor: '#E6DEFA',
    backgroundColor: '#F8F5FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleDone: {
    backgroundColor: colors.lime,
    borderColor: '#98C40E',
    borderBottomWidth: 3,
    borderBottomColor: '#7EA508',
  },
  dayCircleToday: {
    borderWidth: 2,
    borderColor: colors.violet,
    backgroundColor: colors.violetSoft,
  },
  dayCircleFuture: {
    opacity: 0.52,
  },
  todayInnerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.violet,
  },
  dayLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.inkMuted,
  },
  dayLabelToday: {
    color: colors.violetDeep,
  },
  dayLabelDone: {
    color: colors.ink,
  },

  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statTile: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1.2,
    borderBottomWidth: 3,
    borderColor: '#E5DCFF',
    borderBottomColor: '#D1C0FA',
    backgroundColor: '#FFFFFF',
    padding: 12,
    gap: 3,
  },
  statEyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 9.5,
    letterSpacing: 0.7,
    color: colors.inkMuted,
  },
  statValue: {
    fontFamily: fonts.display,
    fontSize: 19,
    lineHeight: 23,
    color: colors.ink,
  },

  whyCard: {
    borderRadius: 18,
    borderWidth: 1.2,
    borderColor: '#EBE3FA',
    backgroundColor: '#FAF7FF',
    padding: 13,
    gap: 4,
  },
  whyTitle: {
    fontFamily: fonts.display,
    fontSize: 14.5,
    lineHeight: 19,
    color: colors.violetDeep,
  },
  whyText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12.8,
    lineHeight: 18.5,
    color: colors.inkSoft,
  },
  footer: {
    paddingTop: 6,
  },
  pressed: { opacity: 0.76 },
});
