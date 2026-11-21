import { getApp } from '@react-native-firebase/app';
import { getCrashlytics, setCrashlyticsCollectionEnabled } from '@react-native-firebase/crashlytics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutDown,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion';
import { useResponsiveLayout } from '../../../shared/hooks/useResponsiveLayout';
import { getAppVersionLabel } from '../../../shared/services/appInfo';
import { recordDiagnosticError } from '../../../shared/services/diagnostics';
import * as Haptics from '../../../shared/services/haptics';
import { borders, colors, fonts, shadows, springs } from '../../../shared/theme';
import type { RootStackParamList } from '../../../shared/types';
import { AppIcon } from '../../../shared/ui/AppIcon';
import { Chip } from '../../../shared/ui/Chip';
import { ComicBackdrop } from '../../../shared/ui/ComicBackdrop';
import { ComicCard } from '../../../shared/ui/ComicCard';
import { ComicSwitch } from '../../../shared/ui/ComicSwitch';
import { Mascot } from '../../../shared/ui/Mascot';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { PlayfulLoader } from '../../../shared/ui/PlayfulLoader';
import { PressableScale } from '../../../shared/ui/PressableScale';
import { ScreenHeader } from '../../../shared/ui/ScreenHeader';
import { Text } from '../../../shared/ui/Typography';
import { useCommercial } from '../../access/context/CommercialContext';
import { GoogleAccountButton } from '../components/GoogleAccountButton';
import { DataDeletionCancelledError } from '../services/dataManagement';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

