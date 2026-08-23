import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '../components/AppIcon';
import { ComicBackdrop } from '../components/ComicBackdrop';
import { ComicButton } from '../components/ComicButton';
import { ImageCropEditor } from '../components/ImageCropEditor';
import { ScreenHeader } from '../components/ScreenHeader';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { createAnalysisRequestId } from '../services/mathAnalysis';
import { colors, fonts } from '../theme';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Review'>;

export function ReviewScreen({ navigation, route }: Props) {
  const { height, contentWidth, gutter, isNarrow, isVeryShort, isCompact } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const isCheck = route.params.mode === 'check';
  const [currentImage, setCurrentImage] = useState(route.params.image);
  const [cropOpen, setCropOpen] = useState(false);
  const [wasAdjusted, setWasAdjusted] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const reveal = useRef(new Animated.Value(0)).current;
  const continuing = useRef(false);
  const photoWidth = contentWidth;
  const sourceRatio = currentImage.height / currentImage.width;
  const photoHeight = Math.min(
    isCompact ? 248 : 300,
    Math.max(isVeryShort ? 150 : 180, Math.min(height * 0.32, photoWidth * Math.min(sourceRatio, 0.9))),
  );
  const bottomSpace = Math.max(insets.bottom, 10);

  useEffect(() => {
    if (reducedMotion) {
      reveal.setValue(1);
      return;
    }
    Animated.spring(reveal, { toValue: 1, useNativeDriver: true, speed: 8, bounciness: 8 }).start();
  }, [reducedMotion, reveal]);

  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
  }, [currentImage.uri]);

  const continueToAnalysis = useCallback(() => {
    if (continuing.current || imageError || !imageLoaded) return;
    continuing.current = true;
    navigation.navigate('Processing', {
      mode: route.params.mode,
      image: currentImage,
      requestId: createAnalysisRequestId(),
    });
    requestAnimationFrame(() => { continuing.current = false; });
  }, [currentImage, imageError, imageLoaded, navigation, route.params.mode]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      <ComicBackdrop />
      <ScreenHeader title="Verifică fotografia" eyebrow="PASUL 2 DIN 4" onBack={() => navigation.goBack()} rightIcon="crop" rightLabel="Decupează fotografia" onRight={() => setCropOpen(true)} />
      <ScrollView
        style={styles.content}
        bounces={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.contentBody, { paddingHorizontal: gutter }]}
      >
        <Text style={[styles.title, isNarrow && styles.titleNarrow, isCompact && styles.titleCompact]}>Se vede tot exercițiul?</Text>
        <Text style={[styles.subtitle, isCompact && styles.subtitleCompact]}>{isCheck ? 'Asigură-te că fotografia este clară și cuprinde toată rezolvarea.' : 'Asigură-te că fotografia este clară și cuprinde întregul enunț.'}</Text>

        <Animated.View style={[styles.photoWrap, isCompact && styles.photoWrapCompact, { opacity: reveal, transform: [{ scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) }] }]}>
          <View style={styles.photoShadow} />
          <View style={[styles.photo, { height: photoHeight }, wasAdjusted && styles.photoCrop]}>
            <View style={styles.tape}><Text style={styles.tapeText}>{currentImage.source === 'camera' ? 'FOTOGRAFIE' : 'GALERIE'}</Text></View>
            {!imageLoaded && !imageError ? <ActivityIndicator size="large" color={colors.lime} /> : null}
            {imageError ? (
              <View style={styles.imageError}><AppIcon name="retake" size={52} /><Text style={styles.imageErrorTitle}>Fotografia nu se poate afișa</Text><Text style={styles.imageErrorText}>Fă altă fotografie sau alege altă imagine.</Text></View>
            ) : (
              <Image
                accessible
                accessibilityLabel="Fotografia selectată pentru analiză"
                source={{ uri: currentImage.uri }}
                resizeMode="contain"
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
                style={styles.capturedImage}
              />
            )}
            <View style={[styles.cropCorner, styles.cropTL]} /><View style={[styles.cropCorner, styles.cropTR]} />
            <View style={[styles.cropCorner, styles.cropBL]} /><View style={[styles.cropCorner, styles.cropBR]} />
            {wasAdjusted ? <View style={styles.cropBadge}><AppIcon name="crop" size={29} /><Text style={styles.cropBadgeText}>FOTOGRAFIE DECUPATĂ</Text></View> : null}
          </View>
        </Animated.View>

        <Animated.View style={[styles.ocrRow, isCompact && styles.ocrRowCompact, { opacity: reveal, transform: [{ translateX: reveal.interpolate({ inputRange: [0, 1], outputRange: [-18, 0] }) }] }]}>
          <View style={styles.ocrIcon}><AppIcon name="scan" size={56} /></View>
          <View style={styles.ocrCopy}>
            <Text style={styles.ocrLabel}>FOTOGRAFIE CLARĂ</Text>
            <Text style={[styles.ocrText, isNarrow && styles.ocrTextNarrow]}>{isCheck ? 'Pot verifica rezolvarea' : 'Pot citi problema'}</Text>
          </View>
          <View style={styles.confidence}><Text style={styles.confidenceText}>GATA</Text></View>
        </Animated.View>

        <View style={styles.tip}>
          <AppIcon name="hint" size={31} />
          <Text style={styles.tipText}>{isCheck ? 'Voi verifica fiecare pas, nu doar răspunsul final.' : 'Voi citi enunțul și apoi îți voi explica rezolvarea, pas cu pas.'}</Text>
        </View>
      </ScrollView>
      <View style={[styles.actionDock, { paddingHorizontal: gutter, paddingBottom: bottomSpace }]}>
        <ComicButton
          compact
          title={imageLoaded && !imageError ? 'Continuă' : 'Fotografia se încarcă…'}
          subtitle={imageLoaded && !imageError ? (isCheck ? 'Verific fiecare pas.' : 'Îți explic rezolvarea.') : 'Așteaptă o clipă.'}
          icon="scan"
          tone="lime"
          disabled={!imageLoaded || imageError}
          onPress={continueToAnalysis}
        />
        <Pressable accessibilityRole="button" accessibilityLabel="Fă altă fotografie" onPress={() => navigation.goBack()} style={styles.retakeLink}>
          <AppIcon name="retake" size={30} />
          <Text style={styles.retakeText}>Fă altă fotografie</Text>
        </Pressable>
      </View>
      <ImageCropEditor
        visible={cropOpen}
        image={currentImage}
        onCancel={() => setCropOpen(false)}
        onApply={(editedImage) => {
          setCurrentImage(editedImage);
          setWasAdjusted(true);
          setCropOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { flex: 1, minHeight: 0 },
  contentBody: { flexGrow: 1, paddingBottom: 4 },
  title: { fontFamily: fonts.display, color: colors.ink, fontSize: 34, lineHeight: 37, marginTop: 8 },
  titleNarrow: { fontSize: 30, lineHeight: 33 },
  titleCompact: { fontSize: 27, lineHeight: 29, marginTop: 2 },
  subtitle: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 14, lineHeight: 19, maxWidth: 344, marginTop: 3 },
  subtitleCompact: { fontSize: 12.5, lineHeight: 16 },
  photoWrap: { marginTop: 20, position: 'relative' },
  photoWrapCompact: { marginTop: 12 },
  photoShadow: { position: 'absolute', top: 8, left: 7, right: -7, bottom: -9, borderRadius: 27, backgroundColor: colors.ink },
  photo: { borderRadius: 27, borderWidth: 3, borderColor: colors.ink, backgroundColor: '#252044', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoCrop: { borderColor: colors.lime },
  tape: { position: 'absolute', zIndex: 3, top: 12, left: -12, backgroundColor: colors.lime, paddingHorizontal: 22, paddingVertical: 5, borderWidth: 2, borderColor: colors.ink, transform: [{ rotate: '-8deg' }] },
  tapeText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 9, letterSpacing: 1.2 },
  capturedImage: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' },
  imageError: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 25 },
  imageErrorTitle: { fontFamily: fonts.displaySemi, color: colors.paper, fontSize: 17, marginTop: 4 },
  imageErrorText: { fontFamily: fonts.body, color: '#CFC8DF', fontSize: 11, lineHeight: 15, textAlign: 'center', marginTop: 2 },
  sheet: { width: '80%', minHeight: 194, backgroundColor: colors.canvas, borderWidth: 2, borderColor: colors.ink, padding: 21, transform: [{ rotate: '-1.5deg' }] },
  sheetCompact: { minHeight: 166, padding: 16 },
  sheetCrop: { transform: [{ rotate: '0deg' }, { scale: 0.96 }] },
  sheetSmall: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 13 },
  sheetEquation: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 24, marginTop: 14 },
  sheetEquationNarrow: { fontSize: 20 },
  sheetHand: { fontFamily: fonts.body, color: colors.violetDeep, fontSize: 17, marginTop: 11 },
  cropCorner: { position: 'absolute', width: 28, height: 28, borderColor: colors.lime },
  cropTL: { top: 20, left: 20, borderTopWidth: 4, borderLeftWidth: 4 },
  cropTR: { top: 20, right: 20, borderTopWidth: 4, borderRightWidth: 4 },
  cropBL: { bottom: 20, left: 20, borderBottomWidth: 4, borderLeftWidth: 4 },
  cropBR: { bottom: 20, right: 20, borderBottomWidth: 4, borderRightWidth: 4 },
  cropBadge: { position: 'absolute', bottom: 13, borderRadius: 12, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.lime, flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 8, paddingVertical: 3 },
  cropBadgeText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 8, letterSpacing: 0.8 },
  ocrRow: { minHeight: 78, marginTop: 21, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: 2, borderColor: colors.line, paddingBottom: 12 },
  ocrRowCompact: { marginTop: 17 },
  ocrIcon: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-3deg' }] },
  ocrCopy: { flex: 1 },
  ocrLabel: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 9, letterSpacing: 1.2 },
  ocrText: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 19, marginTop: 2 },
  ocrTextNarrow: { fontSize: 16 },
  confidence: { backgroundColor: colors.lime, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 4 },
  confidenceText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 10 },
  tip: { flexDirection: 'row', gap: 8, marginTop: 13, paddingTop: 2, paddingBottom: 10, paddingHorizontal: 5 },
  tipText: { flex: 1, fontFamily: fonts.body, color: colors.inkSoft, fontSize: 12, lineHeight: 16 },
  actionDock: { backgroundColor: colors.canvas, borderTopWidth: 1.5, borderTopColor: colors.line, paddingTop: 10 },
  retakeLink: { alignSelf: 'center', minHeight: 35, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 16 },
  retakeText: { fontFamily: fonts.bodyBold, color: colors.inkSoft, fontSize: 11.5 },
});
