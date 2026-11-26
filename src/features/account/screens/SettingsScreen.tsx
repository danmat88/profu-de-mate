import { getApp } from '@react-native-firebase/app';
import { getCrashlytics, setCrashlyticsCollectionEnabled } from '@react-native-firebase/crashlytics';
import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, BackHandler, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import { legalDocument } from '../../../shared/config/legal';
import { beginAppTransition, useTransitionMotion } from '../../../shared/context/TransitionMotionContext';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { useResponsiveLayout } from '../../../shared/hooks/useResponsiveLayout';
import { useTransitionSettled } from '../../../shared/hooks/useTransitionSettled';
import { SILKY_EASE_OUT } from '../../../shared/motion/nativeMotion';
import { getAppVersionLabel } from '../../../shared/services/appInfo';
import { recordDiagnosticError } from '../../../shared/services/diagnostics';
import * as Haptics from '../../../shared/services/haptics';
import { colors, fonts, radii } from '../../../shared/theme';
import type { RootStackParamList } from '../../../shared/types';
import { AppIcon } from '../../../shared/ui/AppIcon';
import { Chip } from '../../../shared/ui/Chip';
import { ComicBackdrop } from '../../../shared/ui/ComicBackdrop';
import { ComicBottomSheet } from '../../../shared/ui/ComicBottomSheet';
import { ComicSwitch } from '../../../shared/ui/ComicSwitch';
import { IconButton } from '../../../shared/ui/IconButton';
import { Mascot } from '../../../shared/ui/Mascot';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { PlayfulLoader } from '../../../shared/ui/PlayfulLoader';
import { PressableScale } from '../../../shared/ui/PressableScale';
import { SpotlightAura } from '../../../shared/ui/SpotlightAura';
import { Text } from '../../../shared/ui/Typography';
import { QuotaResetTimer } from '../../access/components/QuotaResetTimer';
import { useCommercial } from '../../access/context/CommercialContext';
import { isCurrentUserGoogle } from '../../access/services/commercial';
import { friendlyGoogleConnectError, isGoogleSignInCancelledError } from '../../access/services/googleAuthErrors';
import { StudyTrackSheet } from '../../study/components/StudyTrackSheet';
import { setStudyTrack, useStudyProfile } from '../../study/services/studyStorage';
import { getStudyTrackMeta } from '../../study/types';
import { GoogleAccountButton } from '../components/GoogleAccountButton';
import { DataDeletionCancelledError } from '../services/dataManagement';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

function SettingsSectionTitle({ children, tone }: { children: string; tone: string }) {
  return (
    <View style={styles.sectionHeading}>
      <View style={[styles.sectionMark, { backgroundColor: tone }]} />
      <Text style={styles.sectionTitle}>{children}</Text>
    </View>
  );
}

function SettingsCanopyHeader({
  canopyTopStyle,
  contentWidth,
  backDisabled,
  onBack,
}: {
  canopyTopStyle: { paddingTop: number };
  contentWidth: number;
  backDisabled: boolean;
  onBack: () => void;
}) {
  return (
    <View style={[styles.canopy, canopyTopStyle]}>
      <LinearGradient
        colors={['#7E46FF', '#5A21EA', '#4113BC', '#2D0C8E']}
        start={{ x: 0.08, y: 0 }}
        end={{ x: 0.92, y: 1 }}
        style={styles.fill}
      />
      <View pointerEvents="none" style={styles.canopyGlowCyan} />
      <View pointerEvents="none" style={styles.canopyGlowLime} />
      <View pointerEvents="none" style={styles.canopyOrbitArc} />
      <Text accessible={false} style={styles.canopyStar}>✦</Text>

      <View style={[styles.canopyInner, { width: contentWidth }]}>
        <View style={styles.canopyRow}>
          <IconButton
            label="Înapoi"
            disabled={backDisabled}
            dimWhenDisabled={false}
            onPress={onBack}
            size={42}
            style={styles.canopyActionBtn}
          >
            <MiniGlyph name="back" size={18} color={colors.violetDeep} />
          </IconButton>

          <View style={styles.canopyCopy}>
            <Text maxFontSizeMultiplier={1.25} numberOfLines={1} style={styles.canopyTitle}>
              Setări
            </Text>
            <View style={styles.canopyEyebrowRow}>
              <View style={styles.canopyEyebrowDot} />
              <Text maxFontSizeMultiplier={1.15} numberOfLines={1} style={styles.canopyEyebrow}>
                APLICAȚIA TA
              </Text>
            </View>
          </View>

          <View style={styles.canopyBadge}>
            <AppIcon name="settings" size={26} />
          </View>
        </View>
      </View>
    </View>
  );
}

type ComicSheetModalProps = {
  visible: boolean;
  busy?: boolean;
  dismissable?: boolean;
  alertRole?: boolean;
  onClose?: () => void;
  onAfterClose?: () => void;
  children: ReactNode;
};

