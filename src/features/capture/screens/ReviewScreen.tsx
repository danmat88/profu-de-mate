import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
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
  const [preflighting, setPreflighting] = useState(false);
  const continueLocked = useRef(false);
  const preflightInFlightRef = useRef(false);
  const focusedRef = useRef(true);

  useFocusEffect(useCallback(() => {
    focusedRef.current = true;
    continueLocked.current = false;
    preflightInFlightRef.current = false;
    setPreflighting(false);
    return () => {
      focusedRef.current = false;
    };
  }, []));

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !preflighting });
  }, [navigation, preflighting]);

  useEffect(() => {
    if (!preflighting) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, [preflighting]);

  useEffect(() => navigation.addListener('beforeRemove', (event) => {
    if (preflightInFlightRef.current && event.data.action.type !== 'RESET') {
      event.preventDefault();
      return;
    }
    const pending = getPreparedPendingAnalysis();
    const pendingMatchesImage = pending?.schemaVersion === 2
      && (pending.image.uri === route.params.image.uri || pending.image.uri === currentImage.uri);
    const preserveBackgroundAnalysis = pendingMatchesImage
      && (event.data.action.type === 'RESET' || !focusedRef.current);
    if (pendingMatchesImage && !preserveBackgroundAnalysis) {
      clearPendingAnalysis(pending.requestId);
    }
    if (preserveBackgroundAnalysis && pending?.schemaVersion === 2) {
      deleteCapturedImageFiles([route.params.image.uri, currentImage.uri], [pending.image.uri]);
      return;
    }
    deleteCapturedImageFiles([route.params.image.uri, currentImage.uri]);
  }), [currentImage.uri, navigation, route.params.image.uri]);

  const continueToAnalysis = useCallback(async (editedImage: CapturedImage) => {
    if (continueLocked.current) return;

    continueLocked.current = true;
    preflightInFlightRef.current = true;
    setPreflighting(true);
    setAccessError(null);
    const requestId = createAnalysisRequestId();

    try {
      const session = captureSession();
      await preflightAnalysisAccess(requestId);
      assertSessionActive(session);
      if (!focusedRef.current) {
        continueLocked.current = false;
        preflightInFlightRef.current = false;
        setPreflighting(false);
        return false;
      }
      setCurrentImage((previous) => {
        if (previous.uri !== route.params.image.uri && previous.uri !== editedImage.uri) {
          deleteCapturedImageFiles([previous.uri]);
        }
        return editedImage;
      });
      savePendingAnalysis(route.params.mode, editedImage, requestId, session.userId);
      preflightInFlightRef.current = false;
      continueLocked.current = false;
      setPreflighting(false);
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
      preflightInFlightRef.current = false;
      if (!focusedRef.current) {
        continueLocked.current = false;
        setPreflighting(false);
        return false;
      }
      const gate = commercialGateFromError(error);
      if (gate) {
        setPreflighting(false);
        beginAppTransition();
        navigation.navigate('Paywall', { source: 'quota', ...(gate.access ? { access: gate.access } : {}) });
      } else {
        recordDiagnosticError('commercial_preflight', error);
        setAccessError('Nu am putut porni analiza. Verifică internetul și încearcă din nou.');
      }
      continueLocked.current = false;
      setPreflighting(false);
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
