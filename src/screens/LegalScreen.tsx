import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../components/Typography';
import { AppIcon } from '../components/AppIcon';
import { ComicBackdrop } from '../components/ComicBackdrop';
import { MiniGlyph } from '../components/MiniGlyph';
import { ScreenHeader } from '../components/ScreenHeader';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { legalDocument } from '../legal';
import { colors, fonts } from '../theme';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Legal'>;
type DocumentTab = 'overview' | 'privacy' | 'terms';

const tabs: Array<{ id: DocumentTab; label: string }> = [
  { id: 'overview', label: 'Pe scurt' },
  { id: 'privacy', label: 'Datele tale' },
  { id: 'terms', label: 'Reguli' },
];

function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <View style={styles.sectionNumber}><Text style={styles.sectionNumberText}>{number}</Text></View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return <Text style={styles.paragraph}>{children}</Text>;
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bulletDot} />
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

export function LegalScreen({ navigation }: Props) {
  const { gutter } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [tab, setTab] = useState<DocumentTab>('overview');
  const operatorLine = legalDocument.operatorName
    ? `Operatorul aplicației este ${legalDocument.operatorName}.`
    : 'Această politică explică simplu ce folosește aplicația și ce poți controla.';

  const chooseTab = (next: DocumentTab) => {
    setTab(next);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      <ComicBackdrop />
      <ScreenHeader title="Legal și siguranță" eyebrow="INFORMAȚII CLARE" onBack={() => navigation.goBack()} rightIcon="privacy" />

      <View style={[styles.tabBar, { marginHorizontal: gutter }]} accessibilityRole="tablist">
        {tabs.map((item) => {
          const active = item.id === tab;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => chooseTab(item.id)}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingHorizontal: gutter, paddingBottom: Math.max(insets.bottom, 16) + 20 }]}
      >
        {tab === 'overview' ? (
          <>
            <View style={styles.hero}>
              <View style={styles.heroIcon}><AppIcon name="privacy" size={64} /></View>
              <Text style={styles.heroEyebrow}>PE SCURT</Text>
              <Text style={styles.heroTitle}>Tu îți controlezi datele.</Text>
              <Text style={styles.heroText}>Folosim fotografia doar ca să construim explicația. Nu avem reclame, nu cerem nume și nu vindem date.</Text>
              <View style={styles.chips}>
                <View style={styles.chip}><Text style={styles.chipText}>13+</Text></View>
                <View style={[styles.chip, styles.chipLime]}><Text style={styles.chipText}>Fără reclame</Text></View>
                <View style={[styles.chip, styles.chipCyan]}><Text style={styles.chipText}>Ștergere din aplicație</Text></View>
              </View>
            </View>

            <Section number="01" title="Ce se întâmplă cu poza">
              <Bullet>O comprimi și o încadrezi direct pe telefon.</Bullet>
              <Bullet>Este trimisă securizat prin serviciul aplicației către Gemini, pentru o singură analiză.</Bullet>
              <Bullet>Nu este pusă în Firebase Storage și nu apare în Caiet.</Bullet>
              <Bullet>Google poate păstra temporar cererea și răspunsul numai pentru siguranță și prevenirea abuzului, conform termenilor serviciului plătit.</Bullet>
            </Section>

            <Section number="02" title="Tu controlezi Caietul">
              <Paragraph>Lecțiile nesalvate expiră automat după 7 zile. Lecțiile din Caiet rămân cât timp îl folosești, dar sunt șterse după aproximativ 13 luni fără activitate.</Paragraph>
            </Section>

            <Section number="03" title="Inteligența artificială explică, nu decide">
              <Paragraph>Răspunsul este generat automat și poate greși. Profu’ de mate este un ajutor educațional, nu înlocuiește profesorul și nu produce decizii cu efect juridic sau academic.</Paragraph>
            </Section>

            <View style={styles.updated}><MiniGlyph name="check" size={16} color={colors.violetDeep} /><Text style={styles.updatedText}>Actualizat la {legalDocument.updatedAt}</Text></View>
          </>
        ) : null}

        {tab === 'privacy' ? (
          <>
            <View style={styles.documentIntro}>
              <Text style={styles.documentEyebrow}>POLITICA DE CONFIDENȚIALITATE</Text>
              <Text style={styles.documentTitle}>Date puține, scop clar.</Text>
              <Text style={styles.documentLead}>{operatorLine}</Text>
            </View>

            <Section number="01" title="Ce date folosim">
              <Bullet>Un identificator Firebase anonim pentru aplicația instalată pe telefon.</Bullet>
              <Bullet>Fotografia aleasă de tine și cererea de rezolvare sau verificare.</Bullet>
              <Bullet>Soluția, verdictul, materia și starea de salvare a lecției.</Bullet>
              <Bullet>Categoria unui raport trimis de tine și, doar dacă activezi opțiunea, date tehnice de blocare.</Bullet>
              <Bullet>Infrastructura poate înregistra automat metadate de conexiune, precum adresa IP, mărimea cererii, latența și codul răspunsului, fără conținutul fotografiei.</Bullet>
            </Section>

            <Section number="02" title="De ce le folosim">
              <Paragraph>Le folosim pentru a analiza problema, a afișa pașii, a sincroniza Caietul, a preveni abuzurile, a proteja serviciul și a îmbunătăți răspunsurile raportate. Rapoartele tehnice opționale sunt trimise numai dacă alegi acest lucru și le poți opri oricând.</Paragraph>
            </Section>

            <Section number="03" title="Cine procesează datele">
              <Paragraph>Folosim Google Firebase pentru autentificare anonimă, funcții și baza de date; Firebase Crashlytics doar dacă îl activezi; și Gemini Developer API pentru analiza matematică. Nu folosim rețele publicitare și nu vindem date.</Paragraph>
            </Section>

            <Section number="04" title="Cât timp le păstrăm">
              <Bullet>Fotografia nu este stocată de aplicație în Cloud Storage sau Caiet.</Bullet>
              <Bullet>Lecția nesalvată și rezultatul tehnic temporar: maximum 7 zile.</Bullet>
              <Bullet>Contoarele anti-abuz: maximum 35 de zile.</Bullet>
              <Bullet>Metadatele standard din Cloud Logging: în mod normal 30 de zile.</Bullet>
              <Bullet>Lecțiile salvate: până le ștergi sau după aproximativ 13 luni fără folosirea Caietului.</Bullet>
              <Bullet>Rapoartele tale: până ștergi toate datele din aplicație.</Bullet>
            </Section>

            <Section number="05" title="Drepturile tale">
              <Paragraph>Poți opri rapoartele tehnice și poți șterge contul anonim, lecțiile, raportările și istoricul tehnic din Setări → Șterge toate datele. După confirmare, datele nu mai pot fi recuperate.</Paragraph>
              {legalDocument.contactEmail ? <Paragraph>Pentru întrebări sau exercitarea drepturilor: {legalDocument.contactEmail}</Paragraph> : null}
            </Section>

            <Section number="06" title="Vârsta și date sensibile">
              <Paragraph>Aplicația este destinată persoanelor de cel puțin {legalDocument.minimumAge} ani. Nu fotografia nume, fețe, adrese, note sau alte informații personale; încadrează doar problema de matematică.</Paragraph>
            </Section>
          </>
        ) : null}

        {tab === 'terms' ? (
          <>
            <View style={styles.documentIntro}>
              <Text style={styles.documentEyebrow}>TERMENI DE UTILIZARE</Text>
              <Text style={styles.documentTitle}>Învățăm corect și în siguranță.</Text>
              <Text style={styles.documentLead}>Folosind aplicația, accepți regulile de mai jos. Versiune din {legalDocument.updatedAt}.</Text>
            </View>

            <Section number="01" title="Scop educațional">
              <Paragraph>Profu’ de mate explică și verifică exerciții. Răspunsurile generate automat pot conține greșeli, așa că verifică rezultatul înainte să îl folosești la teme, teste sau examene.</Paragraph>
            </Section>

            <Section number="02" title="Folosire permisă">
              <Bullet>Trimite doar conținut matematic pe care ai dreptul să îl folosești.</Bullet>
              <Bullet>Nu încerca să eviți limitele, filtrele sau securitatea aplicației.</Bullet>
              <Bullet>Nu trimite date personale, conținut ilegal, ofensator sau periculos.</Bullet>
              <Bullet>Respectă regulile școlii și indicațiile profesorului.</Bullet>
            </Section>

            <Section number="03" title="Disponibilitate și limite">
              <Paragraph>Serviciul are nevoie de internet și poate avea limite zilnice, perioade de mentenanță sau întreruperi ale furnizorilor. Putem opri accesul automat când detectăm abuz sau risc de securitate.</Paragraph>
            </Section>

            <Section number="04" title="Raportează o problemă">
              <Paragraph>Din fiecare lecție sau recapitulare poți semnala un răspuns greșit, neclar ori nepotrivit fără să ieși din aplicație. Mesajul tău ne ajută să îmbunătățim filtrele și explicațiile.</Paragraph>
            </Section>

            <View style={styles.safetyCard}>
              <AppIcon name="help" size={52} />
              <View style={styles.safetyCopy}>
                <Text style={styles.safetyTitle}>Ai găsit o greșeală?</Text>
                <Text style={styles.safetyText}>Atinge „Ai observat o greșeală?”. Lecția rămâne în Caiet, iar trimiterea durează doar câteva secunde.</Text>
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  tabBar: { height: 48, borderWidth: 2.5, borderColor: colors.ink, borderRadius: 17, backgroundColor: colors.paper, flexDirection: 'row', padding: 3, marginBottom: 8 },
  tab: { flex: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: colors.violet },
  tabText: { fontFamily: fonts.bodyBold, color: colors.inkSoft, fontSize: 12 },
  tabTextActive: { color: colors.paper },
  content: { paddingTop: 4, gap: 14 },
  hero: { borderWidth: 3, borderColor: colors.ink, borderRadius: 28, backgroundColor: colors.paper, alignItems: 'center', paddingHorizontal: 18, paddingVertical: 20, shadowColor: colors.ink, shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  heroIcon: { width: 74, height: 74, borderWidth: 2.5, borderColor: colors.ink, borderRadius: 24, backgroundColor: colors.limeSoft, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-3deg' }] },
  heroEyebrow: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 8.5, letterSpacing: 1.2, marginTop: 11 },
  heroTitle: { fontFamily: fonts.display, color: colors.ink, fontSize: 27, lineHeight: 29, textAlign: 'center', marginTop: 2 },
  heroText: { maxWidth: 320, fontFamily: fonts.body, color: colors.inkSoft, fontSize: 12.5, lineHeight: 17.5, textAlign: 'center', marginTop: 5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 13 },
  chip: { minHeight: 28, borderWidth: 2, borderColor: colors.ink, borderRadius: 10, backgroundColor: colors.violetSoft, justifyContent: 'center', paddingHorizontal: 9 },
  chipLime: { backgroundColor: colors.limeSoft },
  chipCyan: { backgroundColor: '#C9F7FA' },
  chipText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 9.5 },
  section: { borderBottomWidth: 1.5, borderBottomColor: colors.line, paddingBottom: 14 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  sectionNumber: { width: 31, height: 31, borderWidth: 2, borderColor: colors.ink, borderRadius: 11, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-3deg' }] },
  sectionNumberText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 9 },
  sectionTitle: { flex: 1, fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 18, lineHeight: 21 },
  sectionBody: { gap: 7, marginTop: 8, paddingLeft: 3 },
  paragraph: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 12.5, lineHeight: 18 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  bulletDot: { width: 8, height: 8, borderWidth: 1.5, borderColor: colors.ink, borderRadius: 3, backgroundColor: colors.peach, marginTop: 5 },
  bulletText: { flex: 1, fontFamily: fonts.body, color: colors.inkSoft, fontSize: 12.5, lineHeight: 18 },
  updated: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  updatedText: { fontFamily: fonts.bodyBold, color: colors.inkSoft, fontSize: 12 },
  documentIntro: { paddingVertical: 7 },
  documentEyebrow: { fontFamily: fonts.bodyBold, color: colors.violetDeep, fontSize: 8.5, letterSpacing: 1.25 },
  documentTitle: { fontFamily: fonts.display, color: colors.ink, fontSize: 28, lineHeight: 31, marginTop: 2 },
  documentLead: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 12.5, lineHeight: 18, marginTop: 4 },
  safetyCard: { borderWidth: 2.5, borderColor: colors.ink, borderRadius: 21, backgroundColor: colors.limeSoft, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13 },
  safetyCopy: { flex: 1 },
  safetyTitle: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 17 },
  safetyText: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 12, lineHeight: 17, marginTop: 1 },
});