function SettingsSectionTitle({ children, tone }: { children: string; tone: string }) {
  return (
    <View style={styles.sectionHeading}>
      <View style={[styles.sectionMark, { backgroundColor: tone }]} />
      <Text style={styles.sectionTitle}>{children}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

function ComicSheetModal({
  visible,
  busy = false,
  dismissable = true,
  alertRole = false,
  onClose,
  onAfterClose,
  children,
}: {
  visible: boolean;
  busy?: boolean;
  dismissable?: boolean;
  alertRole?: boolean;
  onClose?: () => void;
  onAfterClose?: () => void;
  children: ReactNode;
}) {
  const reducedMotion = useReducedMotion();
  const [present, setPresent] = useState(visible);
  const reveal = useSharedValue(visible ? 1 : 0);
  const mountedRef = useRef(visible);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onAfterCloseRef = useRef(onAfterClose);
  useEffect(() => {
    onAfterCloseRef.current = onAfterClose;
  }, [onAfterClose]);

  useEffect(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    if (visible) {
      mountedRef.current = true;
      setPresent(true);
      reveal.set(reducedMotion ? 1 : 0);
      if (!reducedMotion) {
        reveal.set(withSpring(1, springs.snappy));
      }
      return;
    }
    if (!mountedRef.current) return;
    if (reducedMotion) {
      mountedRef.current = false;
      setPresent(false);
      reveal.set(0);
      onAfterCloseRef.current?.();
      return;
    }
    reveal.set(withTiming(0, { duration: 155, easing: Easing.in(Easing.quad) }));
    closeTimer.current = setTimeout(() => {
      mountedRef.current = false;
      setPresent(false);
      onAfterCloseRef.current?.();
    }, 160);
  }, [reducedMotion, reveal, visible]);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const scrimAnimated = useAnimatedStyle(() => ({
    opacity: reveal.get(),
  }));

  const sheetAnimated = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - reveal.get()) * 360 }],
  }));

  const closingOrBusy = busy || !visible;

  return (
    <Modal
      visible={present}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={closingOrBusy ? undefined : onClose}
    >
      <View style={styles.modalLayer}>
        <Animated.View pointerEvents="none" style={[styles.scrim, scrimAnimated]} />
        {dismissable && onClose ? (
          <Pressable accessible={false} disabled={closingOrBusy} onPress={onClose} style={StyleSheet.absoluteFill} />
        ) : null}
        <Animated.View
          accessibilityViewIsModal
          accessibilityRole={alertRole ? 'alert' : undefined}
          style={[styles.confirmSheet, sheetAnimated]}
        >
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

export function SettingsScreen({ navigation }: Props) {
  const frame = useSafeAreaFrame();
  const { gutter } = useResponsiveLayout(frame);
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const crashlytics = getCrashlytics(getApp());
  const [diagnostics, setDiagnostics] = useState(crashlytics.isCrashlyticsCollectionEnabled);
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
  const [initialGoogleState] = useState(hasGoogleAccount);
  const [hasSwappedAccount, setHasSwappedAccount] = useState(false);
  const identityPulse = useSharedValue(1);
  const previousGoogleState = useRef(hasGoogleAccount);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeDelayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingLogoutNotice = useRef(false);

  useEffect(() => {
    if (previousGoogleState.current === hasGoogleAccount) return;
    previousGoogleState.current = hasGoogleAccount;
    setHasSwappedAccount(true);
    if (reducedMotion) return;
    identityPulse.set(withSequence(
      withTiming(0.985, { duration: 90, easing: Easing.out(Easing.quad) }),
      withSpring(1, springs.snappy),
    ));
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

  const identityAnimated = useAnimatedStyle(() => ({
    transform: [{ scale: identityPulse.get() }],
  }));

  const smoothLayout = reducedMotion ? undefined : LinearTransition.duration(300).easing(Easing.out(Easing.cubic));
  const animateSwap = hasSwappedAccount || hasGoogleAccount !== initialGoogleState;
  const enterAfterSwap = !reducedMotion && animateSwap ? FadeIn.duration(260).easing(Easing.out(Easing.cubic)) : undefined;
  const exitSmooth = reducedMotion ? undefined : FadeOut.duration(170);
  const busyStatusLabel = disconnectingGoogle
    ? 'Deconectez contul Google…'
    : deleting
      ? 'Șterg datele…'
      : 'Conectez contul Google…';
  const showBusyPill = accountBusy && !confirmLogout && !confirmDelete && !deleteComplete;
  const deletionActionTitle = hasGoogleAccount ? 'Șterge contul și datele' : 'Șterge datele temporare';
  const deletionActionText = hasGoogleAccount
    ? 'Șterge definitiv contul Profu’ de mate, Caietul și raportările. Abonamentul Google Play se oprește separat.'
    : 'Șterge profilul temporar, Caietul și raportările. Aplicația va porni apoi cu un spațiu temporar nou.';
  const deletionConfirmTitle = deleteModalHadGoogle ? 'Ștergi contul și datele?' : 'Ștergi datele temporare?';
  const deletionConfirmText = deleteModalHadGoogle
    ? 'Contul Profu’ de mate, Caietul, lecțiile și raportările vor fi șterse definitiv. Aplicația va crea apoi un spațiu temporar nou, ca să poți continua fără conectare. Ștergerea nu reînnoiește problemele disponibile. Păstrăm doar contoarele tehnice minime necesare prevenirii abuzului, conform Politicii de confidențialitate. Abonamentul se oprește separat în Google Play.'
    : 'Profilul temporar, Caietul, lecțiile și raportările vor fi șterse definitiv. Aplicația va crea apoi un spațiu temporar nou. Ștergerea nu reînnoiește problemele disponibile; păstrăm doar contoarele tehnice minime necesare prevenirii abuzului, conform Politicii de confidențialitate.';
  const diagnosticsLocked = useRef(false);
  const connectLocked = useRef(false);
  const deletionLocked = useRef(false);
  const logoutLocked = useRef(false);
  const isInteractionLocked = () => (
    accountBusy || connectLocked.current || logoutLocked.current || deletionLocked.current
  );
  const accountLabel = access?.premium.active ? 'PROFU’ PREMIUM' : hasGoogleAccount ? 'CONT GOOGLE CONECTAT' : 'SPAȚIUL TĂU';
  const accountTitle = !access
    ? hasGoogleAccount ? 'Caietul tău, în contul tău' : 'Setările tale, într-un singur loc'
    : access.premium.active
      ? 'Premium și Caietul sunt legate de contul tău'
      : access.identity === 'google'
        ? 'Caietul poate fi recuperat'
        : 'Caietul este legat de această instalare';
  const accountText = !access
    ? accessLoading ? 'Poți folosi setările cât timp limita de azi se actualizează în fundal.' : 'Limita de azi nu este disponibilă momentan. Verifică internetul pentru actualizare.'
    : access.identity === 'google'
      ? `Ai ${access.remaining} din ${access.limit} probleme disponibile astăzi. Contul Google păstrează Caietul și accesul Premium după reinstalare și pe alte telefoane.`
      : `Ai ${access.remaining} din ${access.limit} probleme gratuite astăzi. Conectează-te cu Google pentru a păstra Caietul în cloud și pentru a putea activa Premium.`;

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
      if (next?.identity === 'google') {
        Haptics.notification(Haptics.NotificationFeedbackType.Success);
        showStatusNotice('Contul Google este conectat.', 'connected', 200);
      }
    } catch {
      setAccountError('Conectarea nu a reușit. Verifică internetul și încearcă din nou.');
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
      await setCrashlyticsCollectionEnabled(crashlytics, next);
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
    <View style={[styles.safe, { paddingTop: insets.top ?? 0 }]}>
      <StatusBar style="dark" />
      <ComicBackdrop />
      <ScreenHeader
        title="Setări"
        eyebrow="APLICAȚIA TA"
        backDisabled={accountBusy}
        onBack={() => { if (!isInteractionLocked()) navigation.goBack(); }}
        rightIcon="settings"
      />
      <ScrollView
        scrollEnabled={!accountBusy}
        removeClippedSubviews={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingHorizontal: gutter, paddingBottom: Math.max(insets.bottom, 14) + 18 }]}
      >
        <View collapsable={false} style={styles.contentInner}>
        <Animated.View pointerEvents={accountBusy ? 'none' : 'auto'} layout={smoothLayout} style={identityAnimated}>
          <ComicCard tone="paper" depth={5} radius={24} shine contentStyle={styles.identity}>
            <View style={styles.identityMascotWrap}>
              <Mascot pose={access?.premium.active ? 'cheer' : 'wave'} size={66} active interactive={!accountBusy} />
            </View>
            <Animated.View
              key={`${hasGoogleAccount ? 'google' : 'guest'}-${access?.premium.active ? 'premium' : 'free'}`}
              entering={enterAfterSwap}
              style={styles.identityCopy}
            >
              <Chip
                label={accountLabel}
                tone={access?.premium.active ? 'lime' : hasGoogleAccount ? 'cyanSoft' : 'violetSoft'}
                outlined={Boolean(access?.premium.active)}
              />
              <Text style={styles.identityTitle}>{accountTitle}</Text>
              <Text style={styles.identityText}>{accountText}</Text>
            </Animated.View>
          </ComicCard>
        </Animated.View>

        <Animated.View layout={smoothLayout} style={styles.accountGroup}>
          {!accessLoading && !access ? (
            <Animated.View entering={enterAfterSwap} exiting={exitSmooth} layout={smoothLayout}>
              <PressableScale
                accessibilityRole="button"
                disabled={accountBusy}
                dimWhenDisabled={false}
                depth={shadows.sm}
                radius={16}
                shadowColor={colors.ink}
                haptic="selection"
                onPress={() => { if (!isInteractionLocked()) void refresh(); }}
                contentStyle={styles.accountRetry}
              >
                <MiniGlyph name="spark" size={17} color={colors.ink} />
                <Text style={styles.accountRetryText}>Verifică din nou</Text>
              </PressableScale>
            </Animated.View>
          ) : null}

          {!hasGoogleAccount && identity === 'anonymous' ? (
            <Animated.View entering={enterAfterSwap} exiting={exitSmooth} layout={smoothLayout}>
              <GoogleAccountButton
                busy={googleSignInBusy}
                disabled={accountBusy && !googleSignInBusy}
                note="Păstrezi Caietul în cloud și poți activa Premium"
                onPress={() => void connectAccount()}
                style={styles.settingsGoogleButton}
              />
            </Animated.View>
          ) : null}

          <Animated.View pointerEvents={accountBusy ? 'none' : 'auto'} layout={smoothLayout}>
            <ComicCard tone="paper" depth={4} radius={22} contentStyle={styles.cardList}>
              {hasGoogleAccount ? (
                <Animated.View entering={enterAfterSwap} exiting={exitSmooth} layout={smoothLayout}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={accountBusy}
                    onPress={() => { if (isInteractionLocked()) return; Haptics.selection(); setLogoutFinishedInSheet(false); setConfirmLogout(true); }}
                    style={({ pressed }) => [styles.row, styles.rowBorder, pressed && styles.rowPressed]}
                  >
                    <View style={[styles.rowIcon, { backgroundColor: colors.cyanSoft }]}><AppIcon name="profile" size={34} /></View>
                    <View style={styles.rowCopy}>
                      <Text style={styles.rowTitle}>Deconectează contul Google</Text>
                      <Text style={styles.rowText}>Caietul rămâne în contul tău. Limita zilnică gratuită continuă pe acest telefon fără resetare.</Text>
                    </View>
                    <MiniGlyph name="next" size={18} color={colors.violetDeep} />
                  </Pressable>
                </Animated.View>
              ) : null}

              <Animated.View layout={smoothLayout}>
                <Pressable
                  accessibilityRole="button"
                  disabled={accountBusy}
                  onPress={() => { if (isInteractionLocked()) return; Haptics.selection(); navigation.navigate('Paywall', { source: 'settings', ...(access ? { access } : {}) }); }}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                >
                  <View style={[styles.rowIcon, { backgroundColor: access?.premium.active ? colors.lime : colors.violetSoft }]}>
                    <AppIcon name="trophy" size={34} />
                  </View>
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>{access?.premium.active ? 'Administrează Premium' : 'Vezi Profu’ Premium'}</Text>
                    <Text style={styles.rowText}>
                      {access?.premium.active
                        ? 'Vezi limita de azi sau deschide abonamentul în Google Play.'
                        : 'O limită zilnică mai mare, fără reclame și fără pachete de credite.'}
                    </Text>
                  </View>
                  <MiniGlyph name="next" size={18} color={colors.violetDeep} />
                </Pressable>
              </Animated.View>
            </ComicCard>
          </Animated.View>
        </Animated.View>

        {accountError ? (
          <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(180)} exiting={exitSmooth} layout={smoothLayout}>
            <Text accessibilityRole="alert" style={styles.accountError}>{accountError}</Text>
          </Animated.View>
        ) : null}

        <Animated.View pointerEvents={accountBusy ? 'none' : 'auto'} layout={smoothLayout} style={styles.sectionBlock}>
          <SettingsSectionTitle tone={colors.cyan}>Confidențialitate</SettingsSectionTitle>
          <ComicCard tone="paper" depth={4} radius={22} contentStyle={styles.cardList}>
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: diagnostics, disabled: accountBusy }}
              disabled={accountBusy}
              onPress={() => void toggleDiagnostics()}
              style={({ pressed }) => [styles.row, styles.rowBorder, pressed && styles.rowPressed]}
            >
              <View style={[styles.rowIcon, { backgroundColor: colors.cyanSoft }]}><AppIcon name="settings" size={34} /></View>
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>Rapoarte tehnice opționale</Text>
                <Text style={styles.rowText}>Ne ajută să reparăm erorile aplicației. Fotografia problemei nu este inclusă.</Text>
              </View>
              <ComicSwitch value={diagnostics} />
            </Pressable>

            <View style={styles.row}>
              <View style={[styles.rowIcon, { backgroundColor: colors.limeSoft }]}><AppIcon name="privacy" size={34} /></View>
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>Fotografiile nu intră în Caiet</Text>
                <Text style={styles.rowText}>Sunt micșorate pe telefon și trimise securizat, fără să ajungă în Firebase Storage. Detaliile sunt explicate la „Legal și siguranță”.</Text>
              </View>
              <MiniGlyph name="check" size={18} color={colors.violetDeep} />
            </View>
          </ComicCard>
        </Animated.View>

        <Animated.View pointerEvents={accountBusy ? 'none' : 'auto'} layout={smoothLayout} style={styles.sectionBlock}>
          <SettingsSectionTitle tone={colors.peach}>Datele tale</SettingsSectionTitle>
          <ComicCard tone="paper" depth={4} radius={22} contentStyle={styles.cardList}>
            <View style={[styles.row, styles.rowBorder]}>
              <View style={[styles.rowIcon, { backgroundColor: colors.violetSoft }]}><AppIcon name="notebook" size={34} /></View>
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
              <View style={[styles.rowIcon, styles.deleteIcon]}><MiniGlyph name="wrong" size={20} color={colors.paper} /></View>
              <View style={styles.rowCopy}>
                <Text style={styles.deleteTitle}>{deletionActionTitle}</Text>
                <Text style={styles.rowText}>{deletionActionText}</Text>
              </View>
              <MiniGlyph name="next" size={18} color={colors.rose} />
            </Pressable>
          </ComicCard>
        </Animated.View>

        <Animated.View pointerEvents={accountBusy ? 'none' : 'auto'} layout={smoothLayout} style={styles.sectionBlock}>
          <SettingsSectionTitle tone={colors.lime}>Despre aplicație</SettingsSectionTitle>
          <ComicCard tone="paper" depth={4} radius={22} contentStyle={styles.cardList}>
            <Pressable
              accessibilityRole="button"
              disabled={accountBusy}
              onPress={() => { if (isInteractionLocked()) return; Haptics.selection(); navigation.navigate('Legal'); }}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={[styles.rowIcon, { backgroundColor: colors.cyanSoft }]}><AppIcon name="help" size={34} /></View>
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>Legal și siguranță</Text>
                <Text style={styles.rowText}>Confidențialitatea, folosirea inteligenței artificiale, păstrarea datelor și regulile aplicației.</Text>
              </View>
              <MiniGlyph name="next" size={18} color={colors.violetDeep} />
            </Pressable>
          </ComicCard>
        </Animated.View>

        <Animated.View layout={smoothLayout} style={styles.versionRow}>
          <Text style={styles.version}>{getAppVersionLabel()}</Text>
        </Animated.View>
        </View>
      </ScrollView>

      {showBusyPill ? (
        <View pointerEvents="auto" style={styles.lockOverlay}>
          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.duration(200).easing(Easing.out(Easing.cubic))}
            exiting={reducedMotion ? undefined : FadeOutDown.duration(150)}
            accessibilityLiveRegion="polite"
            style={[styles.floatingDock, { bottom: Math.max(insets.bottom, 14) + 12 }]}
          >
            <View style={styles.busyPill}>
              <PlayfulLoader micro inverse />
              <Text style={styles.busyPillText}>{busyStatusLabel}</Text>
            </View>
          </Animated.View>
        </View>
      ) : null}

      {!showBusyPill && statusNotice ? (
        <Animated.View
          pointerEvents="none"
          entering={reducedMotion ? undefined : FadeInDown.duration(220).easing(Easing.out(Easing.cubic))}
          exiting={reducedMotion ? undefined : FadeOutDown.duration(180)}
          accessibilityLiveRegion="polite"
          style={[styles.floatingDock, { bottom: Math.max(insets.bottom, 14) + 12 }]}
        >
          <View style={[styles.noticePill, statusNotice.tone === 'disconnected' && styles.noticePillCyan]}>
            <View style={styles.noticeBadge}>
              <MiniGlyph name="check" size={13} color={colors.ink} />
            </View>
            <Text style={styles.noticePillText}>{statusNotice.label}</Text>
          </View>
        </Animated.View>
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
          <View style={styles.sheetHandle} />
          <View style={styles.sheetMascotStage}>
            <View style={[styles.sheetMascotHalo, styles.sheetMascotHaloDanger]} />
            <Mascot pose="oops" size={88} active />
          </View>
          <Chip label="ACȚIUNE DEFINITIVĂ" tone="roseSoft" tilt={-2} />
          <Text style={styles.confirmTitle}>{deletionConfirmTitle}</Text>
          <Text style={styles.confirmText}>{deletionConfirmText}</Text>
          {deleteError ? <Text accessibilityRole="alert" style={styles.confirmError}>Ștergerea nu a reușit. Verifică internetul și încearcă din nou.</Text> : null}
          <PressableScale
            accessibilityRole="button"
            disabled={deleteSheetBusy}
            depth={shadows.sm}
            radius={17}
            shadowColor={colors.ink}
            haptic="medium"
            onPress={() => void deleteData()}
            style={styles.confirmActionWrap}
            contentStyle={styles.confirmDelete}
          >
            <View pointerEvents="none" style={styles.sheetBtnShine} />
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
          <View style={styles.sheetHandle} />
          <View style={styles.sheetMascotStage}>
            <View style={[styles.sheetMascotHalo, styles.sheetMascotHaloCyan]} />
            <Mascot pose="wave" size={88} active />
          </View>
          <Chip label="SCHIMBI CONTUL DE PE TELEFON" tone="cyanSoft" tilt={-1.5} />
          <Text style={styles.confirmTitle}>Te deconectezi?</Text>
          <Text style={styles.confirmText}>Nu se șterge nimic și nu se resetează nicio limită. Caietul, problemele folosite azi și Premium rămân legate de contul Google și reapar când îl conectezi din nou.</Text>
          <PressableScale
            accessibilityRole="button"
            disabled={logoutSheetBusy}
            depth={shadows.sm}
            radius={17}
            shadowColor={colors.ink}
            haptic="medium"
            onPress={() => void disconnectAccount()}
            style={styles.confirmActionWrap}
            contentStyle={styles.confirmLogout}
          >
            <View pointerEvents="none" style={styles.sheetBtnShine} />
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
        onClose={() => { setDeleteComplete(false); navigation.popToTop(); }}
      >
        <ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          style={styles.confirmScroll}
          contentContainerStyle={[styles.confirmSheetContent, { paddingBottom: Math.max(insets.bottom, 14) + 12 }]}
        >
          <View style={styles.sheetHandle} />
          <View style={styles.sheetMascotStage}>
            <View style={[styles.sheetMascotHalo, styles.sheetMascotHaloLime]} />
            <Mascot pose="cheer" size={88} active />
          </View>
          <Chip label="ȘTERGERE ÎNCHEIATĂ" tone="lime" tilt={-2} />
          <Text style={styles.confirmTitle}>Datele tale au fost șterse.</Text>
          <Text style={styles.confirmText}>
            {externalDeletionPending
              ? 'Datele aplicației au fost șterse. Cererea de ștergere a profilului tehnic de plăți a fost înregistrată și necesită verificarea echipei de suport.'
              : 'Contul sau profilul anterior și datele asociate au fost șterse. Aplicația pornește acum cu un spațiu temporar nou, fără legătură cu identitatea ștearsă.'}
          </Text>
          <PressableScale
            accessibilityRole="button"
            depth={shadows.sm}
            radius={17}
            shadowColor={colors.ink}
            haptic="medium"
            onPress={() => { setDeleteComplete(false); navigation.popToTop(); }}
            style={styles.confirmActionWrap}
            contentStyle={styles.successButton}
          >
            <View pointerEvents="none" style={styles.sheetBtnShine} />
            <Text style={styles.successButtonText}>Înapoi la început</Text>
            <MiniGlyph name="next" size={19} color={colors.ink} />
          </PressableScale>
        </ScrollView>
      </ComicSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingTop: 4 },
  contentInner: { gap: 12 },
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
    borderRadius: 999,
    borderWidth: borders.regular,
    borderColor: colors.lime,
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
    borderRadius: 999,
    borderWidth: borders.regular,
    borderColor: colors.ink,
    backgroundColor: colors.lime,
    elevation: 5,
  },
  noticePillCyan: { backgroundColor: colors.cyanSoft },
  noticeBadge: {
    width: 22,
    height: 22,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticePillText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 13, lineHeight: 17 },
  identity: { minHeight: 156, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  identityMascotWrap: {
    width: 68,
    height: 68,
    borderRadius: 20,
    borderWidth: borders.thin,
    borderColor: colors.ink,
    backgroundColor: colors.limeSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityCopy: { flex: 1, minWidth: 0 },
  identityTitle: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 18, lineHeight: 22, marginTop: 6 },
  identityText: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 13, lineHeight: 18.5, marginTop: 3 },
  settingsGoogleButton: {},
  accountError: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.rose,
    backgroundColor: colors.roseSoft,
    padding: 11,
    fontFamily: fonts.bodyBold,
    color: '#9E2135',
    fontSize: 12.5,
    lineHeight: 17,
    textAlign: 'center',
  },
  accountRetry: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: borders.thin,
    borderColor: colors.ink,
    backgroundColor: colors.cyanSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  accountRetryText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 13.5 },

  sectionHeading: { minHeight: 32, marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionMark: { width: 14, height: 14, borderRadius: 5, borderWidth: 1.5, borderColor: colors.ink, transform: [{ rotate: '-5deg' }] },
  sectionTitle: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 19, lineHeight: 22 },
  sectionLine: { flex: 1, height: 1.5, backgroundColor: colors.line },

  cardList: { paddingHorizontal: 13, paddingVertical: 4 },
  row: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11 },
  rowBorder: { borderBottomWidth: 1.5, borderBottomColor: '#EFEAF8' },
  rowPressed: { opacity: 0.72 },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: borders.thin,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-2deg' }],
  },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 15, lineHeight: 19 },
  rowText: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 13, lineHeight: 18, marginTop: 2 },

  deleteIcon: { backgroundColor: colors.rose },
  deleteTitle: { fontFamily: fonts.displaySemi, color: colors.rose, fontSize: 15, lineHeight: 19 },
  versionRow: { alignItems: 'center', paddingVertical: 12 },
  version: { fontFamily: fonts.bodyBold, color: colors.inkSoft, fontSize: 12.5 },

  modalLayer: { flex: 1, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(16, 12, 38, 0.68)' },
  confirmSheet: {
    width: '100%',
    maxWidth: 640,
    maxHeight: '92%',
    alignSelf: 'center',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: borders.thick,
    borderBottomWidth: 0,
    borderColor: colors.ink,
    backgroundColor: colors.canvas,
    paddingHorizontal: 22,
  },
  sheetHandle: { width: 46, height: 5, borderRadius: 3, backgroundColor: colors.line, marginBottom: 12 },
  confirmScroll: { width: '100%' },
  confirmSheetContent: { alignItems: 'center', paddingTop: 12 },
  sheetMascotStage: { width: 102, height: 96, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  sheetMascotHalo: {
    position: 'absolute',
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  sheetMascotHaloDanger: { backgroundColor: colors.roseSoft, borderColor: colors.rose },
  sheetMascotHaloCyan: { backgroundColor: colors.cyanSoft, borderColor: colors.cyan },
  sheetMascotHaloLime: { backgroundColor: colors.limeSoft, borderColor: colors.mint },
  confirmTitle: { fontFamily: fonts.display, color: colors.ink, fontSize: 25, lineHeight: 29, textAlign: 'center', marginTop: 10 },
  confirmText: { maxWidth: 340, fontFamily: fonts.body, color: colors.inkSoft, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 6 },
  confirmError: { fontFamily: fonts.bodyBold, color: colors.rose, fontSize: 12.5, lineHeight: 17, textAlign: 'center', marginTop: 8 },
  confirmActionWrap: { width: '100%', marginTop: 16 },
  sheetBtnShine: {
    position: 'absolute',
    top: 3,
    left: 12,
    right: 12,
    height: 5,
    borderRadius: 4,
    backgroundColor: colors.shine,
  },
  confirmDelete: {
    width: '100%',
    minHeight: 52,
    borderRadius: 17,
    borderWidth: borders.regular,
    borderColor: colors.ink,
    backgroundColor: colors.rose,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  confirmDeleteText: { fontFamily: fonts.displaySemi, color: colors.paper, fontSize: 16.5 },
  confirmLogout: {
    width: '100%',
    minHeight: 52,
    borderRadius: 17,
    borderWidth: borders.regular,
    borderColor: colors.ink,
    backgroundColor: colors.cyan,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  confirmLogoutText: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 16.5 },
  cancel: { minHeight: 46, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, marginTop: 6 },
  cancelText: { fontFamily: fonts.bodyBold, color: colors.inkSoft, fontSize: 13.5 },
  successButton: {
    width: '100%',
    minHeight: 54,
    borderRadius: 17,
    borderWidth: borders.regular,
    borderColor: colors.ink,
    backgroundColor: colors.lime,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  successButtonText: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 16.5 },
});
