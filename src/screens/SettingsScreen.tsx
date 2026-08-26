import { getApp } from '@react-native-firebase/app';
import { getCrashlytics, setCrashlyticsCollectionEnabled } from '@react-native-firebase/crashlytics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '../components/AppIcon';
import { ComicBackdrop } from '../components/ComicBackdrop';
import { GoogleAccountButton } from '../components/GoogleAccountButton';
import { MiniGlyph } from '../components/MiniGlyph';
import { PlayfulLoader } from '../components/PlayfulLoader';
import { ScreenHeader } from '../components/ScreenHeader';
import { Text } from '../components/Typography';
import { useCommercial } from '../context/CommercialContext';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { getAppVersionLabel } from '../services/appInfo';
import { DataDeletionCancelledError, deleteAllUserData } from '../services/dataManagement';
import { recordDiagnosticError } from '../services/diagnostics';
import { colors, fonts } from '../theme';
import type { RootStackParamList } from '../types';

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

export function SettingsScreen({ navigation }: Props) {
  const { gutter } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const crashlytics = getCrashlytics(getApp());
  const [diagnostics, setDiagnostics] = useState(crashlytics.isCrashlyticsCollectionEnabled);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const [deleteComplete, setDeleteComplete] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [disconnectingGoogle, setDisconnectingGoogle] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const { access, loading: accessLoading, connectGoogle, disconnectGoogle, refresh } = useCommercial();
  const freeDailyLimit = access?.allowances.freeDaily ?? 5;
  const diagnosticsLocked = useRef(false);
  const deletionLocked = useRef(false);
  const accountLabel = access?.premium.active ? 'PROFU’ PREMIUM' : access?.identity === 'google' ? 'CONT GOOGLE CONECTAT' : 'CONT TEMPORAR';
  const accountTitle = access?.premium.active
    ? 'Premium și Caietul sunt legate de contul tău'
    : access?.identity === 'google'
      ? 'Caietul poate fi recuperat'
      : access?.reason === 'account_required'
        ? 'Reconectează-te pentru limita zilnică'
      : 'Caietul este legat de această instalare';
  const accountText = access?.identity === 'google'
    ? `Ai ${access.remaining} din ${access.limit} probleme disponibile astăzi. Contul Google păstrează accesul după reinstalare și pe celelalte telefoane ale tale.`
    : access?.reason === 'account_required'
      ? `Problemele de bun-venit ale acestei instalări nu se reactivează prin deconectare. Reconectează-te pentru cele ${freeDailyLimit} probleme gratuite zilnic și pentru Caietul tău.`
      : `Poți folosi problemele de bun-venit fără să te conectezi. Pentru a recupera Caietul după reinstalare și pentru ${freeDailyLimit} probleme gratuite zilnic, conectează-te cu Google.`;

  const connectAccount = async () => {
    if (connectingGoogle) return;
    setConnectingGoogle(true);
    setAccountError(null);
    try {
      await connectGoogle();
    } catch {
      setAccountError('Conectarea nu a reușit. Verifică internetul și încearcă din nou.');
    } finally {
      setConnectingGoogle(false);
    }
  };

  const toggleDiagnostics = async () => {
    if (diagnosticsLocked.current) return;
    diagnosticsLocked.current = true;
    const next = !diagnostics;
    setDiagnostics(next);
    await Haptics.selectionAsync();
    try {
      await setCrashlyticsCollectionEnabled(crashlytics, next);
    } catch {
      setDiagnostics(!next);
    } finally {
      diagnosticsLocked.current = false;
    }
  };

  const deleteData = async () => {
    if (deletionLocked.current) return;
    deletionLocked.current = true;
    setDeleting(true);
    setDeleteError(false);
    try {
      await deleteAllUserData();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setConfirmDelete(false);
      setDeleteComplete(true);
      await refresh();
    } catch (deletionError) {
      if (deletionError instanceof DataDeletionCancelledError) return;
      recordDiagnosticError('data_deletion', deletionError);
      setDeleteError(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      deletionLocked.current = false;
      setDeleting(false);
    }
  };

  const disconnectAccount = async () => {
    if (disconnectingGoogle) return;
    setDisconnectingGoogle(true);
    setAccountError(null);
    try {
      await disconnectGoogle();
      setConfirmLogout(false);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      recordDiagnosticError('google_disconnect', error);
      setAccountError('Deconectarea nu a reușit. Verifică internetul și încearcă din nou.');
      setConfirmLogout(false);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setDisconnectingGoogle(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      <ComicBackdrop />
      <ScreenHeader title="Setări" eyebrow="APLICAȚIA TA" onBack={() => navigation.goBack()} rightIcon="settings" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingHorizontal: gutter, paddingBottom: Math.max(insets.bottom, 14) + 18 }]}>
        <View style={styles.identity}>
          <View style={styles.identityIcon}><AppIcon name="privacy" size={54} /></View>
          {accessLoading && !access
            ? <PlayfulLoader compact label="Verific spațiul tău" style={styles.identityLoader} />
            : <View style={styles.identityCopy}>
                <Text style={styles.identityLabel}>{accountLabel}</Text>
                <Text style={styles.identityTitle}>{accountTitle}</Text>
                <Text style={styles.identityText}>{accountText}</Text>
              </View>}
        </View>

        {!accessLoading && access?.identity !== 'google' ? (
          <GoogleAccountButton
            busy={connectingGoogle}
            note={`Păstrezi Caietul și primești ${freeDailyLimit} probleme gratuite zilnic`}
            onPress={() => void connectAccount()}
            style={styles.settingsGoogleButton}
          />
        ) : null}
        {!accessLoading && access?.identity === 'google' ? (
          <Pressable accessibilityRole="button" onPress={() => setConfirmLogout(true)} style={styles.accountAction}>
            <View style={[styles.rowIcon, { backgroundColor: colors.cyan }]}><AppIcon name="profile" size={36} /></View>
            <View style={styles.rowCopy}><Text style={styles.rowTitle}>Deconectează contul Google</Text><Text style={styles.rowText}>Caietul și limita de azi rămân în cont. Spațiul guest nu primește un nou pachet de bun-venit.</Text></View>
            <MiniGlyph name="next" size={18} color={colors.violetDeep} />
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Paywall', { source: 'settings', ...(access ? { access } : {}) })} style={styles.accountAction}>
          <View style={[styles.rowIcon, { backgroundColor: access?.premium.active ? colors.lime : colors.violetSoft }]}><AppIcon name="trophy" size={36} /></View>
          <View style={styles.rowCopy}><Text style={styles.rowTitle}>{access?.premium.active ? 'Administrează Premium' : 'Vezi Profu’ Premium'}</Text><Text style={styles.rowText}>{access?.premium.active ? 'Vezi limita de azi sau deschide abonamentul în Google Play.' : 'O limită zilnică mai mare, fără reclame și fără pachete de credite.'}</Text></View>
          <MiniGlyph name="next" size={18} color={colors.violetDeep} />
        </Pressable>
        {accountError ? <Text accessibilityRole="alert" style={styles.accountError}>{accountError}</Text> : null}

        <SettingsSectionTitle tone={colors.cyan}>Confidențialitate</SettingsSectionTitle>
        <View style={styles.list}>
          <Pressable accessibilityRole="switch" accessibilityState={{ checked: diagnostics }} onPress={() => void toggleDiagnostics()} style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: colors.cyan }]}><AppIcon name="settings" size={36} /></View>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>Rapoarte tehnice opționale</Text>
              <Text style={styles.rowText}>Ne ajută să reparăm erorile aplicației. Fotografia problemei nu este inclusă.</Text>
            </View>
            <View style={[styles.toggle, diagnostics && styles.toggleActive]}><View style={[styles.toggleKnob, diagnostics && styles.toggleKnobActive]} /></View>
          </Pressable>
          <View style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: colors.lime }]}><AppIcon name="privacy" size={36} /></View>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>Fotografiile nu intră în Caiet</Text>
              <Text style={styles.rowText}>Sunt micșorate pe telefon și trimise securizat, fără să ajungă în Firebase Storage. Detaliile sunt explicate la „Legal și siguranță”.</Text>
            </View>
            <MiniGlyph name="check" size={18} color={colors.violetDeep} />
          </View>
        </View>

        <SettingsSectionTitle tone={colors.peach}>Datele tale</SettingsSectionTitle>
        <View style={styles.list}>
          <View style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: colors.violetSoft }]}><AppIcon name="notebook" size={36} /></View>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>Cât timp păstrăm datele</Text>
              <Text style={styles.rowText}>Lecțiile nesalvate se șterg după 7 zile, iar contoarele zilnice după cel mult 35 de zile. După ștergerea contului, numai cota opacă a zilei poate rămâne până după următoarea resetare, pentru prevenirea abuzului.</Text>
            </View>
          </View>
          <Pressable accessibilityRole="button" onPress={() => { setDeleteError(false); setConfirmDelete(true); }} style={styles.deleteRow}>
            <View style={[styles.rowIcon, styles.deleteIcon]}><MiniGlyph name="wrong" size={20} color={colors.paper} /></View>
            <View style={styles.rowCopy}>
              <Text style={styles.deleteTitle}>Șterge toate datele</Text>
              <Text style={styles.rowText}>Șterge contul, Caietul și raportările. Marcajul opac al cotei de azi poate rămâne temporar pentru a împiedica resetarea artificială. Abonamentul Play se oprește separat.</Text>
            </View>
            <MiniGlyph name="next" size={18} color={colors.rose} />
          </Pressable>
        </View>

        <SettingsSectionTitle tone={colors.lime}>Despre aplicație</SettingsSectionTitle>
        <View style={styles.list}>
          <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Legal')} style={styles.deleteRow}>
            <View style={[styles.rowIcon, { backgroundColor: colors.cyan }]}><AppIcon name="help" size={36} /></View>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>Legal și siguranță</Text>
              <Text style={styles.rowText}>Confidențialitatea, folosirea inteligenței artificiale, păstrarea datelor și regulile aplicației.</Text>
            </View>
            <MiniGlyph name="next" size={18} color={colors.violetDeep} />
          </Pressable>
        </View>

        <View style={styles.versionRow}><Text style={styles.version}>{getAppVersionLabel()}</Text></View>
      </ScrollView>

      <Modal visible={confirmDelete} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={deleting ? undefined : () => setConfirmDelete(false)}>
        <SafeAreaView style={styles.modalLayer} edges={[]}>
          <Pressable accessible={false} disabled={deleting} onPress={() => setConfirmDelete(false)} style={styles.scrim} />
          <View accessibilityViewIsModal style={styles.confirmSheet}>
            <ScrollView
              bounces={false}
              showsVerticalScrollIndicator={false}
              style={styles.confirmScroll}
              contentContainerStyle={[styles.confirmSheetContent, { paddingBottom: Math.max(insets.bottom, 14) + 10 }]}
            >
              <View style={styles.confirmIcon}><MiniGlyph name="wrong" size={28} color={colors.paper} /></View>
              <Text style={styles.confirmEyebrow}>ACȚIUNE DEFINITIVĂ</Text>
              <Text style={styles.confirmTitle}>Ștergi toate datele?</Text>
              <Text style={styles.confirmText}>Caietul, lecțiile, raportările și contul aplicației vor fi șterse definitiv. Pentru a împiedica resetarea artificială a accesului gratuit, numărul problemelor folosite azi poate rămâne temporar sub un cod opac, fără e-mail sau UID. Un abonament activ se oprește separat în Google Play.</Text>
              {deleteError ? <Text accessibilityRole="alert" style={styles.confirmError}>Ștergerea nu a reușit. Verifică internetul și încearcă din nou.</Text> : null}
              <Pressable accessibilityRole="button" disabled={deleting} onPress={() => void deleteData()} style={styles.confirmDelete}>
                {deleting ? <PlayfulLoader micro inverse /> : <MiniGlyph name="wrong" size={18} color={colors.paper} />}
                <Text style={styles.confirmDeleteText}>{deleting ? 'Șterg datele…' : 'Da, șterge definitiv'}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={deleting} onPress={() => setConfirmDelete(false)} style={styles.cancel}><Text style={styles.cancelText}>Păstrează datele</Text></Pressable>
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>

      <Modal visible={confirmLogout} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={disconnectingGoogle ? undefined : () => setConfirmLogout(false)}>
        <SafeAreaView style={styles.modalLayer} edges={[]}>
          <Pressable accessible={false} disabled={disconnectingGoogle} onPress={() => setConfirmLogout(false)} style={styles.scrim} />
          <View accessibilityViewIsModal style={styles.confirmSheet}>
            <View style={[styles.confirmSheetContent, { paddingBottom: Math.max(insets.bottom, 14) + 10 }]}>
              <View style={styles.logoutIcon}><AppIcon name="profile" size={44} /></View>
              <Text style={styles.logoutEyebrow}>SCHIMBI CONTUL DE PE TELEFON</Text>
              <Text style={styles.confirmTitle}>Te deconectezi?</Text>
              <Text style={styles.confirmText}>Nu se șterge nimic și nu se resetează nicio limită. Caietul, problemele folosite azi și Premium rămân legate de contul Google și reapar când îl conectezi din nou.</Text>
              <Pressable accessibilityRole="button" disabled={disconnectingGoogle} onPress={() => void disconnectAccount()} style={styles.confirmLogout}>
                {disconnectingGoogle ? <PlayfulLoader micro /> : <MiniGlyph name="next" size={18} color={colors.ink} />}
                <Text style={styles.confirmLogoutText}>{disconnectingGoogle ? 'Deconectez…' : 'Da, deconectează-mă'}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={disconnectingGoogle} onPress={() => setConfirmLogout(false)} style={styles.cancel}><Text style={styles.cancelText}>Rămân conectat</Text></Pressable>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      <Modal visible={deleteComplete} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={() => { setDeleteComplete(false); navigation.popToTop(); }}>
        <SafeAreaView style={styles.modalLayer} edges={[]}>
          <View style={styles.scrim} />
          <View accessibilityViewIsModal accessibilityRole="alert" style={styles.confirmSheet}>
            <ScrollView
              bounces={false}
              showsVerticalScrollIndicator={false}
              style={styles.confirmScroll}
              contentContainerStyle={[styles.confirmSheetContent, { paddingBottom: Math.max(insets.bottom, 14) + 12 }]}
            >
              <View style={styles.successIcon}><MiniGlyph name="check" size={29} color={colors.ink} /></View>
              <Text style={styles.successEyebrow}>ȘTERGERE ÎNCHEIATĂ</Text>
              <Text style={styles.confirmTitle}>Datele tale au fost șterse.</Text>
              <Text style={styles.confirmText}>Caietul, lecțiile, raportările și contul aplicației au fost șterse. Ai acum un spațiu nou și gol, gata să începi din nou.</Text>
              <Pressable accessibilityRole="button" onPress={() => { setDeleteComplete(false); navigation.popToTop(); }} style={styles.successButton}>
                <Text style={styles.successButtonText}>Înapoi la început</Text>
                <MiniGlyph name="next" size={19} color={colors.ink} />
              </Pressable>
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { gap: 10 },
  identity: { minHeight: 118, borderWidth: 2.5, borderColor: colors.ink, borderRadius: 24, backgroundColor: colors.paper, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, shadowColor: colors.ink, shadowOpacity: 0.18, shadowRadius: 0, shadowOffset: { width: 0, height: 4 }, elevation: 4, marginBottom: 10 },
  identityIcon: { width: 61, height: 61, borderRadius: 20, backgroundColor: colors.limeSoft, alignItems: 'center', justifyContent: 'center' },
  identityCopy: { flex: 1 },
  identityLoader: { flex: 1 },
  identityLabel: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 8, letterSpacing: 1.1 },
  identityTitle: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 17, lineHeight: 20, marginTop: 2 },
  identityText: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 13, lineHeight: 18, marginTop: 3 },
  settingsGoogleButton: { marginBottom: 3 },
  accountAction: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1.5, borderBottomColor: colors.line, paddingVertical: 7 },
  accountError: { borderRadius: 13, backgroundColor: '#FFE1E5', padding: 10, fontFamily: fonts.bodyBold, color: '#9E2135', fontSize: 12, lineHeight: 16, textAlign: 'center' },
  sectionHeading: { minHeight: 38, marginTop: 5, flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionMark: { width: 13, height: 13, borderRadius: 4, borderWidth: 1.5, borderColor: colors.ink, transform: [{ rotate: '-5deg' }] },
  sectionTitle: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 19, lineHeight: 22 },
  sectionLine: { flex: 1, height: 1.5, backgroundColor: colors.line },
  list: { borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: colors.line },
  row: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 8 },
  rowIcon: { width: 44, height: 44, borderRadius: 15, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1 },
  rowTitle: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 12.5 },
  rowText: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 13, lineHeight: 18, marginTop: 2 },
  toggle: { width: 44, height: 26, borderRadius: 14, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.line, padding: 2 },
  toggleActive: { backgroundColor: colors.lime },
  toggleKnob: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.paper, borderWidth: 1.5, borderColor: colors.ink },
  toggleKnobActive: { alignSelf: 'flex-end' },
  deleteRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  deleteIcon: { backgroundColor: colors.rose },
  deleteTitle: { fontFamily: fonts.bodyBold, color: colors.rose, fontSize: 12.5 },
  versionRow: { alignItems: 'center', paddingVertical: 12 },
  version: { fontFamily: fonts.bodyBold, color: colors.inkSoft, fontSize: 12 },
  modalLayer: { flex: 1, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(16, 12, 38, 0.68)' },
  confirmSheet: { width: '100%', maxWidth: 640, maxHeight: '92%', alignSelf: 'center', borderTopLeftRadius: 30, borderTopRightRadius: 30, borderWidth: 3, borderBottomWidth: 0, borderColor: colors.ink, backgroundColor: colors.canvas, paddingHorizontal: 22 },
  confirmScroll: { width: '100%' },
  confirmSheetContent: { alignItems: 'center', paddingTop: 20 },
  confirmIcon: { width: 58, height: 58, borderRadius: 20, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.rose, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-4deg' }] },
  confirmEyebrow: { fontFamily: fonts.bodyBold, color: colors.rose, fontSize: 8, letterSpacing: 1.2, marginTop: 10 },
  confirmTitle: { fontFamily: fonts.display, color: colors.ink, fontSize: 27, lineHeight: 30, textAlign: 'center', marginTop: 2 },
  confirmText: { maxWidth: 330, fontFamily: fonts.body, color: colors.inkSoft, fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 4 },
  confirmError: { fontFamily: fonts.bodyBold, color: colors.rose, fontSize: 12, lineHeight: 16, textAlign: 'center', marginTop: 8 },
  confirmDelete: { width: '100%', minHeight: 52, borderRadius: 17, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.rose, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 14 },
  confirmDeleteText: { fontFamily: fonts.displaySemi, color: colors.paper, fontSize: 16 },
  logoutIcon: { width: 58, height: 58, borderRadius: 20, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.cyan, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-3deg' }] },
  logoutEyebrow: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 8, letterSpacing: 1.2, marginTop: 10 },
  confirmLogout: { width: '100%', minHeight: 52, borderRadius: 17, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.cyan, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 14 },
  confirmLogoutText: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 16 },
  cancel: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, marginTop: 5 },
  cancelText: { fontFamily: fonts.bodyBold, color: colors.inkSoft, fontSize: 13 },
  successIcon: { width: 58, height: 58, borderRadius: 20, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-4deg' }] },
  successEyebrow: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 8, letterSpacing: 1.2, marginTop: 10 },
  successButton: { width: '100%', minHeight: 54, borderRadius: 17, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.lime, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 16 },
  successButtonText: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 16 },
});
