import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaFrame } from 'react-native-safe-area-context';
import { beginAppTransition } from '../context/TransitionMotionContext';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { colors, fonts, typography } from '../theme';
import { AppIcon, type AppIconName } from './AppIcon';
import { IconButton } from './IconButton';
import { MiniGlyph } from './MiniGlyph';
import { Text } from './Typography';

type Props = {
  title: string;
  eyebrow?: string;
  onBack: () => void;
  backDisabled?: boolean;
  rightIcon?: AppIconName;
  rightLabel?: string;
  onRight?: () => void;
  rightActive?: boolean;
  rightDisabled?: boolean;
  dark?: boolean;
  compact?: boolean;
};

export const ScreenHeader = memo(function ScreenHeader({
  title,
  eyebrow,
  onBack,
  backDisabled = false,
  rightIcon,
  rightLabel = 'Acțiune',
  onRight,
  rightActive = false,
  rightDisabled = false,
  dark = false,
  compact = false,
}: Props) {
  const color = dark ? colors.paper : colors.ink;
  const frame = useSafeAreaFrame();
  const { gutter, isNarrow, isLargeText } = useResponsiveLayout(frame);
  const buttonSize = compact && !isLargeText ? 40 : 44;
  const badgeRadius = Math.round(buttonSize / 2);
  const handleBack = () => {
    beginAppTransition();
    onBack();
  };

  return (
    <View
      style={[
        styles.row,
        { paddingHorizontal: gutter },
        compact && !isLargeText && styles.rowCompact,
        isNarrow && !isLargeText && styles.rowNarrow,
        isLargeText && styles.rowLargeText,
      ]}
    >
      <IconButton label="Înapoi" onPress={handleBack} disabled={backDisabled} dimWhenDisabled={false} dark={dark} size={buttonSize}>
        <MiniGlyph name="back" size={compact && !isLargeText ? 21 : 23} color={color} />
      </IconButton>
      <View style={styles.copy}>
        {eyebrow ? (
          <Text numberOfLines={1} style={[styles.eyebrow, dark && styles.eyebrowDark]}>
            {eyebrow}
          </Text>
        ) : null}
        <Text
          numberOfLines={isLargeText ? 2 : 1}
          style={[
            styles.title,
            compact && !isLargeText && styles.titleCompact,
            isNarrow && !isLargeText && styles.titleNarrow,
            dark && styles.titleDark,
          ]}
        >
          {title}
        </Text>
      </View>
      {rightIcon && onRight ? (
        <IconButton
          label={rightLabel}
          onPress={onRight}
          disabled={rightDisabled}
          dark={dark}
          active={rightActive}
          size={buttonSize}
        >
          <AppIcon name={rightIcon} size={compact && !isLargeText ? 28 : 32} />
        </IconButton>
      ) : rightIcon ? (
        <View
          accessible={false}
          style={[
            styles.rightBadge,
            { width: buttonSize, height: buttonSize, borderRadius: badgeRadius },
            dark && styles.rightBadgeDark,
          ]}
        >
          <AppIcon name={rightIcon} size={compact && !isLargeText ? 26 : 30} />
        </View>
      ) : (
        <View style={{ width: buttonSize }} />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 8,
    gap: 12,
  },
  rowCompact: {
    minHeight: 52,
    paddingVertical: 4,
    gap: 10,
  },
  rowNarrow: { minHeight: 58, gap: 9 },
  rowLargeText: { minHeight: 88, paddingVertical: 10 },
  copy: { flex: 1, minWidth: 0 },
  eyebrow: {
    ...typography.kicker,
    fontSize: 10.5,
    color: colors.violetDeep,
  },
  eyebrowDark: { color: colors.lime },
  title: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 20, lineHeight: 24 },
  titleCompact: { fontSize: 18.5, lineHeight: 22 },
  titleNarrow: { fontSize: 18, lineHeight: 22 },
  titleDark: { color: colors.paper },
  rightBadge: {
    borderWidth: 1,
    borderColor: 'rgba(124, 60, 255, 0.1)',
    backgroundColor: 'rgba(124, 60, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  rightBadgeDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
});
