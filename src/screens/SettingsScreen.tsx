import { getApp } from '@react-native-firebase/app';
import { getCrashlytics, setCrashlyticsCollectionEnabled } from '@react-native-firebase/crashlytics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '../components/AppIcon';
import { ComicBackdrop } from '../components/ComicBackdrop';
import { MiniGlyph } from '../components/MiniGlyph';
import { ScreenHeader } from '../components/ScreenHeader';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { deleteAllUserData } from '../services/dataManagement';
import { colors, fonts } from '../theme';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export function SettingsScreen({ navigation }: Props) {
  const { gutter } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const crashlytics = getCrashlytics(getApp());
  const [diagnostics, setDiagnostics] = useState(crashlytics.isCrashlyticsCollectionEnabled);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);

  const toggleDiagnostics = async () => {
    const next = !diagnostics;
    setDiagnostics(next);
    await Haptics.selectionAsync();
    try {
      await setCrashlyticsCollectionEnabled(crashlytics, next);
    } catch {
      setDiagnostics(!next);
    }
  };

  const deleteData = async () => {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(false);
    try {
      await deleteAllUserData();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setConfirmDelete(false);
      navigation.popToTop();
    } catch {
      setDeleteError(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setDeleting(false);
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
          <View style={styles.identityCopy}>
            <Text style={styles.identityLabel}>CONT PROTEJAT AL INSTALĂRII</Text>
            <Text style={styles.identityTitle}>Caietul tău rămâne sincronizat</Text>
            <Text style={styles.identityText}>Lecțiile salvate sunt legate de această instalare. Fotografiile problemelor nu sunt păstrate în Caiet.</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Confidențialitate</Text>
        <View style={styles.list}>
          <Pressable accessibilityRole="switch" accessibilityState={{ checked: diagnostics }} onPress={() => void toggleDiagnostics()} style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: colors.cyan }]}><AppIcon name="settings" size={36} /></View>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>Diagnosticare opțională</Text>
              <Text style={styles.rowText}>Trimite rapoarte tehnice de blocare, fără fotografia problemei.</Text>
            </View>
            <View style={[styles.toggle, diagnostics && styles.toggleActive]}><View style={[styles.toggleKnob, diagnostics && styles.toggleKnobActive]} /></View>
          </Pressable>
          <View style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: colors.lime }]}><AppIcon name="privacy" size={36} /></View>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>Fotografiile nu intră în Caiet</Text>
              <Text style={styles.rowText}>Sunt comprimate local și trimise securizat, fără să ajungă în Firebase Storage. Jurnalele temporare sunt explicate la „Legal și siguranță”.</Text>
            </View>
            <MiniGlyph name="check" size={18} color={colors.violetDeep} />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Datele tale</Text>
        <View style={styles.list}>
          <View style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: colors.violetSoft }]}><AppIcon name="notebook" size={36} /></View>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>Păstrare controlată</Text>
              <Text style={styles.rowText}>Lecțiile nesalvate expiră după 7 zile, iar contoarele de siguranță după cel mult 35. Caietul se șterge după circa 13 luni fără folosire.</Text>
            </View>
          </View>
          <Pressable accessibilityRole="button" onPress={() => { setDeleteError(false); setConfirmDelete(true); }} style={styles.deleteRow}>
            <View style={[styles.rowIcon, styles.deleteIcon]}><MiniGlyph name="wrong" size={20} color={colors.paper} /></View>
            <View style={styles.rowCopy}>
              <Text style={styles.deleteTitle}>Șterge toate datele</Text>
              <Text style={styles.rowText}>Elimină lecțiile, feedbackul, istoricul tehnic și contul acestei instalări.</Text>
            </View>
            <MiniGlyph name="next" size={18} color={colors.rose} />
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Despre aplicație</Text>
        <View style={styles.list}>
          <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Legal')} style={styles.deleteRow}>
            <View style={[styles.rowIcon, { backgroundColor: colors.cyan }]}><AppIcon name="help" size={36} /></View>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>Legal și siguranță</Text>
              <Text style={styles.rowText}>Confidențialitate, folosirea AI, retenția datelor și termenii aplicației.</Text>
            </View>
            <MiniGlyph name="next" size={18} color={colors.violetDeep} />
          </Pressable>
        </View>

        <View style={styles.versionRow}><Text style={styles.version}>Profu’ de mate · versiunea 1.0.0</Text></View>
      </ScrollView>

      <Modal visible={confirmDelete} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={deleting ? undefined : () => setConfirmDelete(false)}>
        <SafeAreaView style={styles.modalLayer} edges={[]}>
          <Pressable accessible={false} disabled={deleting} onPress={() => setConfirmDelete(false)} style={styles.scrim} />
          <View accessibilityViewIsModal style={[styles.confirmSheet, { paddingBottom: Math.max(insets.bottom, 14) + 10 }]}>
            <View style={styles.confirmIcon}><MiniGlyph name="wrong" size={28} color={colors.paper} /></View>
            <Text style={styles.confirmEyebrow}>ACȚIUNE DEFINITIVĂ</Text>
            <Text style={styles.confirmTitle}>Ștergem tot ce îți aparține?</Text>
            <Text style={styles.confirmText}>Caietul, lecțiile, feedbackul și contul instalării vor dispărea definitiv. Fotografiile nu sunt păstrate în Caiet sau Firebase Storage.</Text>
            {deleteError ? <Text accessibilityRole="alert" style={styles.confirmError}>Ștergerea nu a reușit. Verifică internetul și încearcă din nou.</Text> : null}
            <Pressable accessibilityRole="button" disabled={deleting} onPress={() => void deleteData()} style={styles.confirmDelete}>
              {deleting ? <ActivityIndicator size="small" color={colors.paper} /> : <MiniGlyph name="wrong" size={18} color={colors.paper} />}
              <Text style={styles.confirmDeleteText}>{deleting ? 'Șterg datele…' : 'Da, șterge definitiv'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={deleting} onPress={() => setConfirmDelete(false)} style={styles.cancel}><Text style={styles.cancelText}>Păstrează datele</Text></Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { gap: 10 },
  identity: { borderWidth: 3, borderColor: colors.ink, borderRadius: 24, backgroundColor: colors.paper, flexDirection: 'row', gap: 10, padding: 14, shadowColor: colors.ink, shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 6 }, elevation: 6, marginBottom: 10 },
  identityIcon: { width: 61, height: 61, borderRadius: 20, backgroundColor: colors.limeSoft, alignItems: 'center', justifyContent: 'center' },
  identityCopy: { flex: 1 },
  identityLabel: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 8, letterSpacing: 1.1 },
  identityTitle: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 17, lineHeight: 20, marginTop: 2 },
  identityText: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 10.5, lineHeight: 14, marginTop: 3 },
  sectionTitle: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 19, lineHeight: 22, marginTop: 4 },
  list: { borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: colors.line },
  row: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 8 },
  rowIcon: { width: 44, height: 44, borderRadius: 15, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1 },
  rowTitle: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 12.5 },
  rowText: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 10, lineHeight: 13.5, marginTop: 2 },
  toggle: { width: 44, height: 26, borderRadius: 14, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.line, padding: 2 },
  toggleActive: { backgroundColor: colors.lime },
  toggleKnob: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.paper, borderWidth: 1.5, borderColor: colors.ink },
  toggleKnobActive: { alignSelf: 'flex-end' },
  deleteRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  deleteIcon: { backgroundColor: colors.rose },
  deleteTitle: { fontFamily: fonts.bodyBold, color: colors.rose, fontSize: 12.5 },
  versionRow: { alignItems: 'center', paddingVertical: 12 },
  version: { fontFamily: fonts.bodyBold, color: colors.inkSoft, fontSize: 10 },
  modalLayer: { flex: 1, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(16, 12, 38, 0.68)' },
  confirmSheet: { borderTopLeftRadius: 30, borderTopRightRadius: 30, borderWidth: 3, borderBottomWidth: 0, borderColor: colors.ink, backgroundColor: colors.canvas, alignItems: 'center', paddingHorizontal: 22, paddingTop: 20 },
  confirmIcon: { width: 58, height: 58, borderRadius: 20, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.rose, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-4deg' }] },
  confirmEyebrow: { fontFamily: fonts.bodyBold, color: colors.rose, fontSize: 8, letterSpacing: 1.2, marginTop: 10 },
  confirmTitle: { fontFamily: fonts.display, color: colors.ink, fontSize: 27, lineHeight: 30, textAlign: 'center', marginTop: 2 },
  confirmText: { maxWidth: 330, fontFamily: fonts.body, color: colors.inkSoft, fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 4 },
  confirmError: { fontFamily: fonts.bodyBold, color: colors.rose, fontSize: 10.5, textAlign: 'center', marginTop: 8 },
  confirmDelete: { width: '100%', minHeight: 52, borderRadius: 17, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.rose, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 14 },
  confirmDeleteText: { fontFamily: fonts.displaySemi, color: colors.paper, fontSize: 16 },
  cancel: { minHeight: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, marginTop: 5 },
  cancelText: { fontFamily: fonts.bodyBold, color: colors.inkSoft, fontSize: 11.5 },
});
