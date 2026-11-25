import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { beginAppTransition } from '../../../shared/context/TransitionMotionContext';
import { ImageCropEditor } from '../components/ImageCropEditor';
import { commercialGateFromError, preflightAnalysisAccess } from '../../access/services/commercial';
import { recordDiagnosticError } from '../../../shared/services/diagnostics';
import { createAnalysisRequestId } from '../../analysis/services/mathAnalysis';
import { clearPendingAnalysis, getPreparedPendingAnalysis, savePendingAnalysis } from '../../analysis/services/pendingAnalysis';
import { assertSessionActive, captureSession } from '../../../shared/services/sessionGuard';
import { deleteCapturedImageFiles } from '../services/temporaryImages';
import { colors } from '../../../shared/theme';
import type { CapturedImage, RootStackParamList } from '../../../shared/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Review'>;

export function ReviewScreen({ navigation, route }: Props) {
  const [currentImage, setCurrentImage] = useState(route.params.image);
  const [accessError, setAccessError] = useState<string | null>(null);
  const continueLocked = useRef(false);

  useFocusEffect(useCallback(() => {
    continueLocked.current = false;
  }, []));

  useEffect(() => navigation.addListener('beforeRemove', () => {
    const pending = getPreparedPendingAnalysis();
    if (
      pending?.schemaVersion === 2
      && (pending.image.uri === route.params.image.uri || pending.image.uri === currentImage.uri)
    ) {
      clearPendingAnalysis(pending.requestId);
    }
    deleteCapturedImageFiles([route.params.image.uri, currentImage.uri]);
  }), [currentImage.uri, navigation, route.params.image.uri]);

  const continueToAnalysis = useCallback(async (editedImage: CapturedImage) => {
    if (continueLocked.current) return;

    continueLocked.current = true;
    setAccessError(null);
    const requestId = createAnalysisRequestId();

    try {
      const session = captureSession();
      await preflightAnalysisAccess(requestId);
      assertSessionActive(session);
      setCurrentImage((previous) => {
        if (previous.uri !== route.params.image.uri && previous.uri !== editedImage.uri) {
          deleteCapturedImageFiles([previous.uri]);
        }
        return editedImage;
      });
      savePendingAnalysis(route.params.mode, editedImage, requestId, session.userId);
      beginAppTransition();
      navigation.navigate('Processing', {
        mode: route.params.mode,
        image: editedImage,
        requestId,
        userId: session.userId,
        origin: 'review',
      });
      return true;
    } catch (error) {
      const gate = commercialGateFromError(error);
      if (gate) {
        beginAppTransition();
        navigation.navigate('Paywall', { source: 'quota', ...(gate.access ? { access: gate.access } : {}) });
      } else {
        recordDiagnosticError('commercial_preflight', error);
        setAccessError('Nu am putut porni analiza. Verifică internetul și încearcă din nou.');
      }
      continueLocked.current = false;
      return false;
    }
  }, [navigation, route.params.image.uri, route.params.mode]);

  return (
    <View style={styles.scene}>
      <StatusBar style="light" />
      <ImageCropEditor
        image={currentImage}
        mode={route.params.mode}
        actionError={accessError}
        onCancel={() => {
          beginAppTransition();
          navigation.goBack();
        }}
        onApply={continueToAnalysis}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scene: { flex: 1, backgroundColor: colors.ink },
});
