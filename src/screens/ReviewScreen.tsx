import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ImageCropEditor } from '../components/ImageCropEditor';
import { commercialGateFromError, preflightAnalysisAccess } from '../services/commercial';
import { recordDiagnosticError } from '../services/diagnostics';
import { createAnalysisRequestId } from '../services/mathAnalysis';
import { savePendingAnalysis } from '../services/pendingAnalysis';
import { deleteCapturedImageFiles } from '../services/temporaryImages';
import { colors } from '../theme';
import type { CapturedImage, RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Review'>;

export function ReviewScreen({ navigation, route }: Props) {
  const [currentImage, setCurrentImage] = useState(route.params.image);
  const [accessError, setAccessError] = useState<string | null>(null);
  const continueLocked = useRef(false);

  useFocusEffect(useCallback(() => {
    continueLocked.current = false;
  }, []));

  useEffect(() => navigation.addListener('beforeRemove', () => {
    deleteCapturedImageFiles([route.params.image.uri, currentImage.uri]);
  }), [currentImage.uri, navigation, route.params.image.uri]);

  const continueToAnalysis = useCallback(async (editedImage: CapturedImage) => {
    if (continueLocked.current) return;

    continueLocked.current = true;
    setAccessError(null);
    const requestId = createAnalysisRequestId();

    try {
      await preflightAnalysisAccess(requestId);
      setCurrentImage((previous) => {
        if (previous.uri !== route.params.image.uri && previous.uri !== editedImage.uri) {
          deleteCapturedImageFiles([previous.uri]);
        }
        return editedImage;
      });
      savePendingAnalysis(route.params.mode, editedImage, requestId);
      navigation.navigate('Processing', {
        mode: route.params.mode,
        image: editedImage,
        requestId,
        origin: 'review',
      });
      return true;
    } catch (error) {
      const gate = commercialGateFromError(error);
      if (gate) {
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
      <ImageCropEditor
        image={currentImage}
        mode={route.params.mode}
        actionError={accessError}
        onCancel={() => navigation.goBack()}
        onApply={continueToAnalysis}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scene: { flex: 1, backgroundColor: colors.ink },
});
