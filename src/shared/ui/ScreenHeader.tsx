import { StyleSheet, View } from 'react-native';
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
  rightIcon?: AppIconName;
  rightLabel?: string;
  onRight?: () => void;
  rightActive?: boolean;
  dark?: boolean;
};

export function ScreenHeader({
  title,
  eyebrow,
  onBack,
  rightIcon,
  rightLabel = 'Acțiune',
  onRight,
  rightActive = false,
  dark = false,
}: Props) {
  const color = dark ? colors.paper : colors.ink;
  const { gutter, isNarrow, isLargeText } = useResponsiveLayout();

  return (
    <View
      style={[
        styles.row,
        { paddingHorizontal: gutter },
        isNarrow && !isLargeText && styles.rowNarrow,
        isLargeText && styles.rowLargeText,
      ]}
    >
      <IconButton label="Înapoi" onPress={onBack} dark={dark} size={46}>
        <MiniGlyph name="back" size={25} color={color} />
      </IconButton>
      <View style={styles.copy}>
        {eyebrow ? (
          <Text numberOfLines={1} style={[styles.eyebrow, dark && styles.eyebrowDark]}>
            {eyebrow}
          </Text>
        ) : null}
        <Text
          numberOfLines={isLargeText ? 2 : 1}
          style={[styles.title, isNarrow && !isLargeText && styles.titleNarrow, dark && styles.titleDark]}
        >
          {title}
        </Text>
      </View>
      {rightIcon ? (
        <IconButton
          label={rightLabel}
          onPress={onRight}
          dark={dark}
          active={rightActive}
          size={46}
        >
          <AppIcon name={rightIcon} size={36} />
        </IconButton>
      ) : (
        <View style={styles.spacer} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 8,
    gap: 12,
  },
  rowNarrow: { minHeight: 64, gap: 9 },
  rowLargeText: { minHeight: 94, paddingVertical: 10 },
  copy: { flex: 1, minWidth: 0 },
  eyebrow: {
    ...typography.kicker,
    color: colors.violetDeep,
  },
  eyebrowDark: { color: colors.lime },
  title: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 20, lineHeight: 24 },
  titleNarrow: { fontSize: 18, lineHeight: 22 },
  titleDark: { color: colors.paper },
  spacer: { width: 46 },
});