/** Lazily mounts the unified native ComicBottomSheet only after first open. */
function ComicSheetModal({
  visible,
  busy = false,
  dismissable = true,
  alertRole = false,
  onClose,
  onAfterClose,
  children,
}: ComicSheetModalProps) {
  const [everOpened, setEverOpened] = useState(visible);
  if (visible && !everOpened) {
    setEverOpened(true);
  }
  if (!everOpened) return null;
  return (
    <ComicBottomSheet
      visible={visible}
      dismissible={dismissable && !busy}
      accessibilityRole={alertRole ? 'alert' : undefined}
      onClose={() => onClose?.()}
      onAfterClose={onAfterClose}
      maxHeight="92%"
      sheetStyle={styles.confirmSheet}
    >
      {children}
    </ComicBottomSheet>
  );
}

export function SettingsScreen({ navigation }: Props) {
  const frame = useSafeAreaFrame();
  const { gutter, contentWidth } = useResponsiveLayout(frame);
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const focused = useIsFocused();
  const transitionSettled = useTransitionSettled(navigation, reducedMotion);
  const { isTransitioning } = useTransitionMotion(focused && !reducedMotion);
  const ambientActive = focused && transitionSettled && !isTransitioning;
  const crashlyticsRef = useRef<ReturnType<typeof getCrashlytics> | null>(null);
  const getCrashlyticsInstance = () => {
    if (!crashlyticsRef.current) crashlyticsRef.current = getCrashlytics(getApp());
    return crashlyticsRef.current;
  };
  const [diagnostics, setDiagnostics] = useState(() => getCrashlyticsInstance().isCrashlyticsCollectionEnabled);
  const studyProfile = useStudyProfile();
  const trackMeta = getStudyTrackMeta(studyProfile.track);
  const [trackSheetVisible, setTrackSheetVisible] = useState(false);
  const [trackSheetEverOpened, setTrackSheetEverOpened] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteModalHadGoogle, setDeleteModalHadGoogle] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteFinishedInSheet, setDeleteFinishedInSheet] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const [deleteComplete, setDeleteComplete] = useState(false);
  const [externalDeletionPending, setExternalDeletionPending] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [disconnectingGoogle, setDisconnectingGoogle] = useState(false);
  const [logoutFinishedInSheet, setLogoutFinishedInSheet] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<{ label: string; tone: 'connected' | 'disconnected' } | null>(null);
  const {
    access,
    identity,
    loading: accessLoading,
    identityTransitionBusy,
    connectGoogle,
    disconnectGoogle,
    deleteAccount,
    refresh,
  } = useCommercial();
  const googleSignInBusy = connectingGoogle || (identityTransitionBusy && !disconnectingGoogle && !deleting);
  const accountBusy = connectingGoogle || disconnectingGoogle || deleting || identityTransitionBusy;
  const deleteSheetBusy = deleting || deleteFinishedInSheet;
  const logoutSheetBusy = disconnectingGoogle || logoutFinishedInSheet;
  const hasGoogleAccount = (access?.identity ?? identity) === 'google';
  const identityPulse = useRef(new Animated.Value(1)).current;
  const previousGoogleState = useRef(hasGoogleAccount);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeDelayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingLogoutNotice = useRef(false);

  useEffect(() => {
    if (previousGoogleState.current === hasGoogleAccount) return undefined;
    previousGoogleState.current = hasGoogleAccount;
    if (hasGoogleAccount) setAccountError(null);
    if (reducedMotion) return undefined;
    identityPulse.stopAnimation();
    identityPulse.setValue(0.985);
    const anim = Animated.timing(identityPulse, {
      toValue: 1,
      duration: 240,
      easing: SILKY_EASE_OUT,
      useNativeDriver: true,
    });
    anim.start();
    return () => {
      anim.stop();
      identityPulse.stopAnimation();
    };
  }, [hasGoogleAccount, identityPulse, reducedMotion]);

  useEffect(() => () => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    if (noticeDelayTimer.current) clearTimeout(noticeDelayTimer.current);
  }, []);

  const showStatusNotice = (label: string, tone: 'connected' | 'disconnected', delayMs = 0) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    if (noticeDelayTimer.current) clearTimeout(noticeDelayTimer.current);
    const present = () => {
      setStatusNotice({ label, tone });
      noticeTimer.current = setTimeout(() => setStatusNotice(null), 2_800);
    };
    if (delayMs > 0 && !reducedMotion) {
      noticeDelayTimer.current = setTimeout(present, delayMs);
    } else {
      present();
    }
  };

  const identityAnimated = useMemo(() => ({
    transform: [{ scale: identityPulse }],
  }), [identityPulse]);

  const busyStatusLabel = disconnectingGoogle
    ? 'Deconectez contul Google…'
    : deleting
      ? 'Șterg datele…'
      : 'Conectez contul Google…';
  const showBusyPill = accountBusy && !confirmLogout && !confirmDelete && !deleteComplete;
  const deletionActionTitle = hasGoogleAccount ? 'Șterge contul și datele' : 'Șterge datele temporare';
  const deletionActionText = hasGoogleAccount
    ? 'Șterge definitiv contul Profu’ de mate, Caietul, progresul de studiu, simulările și raportările. Abonamentul Google Play se oprește separat.'
    : 'Șterge profilul temporar, Caietul, progresul de studiu, simulările și raportările. Aplicația va porni apoi cu un spațiu temporar nou.';
  const deletionConfirmTitle = deleteModalHadGoogle ? 'Ștergi contul și datele?' : 'Ștergi datele temporare?';
  const deletionConfirmText = deleteModalHadGoogle
    ? 'Contul Profu’ de mate, Caietul, lecțiile, progresul de studiu, istoricul simulărilor și raportările vor fi șterse definitiv. Aplicația va crea apoi un spațiu temporar nou, ca să poți continua fără conectare. Ștergerea nu reînnoiește problemele disponibile. Păstrăm doar contoarele tehnice minime necesare prevenirii abuzului, conform Politicii de confidențialitate. Abonamentul se oprește separat în Google Play.'
    : 'Profilul temporar, Caietul, lecțiile, progresul de studiu, istoricul simulărilor și raportările vor fi șterse definitiv. Aplicația va crea apoi un spațiu temporar nou. Ștergerea nu reînnoiește problemele disponibile; păstrăm doar contoarele tehnice minime necesare prevenirii abuzului, conform Politicii de confidențialitate.';
  const diagnosticsLocked = useRef(false);
  const connectLocked = useRef(false);
  const deletionLocked = useRef(false);
  const logoutLocked = useRef(false);
  const isInteractionLocked = () => (
    accountBusy || connectLocked.current || logoutLocked.current || deletionLocked.current
  );
  const accountLabel = access?.premium.active
    ? access.premium.tier === 'max' ? 'PROFU’ MAX' : 'PROFU’ PRO'
    : hasGoogleAccount ? 'CONT GOOGLE CONECTAT' : 'SPAȚIUL TĂU';
  const accountTitle = !access
    ? hasGoogleAccount ? 'Caietul tău, în contul tău' : 'Setările tale, într-un singur loc'
    : access.premium.active
      ? `${access.premium.tier === 'max' ? 'Profu’ Max' : 'Profu’ Pro'} și Caietul sunt pe contul tău`
      : access.identity === 'google'
        ? 'Caietul poate fi recuperat'
        : 'Caietul este legat de această instalare';
  const accountText = !access
    ? accessLoading ? 'Poți folosi setările cât timp limita de azi se actualizează în fundal.' : 'Limita de azi nu este disponibilă momentan. Verifică internetul pentru actualizare.'
    : access.identity === 'google'
      ? `Ai ${access.remaining} din ${access.limit} acțiuni AI disponibile astăzi. Contul Google păstrează Caietul și abonamentul pe toate telefoanele.`
      : `Ai ${access.remaining} din ${access.limit} acțiuni AI gratuite astăzi. Conectează-te cu Google pentru sincronizarea Caietului și pentru Pro sau Max.`;

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !accountBusy });
  }, [accountBusy, navigation]);

  useEffect(() => {
    if (!accountBusy) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    const removeUnsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (event.data.action.type !== 'RESET') {
        event.preventDefault();
      }
    });
    return () => {
      subscription.remove();
      removeUnsubscribe();
    };
  }, [accountBusy, navigation]);

  const connectAccount = async () => {
    if (isInteractionLocked()) return;
    connectLocked.current = true;
    setConnectingGoogle(true);
    setAccountError(null);
    setStatusNotice(null);
    try {
      const next = await connectGoogle();
      if (next?.identity === 'google' || isCurrentUserGoogle()) {
        Haptics.notification(Haptics.NotificationFeedbackType.Success);
        showStatusNotice('Contul Google este conectat.', 'connected', 200);
      }
    } catch (error) {
      if (isGoogleSignInCancelledError(error)) return;
      recordDiagnosticError('google_connect', error);
      setAccountError(friendlyGoogleConnectError(error));
      Haptics.notification(Haptics.NotificationFeedbackType.Error);
    } finally {
      connectLocked.current = false;
      setConnectingGoogle(false);
    }
  };

  const toggleDiagnostics = async () => {
    if (isInteractionLocked() || diagnosticsLocked.current) return;
    diagnosticsLocked.current = true;
    const next = !diagnostics;
    setDiagnostics(next);
    Haptics.selection();
    try {
      await setCrashlyticsCollectionEnabled(getCrashlyticsInstance(), next);
    } catch {
      setDiagnostics(!next);
    } finally {
      diagnosticsLocked.current = false;
    }
  };

  const deleteData = async () => {
    if (isInteractionLocked()) return;
    deletionLocked.current = true;
    setDeleting(true);
    setDeleteError(false);
    try {
      const result = await deleteAccount();
      setDeleteFinishedInSheet(true);
      setExternalDeletionPending(result.externalBillingProfilePending);
      Haptics.notification(Haptics.NotificationFeedbackType.Success);
      setConfirmDelete(false);
      setDeleteComplete(true);
    } catch (deletionError) {
      if (deletionError instanceof DataDeletionCancelledError) return;
      recordDiagnosticError('data_deletion', deletionError);
      setDeleteError(true);
      Haptics.notification(Haptics.NotificationFeedbackType.Error);
    } finally {
      deletionLocked.current = false;
      setDeleting(false);
    }
  };

  const disconnectAccount = async () => {
    if (isInteractionLocked()) return;
    logoutLocked.current = true;
    setDisconnectingGoogle(true);
    setAccountError(null);
    setStatusNotice(null);
    try {
      await disconnectGoogle();
      pendingLogoutNotice.current = true;
      setLogoutFinishedInSheet(true);
      setConfirmLogout(false);
      Haptics.notification(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      recordDiagnosticError('google_disconnect', error);
      setAccountError('Nu am putut închide sesiunea. Încearcă din nou.');
      setConfirmLogout(false);
      Haptics.notification(Haptics.NotificationFeedbackType.Error);
    } finally {
      logoutLocked.current = false;
      setDisconnectingGoogle(false);
    }
  };

  return (
    <View style={styles.safe}>
      <StatusBar style="light" />
      <ComicBackdrop />
      <SettingsCanopyHeader
        canopyTopStyle={{ paddingTop: insets.top ?? 0 }}
        contentWidth={contentWidth}
        backDisabled={accountBusy}
        onBack={() => { if (!isInteractionLocked()) navigation.goBack(); }}
      />
      <ScrollView
        scrollEnabled={!accountBusy}
        removeClippedSubviews={false}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingHorizontal: gutter, paddingBottom: Math.max(insets.bottom, 14) + 20 }]}
      >
        <View collapsable={false} style={[styles.contentInner, { maxWidth: contentWidth }]}>
          <Animated.View pointerEvents={accountBusy ? 'none' : 'auto'} style={identityAnimated}>
            <View style={styles.identityCard}>
              <View pointerEvents="none" style={styles.identityTopGloss} />
              <View pointerEvents="none" style={styles.identityCornerTint} />
              <View style={styles.identityTopRow}>
                <View style={styles.identityMascotWrap}>
                  <SpotlightAura size={76} tone={access?.premium.active ? 'lime' : 'violet'} active={ambientActive} />
                  <Mascot pose={access?.premium.active ? 'cheer' : 'wave'} size={66} active={ambientActive} interactive={!accountBusy} />
                </View>
                <View style={styles.identityCopy}>
                  <Chip
                    label={accountLabel}
                    tone={access?.premium.active ? 'lime' : hasGoogleAccount ? 'cyanSoft' : 'violetSoft'}
                    outlined={Boolean(access?.premium.active)}
                  />
                  <Text style={styles.identityTitle}>{accountTitle}</Text>
                  <Text style={styles.identityText}>{accountText}</Text>
                </View>
              </View>
              {access?.resetAt ? (
                <QuotaResetTimer
                  resetAt={access.resetAt}
                  remaining={access.remaining}
                  limit={access.limit}
                  premium={access.premium.active}
                  planName={access.premium.tier === 'max' ? 'Max' : access.premium.active ? 'Pro' : null}
                  variant="embedded"
                  active={ambientActive}
                  style={styles.identityTimer}
                />
              ) : null}
            </View>
          </Animated.View>

          <View style={styles.accountGroup}>
            {!accessLoading && !access ? (
              <PressableScale
                accessibilityRole="button"
                disabled={accountBusy}
                dimWhenDisabled={false}
                pressedScale={0.97}
                haptic="selection"
                onPress={() => { if (!isInteractionLocked()) void refresh(); }}
                contentStyle={styles.accountRetry}
              >
                <MiniGlyph name="spark" size={16} color={colors.ink} />
                <Text style={styles.accountRetryText}>Verifică din nou</Text>
              </PressableScale>
            ) : null}

            {!hasGoogleAccount && identity === 'anonymous' ? (
              <GoogleAccountButton
                busy={googleSignInBusy}
                disabled={accountBusy && !googleSignInBusy}
                note="Păstrezi Caietul în cloud și poți activa Pro sau Max"
                onPress={() => void connectAccount()}
              />
            ) : null}

            <View pointerEvents={accountBusy ? 'none' : 'auto'}>
              <View style={styles.porcelainGroup}>
                {hasGoogleAccount ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={accountBusy}
                    onPress={() => { if (isInteractionLocked()) return; Haptics.selection(); setLogoutFinishedInSheet(false); setConfirmLogout(true); }}
                    style={({ pressed }) => [styles.row, styles.rowBorder, pressed && styles.rowPressed]}
                  >
                    <View style={[styles.rowIcon, { backgroundColor: colors.cyanSoft }]}><AppIcon name="profile" size={30} /></View>
                    <View style={styles.rowCopy}>
                      <Text style={styles.rowTitle}>Deconectează contul Google</Text>
                      <Text style={styles.rowText}>Caietul rămâne în contul tău. Limita zilnică gratuită continuă pe acest telefon fără resetare.</Text>
                    </View>
                    <MiniGlyph name="next" size={17} color={colors.violetDeep} />
                  </Pressable>
                ) : null}

                <Pressable
                  accessibilityRole="button"
                  disabled={accountBusy}
                  onPress={() => { if (isInteractionLocked()) return; Haptics.selection(); beginAppTransition(); navigation.navigate('Paywall', { source: 'settings', ...(access ? { access } : {}) }); }}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                >
                  <View style={[styles.rowIcon, { backgroundColor: access?.premium.active ? colors.lime : colors.violetSoft }]}>
                    <AppIcon name="trophy" size={30} />
                  </View>
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>
                      {access?.premium.active
                        ? access.premium.tier === 'max'
                          ? 'Administrează Profu’ Max'
                          : 'Profu’ Pro · Vezi Max'
                        : 'Vezi Profu’ Pro & Max'}
                    </Text>
                    <Text style={styles.rowText}>
                      {access?.premium.active
                        ? 'Vezi limita de azi sau deschide abonamentul în Google Play.'
                        : '50 sau 150 acțiuni AI pe zi · Max include raționament extins.'}
                    </Text>
                  </View>
                  <MiniGlyph name="next" size={17} color={colors.violetDeep} />
                </Pressable>
              </View>
            </View>
          </View>

          {accountError ? (
            <Text accessibilityRole="alert" style={styles.accountError}>{accountError}</Text>
          ) : null}

          <View pointerEvents={accountBusy ? 'none' : 'auto'} style={styles.sectionBlock}>
            <SettingsSectionTitle tone={colors.violet}>Profil de studiu</SettingsSectionTitle>
            <View style={styles.porcelainGroup}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  studyProfile.hasChosenTrack
                    ? `Nivelul de studiu: ${trackMeta.label}. Apasă pentru schimbare`
                    : 'Niciun nivel ales încă. Apasă pentru a alege clasa sau examenul'
                }
                disabled={accountBusy}
                onPress={() => {
                  if (isInteractionLocked()) return;
                  Haptics.selection();
                  setTrackSheetEverOpened(true);
                  setTrackSheetVisible(true);
                }}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View
                  style={[
                    styles.rowIcon,
                    { backgroundColor: studyProfile.hasChosenTrack ? colors.violetSoft : colors.goldSoft },
                  ]}
                >
                  <AppIcon name="class" size={30} />
                </View>
                <View style={styles.rowCopy}>
                  <View style={styles.rowTitleRow}>
                    <Text style={styles.rowTitle}>
                      {studyProfile.hasChosenTrack ? trackMeta.label : 'Alege nivelul de studiu'}
                    </Text>
                    {!studyProfile.hasChosenTrack ? (
                      <View style={styles.trackUnchosenBadge}>
                        <Text style={styles.trackUnchosenBadgeText}>NEALES</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.rowText}>
                    {studyProfile.hasChosenTrack
                      ? trackMeta.description
                      : 'Niciun nivel ales încă. Personalizează formulele, testele și simulările.'}
                  </Text>
                </View>
                <MiniGlyph name="next" size={17} color={studyProfile.hasChosenTrack ? colors.violetDeep : '#8A5600'} />
              </Pressable>
            </View>
          </View>

          <View pointerEvents={accountBusy ? 'none' : 'auto'} style={styles.sectionBlock}>
            <SettingsSectionTitle tone={colors.cyan}>Confidențialitate</SettingsSectionTitle>
            <View style={styles.porcelainGroup}>
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: diagnostics, disabled: accountBusy }}
                disabled={accountBusy}
                onPress={() => void toggleDiagnostics()}
                style={({ pressed }) => [styles.row, styles.rowBorder, pressed && styles.rowPressed]}
              >
                <View style={[styles.rowIcon, { backgroundColor: colors.cyanSoft }]}><AppIcon name="settings" size={30} /></View>
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>Rapoarte tehnice opționale</Text>
                  <Text style={styles.rowText}>Ne ajută să reparăm erorile aplicației. Fotografia problemei nu este inclusă.</Text>
                </View>
                <ComicSwitch value={diagnostics} />
              </Pressable>

              <View style={styles.row}>
                <View style={[styles.rowIcon, { backgroundColor: colors.limeSoft }]}><AppIcon name="privacy" size={30} /></View>
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>Fotografiile nu intră în Caiet</Text>
                  <Text style={styles.rowText}>Sunt micșorate pe telefon și trimise securizat, fără să ajungă în Firebase Storage. Detaliile sunt explicate la „Legal și siguranță”.</Text>
                </View>
                <MiniGlyph name="check" size={17} color={colors.violetDeep} />
              </View>
            </View>
          </View>

          <View pointerEvents={accountBusy ? 'none' : 'auto'} style={styles.sectionBlock}>
            <SettingsSectionTitle tone={colors.peach}>Datele tale</SettingsSectionTitle>
            <View style={styles.porcelainGroup}>
              <View style={[styles.row, styles.rowBorder]}>
                <View style={[styles.rowIcon, { backgroundColor: colors.violetSoft }]}><AppIcon name="notebook" size={30} /></View>
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>Cât timp păstrăm datele</Text>
                  <Text style={styles.rowText}>Lecțiile nesalvate se șterg după 7 zile, iar contoarele zilnice după cel mult 35 de zile. După ștergere pot rămâne numai markerii anti-abuz minimizați, pentru perioadele explicate la „Legal și siguranță”.</Text>
                </View>
              </View>

              <Pressable
                accessibilityRole="button"
                disabled={accountBusy}
                onPress={() => { if (isInteractionLocked()) return; Haptics.selection(); setDeleteFinishedInSheet(false); setDeleteError(false); setDeleteModalHadGoogle(hasGoogleAccount); setConfirmDelete(true); }}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View style={[styles.rowIcon, styles.deleteIcon]}><MiniGlyph name="wrong" size={19} color={colors.paper} /></View>
                <View style={styles.rowCopy}>
                  <Text style={styles.deleteTitle}>{deletionActionTitle}</Text>
                  <Text style={styles.rowText}>{deletionActionText}</Text>
                </View>
                <MiniGlyph name="next" size={17} color={colors.rose} />
              </Pressable>
            </View>
          </View>

          <View pointerEvents={accountBusy ? 'none' : 'auto'} style={styles.sectionBlock}>
            <SettingsSectionTitle tone={colors.limeDeep}>Despre aplicație</SettingsSectionTitle>
            <View style={styles.porcelainGroup}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Ajutor și suport pe e-mail la ${legalDocument.supportEmail}`}
                disabled={accountBusy}
                onPress={() => {
                  if (isInteractionLocked()) return;
                  Haptics.selection();
                  void Linking.openURL(`mailto:${legalDocument.supportEmail}?subject=${encodeURIComponent('Suport Profu’ de mate')}`).catch(() => undefined);
                }}
                style={({ pressed }) => [styles.row, styles.rowBorder, pressed && styles.rowPressed]}
              >
                <View style={[styles.rowIcon, { backgroundColor: colors.limeSoft }]}><AppIcon name="help" size={30} /></View>
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>Ajutor și suport</Text>
                  <Text style={styles.rowText}>Scrie-ne la {legalDocument.supportEmail} pentru întrebări, sugestii sau probleme tehnice.</Text>
                </View>
                <MiniGlyph name="next" size={17} color={colors.violetDeep} />
              </Pressable>

              <Pressable
                accessibilityRole="button"
                disabled={accountBusy}
                onPress={() => { if (isInteractionLocked()) return; Haptics.selection(); beginAppTransition(); navigation.navigate('Legal'); }}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View style={[styles.rowIcon, { backgroundColor: colors.cyanSoft }]}><AppIcon name="privacy" size={30} /></View>
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>Legal și siguranță</Text>
                  <Text style={styles.rowText}>Confidențialitatea, folosirea inteligenței artificiale, păstrarea datelor și regulile aplicației.</Text>
                </View>
                <MiniGlyph name="next" size={17} color={colors.violetDeep} />
              </Pressable>
            </View>
          </View>

          <View style={styles.versionRow}>
            <Text style={styles.version}>{getAppVersionLabel()}</Text>
          </View>
        </View>
      </ScrollView>

      {showBusyPill ? (
        <View pointerEvents="auto" style={styles.lockOverlay}>
          <View
            accessibilityLiveRegion="polite"
            style={[styles.floatingDock, { bottom: Math.max(insets.bottom, 14) + 12 }]}
          >
            <View style={styles.busyPill}>
              <PlayfulLoader micro inverse />
              <Text style={styles.busyPillText}>{busyStatusLabel}</Text>
            </View>
          </View>
        </View>
      ) : null}

      {!showBusyPill && statusNotice ? (
        <View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={[styles.floatingDock, { bottom: Math.max(insets.bottom, 14) + 12 }]}
        >
          <View style={[styles.noticePill, statusNotice.tone === 'disconnected' && styles.noticePillCyan]}>
            <View style={styles.noticeBadge}>
              <MiniGlyph name="check" size={13} color={colors.ink} />
            </View>
            <Text style={styles.noticePillText}>{statusNotice.label}</Text>
          </View>
        </View>
      ) : null}

      <ComicSheetModal
        visible={confirmDelete}
        busy={deleteSheetBusy}
        onClose={() => setConfirmDelete(false)}
        onAfterClose={() => setDeleteFinishedInSheet(false)}
      >
        <ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          style={styles.confirmScroll}
          contentContainerStyle={[styles.confirmSheetContent, { paddingBottom: Math.max(insets.bottom, 14) + 10 }]}
        >
          <View style={styles.sheetMascotStage}>
            <SpotlightAura size={96} tone="rose" active={confirmDelete} />
            <Mascot pose="oops" size={86} active={confirmDelete} />
          </View>
          <Chip label="ACȚIUNE DEFINITIVĂ" tone="roseSoft" />
          <Text style={styles.confirmTitle}>{deletionConfirmTitle}</Text>
          <Text style={styles.confirmText}>{deletionConfirmText}</Text>
          {deleteError ? <Text accessibilityRole="alert" style={styles.confirmError}>Ștergerea nu a reușit. Verifică internetul și încearcă din nou.</Text> : null}
          <PressableScale
            accessibilityRole="button"
            disabled={deleteSheetBusy}
            pressedScale={0.97}
            haptic="medium"
            onPress={() => void deleteData()}
            style={styles.confirmActionWrap}
            contentStyle={styles.confirmDelete}
          >
            {deleteSheetBusy ? <PlayfulLoader micro inverse /> : <MiniGlyph name="wrong" size={18} color={colors.paper} />}
            <Text style={styles.confirmDeleteText}>{deleteSheetBusy ? 'Șterg datele…' : deleteModalHadGoogle ? 'Da, șterge contul' : 'Da, șterge datele'}</Text>
          </PressableScale>
          <Pressable accessibilityRole="button" disabled={deleteSheetBusy} onPress={() => setConfirmDelete(false)} style={styles.cancel}>
            <Text style={styles.cancelText}>Păstrează datele</Text>
          </Pressable>
        </ScrollView>
      </ComicSheetModal>

      <ComicSheetModal
        visible={confirmLogout}
        busy={logoutSheetBusy}
        onClose={() => setConfirmLogout(false)}
        onAfterClose={() => {
          setLogoutFinishedInSheet(false);
          if (pendingLogoutNotice.current) {
            pendingLogoutNotice.current = false;
            showStatusNotice('Te-ai deconectat din contul Google.', 'disconnected', 60);
          }
        }}
      >
        <View style={[styles.confirmSheetContent, { paddingBottom: Math.max(insets.bottom, 14) + 10 }]}>
          <View style={styles.sheetMascotStage}>
            <SpotlightAura size={96} tone="cyan" active={confirmLogout} />
            <Mascot pose="wave" size={86} active={confirmLogout} />
          </View>
          <Chip label="SCHIMBI CONTUL DE PE TELEFON" tone="cyanSoft" />
          <Text style={styles.confirmTitle}>Te deconectezi?</Text>
          <Text style={styles.confirmText}>Nu se șterge nimic și nu se resetează nicio limită. Caietul, acțiunile folosite azi și abonamentul rămân legate de contul Google și reapar când îl conectezi din nou.</Text>
          <PressableScale
            accessibilityRole="button"
            disabled={logoutSheetBusy}
            pressedScale={0.97}
            haptic="medium"
            onPress={() => void disconnectAccount()}
            style={styles.confirmActionWrap}
            contentStyle={styles.confirmLogout}
          >
            {logoutSheetBusy ? <PlayfulLoader micro /> : <MiniGlyph name="next" size={18} color={colors.ink} />}
            <Text style={styles.confirmLogoutText}>{logoutSheetBusy ? 'Deconectez…' : 'Da, deconectează-mă'}</Text>
          </PressableScale>
          <Pressable accessibilityRole="button" disabled={logoutSheetBusy} onPress={() => setConfirmLogout(false)} style={styles.cancel}>
            <Text style={styles.cancelText}>Rămân conectat</Text>
          </Pressable>
        </View>
      </ComicSheetModal>

      <ComicSheetModal
        visible={deleteComplete}
        dismissable={false}
        alertRole
        onClose={() => { setDeleteComplete(false); beginAppTransition(); navigation.popToTop(); }}
      >
        <ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          style={styles.confirmScroll}
          contentContainerStyle={[styles.confirmSheetContent, { paddingBottom: Math.max(insets.bottom, 14) + 12 }]}
        >
          <View style={styles.sheetMascotStage}>
            <SpotlightAura size={96} tone="lime" active={deleteComplete} />
            <Mascot pose="cheer" size={86} active={deleteComplete} />
          </View>
          <Chip label="ȘTERGERE ÎNCHEIATĂ" tone="lime" />
          <Text style={styles.confirmTitle}>Datele tale au fost șterse.</Text>
          <Text style={styles.confirmText}>
            {externalDeletionPending
              ? 'Datele aplicației au fost șterse. Cererea de ștergere a profilului tehnic de plăți a fost înregistrată și necesită verificarea echipei de suport.'
              : 'Contul sau profilul anterior și datele asociate au fost șterse. Aplicația pornește acum cu un spațiu temporar nou, fără legătură cu identitatea ștearsă.'}
          </Text>
          <PressableScale
            accessibilityRole="button"
            pressedScale={0.97}
            haptic="medium"
            onPress={() => { setDeleteComplete(false); beginAppTransition(); navigation.popToTop(); }}
            style={styles.confirmActionWrap}
            contentStyle={styles.successButton}
          >
            <Text style={styles.successButtonText}>Înapoi la început</Text>
            <MiniGlyph name="next" size={18} color={colors.ink} />
          </PressableScale>
        </ScrollView>
      </ComicSheetModal>

      {trackSheetEverOpened ? (
        <StudyTrackSheet
          visible={trackSheetVisible}
          selectedTrack={studyProfile.hasChosenTrack ? studyProfile.track : null}
          onSelect={(nextTrack) => {
            setStudyTrack(nextTrack);
            setTrackSheetVisible(false);
            showStatusNotice(`Nivel activ: ${getStudyTrackMeta(nextTrack).shortLabel}`, 'connected');
          }}
          onClose={() => setTrackSheetVisible(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },

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
    top: -80,
    left: -50,
    backgroundColor: 'rgba(67, 214, 230, 0.2)',
  },
  canopyGlowLime: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    bottom: -70,
    right: 24,
    backgroundColor: 'rgba(216, 255, 62, 0.14)',
  },
  canopyOrbitArc: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    top: -115,
    right: -80,
  },
  canopyStar: {
    position: 'absolute',
    right: 88,
    bottom: 12,
    fontFamily: fonts.display,
    fontSize: 13,
    color: 'rgba(216, 255, 62, 0.36)',
  },
  canopyInner: {
    maxWidth: 560,
    alignSelf: 'center',
    paddingTop: 6,
  },
  canopyRow: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  canopyActionBtn: {
    borderRadius: 21,
    borderBottomWidth: 3.5,
    borderBottomColor: '#C5B8FA',
    backgroundColor: '#FFFFFF',
  },
  canopyCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  canopyTitle: {
    fontFamily: fonts.display,
    color: colors.paper,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.3,
    textShadowColor: 'rgba(18, 6, 62, 0.28)',
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 3,
  },
  canopyEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  canopyEyebrowDot: {
    width: 6.5,
    height: 6.5,
    borderRadius: 3.5,
    backgroundColor: colors.lime,
  },
  canopyEyebrow: {
    fontFamily: fonts.bodyBold,
    color: 'rgba(242, 238, 255, 0.9)',
    fontSize: 10,
    letterSpacing: 0.9,
    includeFontPadding: false,
  },
  canopyBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderBottomWidth: 3.5,
    borderColor: colors.lime,
    borderBottomColor: '#98C40E',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  scroll: { flex: 1 },
  content: { paddingTop: 14 },
  contentInner: { width: '100%', alignSelf: 'center', gap: 13 },
  accountGroup: { gap: 12 },
  sectionBlock: { gap: 8 },
  lockOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 40 },
  floatingDock: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 45,
  },
  busyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 46,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(216, 255, 62, 0.35)',
    backgroundColor: colors.ink,
    elevation: 6,
  },
  busyPillText: { fontFamily: fonts.bodyBold, color: colors.paper, fontSize: 13.5, lineHeight: 18 },
  noticePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(86, 120, 0, 0.2)',
    backgroundColor: colors.lime,
    elevation: 5,
  },
  noticePillCyan: { backgroundColor: colors.cyanSoft, borderColor: '#B2EAF0' },
  noticeBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticePillText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 13, lineHeight: 17 },
  identityCard: {
    minHeight: 152,
    borderRadius: 28,
    borderWidth: 1.5,
    borderBottomWidth: 4,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  identityTopGloss: {
    position: 'absolute',
    top: 0,
    left: 22,
    right: 22,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  identityCornerTint: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    top: -60,
    right: -40,
    backgroundColor: 'rgba(124, 60, 255, 0.06)',
  },
  identityTopRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  identityTimer: { width: '100%' },
  identityMascotWrap: {
    width: 78,
    height: 78,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  identityCopy: { flex: 1, minWidth: 0 },
  identityTitle: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 18, lineHeight: 22, marginTop: 6 },
  identityText: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 13, lineHeight: 18.5, marginTop: 3 },
  accountError: {
    borderRadius: 18,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 87, 109, 0.3)',
    backgroundColor: colors.roseSoft,
    padding: 12,
    fontFamily: fonts.bodyBold,
    color: '#9E2135',
    fontSize: 12.5,
    lineHeight: 17,
    textAlign: 'center',
  },
  accountRetry: {
    minHeight: 46,
    borderRadius: radii.pill,
    borderWidth: 1.3,
    borderBottomWidth: 3.5,
    borderColor: '#A6E6F2',
    borderBottomColor: '#72C9DC',
    backgroundColor: colors.cyanSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  accountRetryText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 13.5 },

  sectionHeading: { minHeight: 28, marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  sectionMark: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 17.5, lineHeight: 21 },

  porcelainGroup: {
    borderRadius: 24,
    borderWidth: 1.4,
    borderBottomWidth: 3.5,
    borderColor: '#E8E0FC',
    borderBottomColor: '#D4C7F7',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  row: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(124, 60, 255, 0.07)' },
  rowPressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 },
  rowTitle: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 15, lineHeight: 19, flexShrink: 1 },
  trackUnchosenBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: '#FFF3BF',
    borderWidth: 1,
    borderColor: '#E5BE3A',
  },
  trackUnchosenBadgeText: {
    fontFamily: fonts.bodyBold,
    color: '#734A00',
    fontSize: 9.5,
    letterSpacing: 0.6,
    includeFontPadding: false,
  },
  rowText: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 13, lineHeight: 18, marginTop: 2 },

  deleteIcon: { backgroundColor: colors.rose },
  deleteTitle: { fontFamily: fonts.displaySemi, color: colors.rose, fontSize: 15, lineHeight: 19 },
  versionRow: { alignItems: 'center', paddingVertical: 12 },
  version: { fontFamily: fonts.bodyBold, color: colors.inkMuted, fontSize: 12.5 },

  confirmSheet: { paddingHorizontal: 22 },
  confirmScroll: { width: '100%' },
  confirmSheetContent: { alignItems: 'center', paddingTop: 4 },
  sheetMascotStage: { width: 106, height: 100, alignItems: 'center', justifyContent: 'center', marginBottom: 6, position: 'relative' },
  confirmTitle: { fontFamily: fonts.display, color: colors.ink, fontSize: 25, lineHeight: 29, textAlign: 'center', marginTop: 10 },
  confirmText: { maxWidth: 340, fontFamily: fonts.body, color: colors.inkSoft, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 6 },
  confirmError: { fontFamily: fonts.bodyBold, color: colors.rose, fontSize: 12.5, lineHeight: 17, textAlign: 'center', marginTop: 8 },
  confirmActionWrap: { width: '100%', marginTop: 16 },
  confirmDelete: {
    width: '100%',
    minHeight: 52,
    borderRadius: radii.pill,
    backgroundColor: colors.rose,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmDeleteText: { fontFamily: fonts.displaySemi, color: colors.paper, fontSize: 16.5 },
  confirmLogout: {
    width: '100%',
    minHeight: 52,
    borderRadius: radii.pill,
    backgroundColor: colors.cyan,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmLogoutText: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 16.5 },
  cancel: { minHeight: 46, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, marginTop: 6 },
  cancelText: { fontFamily: fonts.bodyBold, color: colors.inkSoft, fontSize: 13.5 },
  successButton: {
    width: '100%',
    minHeight: 54,
    borderRadius: radii.pill,
    backgroundColor: colors.lime,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  successButtonText: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 16.5 },
});
