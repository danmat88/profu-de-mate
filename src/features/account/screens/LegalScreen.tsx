import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { legalDocument } from '../../../shared/config/legal';
import { useResponsiveLayout } from '../../../shared/hooks/useResponsiveLayout';
import * as Haptics from '../../../shared/services/haptics';
import { borders, colors, fonts, shadows, typography } from '../../../shared/theme';
import type { RootStackParamList } from '../../../shared/types';
import { AppIcon } from '../../../shared/ui/AppIcon';
import { Chip } from '../../../shared/ui/Chip';
import { ComicBackdrop } from '../../../shared/ui/ComicBackdrop';
import { ComicCard } from '../../../shared/ui/ComicCard';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { ScreenHeader } from '../../../shared/ui/ScreenHeader';
import { Text } from '../../../shared/ui/Typography';

type Props = NativeStackScreenProps<RootStackParamList, 'Legal'>;
type DocumentTab = 'overview' | 'privacy' | 'terms';

const tabs: { id: DocumentTab; label: string }[] = [
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
    if (next === tab) return;
    Haptics.selection();
    setTab(next);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      <ComicBackdrop />
      <ScreenHeader title="Legal și siguranță" eyebrow="INFORMAȚII CLARE" onBack={() => navigation.goBack()} rightIcon="privacy" />

      <View style={[styles.tabBarShadow, { marginHorizontal: gutter }]}>
        <View style={styles.tabBar} accessibilityRole="tablist">
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
      </View>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingHorizontal: gutter, paddingBottom: Math.max(insets.bottom, 16) + 20 }]}
      >
        {tab === 'overview' ? (
          <>
            <ComicCard tone="paper" depth={5} radius={26} borderWidth={borders.thick} shine contentStyle={styles.hero}>
              <View style={styles.heroIcon}><AppIcon name="privacy" size={62} /></View>
              <Text style={styles.heroEyebrow}>PE SCURT</Text>
              <Text style={styles.heroTitle}>Tu îți controlezi datele.</Text>
              <Text style={styles.heroText}>Folosim fotografia sau formula trimisă de tine ca să construim explicația. Poți începe fără cont Google, nu avem reclame și nu vindem date.</Text>
              <View style={styles.chips}>
                <Chip label="13+" tone="violetSoft" />
                <Chip label="Fără reclame" tone="lime" />
                <Chip label="Ștergere din aplicație" tone="cyanSoft" />
              </View>
            </ComicCard>

            <Section number="01" title="Ce se întâmplă cu poza">
              <Bullet>O comprimi și o încadrezi direct pe telefon.</Bullet>
              <Bullet>Este trimisă securizat prin serviciul aplicației către Gemini, pentru o singură analiză.</Bullet>
              <Bullet>Nu este pusă în Firebase Storage și nu apare în Caiet.</Bullet>
              <Bullet>Dacă scrii problema, trimitem formula și, la verificare, rezolvarea introdusă de tine către același serviciu. Ciorna rămâne pe telefon până alegi să pornești analiza.</Bullet>
              <Bullet>Google poate păstra temporar cererea și răspunsul numai pentru siguranță și prevenirea abuzului, conform termenilor serviciului plătit.</Bullet>
            </Section>

            <Section number="02" title="Tu controlezi Caietul">
              <Paragraph>Lecțiile nesalvate expiră automat după 7 zile. Lecțiile din Caiet rămân cât timp îl folosești, dar sunt șterse după aproximativ 13 luni fără activitate.</Paragraph>
            </Section>

            <Section number="03" title="Inteligența artificială explică, nu decide">
              <Paragraph>Răspunsul este generat automat și poate greși. Profu’ de mate este un ajutor educațional, nu înlocuiește profesorul și nu produce decizii cu efect juridic sau academic.</Paragraph>
            </Section>

            <View style={styles.updated}>
              <MiniGlyph name="check" size={16} color={colors.violetDeep} />
              <Text style={styles.updatedText}>Actualizat la {legalDocument.updatedAt}</Text>
            </View>
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
              <Bullet>Un identificator Firebase pentru spațiul aplicației; dacă alegi Google, adresa de e-mail, numele și identificatorul contului furnizate de Google. Pentru cota zilnică, backendul transformă identificatorul Google într-un cod HMAC opac, care nu conține e-mailul.</Bullet>
              <Bullet>Fotografia sau formula aleasă de tine, rezolvarea introdusă pentru verificare și cererea de analiză.</Bullet>
              <Bullet>Soluția, verdictul, materia și starea de salvare a lecției.</Bullet>
              <Bullet>Categoria unui raport trimis de tine și, doar dacă activezi opțiunea, date tehnice de blocare.</Bullet>
              <Bullet>Starea abonamentului și produsul cumpărat, fără numărul cardului sau datele de plată.</Bullet>
              <Bullet>Semnale Play Integrity și un bit Device Recall, când sunt disponibile, folosite numai pentru siguranță și prevenirea repetării abuzive a ofertei de bun-venit.</Bullet>
              <Bullet>Infrastructura poate înregistra automat metadate de conexiune, precum adresa IP, mărimea cererii, latența și codul răspunsului, fără conținutul fotografiei.</Bullet>
            </Section>

            <Section number="02" title="De ce le folosim">
              <Paragraph>Le folosim pentru a analiza problema, a afișa pașii, a sincroniza Caietul, a preveni abuzurile, a proteja serviciul și a îmbunătăți răspunsurile raportate. Rapoartele tehnice opționale sunt trimise numai dacă alegi acest lucru și le poți opri oricând.</Paragraph>
            </Section>

            <Section number="03" title="Cine procesează datele">
              <Paragraph>Folosim Google Firebase pentru autentificare, funcții și baza de date; Google Sign-In dacă îl alegi; Google Play pentru plăți și verificarea integrității; RevenueCat pentru starea abonamentului; Firebase Crashlytics doar dacă îl activezi; și Gemini Developer API pentru analiza matematică. Nu folosim rețele publicitare și nu vindem date.</Paragraph>
            </Section>

            <Section number="04" title="Cât timp le păstrăm">
              <Bullet>Fotografia nu este stocată de aplicație în Cloud Storage sau Caiet.</Bullet>
              <Bullet>Ciornele editorului rămân pe telefon, separat pentru rezolvare și verificare. Expiră după 7 zile fără editare și sunt eliminate la următoarea deschidere a editorului; sunt șterse și la deconectare, schimbarea contului sau ștergerea datelor. Datele locale pentru reluarea unei analize expiră după 30 de minute și sunt curățate la următoarea verificare.</Bullet>
              <Bullet>Lecția nesalvată și rezultatul tehnic temporar: expirare după 7 zile.</Bullet>
              <Bullet>Contoarele zilnice și rezervările anti-abuz: expirare după 35 de zile.</Bullet>
              <Bullet>După ștergerea unui cont Google, codul HMAC, hashurile unidirecționale folosite exclusiv pentru deduplicare și numărul folosit în ziua curentă pot rămâne numai până la următoarea resetare, apoi intră în curățarea automată și nu mai sunt folosite pentru noua zi.</Bullet>
              <Bullet>Markerul HMAC al instalării și numărul problemelor de bun-venit folosite pot rămâne maximum 400 de zile de la ultima activitate, inclusiv după ștergere, exclusiv pentru a împiedica refolosirea artificială a ofertei. Nu conțin e-mailul sau UID-ul Firebase.</Bullet>
              <Bullet>Dacă Device Recall este aprobat și activat, Google poate păstra bitul anti-abuz până la 3 ani de la ultima citire sau scriere, conform documentației Play Integrity. Aplicația îl folosește numai pentru oferta de bun-venit.</Bullet>
              <Bullet>Evenimentele tehnice ale abonamentului: maximum aproximativ 13 luni; starea curentă a abonamentului este păstrată cât timp contul există.</Bullet>
              <Bullet>Metadatele standard din Cloud Logging: în mod normal 30 de zile.</Bullet>
              <Bullet>Lecțiile salvate: până le ștergi sau după aproximativ 13 luni fără folosirea Caietului.</Bullet>
              <Paragraph>Termenele indică expirarea programată. Curățarea rulează zilnic: eliminarea fizică are loc de regulă în următoarele 24 de ore după expirare; incidentele tehnice pot întârzia execuția.</Paragraph>
              <Bullet>Pentru a opri răspunsurile întârziate să refacă date șterse, păstrăm un marker tehnic cu UID-ul timp de 35 de zile după finalizarea ștergerii. O ștergere incompletă păstrează blocajul până la finalizare.</Bullet>
              <Bullet>Un transfer de lecții început la conectarea cu Google păstrează identificatorii tehnici necesari reluării până la finalizare sau rezolvarea incidentului.</Bullet>
              <Bullet>Rapoartele tale și răspunsul generat raportat: 180 de zile sau până ștergi toate datele din aplicație, dacă alegi ștergerea mai devreme.</Bullet>
            </Section>

            <Section number="05" title="Drepturile tale">
              <Paragraph>Poți opri rapoartele tehnice, te poți deconecta fără să ștergi datele sau poți șterge definitiv contul, lecțiile și raportările din Setări. După ștergere, aplicația creează automat un spațiu temporar nou, fără legătură cu identitatea ștearsă, ca să poată fi folosită fără conectare. Cererea pentru profilul tehnic RevenueCat necesită verificarea echipei de suport; identificatorii necesari urmăririi cererii rămân până la soluționare. Ștergerea cere și eliminarea profilului RevenueCat, dar nu oprește automat abonamentul din Google Play. Numai markerii anti-abuz minimizați, totalurile anonime și logurile strict necesare securității pot urma retențiile limitate descrise aici. Datele contului nu mai pot fi recuperate.</Paragraph>
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

            <Section number="04" title="Abonamentul Premium">
              <Bullet>Plata este procesată exclusiv de Google Play; noi nu primim datele cardului.</Bullet>
              <Bullet>Prețul, moneda, perioada și eventualele oferte sunt cele afișate de Google Play înainte de confirmare.</Bullet>
              <Bullet>Abonamentul se reînnoiește automat până când îl oprești din Google Play. Oprirea reînnoirii păstrează Premium până la sfârșitul perioadei plătite.</Bullet>
              <Bullet>Poți restaura o achiziție din ecranul Premium folosind același cont Google Play.</Bullet>
              <Bullet>Ștergerea aplicației sau a datelor nu anulează abonamentul.</Bullet>
            </Section>

            <Section number="05" title="Raportează o problemă">
              <Paragraph>Din fiecare lecție sau recapitulare poți semnala un răspuns greșit, neclar ori nepotrivit fără să ieși din aplicație. Mesajul tău ne ajută să îmbunătățim filtrele și explicațiile.</Paragraph>
            </Section>

            <ComicCard tone="limeSoft" depth={4} radius={22} contentStyle={styles.safetyCard}>
              <AppIcon name="help" size={50} />
              <View style={styles.safetyCopy}>
                <Text style={styles.safetyTitle}>Ai găsit o greșeală?</Text>
                <Text style={styles.safetyText}>Atinge „Ai observat o greșeală?”. Lecția rămâne în Caiet, iar trimiterea durează doar câteva secunde.</Text>
              </View>
            </ComicCard>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  tabBarShadow: { borderRadius: 18, backgroundColor: colors.ink, paddingBottom: shadows.sm, marginBottom: 10 },
  tabBar: {
    height: 48,
    borderWidth: borders.regular,
    borderColor: colors.ink,
    borderRadius: 17,
    backgroundColor: colors.paper,
    flexDirection: 'row',
    padding: 3,
    gap: 3,
  },
  tab: { flex: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: colors.violet, borderWidth: 1.5, borderColor: colors.ink },
  tabText: { fontFamily: fonts.bodyBold, color: colors.inkSoft, fontSize: 12.5 },
  tabTextActive: { color: colors.paper },

  content: { paddingTop: 4, gap: 14 },
  hero: { alignItems: 'center', paddingHorizontal: 18, paddingVertical: 20 },
  heroIcon: {
    width: 72,
    height: 72,
    borderWidth: borders.regular,
    borderColor: colors.ink,
    borderRadius: 23,
    backgroundColor: colors.limeSoft,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-3deg' }],
  },
  heroEyebrow: { ...typography.kicker, color: colors.violetDeep, marginTop: 12 },
  heroTitle: { fontFamily: fonts.display, color: colors.ink, fontSize: 27, lineHeight: 30, textAlign: 'center', marginTop: 3 },
  heroText: { maxWidth: 320, fontFamily: fonts.body, color: colors.inkSoft, fontSize: 13.5, lineHeight: 19, textAlign: 'center', marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 7, marginTop: 14 },

  section: { borderBottomWidth: 1.5, borderBottomColor: colors.line, paddingBottom: 14 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionNumber: {
    width: 32,
    height: 32,
    borderWidth: borders.thin,
    borderColor: colors.ink,
    borderRadius: 11,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-3deg' }],
  },
  sectionNumberText: { fontFamily: fonts.display, color: colors.ink, fontSize: 12.5 },
  sectionTitle: { flex: 1, fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 18.5, lineHeight: 22 },
  sectionBody: { gap: 7, marginTop: 9, paddingLeft: 3 },
  paragraph: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 13.5, lineHeight: 20 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  bulletDot: { width: 8, height: 8, borderWidth: 1.5, borderColor: colors.ink, borderRadius: 3, backgroundColor: colors.peach, marginTop: 6 },
  bulletText: { flex: 1, fontFamily: fonts.body, color: colors.inkSoft, fontSize: 13.5, lineHeight: 20 },

  updated: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  updatedText: { fontFamily: fonts.bodyBold, color: colors.inkSoft, fontSize: 12.5 },
  documentIntro: { paddingVertical: 6 },
  documentEyebrow: { ...typography.kicker, color: colors.violetDeep },
  documentTitle: { fontFamily: fonts.display, color: colors.ink, fontSize: 27, lineHeight: 31, marginTop: 3 },
  documentLead: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 13.5, lineHeight: 19.5, marginTop: 4 },
  safetyCard: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 14 },
  safetyCopy: { flex: 1 },
  safetyTitle: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 17.5 },
  safetyText: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 13, lineHeight: 18, marginTop: 2 },
});
