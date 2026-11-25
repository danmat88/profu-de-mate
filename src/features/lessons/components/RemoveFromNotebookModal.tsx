import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { colors, fonts, radii } from '../../../shared/theme';
import { AppIcon } from '../../../shared/ui/AppIcon';
import { Chip } from '../../../shared/ui/Chip';
import { ComicBottomSheet } from '../../../shared/ui/ComicBottomSheet';
import { Mascot } from '../../../shared/ui/Mascot';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { PlayfulLoader } from '../../../shared/ui/PlayfulLoader';
import { PressableScale } from '../../../shared/ui/PressableScale';
import { Text } from '../../../shared/ui/Typography';

type Props = {
  visible: boolean;
  lessonTitle: string;
  description?: string;
  removing: boolean;
  error: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onAfterClose?: () => void;
};

/**
 * Playful comic confirmation bottom sheet shown whenever the user removes a
 * saved problem from their Notebook (from Lesson, Summary, or Notebook list).
 * Built on the unified native-driver ComicBottomSheet (zero Reanimated).
 */
export function RemoveFromNotebookModal({
  visible,
  lessonTitle,
  description = 'Lecția va dispărea din Caietul tău. O poți salva din nou oricând.',
  removing,
  error,
  onConfirm,
  onCancel,
  onAfterClose,
}: Props) {
  return (
    <ComicBottomSheet
      visible={visible}
      dismissible={!removing}
      onClose={onCancel}
      onAfterClose={onAfterClose}
      sheetStyle={styles.sheet}
    >
      <View style={styles.mascotStage}>
        <View style={styles.mascotHalo} />
        <Mascot pose="oops" size={92} active={visible} />
        <View pointerEvents="none" style={styles.cornerBadge}>
          <MiniGlyph name="wrong" size={13} color={colors.paper} />
        </View>
      </View>

      <Chip label="GESTIONEAZĂ CAIETUL" tone="roseSoft" tilt={-2} />
      <Text style={styles.title}>Scoți problema din Caiet?</Text>

      {lessonTitle ? (
        <View style={styles.lessonPreview}>
          <View style={styles.lessonPreviewIcon}>
            <AppIcon name="notebook" size={24} />
          </View>
          <Text numberOfLines={2} style={styles.lessonTitle}>
            {lessonTitle}
          </Text>
        </View>
      ) : null}

      <Text style={styles.description}>{description}</Text>

      {error ? (
        <View accessibilityRole="alert" style={styles.errorBox}>
          <MiniGlyph name="wrong" size={14} color={colors.berryDeep} />
          <Text style={styles.errorText}>
            Nu am putut actualiza Caietul. Verifică internetul și încearcă din nou.
          </Text>
        </View>
      ) : null}

      <PressableScale
        accessibilityRole="button"
        accessibilityState={{ disabled: removing, busy: removing }}
        disabled={removing}
        dimWhenDisabled={false}
        pressedScale={0.97}
        haptic="medium"
        onPress={onConfirm}
        style={styles.confirmWrap}
        contentStyle={styles.confirmButton}
      >
        <LinearGradient
          colors={['#FF7488', '#FF4D66', '#E02D48']}
          start={{ x: 0.08, y: 0 }}
          end={{ x: 0.92, y: 1 }}
          style={styles.fill}
        />
        <View pointerEvents="none" style={styles.buttonShine} />
        {removing ? <PlayfulLoader micro inverse /> : <MiniGlyph name="wrong" size={17} color={colors.paper} />}
        <Text style={styles.confirmText}>
          {removing ? 'Actualizez Caietul…' : 'Da, scoate problema'}
        </Text>
      </PressableScale>

      <PressableScale
        accessibilityRole="button"
        accessibilityState={{ disabled: removing }}
        disabled={removing}
        dimWhenDisabled={false}
        pressedScale={0.97}
        haptic="selection"
        onPress={onCancel}
        style={styles.keepWrap}
        contentStyle={styles.keepButton}
      >
        <Text style={styles.keepText}>Păstreaz-o în Caiet</Text>
      </PressableScale>
    </ComicBottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    paddingHorizontal: 22,
    alignItems: 'center',
  },
  mascotStage: {
    width: 108,
    height: 98,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    position: 'relative',
  },
  mascotHalo: {
    position: 'absolute',
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 87, 109, 0.4)',
    backgroundColor: 'rgba(255, 224, 229, 0.72)',
  },
  cornerBadge: {
    position: 'absolute',
    right: 6,
    bottom: 4,
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.canvas,
    backgroundColor: colors.rose,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  title: {
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 24,
    lineHeight: 28,
    textAlign: 'center',
    marginTop: 10,
  },
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  lessonPreview: {
    width: '100%',
    marginTop: 12,
    borderRadius: 20,
    borderWidth: 1.4,
    borderBottomWidth: 3.5,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  lessonPreviewIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.limeSoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  lessonTitle: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.bodyBold,
    color: colors.ink,
    fontSize: 13.5,
    lineHeight: 18.5,
  },
  description: {
    maxWidth: 330,
    marginTop: 10,
    fontFamily: fonts.body,
    color: colors.inkSoft,
    fontSize: 13,
    lineHeight: 18.5,
    textAlign: 'center',
  },
  errorBox: {
    width: '100%',
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1.25,
    borderColor: '#FBC2CC',
    backgroundColor: colors.roseSoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  errorText: {
    flex: 1,
    fontFamily: fonts.bodyBold,
    color: colors.berryDeep,
    fontSize: 12,
    lineHeight: 16.5,
  },
  confirmWrap: { width: '100%', marginTop: 16 },
  confirmButton: {
    width: '100%',
    minHeight: 54,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderBottomWidth: 4.5,
    borderColor: '#FF98A6',
    borderBottomColor: '#A81E34',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  buttonShine: {
    position: 'absolute',
    top: 2,
    left: 22,
    right: 22,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.34)',
  },
  confirmText: {
    fontFamily: fonts.display,
    color: colors.paper,
    fontSize: 16.5,
  },
  keepWrap: { width: '100%', marginTop: 9 },
  keepButton: {
    width: '100%',
    minHeight: 50,
    borderRadius: radii.pill,
    borderWidth: 1.4,
    borderBottomWidth: 3.5,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  keepText: {
    fontFamily: fonts.bodyBold,
    color: colors.ink,
    fontSize: 14,
  },
});
