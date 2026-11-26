import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import { legalDocument } from '../../../shared/config/legal';
import { useResponsiveLayout } from '../../../shared/hooks/useResponsiveLayout';
import { colors, fonts, radii, typography } from '../../../shared/theme';
import type { RootStackParamList } from '../../../shared/types';
import { AppIcon } from '../../../shared/ui/AppIcon';
import { Chip } from '../../../shared/ui/Chip';
import { ComicBackdrop } from '../../../shared/ui/ComicBackdrop';
import { ComicTabBar, type ComicTabOption } from '../../../shared/ui/ComicTabBar';
import { IconButton } from '../../../shared/ui/IconButton';
import { MiniGlyph } from '../../../shared/ui/MiniGlyph';
import { TabPanel } from '../../../shared/ui/TabPanel';
import { Text } from '../../../shared/ui/Typography';

type Props = NativeStackScreenProps<RootStackParamList, 'Legal'>;
type DocumentTab = 'overview' | 'privacy' | 'terms';

const TAB_ORDER: Record<DocumentTab, number> = { overview: 0, privacy: 1, terms: 2 };

const tabs: readonly ComicTabOption<DocumentTab>[] = [
  { value: 'overview', label: 'Pe scurt', activeFill: colors.violet, activeText: colors.paper },
  { value: 'privacy', label: 'Datele tale', activeFill: colors.cyan, activeText: colors.ink },
  { value: 'terms', label: 'Reguli', activeFill: colors.peach, activeText: colors.ink },
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
  const frame = useSafeAreaFrame();
  const { gutter, contentWidth } = useResponsiveLayout(frame);
  const insets = useSafeAreaInsets();
  const [tabState, setTabState] = useState<{ tab: DocumentTab; direction: -1 | 0 | 1 }>({
    tab: 'overview',
    direction: 0,
  });
  const { tab, direction } = tabState;
  const operatorLine = legalDocument.operatorName
    ? `Operatorul aplicației este ${legalDocument.operatorName}.`
    : 'Această politică explică simplu ce folosește aplicația și ce poți controla.';

  const chooseTab = (next: DocumentTab) => {
    setTabState((current) => (current.tab === next
      ? current
      : { tab: next, direction: TAB_ORDER[next] > TAB_ORDER[current.tab] ? 1 : -1 }));
  };

  return (
    <View style={styles.safe}>
      <StatusBar style="light" />
      <ComicBackdrop />

      {/* Full-bleed curved Indigo-Sapphire Trust & Safety Canopy */}
      <View style={[styles.canopy, { paddingTop: insets.top ?? 0 }]}>
        <LinearGradient
          colors={['#1A8CC4', '#2C4CE0', '#3E1EC4', '#29108F']}
          start={{ x: 0.06, y: 0 }}
          end={{ x: 0.94, y: 1 }}
          style={styles.fill}
        />
        <View pointerEvents="none" style={styles.canopyGlowCyan} />
        <View pointerEvents="none" style={styles.canopyGlowLime} />
        <View pointerEvents="none" style={styles.canopyOrbitArc} />
        <Text accessible={false} style={styles.canopyGlyphStar}>✦</Text>

        <View style={[styles.canopyInner, { width: contentWidth }]}>
          <View style={styles.canopyRow}>
            <IconButton
              label="Înapoi"
              onPress={() => navigation.goBack()}
              size={42}
              style={styles.canopyActionBtn}
            >
              <MiniGlyph name="back" size={18} color={colors.violetDeep} />
            </IconButton>

            <View style={styles.canopyCopy}>
              <Text maxFontSizeMultiplier={1.25} numberOfLines={1} style={styles.canopyTitle}>
                Legal și <Text style={styles.canopyTitleAccent}>siguranță</Text>
              </Text>
              <View style={styles.canopyEyebrowRow}>
                <View style={styles.canopyEyebrowDot} />
                <Text maxFontSizeMultiplier={1.15} numberOfLines={1} style={styles.canopyEyebrow}>
                  INFORMAȚII CLARE
                </Text>
              </View>
            </View>

            <View accessible={false} style={styles.canopyShieldBadge}>
              <AppIcon name="privacy" size={24} />
            </View>
          </View>
        </View>
      </View>

      {/* Straddling 3D tactile tab switcher */}
      <View style={[styles.tabWrap, { paddingHorizontal: gutter }]}>
        <View style={[styles.tabInner, { maxWidth: contentWidth }]}>
          <ComicTabBar options={tabs} value={tab} onChange={chooseTab} />
        </View>
      </View>

      <TabPanel key={tab} direction={direction} style={styles.tabStage}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingHorizontal: gutter, paddingBottom: Math.max(insets.bottom, 16) + 22 }]}
        >
          <View style={[styles.tabBody, { maxWidth: contentWidth }]}>
          {tab === 'overview' ? (
            <>
              <View style={styles.heroCard}>
                <View pointerEvents="none" style={styles.cardTopGloss} />
                <View style={styles.heroIcon}><AppIcon name="privacy" size={52} /></View>
                <Text style={styles.heroEyebrow}>PE SCURT</Text>
                <View style={styles.heroTitleWrap}>
                  <View pointerEvents="none" style={styles.heroTitleHighlight} />
                  <Text style={styles.heroTitle}>Tu îți controlezi datele.</Text>
                </View>
                <Text style={styles.heroText}>Folosim fotografia sau formula trimisă de tine ca să construim explicația. Poți începe fără cont Google, nu avem reclame și nu vindem date.</Text>
                <View style={styles.chips}>
                  <Chip label="13+ · Acord sub 16" tone="violetSoft" />
                  <Chip label="Fără reclame" tone="lime" />
                  <Chip label="Ștergere din aplicație" tone="cyanSoft" />
                </View>
              </View>

              <Section number="01" title="Ce se întâmplă cu poza">
                <Bullet>O comprimi și o încadrezi direct pe telefon.</Bullet>
                <Bullet>Este trimisă securizat prin serviciul aplicației către OpenAI API (fără numele, e-mailul sau contul tău), pentru o singură analiză sau pentru corectarea pe barem a unei rezolvări de simulare.</Bullet>
                <Bullet>Nu este stocată în cloud și nu apare în Caiet.</Bullet>
                <Bullet>Dacă scrii problema, trimitem formula și, la verificare, rezolvarea introdusă de tine către același serviciu. Ciorna rămâne pe telefon până alegi să pornești analiza.</Bullet>
                <Bullet>Cererile sunt trimise fără stocare de conversație, iar datele trimise prin OpenAI API nu sunt folosite implicit pentru antrenarea modelelor; furnizorul poate păstra temporar jurnale tehnice limitate doar pentru siguranță și prevenirea abuzului.</Bullet>
              </Section>

              <Section number="02" title="Tu controlezi Caietul și studiul">
                <Paragraph>Lecțiile nesalvate expiră automat după 7 zile. Lecțiile salvate în Caiet rămân cât timp îl folosești, dar sunt șterse după aproximativ 13 luni fără activitate. Progresul de studiu (nivelul ales, formule favorite, exerciții stăpânite, lista „De repetat”, seria zilnică și simulările finalizate) se sincronizează pentru contul tău, iar ciorna unei simulări puse pe pauză rămâne exclusiv local pe telefon (până la 14 zile); toate se șterg complet din Setări.</Paragraph>
              </Section>

              <Section number="03" title="Inteligența artificială explică, nu decide">
                <Paragraph>Răspunsurile, exercițiile generate cu AI și punctajele orientative pe barem pot conține greșeli. Profu’ de mate este un ajutor educațional, nu înlocuiește profesorul sau comisiile EN/BAC și nu produce decizii cu efect juridic ori academic.</Paragraph>
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
                <Bullet>Un identificator Firebase pentru spațiul aplicației; dacă alegi Google, adresa de e-mail, numele și identificatorul contului furnizate de Google. Pentru cota zilnică gratuită și prevenirea abuzului, aplicația derivă local un hash SHA-256 din identificatorul de dispozitiv specific aplicației Android (fără a transmite valoarea brută), iar backendul transformă atât acest hash, cât și identificatorul Google în coduri HMAC opace.</Bullet>
                <Bullet>Fotografia sau formula aleasă de tine, rezolvarea introdusă pentru verificare, cererea de exerciții AI ori corectarea foto pe barem la simulări.</Bullet>
                <Bullet>Soluția, verdictul, materia și starea de salvare a lecției.</Bullet>
                <Bullet>Progresul de studiu (profilul ales, formule favorite, exerciții stăpânite, lista „De repetat”, seria zilnică și rezultatele simulărilor finalizate) sincronizat pentru contul activ; ciorna unei simulări aflate în pauză rămâne salvată exclusiv local pe telefon.</Bullet>
                <Bullet>Categoria unui raport trimis de tine și, doar dacă activezi opțiunea, date tehnice de blocare.</Bullet>
                <Bullet>Starea abonamentului și produsul cumpărat, fără numărul cardului sau datele de plată.</Bullet>
                <Bullet>Semnale Play Integrity (App Check), când sunt disponibile, folosite exclusiv pentru securitatea aplicației și prevenirea cererilor neautorizate.</Bullet>
                <Bullet>Infrastructura poate înregistra automat metadate de conexiune, precum adresa IP, mărimea cererii, latența și codul răspunsului, fără conținutul fotografiei.</Bullet>
              </Section>

              <Section number="02" title="De ce și pe ce temei legal (GDPR)">
                <Bullet>Executarea serviciului (Art. 6(1)(b)): analiza problemei, explicațiile pas cu pas, exercițiile AI, corectarea pe barem, sincronizarea Caietului/progresului și abonamentele.</Bullet>
                <Bullet>Interes legitim (Art. 6(1)(f)): securitatea aplicației (Play Integrity / App Check), limitarea abuzului, controlul costurilor și investigarea răspunsurilor raportate.</Bullet>
                <Bullet>Consimțământ (Art. 6(1)(a)): rapoartele tehnice opționale (Crashlytics), pe care le poți opri oricând din Setări.</Bullet>
                <Bullet>Obligație legală (Art. 6(1)(c)): respectarea obligațiilor legale și fiscale aplicabile.</Bullet>
              </Section>

              <Section number="03" title="Cine procesează datele și transferuri">
                <Paragraph>Folosim Google Firebase (servere în UE, europe-west1) pentru autentificare, funcții și baza de date; Google Sign-In dacă îl alegi; Google Play pentru plăți și verificarea integrității; RevenueCat, Inc. pentru starea abonamentului; Firebase Crashlytics doar dacă îl activezi; și OpenAI, LLC (OpenAI API) pentru analiza matematică, generarea de exerciții și corectarea orientativă pe barem. Nu folosim rețele publicitare și nu vindem date.</Paragraph>
                <Paragraph>Deoarece OpenAI, RevenueCat și infrastructura globală Google pot procesa date în SUA, transferurile în afara SEE se fac în baza garanțiilor GDPR (Clauze Contractuale Standard / EU–US Data Privacy Framework).</Paragraph>
              </Section>

              <Section number="04" title="Cât timp le păstrăm">
                <Bullet>Fotografia nu este stocată de aplicație în cloud sau în Caiet.</Bullet>
                <Bullet>Ciornele editorului rămân pe telefon, separat pentru rezolvare și verificare. Expiră după 7 zile fără editare și sunt eliminate la următoarea deschidere a editorului; sunt șterse și la deconectare, schimbarea contului sau ștergerea datelor. Datele locale pentru reluarea unei analize expiră după 30 de minute și sunt curățate la următoarea verificare.</Bullet>
                <Bullet>Progresul de studiu și rezultatele simulărilor sincronizate rămân cât timp contul există și sunt eliminate definitiv când alegi ștergerea datelor din Setări. Progresul local al unei simulări puse pe pauză expiră automat după 14 zile și se șterge la predare, deconectare sau ștergerea datelor.</Bullet>
                <Bullet>Lecția nesalvată și rezultatul tehnic temporar: expirare după 7 zile.</Bullet>
                <Bullet>Contoarele zilnice și rezervările anti-abuz: expirare după 35 de zile.</Bullet>
                <Bullet>După ștergerea datelor sau a contului, contorul zilnic al acțiunilor AI folosite în ziua curentă rămâne numai până la miezul nopții (următoarea resetare zilnică), apoi intră în curățarea automată. Identificatorul tehnic anonimizat (HMAC) al instalării poate fi păstrat minimizat până la 400 de zile exclusiv pentru prevenirea abuzului la reinstalare, fără e-mail, nume sau identificatorul contului Google.</Bullet>
                <Bullet>Nu folosim identificatorul de dispozitiv pentru publicitate și nu îl partajăm cu terți.</Bullet>
                <Bullet>Evenimentele tehnice ale abonamentului: maximum aproximativ 13 luni; starea curentă a abonamentului este păstrată cât timp contul există.</Bullet>
                <Bullet>Metadatele standard din jurnalele de infrastructură: în mod normal 30 de zile.</Bullet>
                <Bullet>Lecțiile salvate: până le ștergi sau după aproximativ 13 luni fără folosirea Caietului.</Bullet>
                <Paragraph>Termenele indică expirarea programată. Curățarea rulează zilnic: eliminarea fizică are loc de regulă în următoarele 24 de ore după expirare; incidentele tehnice pot întârzia execuția.</Paragraph>
                <Bullet>Pentru a opri răspunsurile întârziate să refacă date șterse, păstrăm un blocaj tehnic anonimizat timp de 35 de zile după finalizarea ștergerii. O ștergere incompletă păstrează blocajul până la finalizare.</Bullet>
                <Bullet>Un transfer de lecții și progres început la conectarea cu Google păstrează identificatorii tehnici necesari reluării până la finalizare sau rezolvarea incidentului.</Bullet>
                <Bullet>Rapoartele tale și răspunsul generat raportat: 180 de zile sau până ștergi toate datele din aplicație, dacă alegi ștergerea mai devreme.</Bullet>
              </Section>

              <Section number="05" title="Drepturile tale GDPR">
                <Paragraph>Poți opri rapoartele tehnice, te poți deconecta fără să ștergi datele sau poți șterge definitiv contul, lecțiile, progresul de studiu, simulările și raportările din Setări. După ștergere, aplicația creează automat un spațiu temporar nou, fără legătură cu identitatea ștearsă, ca să poată fi folosită fără conectare. Pentru conturile Google, ștergerea înregistrează și cererea de eliminare a profilului tehnic RevenueCat, care necesită verificarea echipei de suport până la soluționare, dar nu oprește automat abonamentul din Google Play. Numai contoarele anti-abuz minimizate, totalurile anonime și jurnalele tehnice strict necesare securității pot urma retențiile limitate descrise aici. Datele contului nu mai pot fi recuperate.</Paragraph>
                <Paragraph>
                  Conform GDPR, ai dreptul de acces, rectificare, ștergere, restricționare, portabilitate, opoziție și retragere a consimțământului, precum și dreptul de a depune o plângere la ANSPDCP (
                  <Text accessibilityRole="link" onPress={() => void Linking.openURL('https://www.dataprotection.ro').catch(() => undefined)} style={styles.inlineLink}>www.dataprotection.ro</Text>
                  ).
                </Paragraph>
                {legalDocument.contactEmail ? (
                  <Paragraph>
                    Pentru întrebări sau exercitarea drepturilor:{' '}
                    <Text accessibilityRole="link" onPress={() => void Linking.openURL(`mailto:${legalDocument.contactEmail}`).catch(() => undefined)} style={styles.inlineLink}>{legalDocument.contactEmail}</Text>
                  </Paragraph>
                ) : null}
              </Section>

              <Section number="06" title="Vârsta, acordul parental și date sensibile">
                <Paragraph>Aplicația este destinată persoanelor de cel puțin {legalDocument.minimumAge} ani și părinților. Copiii sub {legalDocument.minimumAge} ani o pot folosi doar împreună cu un părinte sau tutore.</Paragraph>
                <Paragraph>În România, conform Legii nr. 190/2018, pragul de consimțământ digital este 16 ani: între 13 și 15 ani este necesar acordul părintelui sau tutorelui legal. La prima deschidere salvăm local doar categoria de eligibilitate, fără a colecta data nașterii. Nu fotografia nume, fețe, adrese, note sau alte informații personale; încadrează doar problema de matematică.</Paragraph>
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
                <Paragraph>Profu’ de mate oferă fișe de formule offline, ghiduri și simulări EN/BAC, exerciții interactive, explicații și verificări pentru rezolvări. Răspunsurile și punctajele orientative generate automat pot conține greșeli, așa că verifică rezultatul înainte să îl folosești la teme, teste sau examene.</Paragraph>
              </Section>

              <Section number="02" title="Folosire permisă">
                <Bullet>Trimite doar conținut matematic pe care ai dreptul să îl folosești.</Bullet>
                <Bullet>Nu încerca să eviți limitele, filtrele sau securitatea aplicației.</Bullet>
                <Bullet>Nu trimite date personale, conținut ilegal, ofensator sau periculos.</Bullet>
                <Bullet>Respectă regulile școlii și indicațiile profesorului.</Bullet>
              </Section>

              <Section number="03" title="Disponibilitate și limite">
                <Paragraph>Formulele, ghidurile și testele pregătite merg și offline. Funcțiile AI (analiză foto/scrisă, exerciții AI și corectare foto pe barem) au nevoie de internet și pot avea limite zilnice, perioade de mentenanță sau întreruperi ale furnizorilor. Putem opri accesul automat când detectăm abuz sau risc de securitate.</Paragraph>
              </Section>

              <Section number="04" title="Abonamentul și rambursările">
                <Bullet>Plata, anularea și cererile de rambursare sunt procesate exclusiv prin Google Play; noi nu primim datele cardului.</Bullet>
                <Bullet>Prețul, moneda, perioada și eventualele oferte sunt cele afișate de Google Play înainte de confirmare.</Bullet>
                <Bullet>Abonamentul se reînnoiește automat până când îl oprești din Google Play. Oprirea reînnoirii păstrează accesul până la sfârșitul perioadei plătite.</Bullet>
                <Bullet>Poți restaura o achiziție din ecranul Pro &amp; Max folosind același cont Google Play. Ștergerea aplicației sau a datelor nu anulează abonamentul.</Bullet>
                <Bullet>Pentru conținutul și serviciile digitale livrate imediat la activare se aplică regulile OUG nr. 34/2014 și politica Google Play.</Bullet>
              </Section>

              <Section number="05" title="Raportează o problemă">
                <Paragraph>Din fiecare lecție sau recapitulare poți semnala un răspuns greșit, neclar ori nepotrivit fără să ieși din aplicație. Mesajul tău ne ajută să îmbunătățim filtrele și explicațiile.</Paragraph>
              </Section>

              <Section number="06" title="Legea aplicabilă, suport și ANPC">
                <Paragraph>
                  Acești termeni sunt guvernați de legea română. Pentru suport tehnic scrie la{' '}
                  <Text accessibilityRole="link" onPress={() => void Linking.openURL(`mailto:${legalDocument.supportEmail}`).catch(() => undefined)} style={styles.inlineLink}>{legalDocument.supportEmail}</Text>
                  , iar pentru plăți la{' '}
                  <Text accessibilityRole="link" onPress={() => void Linking.openURL(`mailto:${legalDocument.billingEmail}`).catch(() => undefined)} style={styles.inlineLink}>{legalDocument.billingEmail}</Text>
                  . Consumatorii din România pot apela și la ANPC / Soluționarea Alternativă a Litigiilor (
                  <Text accessibilityRole="link" onPress={() => void Linking.openURL('https://anpc.ro').catch(() => undefined)} style={styles.inlineLink}>anpc.ro</Text>
                  ).
                </Paragraph>
              </Section>

              <View style={styles.safetyCard}>
                <AppIcon name="help" size={48} />
                <View style={styles.safetyCopy}>
                  <Text style={styles.safetyTitle}>Ai găsit o greșeală?</Text>
                  <Text style={styles.safetyText}>Atinge butonul de raportare din lecție sau recapitulare. Lecția rămâne în Caiet, iar trimiterea durează câteva secunde.</Text>
                </View>
              </View>
            </>
          ) : null}
          </View>
        </ScrollView>
      </TabPanel>
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
    paddingBottom: 32,
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
    backgroundColor: 'rgba(67, 214, 230, 0.24)',
  },
  canopyGlowLime: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    top: -40,
    right: -40,
    backgroundColor: 'rgba(216, 255, 62, 0.14)',
  },
  canopyOrbitArc: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    top: -120,
    right: -82,
  },
  canopyGlyphStar: {
    position: 'absolute',
    right: 78,
    bottom: 12,
    fontFamily: fonts.display,
    fontSize: 22,
    color: 'rgba(216, 255, 62, 0.24)',
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
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.3,
    textShadowColor: 'rgba(18, 6, 62, 0.28)',
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 3,
  },
  canopyTitleAccent: {
    color: colors.lime,
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
    flexShrink: 1,
    fontFamily: fonts.bodyBold,
    color: 'rgba(240, 245, 255, 0.92)',
    fontSize: 10,
    letterSpacing: 0.9,
    includeFontPadding: false,
  },
  canopyShieldBadge: {
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

  tabWrap: {
    marginTop: -22,
    paddingBottom: 10,
    zIndex: 8,
    alignItems: 'center',
  },
  tabInner: {
    width: '100%',
  },
  tabStage: { flex: 1, minHeight: 0 },
  content: { paddingTop: 4, alignItems: 'center' },
  tabBody: { width: '100%', gap: 12 },

  heroCard: {
    borderRadius: 26,
    borderWidth: 1.5,
    borderBottomWidth: 4,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  cardTopGloss: {
    position: 'absolute',
    top: 0,
    left: 24,
    right: 24,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderWidth: 1.4,
    borderBottomWidth: 3.5,
    borderColor: '#DDF68E',
    borderBottomColor: '#B1D63D',
    borderRadius: 24,
    backgroundColor: '#F4FFD2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEyebrow: { ...typography.kicker, color: colors.violetDeep, marginTop: 12 },
  heroTitleWrap: { position: 'relative', alignItems: 'center', marginTop: 3 },
  heroTitleHighlight: {
    position: 'absolute',
    bottom: 2,
    width: 170,
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(216, 255, 62, 0.65)',
  },
  heroTitle: { fontFamily: fonts.display, color: colors.ink, fontSize: 26, lineHeight: 30, textAlign: 'center' },
  heroText: { maxWidth: 320, fontFamily: fonts.body, color: colors.inkSoft, fontSize: 13.5, lineHeight: 19, textAlign: 'center', marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 7, marginTop: 14 },

  section: {
    borderRadius: 22,
    borderWidth: 1.4,
    borderBottomWidth: 3.5,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FFFFFF',
    padding: 15,
  },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionNumber: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 1.2,
    borderBottomWidth: 2.5,
    borderColor: '#DDF68E',
    borderBottomColor: '#B1D63D',
    backgroundColor: colors.limeSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionNumberText: { fontFamily: fonts.display, color: colors.violetDeep, fontSize: 12.5 },
  sectionTitle: { flex: 1, fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 17.5, lineHeight: 21 },
  sectionBody: { gap: 7, marginTop: 10, paddingLeft: 2 },
  paragraph: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 13.5, lineHeight: 20 },
  inlineLink: { fontFamily: fonts.bodyBold, color: colors.violetDeep, textDecorationLine: 'underline' },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  bulletDot: { width: 7, height: 7, borderRadius: 999, backgroundColor: colors.peach, marginTop: 6.5 },
  bulletText: { flex: 1, fontFamily: fonts.body, color: colors.inkSoft, fontSize: 13.5, lineHeight: 20 },

  updated: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  updatedText: { fontFamily: fonts.bodyBold, color: colors.inkSoft, fontSize: 12.5 },
  documentIntro: {
    borderRadius: 22,
    borderWidth: 1.4,
    borderBottomWidth: 3.5,
    borderColor: '#E5DCFF',
    borderBottomColor: '#CEC0F8',
    backgroundColor: '#FFFFFF',
    padding: 16,
  },
  documentEyebrow: { ...typography.kicker, color: colors.violetDeep },
  documentTitle: { fontFamily: fonts.display, color: colors.ink, fontSize: 24, lineHeight: 28, marginTop: 3 },
  documentLead: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 13.5, lineHeight: 19.5, marginTop: 4 },
  safetyCard: {
    borderRadius: 22,
    borderWidth: 1.4,
    borderBottomWidth: 3.5,
    borderColor: '#DDF68E',
    borderBottomColor: '#B1D63D',
    backgroundColor: '#F6FFD4',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 14,
  },
  safetyCopy: { flex: 1 },
  safetyTitle: { fontFamily: fonts.displaySemi, color: colors.ink, fontSize: 17.5 },
  safetyText: { fontFamily: fonts.body, color: colors.inkSoft, fontSize: 13, lineHeight: 18, marginTop: 2 },
});
