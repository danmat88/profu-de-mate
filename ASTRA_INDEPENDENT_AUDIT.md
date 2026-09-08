# ASTRA — audit tehnic independent

**Profu’ de mate · 5 septembrie 2026 · Europe/Bucharest**  
Workspace: `C:\Users\Daniel\Desktop\profu-de-mate`  
Commit inspectat: `db85cd666132008044196d193d3359d0f1b4a68a` (05.09.2026, 14:08:46 +03:00).  
Companion: [dashboard autonom](ASTRA_INDEPENDENT_DASHBOARD.html).

## Verdict

**Produs în dezvoltare cu o implementare substanțială, dar neacceptabil în forma actuală pentru beta 13+ sau producție Google Play.** Poate continua dezvoltarea. Cele 151 de teste existente trec, însă probele suplimentare confirmă defecte de funcționare și de control al costurilor pe care ele nu le detectează.

Cele trei priorități P0 sunt incompatibilitatea condițiilor Gemini API cu publicul 13+ (A01), două APK-uri cu token App Check debug și semnătură Android Debug (A02), respectiv contorul global care nu limitează încercările AI facturabile (A03). Urmează Caietul gol blocat în loading (A04), modul AI greșit acceptat server-side (A05), reluarea defectuoasă a cererilor abandonate (A06) și logout-ul condiționat de rețea (A08). Dovezile și limitele fiecărei afirmații sunt în registrul de mai jos; nu afirm că tokenul este încă autorizat sau că defectele au fost observate în trafic real.

Nu rezultă din acest audit că trebuie reconstruită întreaga aplicație. Rezultă că sunt necesare contracte mai stricte între componente, probe comportamentale și dovezi asupra candidatului distribuit. Nici existența unui APK, nici un checkmark local nu reprezintă acceptarea Google Play.

## Mandat, independență și metodă

Am folosit codul/configurațiile operaționale, fișierele binare, comenzi fără emitere de fișiere, teste și surse oficiale actuale. Am inspectat straturile client, backend, securitate, identitate, costuri, monetizare, date, packaging, CI și UX, urmărind cazuri-limită între ele. Nu am presupus corectitudine din comentarii sau numele testelor.

Nu am citit AUDIT_PROMPT.md, RELEASE_DASHBOARD.html, audituri, roadmapuri, handoff-uri ori evaluări de readiness existente, nici ulterior pentru validarea concluziilor. AGENTS.md și documentația exactă [Expo v57](https://docs.expo.dev/versions/v57.0.0/) au fost citite înaintea codului de probe/artefacte. Colectarea unor rezultate brute de comandă și a linkurilor oficiale a fost paralelizată; concluziile, prioritățile, criteriile și designul acestui audit au fost stabilite aici din dovezile primare, fără a prelua evaluări ale altor agenți.

Git era curat la început. Au fost luate în calcul și fișiere ignorate: configurația locală a fost verificată numai pentru prezența valorilor relevante, fără afișarea secretelor; native Android și cele patru APK-uri din dist au fost inspectate. Fișierele cu scop evaluativ au rămas excluse. Nu am folosit imagini istorice ca dovadă a UI-ului curent. Nu am modificat surse, pachete, documente vechi, servicii cloud sau date și nu am făcut build, deploy, commit/push. Singurele fișiere create sunt acest raport și dashboardul.

### Niveluri de dovadă

- **Verificat direct:** fișier/linie, metadată binară ori răspuns HTTP observat în această sesiune.
- **Demonstrat prin teste:** cod executat cu intrări și rezultate precizate; mockurile și ceasul virtual sunt declarate.
- **Dedus din cod:** traseu logic identificat, fără a pretinde reproducere pe Android/cloud.
- **Neverificat:** dovada necesară nu a fost obținută; existența implementării nu închide criteriul.
- **Blocat de informații/acces:** console, dispozitive, contracte ori aprobări care nu au fost accesibile/verificate. Nu înseamnă că nu există în afara workspace-ului.

### Legendă și priorități

- ✅ **verificat și acceptat**
- 🟡 **implementat parțial sau insuficient demonstrat**
- ❌ **defect confirmat**
- ⚪ **absent și necesar**
- ⛔ **blocat extern**
- ❓ **nu poate fi verificat încă**

**P0:** rezolvare înainte de expunere externă relevantă; incompatibilitate fundamentală sau risc critic. **P1:** blocant pentru acceptarea beta/producției ori pentru proba unui flux esențial. **P2:** robustețe, mentenanță și criterii de acceptare limitate. Prioritatea este ordinea de tratare/menținere, nu un scor CVSS.

Registrul are **30 elemente**, dintre care 5 acceptate numai în limitele precizate, 7 defecte confirmate, 12 parțiale, 2 absențe necesare, 2 blocaje externe și 2 încă neverificabile. **Nu calculez un procent de readiness.** Elementele au importanță și granularitate diferite, iar un singur P0 poate opri release-ul. Aceste numere nu reprezintă probabilitatea aprobării Play.

## Sistemul găsit

| Strat | Ce există în implementare | Dovadă și limită |
|---|---|---|
| Android | Expo 57.0.20, React Native 0.86.3, React 19.2.3; package ro.profudemate.app, orientare portrait; configurație target/compile API 36 | package.json:10–62; app.json:6–41; app.config.js:39–45. Candidat actual neconstruit. |
| Navigație | Home, Capture, Review, Processing, Lesson, Summary, Notebook, Settings, Legal, Paywall | App.tsx:86–96; nu au fost navigate pe telefon în audit. |
| Captură/import | expo-camera și picker de imagini, editare/crop/rotație, JPEG cu muchie maximă 1800; fișiere temporare în cache gestionat | CaptureScreen.tsx:186–218; imagePipeline.ts:5–49; temporaryImages.ts:56–75. Datele EXIF/OEM nu sunt probate nativ. |
| Analiză | Callable Firebase în europe-west1, Auth și App Check condițional; Gemini 3.7 Flash prin Interactions, store=false; validare Zod, normalizare, până la 3 încercări, MathJax→SVG | functions/src/index.ts:199–309; providerPipeline.ts:42–94; mathRenderer.ts:78–156. Nicio cerere AI live executată. |
| Lecții | Rezultatul ready este salvat automat ca lecție ne-favorită; utilizatorul o păstrează în Caiet prin isFavorite. Răspunsurile sunt cached după UID+requestId | index.ts:156–177, 287–309; lessons.ts:61–139. Caietul folosește Firestore plus cache RAM, fără paginare în query. |
| Identitate și cote | Auth anonim→Google; HMAC server pentru identitatea comercială; token de instalare în SecureStore; cote implicite 5 welcome, 5/zi Google free, 30/zi premium, reset Europe/Bucharest | commercialIdentity.ts:55–87; commercialAccess.ts:64–70, 192–268; src/services/installationIdentity.ts. Configurația runtime poate modifica limitele. |
| Plăți | react-native-purchases 10.9.0; UI lunar/anual, prețuri din Play, restore, managementURL; sincronizare server RevenueCat și webhook HMAC opționale prin flag | purchases.ts:30–111; index.ts:560–671. Metadata APK indică Billing 8.3.0; produse/tranzacții externe neverificate. |
| Date și suport | Ștergere Firebase și RevenueCat cu retry extern; cleanup programat; feedback pe lecții; diagnostice Crashlytics opt-in; pagini publice Hosting | index.ts:673–850; firebase.json:2–6, 24–48; T07. Operațiile cloud efective nu sunt atestate. |

Traseul principal este: **fotografie/import → editare locală → verificare acces → cerere cu requestId și installationToken → rezervare cotă → AI/validare/randare → scriere tranzacțională rezultat și taxare → lecție → salvare în Caiet**. Cazurile A03–A08 și A14 apar la frontierele acestui traseu. Pentru amprenta datelor, imaginea părăsește telefonul; «nu este în Storage/Caiet» nu înseamnă «nu este colectată» sau «nu există loguri de furnizor» ([Data safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en)).

## Lucruri realizate bine, cu limitele dovezii

- A25 și A26: tipuri coerente, lint curat, 151 teste existente trecute; acestea oferă o bază de regresie, cu acoperirea limitată declarată.
- A28: paginile legale sunt efectiv publice, UTF-8 și identice cu sursa. Un site accesibil este demonstrat; calitatea juridică integrală și inboxul nu sunt.
- A29: configurația/manifestele și alinierea statică Android sunt verificate pe hashurile inventariate. Semnătura debug și lipsa provenienței sunt tratate separat.
- A30: minimizarea payloadului lecției și diagnosticele opt-in sunt proprietăți verificabile ale codului.
- A27, A09 și A15: reguli deny-by-default, HMAC, tranzacții, merge tickets și mecanisme de recovery există și au un rol justificat. Le păstrez 🟡 deoarece acceptarea securității și lifecycle-ului cere probe suplimentare, iar defectele găsite ating chiar aceste frontiere.

## Registrul constatărilor

<a id="A01"></a>
### A01 · ❌ · P0 — Furnizorul AI actual este incompatibil cu publicul 13+

**Statut:** defect confirmat. **Responsabil principal:** Daniel.  
**Tip de dovadă:** Verificat direct: cod și termeni oficiali.

**Dovezi exacte:** [functions/src/index.ts:236–249](functions/src/index.ts); [src/legal.ts:2–4](src/legal.ts); [Gemini API — Age Requirements / Use Restrictions](https://ai.google.dev/gemini-api/terms).

**Impact real / observație:** Traseul AI ales nu poate fundamenta lansarea produsului 13+ în condițiile publice actuale. Gemini API interzice clienții destinați sau probabil accesați de persoane sub 18 ani; pentru SEE cere servicii plătite.

**Cauză probabilă:** Clientul GoogleGenAI este creat cu apiKey, fără configurare Vertex AI; și politica produsului numește Gemini Developer API. Nu există dovadă accesată a unei derogări contractuale.

**Remediere / următoarea acțiune:** Daniel alege un serviciu și condiții care permit explicit publicul dorit; agentul poate adapta integrarea după această decizie. Nu presupune că o simplă migrare la alt endpoint rezolvă eligibilitatea.

**Criteriu verificabil de acceptanță:** Termeni/contract aplicabili care permit utilizarea de către publicul 13+, cont plătit unde este cerut, integrare și informare actualizate, apoi test de contract pe noul traseu.

**Dependențe și blocaje:** Decizie Daniel; condițiile și accesul furnizorului. Blochează A10, A11, A16, A21.

<a id="A02"></a>
### A02 · ❌ · P0 — Două APK-uri conțin token debug și certificat Android Debug

**Statut:** defect confirmat. **Responsabil principal:** Daniel.  
**Tip de dovadă:** Verificat direct în binare; validitatea tokenului în cloud este neverificată.

**Dovezi exacte:** [T08 — inventar APK, hashuri și scanare în memorie](#T08); [src/services/firebase.ts:117–130](src/services/firebase.ts); [Firebase — debug provider](https://firebase.google.com/docs/app-check/android/debug-provider).

**Impact real / observație:** Un token debug înregistrat permite atestare de pe dispozitive neverificate. APK-urile production-test-v1.0.0-v9 și vc10-local-production-p0 conțin exact tokenul local în assets/index.android.bundle; ambele au semnătură Android Debug. Nu există dovadă că au fost distribuite sau că tokenul este încă autorizat.

**Cauză probabilă:** Artefacte istorice amestecate în dist, produse prin configurații diferite. Numele «production» nu identifică sigur certificatul sau conținutul.

**Remediere / următoarea acțiune:** Daniel verifică distribuția și înregistrarea tokenului, îl revocă dacă este înregistrat și compromis; agentul adaugă ulterior verificarea binarului final și o identificare fără ambiguități. Acest audit nu revocă și nu șterge nimic.

**Criteriu verificabil de acceptanță:** Artefactul final nu conține niciun token debug cunoscut, folosește cheia de release/Play aprobată; dovadă de revocare pentru tokenul expus dacă era înregistrat și inventar al canalelor afectate.

**Dependențe și blocaje:** Daniel + Firebase; A18 trebuie să verifice exact AAB-ul distribuit.

<a id="A03"></a>
### A03 · ❌ · P0 — Plafonul global nu plafonează consumul real al furnizorului AI

**Statut:** defect confirmat. **Responsabil principal:** agent.  
**Tip de dovadă:** Demonstrat prin proba T10 pe funcțiile reale, cu Firestore în memorie; efectul financiar este dedus.

**Dovezi exacte:** [functions/src/commercialAccess.ts:393–445, 547–567](functions/src/commercialAccess.ts); [functions/src/providerPipeline.ts:10, 49–91](functions/src/providerPipeline.ts); [functions/src/runtimeConfig.ts:25–29](functions/src/runtimeConfig.ts); [T10 — 12 rezervări la plafon 2](#T10).

**Impact real / observație:** 12 analize respinse pot trece succesiv de un plafon global 2 deoarece contorul revine la zero. O analiză poate face până la 3 apeluri AI. Cota restituită utilizatorului nu înseamnă cost restituit de furnizor; o rată mare de imagini neclare/erori poate depăși bugetul presupus.

**Cauză probabilă:** Același contor măsoară rezervări/rezultate taxabile și presupusul buget AI. Refund scade inclusiv totalul global; retry-urile interne nu au rezervare distinctă.

**Remediere / următoarea acțiune:** Separă alocația utilizatorului de bugetul nerefundabil pentru încercări AI, tokeni și cost; rezervă înaintea fiecărui apel și stabilește timeout și buget de ieșire explicit.

**Criteriu verificabil de acceptanță:** La plafon N sunt permise cel mult N apeluri AI, inclusiv repair/retry/unclear/timeout. Cota utilizatorului se restituie separat. Teste concurente și metrici reconciliate cu facturarea.

**Dependențe și blocaje:** Definire buget Daniel; A09 și A20. Necesar înainte de trafic extern.

<a id="A04"></a>
### A04 · ❌ · P1 — Caietul gol poate rămâne permanent în încărcare

**Statut:** defect confirmat. **Responsabil principal:** agent.  
**Tip de dovadă:** Demonstrat prin T09 pe serviciul real; blocarea ecranului este dedusă din legătura cu state-ul React.

**Dovezi exacte:** [src/services/lessons.ts:72, 122–128](src/services/lessons.ts); [src/screens/NotebookScreen.tsx:300–327, 444–450](src/screens/NotebookScreen.tsx); [T09 — primul snapshot gol](#T09).

**Impact real / observație:** Un utilizator fără lecții salvate primește loaderul în locul stării goale și al îndrumării pentru prima lecție.

**Cauză probabilă:** previousLessons pornește ca []; primul snapshot [] este considerat identic și întoarce înainte de onChange. Cache-ul rămâne undefined.

**Remediere / următoarea acțiune:** Emite obligatoriu primul snapshot valid, inclusiv []; aplică deduplicarea numai după prima emisie.

**Criteriu verificabil de acceptanță:** Primul snapshot gol produce exact o notificare cu [], cache [], iar ecranul părăsește loading. Verifică și gol→nevid→gol și revenire după schimbarea contului.

**Dependențe și blocaje:** Nicio dependență externă pentru remediere; A19 pentru test pe Android.

<a id="A05"></a>
### A05 · ❌ · P1 — Backendul acceptă un rezultat AI pentru modul opus

**Statut:** defect confirmat. **Responsabil principal:** agent.  
**Tip de dovadă:** Demonstrat prin T11 cu schema și rendererul reale, răspuns de furnizor injectat.

**Dovezi exacte:** [functions/src/providerPipeline.ts:74–86](functions/src/providerPipeline.ts); [functions/src/index.ts:287–309](functions/src/index.ts); [src/services/mathAnalysis.ts:33–38, 67–69](src/services/mathAnalysis.ts); [T11 — check→solve și solve→check](#T11).

**Impact real / observație:** Serverul poate salva și taxa un rezultat ready de tip solve la o cerere check sau invers; clientul îl respinge ulterior. Utilizatorul vede eroare și poate pierde o problemă fără răspunsul cerut.

**Cauză probabilă:** Schema validează consistența internă a răspunsului, fără egalitatea candidate.mode === input.mode. Contractul mai strict este aplicat prea târziu, în client.

**Remediere / următoarea acțiune:** Verifică modul în pipeline înainte de randare și taxare; tratează nepotrivirea ca eroare de contract reparabilă. Leagă și cache-ul cererii de modul/inputul inițial.

**Criteriu verificabil de acceptanță:** Ambele nepotriviri sunt respinse sau reparate înainte de settle; fără consum definitiv pentru un rezultat inutilizabil. Refolosirea requestId cu alt mod/input nu livrează rezultat străin cererii.

**Dependențe și blocaje:** Nicio dependență externă; apoi A11.

<a id="A06"></a>
### A06 · ❌ · P1 — Reluarea unei cereri rămase processing nu recuperează lease-ul expirat

**Statut:** defect confirmat. **Responsabil principal:** agent.  
**Tip de dovadă:** Demonstrat prin T12 cu ceas virtual; traseul cloud este dedus din cod.

**Dovezi exacte:** [src/services/mathAnalysis.ts:89–114](src/services/mathAnalysis.ts); [functions/src/index.ts:165–177, 353–358](functions/src/index.ts); [src/screens/ProcessingScreen.tsx:239–244, 294–302](src/screens/ProcessingScreen.tsx); [T12 — 108 poll-uri, zero relansări](#T12).

**Impact real / observație:** Dacă workerul este oprit fără a marca failed, reluarea din Home interoghează 135 secunde și expiră. Retry-ul cu origin home repetă pollingul. Refund-ul comercial după 5 minute nu schimbă starea _analysisRequests.

**Cauză probabilă:** getAnalysisStatus returnează processing fără a verifica vârsta lease-ului; clientul nu ajunge la analyzeMathImage, unde există posibilitatea reclamării.

**Remediere / următoarea acțiune:** Expune starea lease-expired și permite recuperare idempotentă cu același requestId; păstrează markerul la erori tranzitorii și asociază starea cu identitatea corectă.

**Criteriu verificabil de acceptanță:** Simulează oprirea workerului după rezervare, așteaptă lease-ul, reia: o singură finalizare, o singură taxare, fără buclă de timeouts și fără pierderea markerului.

**Dependențe și blocaje:** A05, A14; integrare Firestore pentru concurență.

<a id="A07"></a>
### A07 · 🟡 · P1 — Ștergerea contului nu are o barieră împotriva operațiilor deja în curs

**Statut:** implementat parțial sau insuficient demonstrat. **Responsabil principal:** agent.  
**Tip de dovadă:** Dedus din cod; intercalarea concurentă nu a fost executată în cloud/emulator.

**Dovezi exacte:** [functions/src/index.ts:293–309, 319–330, 673–744](functions/src/index.ts); [functions/src/index.ts:789–810](functions/src/index.ts); [functions/src/dataDeletion.ts:33–65](functions/src/dataDeletion.ts).

**Impact real / observație:** Analiza sau triage-ul pornit înainte de ștergere poate scrie după ștergere. Un caz concret: settle găsește rezervarea eliminată, apoi catch recreează requestRef ca failed fără userId, astfel încât curățarea ulterioară după userId îl poate rata. Ștergerea este și o succesiune de operații, deci poate termina parțial.

**Cauză probabilă:** Lipsește o stare de cont «deleting/deleted» verificată la claim și înainte de orice rezultat; triggerul de feedback face set merge, care poate recrea un document șters.

**Remediere / următoarea acțiune:** Introdu un protocol idempotent de ștergere cu barieră verificată de scriitori, tratarea triggerelor întârziate și reconciliere a resturilor. Testează întreruperea fiecărei etape.

**Criteriu verificabil de acceptanță:** Ștergerea concurentă cu analyze, merge, webhook și triage nu lasă conținut/UID-uri recreabile; retry după eșec parțial converge; retențiile anti-abuz sunt singurele excepții documentate.

**Dependențe și blocaje:** A06, A14, A15 și servicii externe de ștergere; test de integrare necesar.

<a id="A08"></a>
### A08 · ❌ · P1 — Logout-ul cere verificare de rețea înainte de signOut

**Statut:** defect confirmat. **Responsabil principal:** agent.  
**Tip de dovadă:** Demonstrat prin T13 pentru eroarea de verificare; scenariul cold-start offline este dedus din firebase.ts.

**Dovezi exacte:** [src/services/commercial.ts:402–417](src/services/commercial.ts); [src/services/firebase.ts:54–73, 145–157](src/services/firebase.ts); [T13 — signOutCalls=0](#T13).

**Impact real / observație:** Un cont restaurat local, dar neverificat în procesul curent, nu se poate deconecta când token refresh/App Check eșuează. Este problematic și pe un telefon partajat.

**Cauză probabilă:** disconnectGoogleAccount apelează initializeVerifiedFirebaseServices înaintea deconectării locale, deși comentariul promite independență față de backend.

**Remediere / următoarea acțiune:** Folosește starea locală Auth pentru logout și curățarea izolată a cache-urilor; verificările online nu trebuie să condiționeze eliminarea sesiunii locale.

**Criteriu verificabil de acceptanță:** Cold-start cu cont Google, mod avion și Play Services indisponibil: signOut local reușește, Caietul și datele contului anterior nu sunt afișate, revenirea online nu reactivează contul.

**Dependențe și blocaje:** A14; validare Android necesară.

<a id="A09"></a>
### A09 · 🟡 · P1 — Protecția pentru Play și identitatea guest nu sunt garantate de configurația curentă

**Statut:** implementat parțial sau insuficient demonstrat. **Responsabil principal:** agent.  
**Tip de dovadă:** Verificat în cod; setările cloud efective sunt neverificate.

**Dovezi exacte:** [functions/src/releaseSecurity.ts:8–22](functions/src/releaseSecurity.ts); [functions/src/commercialAccess.ts:64–70, 385–390](functions/src/commercialAccess.ts); [functions/src/commercialIdentity.ts:55–79](functions/src/commercialIdentity.ts); [eas.json:31–48](eas.json).

**Impact real / observație:** Fără variabilă explicită, backendul nu impune App Check; Device Recall este off. installationToken este ales de client, astfel că o identitate nouă poate crea un alt contor guest. HMAC-ul ascunde tokenul, dar nu dovedește că acesta reprezintă un dispozitiv unic.

**Cauză probabilă:** Modul temporar pre-play-public este implicit, iar validarea de build nu dovedește stadiul backendului. Autentificarea anonimă nu este singură o barieră anti-automatizare.

**Remediere / următoarea acțiune:** Fă etapa Play explicită și verificabilă pentru backend, validează traficul fără atestare și politica guest. Alege comportamentul când Device Recall nu este disponibil/aprobat.

**Criteriu verificabil de acceptanță:** Configurația efectivă a funcțiilor Play impune App Check; cererile fără atestare sunt respinse; rotația UID/tokenului local nu acordă alocații necontrolate; utilizatorul legitim are fallback documentat.

**Dependențe și blocaje:** A02, A03; Daniel/Firebase/Play Integrity. Device Recall nu este o cerință obligatorie Google Play.

<a id="A10"></a>
### A10 · 🟡 · P1 — Free/premium este construit în cod, dar monetizarea completă nu este demonstrată

**Statut:** implementat parțial sau insuficient demonstrat. **Responsabil principal:** Daniel.  
**Tip de dovadă:** Dedus din cod; configurația comercială externă și tranzacțiile reale sunt neverificate.

**Dovezi exacte:** [src/services/purchases.ts:21–106](src/services/purchases.ts); [src/screens/PaywallScreen.tsx:246–274](src/screens/PaywallScreen.tsx); [functions/src/index.ts:60–65, 560–671](functions/src/index.ts); [RevenueCat — webhooks și HMAC](https://www.revenuecat.com/docs/integrations/webhooks).

**Impact real / observație:** Există prețuri din magazin, cumpărare, restore și sync server, dar nu există în audit dovada produselor active, contului merchant, webhookului și accesului premium după o tranzacție. Cheia RevenueCat lipsește din .env.local; asta nu dovedește că lipsește din EAS.

**Cauză probabilă:** Funcțiile RevenueCat sunt exportate numai dacă PROFU_ENABLE_REVENUECAT=true. Configurația externă nu este inclusă în sursele inspectate.

**Remediere / următoarea acțiune:** Daniel configurează/confirmă produsele lunar și anual, entitlements, licențele de test, credentialele și HMAC-ul webhookului. Agentul execută ulterior testele și corectează integrarea pe dovezi.

**Criteriu verificabil de acceptanță:** Pe un build Play: cumpărare, pending, cancel, restore pe alt dispozitiv, expirare, grace, refund și webhook duplicat validează accesul server; prețul/moneda/perioada coincid cu Google Play.

**Dependențe și blocaje:** A01, A09, A15, A18; RevenueCat + Play Console.

<a id="A11"></a>
### A11 · ⚪ · P1 — Lipsește o evaluare reproductibilă a corectitudinii matematice

**Statut:** absent și necesar. **Responsabil principal:** agent.  
**Tip de dovadă:** Absență în codul și testele operaționale inventariate; nu afirmă inexistența unor teste private ale proprietarului.

**Dovezi exacte:** [functions/src/providerPipeline.test.ts:5–29](functions/src/providerPipeline.test.ts); [functions/scripts/provider-contract-probe.mjs:7–18, 34–64](functions/scripts/provider-contract-probe.mjs); [functions/src/analysisSchema.ts:210–241](functions/src/analysisSchema.ts).

**Impact real / observație:** Trecerea schemei și randarea unei formule nu dovedesc un calcul sau verdict corect. Nu sunt măsurate OCR, pașii, diagnosticul unei greșeli, ambiguitatea, prompt injection și rezultatele pe clase/capitole.

**Cauză probabilă:** Testele folosesc fixtures; scriptul diagnostic primește o imagine, fără corpus etichetat, răspunsuri de referință și agregarea rezultatelor.

**Remediere / următoarea acțiune:** Construiește un corpus consimțit/sintetic, etichetat de profesor, cu solve/check, scris de mână, română, geometrie, imagini incomplete și conținut adversarial; fixează modelul și criteriile înaintea rulării.

**Criteriu verificabil de acceptanță:** Minimum 100 cazuri reprezentative ca prag inițial propus de audit, rubrică evaluată uman, rată de corectitudine și intervale de incertitudine, erori critice explicate; Daniel/profesorul aprobă pragul înainte de beta.

**Dependențe și blocaje:** A01, A05; Daniel pentru validare pedagogică și buget de execuție.

<a id="A12"></a>
### A12 · 🟡 · P1 — Raportarea și moderarea conținutului AI acoperă numai o parte din experiență

**Statut:** implementat parțial sau insuficient demonstrat. **Responsabil principal:** agent.  
**Tip de dovadă:** Dedus din traseele UI/backend; triage operațional neverificat.

**Dovezi exacte:** [src/components/FeedbackSheet.tsx:14–24, 92–108](src/components/FeedbackSheet.tsx); [src/screens/LessonScreen.tsx:291–294, 353](src/screens/LessonScreen.tsx); [src/screens/ProcessingScreen.tsx:276–278, 315–377](src/screens/ProcessingScreen.tsx); [functions/src/index.ts:377–393, 789–811](functions/src/index.ts); [Play — AI-generated content](https://support.google.com/googleplay/android-developer/answer/13985936?hl=en).

**Impact real / observație:** Lecțiile au raportare «unsafe» în aplicație. Răspunsurile AI respinse, afișate în Processing fără lessonId, nu au aceeași cale. Coada de triage atribuie severitate, dar nu dovedește că rapoartele sunt investigate și folosite la filtrare.

**Cauză probabilă:** Modelul de feedback cere o lecție existentă; stările not_math/unclear nu sunt lecții. Nu am găsit în cod un flux de decizie/moderare după status=new.

**Remediere / următoarea acțiune:** Permite raportarea fiecărui răspuns generat afișat, cu context minim și retenție explicită; Daniel desemnează cine investighează și în ce termen.

**Criteriu verificabil de acceptanță:** Din fiecare stare cu text AI se poate trimite un raport fără ieșirea din aplicație; raportul ajunge în coada corectă, are responsabil, rezoluție și test de regresie pentru incident.

**Dependențe și blocaje:** A01, A07, A11, A20; Daniel pentru operarea cozii.

<a id="A13"></a>
### A13 · 🟡 · P2 — Retenția declarată nu coincide exact cu mecanismul de curățare

**Statut:** implementat parțial sau insuficient demonstrat. **Responsabil principal:** agent.  
**Tip de dovadă:** Dedus din cod și textele produsului; politica TTL și execuția schedulerului în cloud sunt neverificate.

**Dovezi exacte:** [hosting/public/confidentialitate.html:58–69](hosting/public/confidentialitate.html); [src/screens/LegalScreen.tsx:151–161](src/screens/LegalScreen.tsx); [functions/src/index.ts:814–835](functions/src/index.ts); [src/services/lessons.ts:13–14, 85–98](src/services/lessons.ts); [functions/src/feedbackTriage.ts:4](functions/src/feedbackTriage.ts).

**Impact real / observație:** «Maximum 7/35 zile» nu este garantat de o curățare zilnică: fără alt mecanism verificat se poate adăuga aproape o zi, mai mult la eșec. Extinderea Caietului doar în ultimele 60 zile nu echivalează cu 13 luni de la fiecare ultimă folosire. Textul despre rapoarte diferă între web, aplicație și TTL-ul de 180 zile din cod.

**Cauză probabilă:** Pragurile expiresAt, executarea efectivă și sensul «activității» sunt confundate în informare; aceleași date sunt descrise manual în mai multe locuri.

**Remediere / următoarea acțiune:** Stabilește retenții realiste, momentele de extindere și intervalul de ștergere; sincronizează textele cu mecanismul și monitorizează întârzierile.

**Criteriu verificabil de acceptanță:** Teste cu ceas controlat pentru fiecare categorie și ultima activitate; documente expirate eliminate în termenul publicat, alerte la întârzieri; aceeași politică în aplicație și web.

**Dependențe și blocaje:** A07, A20; Daniel validează politica, cloud confirmă execuția.

<a id="A14"></a>
### A14 · 🟡 · P1 — Analiza în așteptare nu este legată de contul care a inițiat-o

**Statut:** implementat parțial sau insuficient demonstrat. **Responsabil principal:** agent.  
**Tip de dovadă:** Dedus din cod; comportamentul complet la schimbarea contului nu a fost testat pe Android.

**Dovezi exacte:** [src/services/pendingAnalysis.ts:9–15, 45–55](src/services/pendingAnalysis.ts); [src/services/commercial.ts:363–369, 402–418](src/services/commercial.ts); [src/services/mathAnalysis.ts:57–65, 74–78](src/services/mathAnalysis.ts); [App.tsx:86–94](App.tsx).

**Impact real / observație:** După continuare în fundal și logout/schimbare cont, markerul și fotografia pot fi reluate în noua sesiune. Lookup-ul cache-ului este după UID-ul curent; pot apărea expunerea fotografiei pe telefon partajat și reprocesare/taxare sub alt cont.

**Cauză probabilă:** Markerul are mode/image/requestId/time, fără UID sau cheie de sesiune; logout-ul nu îl invalidează. Restaurarea de la startup nici nu adaugă origin=home.

**Remediere / următoarea acțiune:** Leagă markerul și rezultatul de identitatea inițiatoare; definește explicit transferul la link/merge și ce se păstrează la logout. Corectează parametrii de reluare la cold-start.

**Criteriu verificabil de acceptanță:** Testele A→logout→B, guest→Google și restart nu afișează/transmit fotografia lui A ca fiind a lui B, nu dublează analiza și reiau numai cu identitatea autorizată.

**Dependențe și blocaje:** A06, A08, A15.

<a id="A15"></a>
### A15 · 🟡 · P1 — Fuziunea conturilor și sincronizarea Premium necesită teste de concurență și identitate

**Statut:** implementat parțial sau insuficient demonstrat. **Responsabil principal:** agent.  
**Tip de dovadă:** Dedus din cod; doar helper-ele pure sunt demonstrate prin testele existente.

**Dovezi exacte:** [functions/src/accountMerge.ts:139–160, 300–334](functions/src/accountMerge.ts); [src/services/commercial.ts:172–205, 316–370](src/services/commercial.ts); [src/services/purchases.ts:30–58, 83–106](src/services/purchases.ts); [tests/commercialLifecycle.test.mts:13–62](tests/commercialLifecycle.test.mts).

**Impact real / observație:** Există mecanisme serioase de ticket/merge și HMAC, dar copierea lecțiilor, migrarea cotelor, ștergerea sursei și tranzacția finală sunt etape diferite. Nu este dovedit comportamentul la două dispozitive, link în același UID, coliziune Google, restore ori schimbare de cont în timpul unei plăți.

**Cauză probabilă:** Testele mobile de lifecycle caută texte în sursă; testele de integrare prezente nu au fost executate în acest audit, iar callbacks de purchase/sync nu sunt toate legate de generația sesiunii.

**Remediere / următoarea acțiune:** Adaugă teste comportamentale cu întrerupere între etape, două sesiuni și răspunsuri întârziate; validează identitatea și după fiecare operație SDK/server.

**Criteriu verificabil de acceptanță:** Nicio lecție pierdută sau transferată altui cont, cote deduplicate, entitlement corect pentru contul activ, retry idempotent după fiecare întrerupere și restore după reinstalare.

**Dependențe și blocaje:** A07, A10, A14, A19; Firebase/RevenueCat/Play pentru probe reale.

<a id="A16"></a>
### A16 · ⛔ · P1 — Declarațiile Play și baza de prelucrare pentru minori cer decizii ale proprietarului

**Statut:** blocat extern. **Responsabil principal:** Daniel.  
**Tip de dovadă:** Blocat de lipsa dovezilor Play Console și a deciziilor juridice/comerciale accesate.

**Dovezi exacte:** [src/legal.ts:2–7](src/legal.ts); [hosting/public/confidentialitate.html:28–43, 75–79](hosting/public/confidentialitate.html); [Play — Data safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en); [Play — public țintă](https://support.google.com/googleplay/android-developer/answer/9867159?hl=en); [Play — User Data](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en).

**Impact real / observație:** Fotografiile părăsesc telefonul, identificatorii sunt pseudonimi, iar SDK-urile procesează date. Formularul Data safety, publicul țintă, ratingul și informarea nu se pot valida prin existența unei pagini «13+». Nu declar conformitate juridică din cod.

**Cauză probabilă:** Nu au fost accesate declarațiile efective, rolurile contractuale, baza legală pe scopuri, jurisdicțiile și procedura pentru minori. Nu presupun că vârsta 13 implică automat aceeași regulă parentală în toate țările.

**Remediere / următoarea acțiune:** Daniel stabilește identitatea comercială și cadrul juridic, apoi completează Data safety, publicul, ratingul, declarația de reclame și accesul reviewerului conform traseului real și SDK-urilor.

**Criteriu verificabil de acceptanță:** Declarații salvate în Play Console, verificate față de fluxul de date și condițiile furnizorilor; privacy publică exactă; decizie documentată pentru utilizatorii 13–17 și drepturile lor.

**Dependențe și blocaje:** A01, A10, A12, A13; proprietar și, dacă e necesar, consilier juridic.

<a id="A17"></a>
### A17 · ⛔ · P1 — Contul Play, aprobările și accesul la producție nu pot fi atestate din workspace

**Statut:** blocat extern. **Responsabil principal:** serviciu extern.  
**Tip de dovadă:** Blocat extern: Play Console nu a fost accesat.

**Dovezi exacte:** [eas.json:43–54](eas.json); [Play — testing pentru conturi personale noi](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en-GB); [Play — ștergerea contului](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en).

**Impact real / observație:** Nu sunt verificate identitatea dezvoltatorului, Play App Signing, listingul, track-urile, produsele, device verification și acceptarea accesului la producție. Nu afirm că lipsesc în cont.

**Cauză probabilă:** Aceste stări aparțin consolei și aprobărilor, nu fișierelor locale. Profilul EAS submit gol nu reprezintă singur un defect.

**Remediere / următoarea acțiune:** Daniel furnizează/verifică stările consolei și pregătește listingul și accesul pentru review; apoi serviciul procesează track-ul și aprobările. Pentru cont personal creat după 13.11.2023: cel puțin 12 testeri înscriși continuu 14 zile înaintea cererii de acces.

**Criteriu verificabil de acceptanță:** Cerințele aplicabile contului sunt îndeplinite și confirmate în Play Console; beta rulează pe track-ul ales. Pragul 12/14 permite solicitarea, nu garantează aprobarea.

**Dependențe și blocaje:** A01–A16 critice, A18–A21; Daniel și Google Play.

<a id="A18"></a>
### A18 · ❓ · P1 — Nu există dovadă de build Android final pentru sursa auditată

**Statut:** nu poate fi verificat încă. **Responsabil principal:** agent.  
**Tip de dovadă:** Neverificat: build nou interzis de regula celor două fișiere; APK-urile existente au fost inspectate separat.

**Dovezi exacte:** [T01 — commit și Git curat](#T01); [T08 — APK-uri din 26.08.2026](#T08); [app.config.js:20–45](app.config.js); [scripts/verify-production-bundle.mjs:45–69](scripts/verify-production-bundle.mjs).

**Impact real / observație:** APK-urile au mtime anterior commitului auditat din 05.09.2026 și nu au proveniență demonstrată către el. În dist și output-urile Android inventariate nu am găsit AAB. Trecerea TypeScript nu probează compilarea, optimizarea R8, pornirea și semnarea configurației finale.

**Cauză probabilă:** Artefactele nu sunt însoțite de o legătură verificată commit/config/build ID/hash. Buildurile și exportul ar crea fișiere suplimentare, interzise în această etapă.

**Remediere / următoarea acțiune:** După remedieri, creează un AAB production din commitul ales, fără token debug, cu build ID și hash; validează semnătura, manifestul, bundletool și raportul Play.

**Criteriu verificabil de acceptanță:** Un singur candidat identificabil, construit din sursa finală, instalabil prin Play, fără crash la pornire; API/Billing/16 KB verificate pe același AAB și pe split-urile generate.

**Dependențe și blocaje:** A02, A09, A10, A19; EAS/Play pentru build/distribuție ulterior.

<a id="A19"></a>
### A19 · ❓ · P1 — Funcționarea pe Android real, accesibilitatea și performanța nu sunt încă demonstrate

**Statut:** nu poate fi verificat încă. **Responsabil principal:** Daniel.  
**Tip de dovadă:** Neverificat în audit: adb devices -l a returnat lista goală.

**Dovezi exacte:** [T02 — toolchain și zero dispozitive](#T02); [src/screens/CaptureScreen.tsx:186–218, 256–338](src/screens/CaptureScreen.tsx); [src/components/Typography.tsx:9–14](src/components/Typography.tsx); [src/components/ImageCropEditor.tsx:41–48](src/components/ImageCropEditor.tsx).

**Impact real / observație:** Nu pot confirma camera OEM, photo picker, EXIF/crop/rotație, memoria pe imagini mari, font 200%, TalkBack, tastatura, Back predictiv, proces omorât și conexiunea instabilă. Nu acord un verdict vizual pe baza screenshoturilor vechi.

**Cauză probabilă:** Lipsește un dispozitiv/emulator conectat în sesiune și un candidat actual permis pentru instalare; testele Node nu execută modulele native.

**Remediere / următoarea acțiune:** Daniel asigură dispozitivele și conturile de test; agentul execută ulterior matricea Android, capturile sintetice și scenariile de întrerupere, cu măsurători startup/latență/memorie.

**Criteriu verificabil de acceptanță:** Fluxurile camera și galerie→crop→solve/check→save→restart→restore/delete trec pe cel puțin un telefon modest și unul recent, incluzând API 36/mediu 16 KB, TalkBack și font 200%; pragurile de performanță sunt fixate înaintea testării.

**Dependențe și blocaje:** A04–A08, A14, A18; dispozitive și conturi de test.

<a id="A20"></a>
### A20 · 🟡 · P1 — Operarea backendului, alertele și restaurarea datelor sunt insuficient demonstrate

**Statut:** implementat parțial sau insuficient demonstrat. **Responsabil principal:** Daniel.  
**Tip de dovadă:** Dedus din cod pentru hookuri operaționale; setările și execuțiile cloud neverificate.

**Dovezi exacte:** [functions/src/index.ts:67–73, 270–278, 312–315, 751–850](functions/src/index.ts); [functions/src/runtimeConfig.ts:31–43](functions/src/runtimeConfig.ts); [firebase.json:17–22](firebase.json).

**Impact real / observație:** Există service accounts distincte, loguri sanitizate, kill switch, circuit breaker și cleanup. Nu este verificat IAM-ul efectiv, schedulerul, alertele, coada de ștergere RevenueCat, disponibilitatea, bugetele și capacitatea de recuperare după incident.

**Cauză probabilă:** Configurația codului nu atestă permisiuni minime în cloud. Circuit breaker-ul este în memorie per instanță; fallback-ul config la eroare revine la enabled=true și limita implicită.

**Remediere / următoarea acțiune:** Daniel stabilește SLO, buget, responsabil incident și recuperare; agentul poate pregăti metrici și verificări. Confirmă read-only ulterior versiunile funcțiilor, IAM, indexuri, joburi, retențiile de logging și politica backup/restore compatibilă cu ștergerea.

**Criteriu verificabil de acceptanță:** Alerta la rate crescute de erori/cost/coadă/cleanup se livrează destinatarului; oprirea AI este probată inclusiv la eșecul citirii config; restaurare de probă și ștergere corelată cu retenția, fără reintroducerea conturilor șterse.

**Dependențe și blocaje:** A03, A07, A09, A13; Firebase/Cloud și Daniel.

<a id="A21"></a>
### A21 · ⚪ · P1 — Lipsesc testele de release care ar detecta defectele confirmate aici

**Statut:** absent și necesar. **Responsabil principal:** agent.  
**Tip de dovadă:** Verificat în workflow și suitele inspectate; istoricul execuțiilor CI nu a fost accesat.

**Dovezi exacte:** [.github/workflows/quality.yml:40–65](.github/workflows/quality.yml); [tests/commercialLifecycle.test.mts:13–62](tests/commercialLifecycle.test.mts); [functions/integration/commercialAccess.test.mjs:107–124](functions/integration/commercialAccess.test.mjs); [package.json:79–93](package.json).

**Impact real / observație:** CI verifică tipuri, teste pure, reguli și advisories high, dar nu construiește AAB și nu rulează fluxuri native. Testul de refund chiar așteaptă scăderea plafonului global; testele regex de logout trec deși logout-ul offline este blocat.

**Cauză probabilă:** Criteriile verifică forma implementării mai mult decât efectul contractual pentru utilizator și cost. legal:check detectează numai câteva câmpuri/placeholder-e.

**Remediere / următoarea acțiune:** Adaugă regresii comportamentale pentru A03–A08/A14, teste callable și SDK mock cu ordonare controlată, apoi job de candidat Android și scenarii native. Integrează scanarea binarului, nu doar un export separat.

**Criteriu verificabil de acceptanță:** Noile teste eșuează pe commitul auditat și trec numai după remedieri; rules/commercial integration plus build/smoke pentru același commit trec; niciun badge de test static nu este prezentat drept validare E2E.

**Dependențe și blocaje:** A03–A08, A14–A15, A18; buget/dispozitive pentru CI native.

<a id="A22"></a>
### A22 · 🟡 · P2 — Dependențele au advisories moderate, fără exploatabilitate demonstrată

**Statut:** implementat parțial sau insuficient demonstrat. **Responsabil principal:** agent.  
**Tip de dovadă:** Verificat prin bulk advisory npm la 05.09.2026 și lockfile; accesibilitatea căilor vulnerabile este neverificată.

**Dovezi exacte:** [package-lock.json:6154, 8350, 16072, 19368](package-lock.json); [functions/package-lock.json:3414](functions/package-lock.json); [xmldom — advisory](https://github.com/advisories/GHSA-6gmq-8vp8-gcm6); [decode-uri-component — advisory](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr); [uuid — advisory](https://github.com/advisories/GHSA-w5hq-g745-h8pq).

**Impact real / observație:** În arborele non-dev: aplicație xmldom 0.8.14/0.9.11, decode-uri-component 0.2.2, uuid 7.0.3; backend uuid 9.0.1. Rezultatele registry sunt moderate, fără high/critical în această probă. Nu rezultă automat exploatare în aplicație; arborele non-dev include și tooling Expo.

**Cauză probabilă:** Versiuni tranzitive vulnerabile în lockfile; CI blochează doar prag high. Nu am analizat toate condițiile de acces către API-urile afectate.

**Remediere / următoarea acțiune:** Trasează părinții și utilizările vulnerabile, actualizează controlat prin părinți compatibili și reevaluează lockfile/buildul; păstrează justificarea dacă o cale este inaccesibilă.

**Criteriu verificabil de acceptanță:** Fără advisory aplicabil neacceptat; pentru fiecare excepție există analiză de accesibilitate, responsabil și termen. Verificare exactă pe dependențele candidatului final.

**Dependențe și blocaje:** A18, A21; nicio actualizare făcută în audit.

<a id="A23"></a>
### A23 · 🟡 · P2 — Oferta Premium poate rămâne în loader după o eroare de încărcare

**Statut:** implementat parțial sau insuficient demonstrat. **Responsabil principal:** agent.  
**Tip de dovadă:** Dedus din cod; SDK-ul de cumpărături nu a fost executat.

**Dovezi exacte:** [src/screens/PaywallScreen.tsx:65–74, 260–268](src/screens/PaywallScreen.tsx); [src/services/purchases.ts:69–80](src/services/purchases.ts).

**Impact real / observație:** getOfferings eșuat afișează un mesaj, dar păstrează loaderul «Aduc prețurile», fără buton de reîncercare și cu cumpărarea dezactivată. Revenirea rețelei nu declanșează singură loadOffer cât timp dependențele nu se schimbă.

**Cauză probabilă:** Nu există stări distincte loading/error/empty și declanșator explicit de retry pentru ofertă. Oferta cere ambele planuri simultan.

**Remediere / următoarea acțiune:** Modelează stările ofertei și permite retry pe ecran/focus; decide explicit comportamentul când este disponibil un singur plan.

**Criteriu verificabil de acceptanță:** Timeout/offline→eroare terminată→retry→prețuri; fără loader permanent și fără duplicarea cererii de cumpărare. Planurile indisponibile nu blochează un plan valid dacă politica comercială îl permite.

**Dependențe și blocaje:** A10; test mock SDK și apoi Play sandbox.

<a id="A24"></a>
### A24 · 🟡 · P2 — Documentul matematic nu are termen maxim pentru disponibilitatea fonturilor/bridge-ului

**Statut:** implementat parțial sau insuficient demonstrat. **Responsabil principal:** agent.  
**Tip de dovadă:** Dedus din cod; nu afirm crash sau blocare observată pe Android.

**Dovezi exacte:** [src/components/MathDocumentView.tsx:28–42, 59–64, 93–98, 146–168](src/components/MathDocumentView.tsx); [src/utils/mathDocument.ts:447](src/utils/mathDocument.ts); [src/services/lessonPresentation.ts:16–31](src/services/lessonPresentation.ts).

**Impact real / observație:** O promisiune de font rămasă pending sau lipsa mesajului document-ready poate lăsa pagina în loader. Timeout-ul preîncărcării lecției nu închide loaderul intern al WebView.

**Cauză probabilă:** Fallback-ul există numai la reject, nu și la promisiuni care nu se rezolvă; detectarea readiness depinde de bridge și document.fonts.ready.

**Remediere / următoarea acțiune:** Adaugă deadline, fallback cu font de sistem și reîncărcare controlată; definește ce se afișează dacă bridge-ul nu răspunde.

**Criteriu verificabil de acceptanță:** Font pending și mesaj readiness absent nu ascund lecția fără termen; apare conținut lizibil sau eroare cu retry; test pe WebView Android și offline.

**Dependențe și blocaje:** A19, A21.

<a id="A25"></a>
### A25 · ✅ · P2 — Tipurile și versiunile de bază sunt coerente în workspace

**Statut:** verificat și acceptat. **Responsabil principal:** agent.  
**Tip de dovadă:** Verificat direct prin T02–T04, limitat la compilare statică și comparația locală.

**Dovezi exacte:** [package.json:4–9, 10–62](package.json); [tsconfig.json:3–8](tsconfig.json); [functions/tsconfig.json:2–16](functions/tsconfig.json); [Expo SDK 57 — versiuni suportate](https://docs.expo.dev/versions/v57.0.0/).

**Impact real / observație:** Node 22.20.0/npm 10.9.3, Expo 57.0.20, React Native 0.86.3 și React 19.2.3 sunt coerente. Ambele tsc --noEmit și ESLint trec; 29 dependențe prezente în bundledNativeModules corespund intervalelor. Acceptarea privește numai aceste verificări.

**Cauză probabilă:** Configurație TypeScript strictă și versiuni fixate prin lockfile.

**Remediere / următoarea acțiune:** Păstrează aceste verificări în CI și repetă-le când se schimbă codul/dependențele.

**Criteriu verificabil de acceptanță:** Criteriu îndeplinit în audit: zero erori tsc pentru client/backend, zero erori ESLint și zero abateri în cele 29 comparații SDK. Buildul nativ rămâne A18.

**Dependențe și blocaje:** Fără blocaj pentru acceptarea limitată; nu echivalează cu Expo Doctor complet.

<a id="A26"></a>
### A26 · ✅ · P2 — Suitele existente de logică și randare trec

**Statut:** verificat și acceptat. **Responsabil principal:** agent.  
**Tip de dovadă:** Demonstrat prin T05–T06: 87 mobile și 64 backend, zero eșecuri.

**Dovezi exacte:** [tests/mathContent.test.mts](tests/mathContent.test.mts); [tests/mathDocument.test.mts](tests/mathDocument.test.mts); [functions/src/analysisSchema.test.ts](functions/src/analysisSchema.test.ts); [functions/src/providerPipeline.test.ts](functions/src/providerPipeline.test.ts); [T05/T06 — rezultate](#T05).

**Impact real / observație:** Există o bază executabilă de regresie pentru schema de conținut, MathJax, cotă și prezentare. Acceptarea este a suitei curente, nu a corectitudinii întregului produs sau a matematicii AI.

**Cauză probabilă:** Logica pură este separată suficient pentru execuție Node; unele teste mobile sunt verificări de text în sursă.

**Remediere / următoarea acțiune:** Menține suita și adaugă regresiile comportamentale din A21, fără a înlocui testarea nativă.

**Criteriu verificabil de acceptanță:** Criteriu îndeplinit: 151 teste existente trec, fără skip/cancel/fail; backendul a folosit sursa TS actuală transpile în memorie, nu lib istoric.

**Dependențe și blocaje:** A21 delimitează acoperirea lipsă.

<a id="A27"></a>
### A27 · 🟡 · P1 — Autorizarea Firestore este restrictivă în sursă, dar nu este acceptată E2E

**Statut:** implementat parțial sau insuficient demonstrat. **Responsabil principal:** agent.  
**Tip de dovadă:** Dedus din reguli; testele emulator și configurația deployată nu au fost executate/verificate.

**Dovezi exacte:** [firestore.rules:9–10, 31–75](firestore.rules); [tests/firestore.rules.test.mjs:23–120](tests/firestore.rules.test.mjs); [firestore.indexes.json](firestore.indexes.json).

**Impact real / observație:** Codul limitează accesul la UID, interzice crearea de lecții din client și orice acces direct la feedback/config/entitlements. Este o bază bună, însă nu dovedește că regulile publicate sunt identice sau că query-urile funcționează.

**Cauză probabilă:** Regulile și indexurile sunt locale; Admin SDK ocolește regulile, astfel că autorizarea callable-urilor trebuie verificată separat.

**Remediere / următoarea acțiune:** Rulează suita de reguli și probe callable pentru două conturi, anonymous/Google, scrieri malițioase și indexuri; compară versiunea deployată.

**Criteriu verificabil de acceptanță:** Toate citirile/scrierile cross-account și escaladările premium sunt respinse, query-urile legitime funcționează și versiunea cloud coincide cu cea testată.

**Dependențe și blocaje:** A07, A15, A21; Firestore Emulator și acces read-only la cloud ulterior.

<a id="A28"></a>
### A28 · ✅ · P2 — Paginile legale publice sunt disponibile și identice cu sursa

**Statut:** verificat și acceptat. **Responsabil principal:** agent.  
**Tip de dovadă:** Verificat direct prin T07, limitat la disponibilitate, conținut și headere.

**Dovezi exacte:** [Confidențialitate publică](https://profu-de-mate-danmat88.web.app/confidentialitate); [Termeni publici](https://profu-de-mate-danmat88.web.app/termeni); [Ștergere date publică](https://profu-de-mate-danmat88.web.app/stergere-date); [hosting/public/stergere-date.html:48–50](hosting/public/stergere-date.html).

**Impact real / observație:** Toate trei răspund HTTP 200 cu UTF-8, sunt identice byte-cu-byte cu fișierele locale și au CSP/HSTS/nosniff. Există o solicitare de ștergere prin email fără reinstalare; funcționarea inboxului și procesarea cererilor nu au fost probate.

**Cauză probabilă:** Firebase Hosting este configurat și livrează paginile inspectate.

**Remediere / următoarea acțiune:** Păstrează disponibilitatea și actualizează textele după A01/A13/A16; Daniel testează ulterior recepția și soluționarea solicitărilor.

**Criteriu verificabil de acceptanță:** Criteriu îndeplinit: cele trei URL-uri au HTTP 200, UTF-8 și conținut local identic. Acceptarea juridică și operațională rămâne deschisă.

**Dependențe și blocaje:** A01, A13, A16 pentru conținut; nu este certificat de conformitate.

<a id="A29"></a>
### A29 · ✅ · P2 — APK-urile inspectate țintesc API 36 și trec verificările statice 16 KB

**Statut:** verificat și acceptat. **Responsabil principal:** agent.  
**Tip de dovadă:** Verificat direct prin T08, limitat la cele patru fișiere istorice.

**Dovezi exacte:** [app.config.js:39–45](app.config.js); [T08 — manifest, ELF și ZIP](#T08); [Play — target API actual](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en); [Android — 16 KB](https://developer.android.com/guide/practices/page-sizes); [Android — Billing deprecation](https://developer.android.com/google/play/billing/deprecation-faq).

**Impact real / observație:** Fiecare APK are minSdk 24, target/compile 36, 112 biblioteci native, fără LOAD 64-bit sub 16 KB și fără .so necomprimate nealiniate la 16 KB. Metadata Billing indică 8.3.0 în toate patru. Semnăturile criptografice se verifică, dar două sunt debug (A02). Nu este demonstrată execuția într-un mediu 16 KB.

**Cauză probabilă:** Configurația nativă și bibliotecile acestor artefacte au aliniere statică adecvată.

**Remediere / următoarea acțiune:** Repetă pe AAB/split-uri finale și rulează pe dispozitiv 16 KB. API 36 este cerut pentru aplicații/actualizări noi din 31.08.2026, fără a presupune o extensie aprobată. Billing 8 este în intervalul oficial de suport pentru submit; Billing 7 a depășit termenul standard la 31.08.2026.

**Criteriu verificabil de acceptanță:** Criteriu static îndeplinit doar pentru hashurile T08; acceptarea distribuției curente cere A18/A19. Documentația 16 KB actuală menționează 01.02.2027 pentru blocarea actualizărilor incompatibile; nu extrapolez termenul aplicațiilor noi.

**Dependențe și blocaje:** A02, A18, A19; acest checkmark nu acceptă APK-urile pentru distribuție.

<a id="A30"></a>
### A30 · ✅ · P2 — Fotografia nu este scrisă în lecția Firestore; diagnosticele opționale sunt minimizate în cod

**Statut:** verificat și acceptat. **Responsabil principal:** agent.  
**Tip de dovadă:** Verificat direct în traseul de scriere și configurație; comportamentul SDK/cloud integral rămâne neverificat.

**Dovezi exacte:** [functions/src/index.ts:249, 287–309](functions/src/index.ts); [src/services/imagePipeline.ts:5–6, 29–33](src/services/imagePipeline.ts); [firebase.json:2–6](firebase.json); [src/services/diagnostics.ts:5–17](src/services/diagnostics.ts); [Gemini — Interactions și store=false](https://ai.google.dev/gemini-api/docs/interactions-overview).

**Impact real / observație:** Scrierea lecției conține rezultatul structurat, fără imagineBase64; imaginile sunt comprimate local și trimise prin callable. Interactions cere store=false. Crashlytics are colectarea implicită dezactivată, iar logarea manuală folosește eroare sanitizată. Acestea reduc datele păstrate, dar nu elimină logurile furnizorilor.

**Cauză probabilă:** Separare între fotografia temporară, lecția structurată și diagnosticele opt-in.

**Remediere / următoarea acțiune:** Păstrează proprietățile la schimbarea furnizorului; testează ulterior traficul real, cache-ul nativ și ștergerea.

**Criteriu verificabil de acceptanță:** Criteriu îndeplinit la nivel de traseu de date: payloadul lecției nu include fotografia, store=false explicit, colectarea implicită Crashlytics false și verificarea opt-in înainte de recordError.

**Dependențe și blocaje:** A01, A07, A13, A16, A19 pentru garanțiile complete de confidențialitate.


## Verdict separat pe etape

| Etapă | Verdict | Motiv / condiție |
|---|---|---|
| Dezvoltare | **Poate continua, cu remedierea prioritară a P0/P1** | Tipuri și suite de bază trecute; defecte concrete reproductibile. Nicio autorizare de implementare nu este implicită în acest raport. |
| Testare reală | **Numai diagnostic controlat; acceptarea este încă neobținută** | Dispozitive și candidat actual lipsesc în audit. Pentru date reale ale publicului 13+, A01 trebuie rezolvat; începe ulterior cu adulți și imagini sintetice după A02/A03. |
| Beta închisă 13+ | **NU — criteriile nu sunt îndeplinite** | A01–A09, A12/A14 și dovada buildului/fluxurilor trebuie închise; formularele și track-ul Play necesită A16/A17. Beta nu suspendă politicile aplicabile. |
| Producție Google Play | **NU — release respins în evaluarea tehnică** | Eligibilitate AI, costuri, artefacte, fiabilitate, premium, privacy și operare nu sunt validate împreună. Google Play decide separat aprobarea. |

## Cine poate face ce

**Agentul, într-o etapă ulterioară autorizată:** remedierea Caietului gol, validarea mode/input, contabilizarea costurilor și retry, recuperarea lease-ului, logout local, izolarea markerului pe cont, protocolul de ștergere, stările paywall/WebView, raportarea completă, teste comportamentale/CI și producerea unui candidat verificabil. Acestea corespund în principal A03–A09, A12–A15, A18, A21–A24 și A27. Benchmarkul poate fi automatizat de agent; etichetele și pragurile pedagogice necesită validarea lui Daniel/profesorului.

**Daniel:** decizia de furnizor/contract pentru 13+, verificarea tokenului și distribuției APK-urilor, bugetele și prețurile, identitatea juridică, protecția minorilor și declarațiile Play, conturile merchant/RevenueCat/Firebase/EAS, mailboxurile și tratarea rapoartelor, dispozitivele, testeri și aprobarea criteriilor comerciale/pedagogice. Nu cer aici acces sau clarificări: raportul marchează ce lipsește.

**Servicii și aprobări externe:** eligibilitatea API și facturarea; Play App Signing, Integrity și eventual Device Recall; produse și plăți test, evenimente RevenueCat; execuții Firebase/Cloud/IAM; track și review Google Play. Codul pregătit nu poate certifica aceste stări. Niciun serviciu nu a fost modificat prin acest audit.

## Ordinea profesională de implementare

1. **Rezolvă blocajele de produs și expunerea** — A01, A02; responsabil Daniel + furnizori. Confirmă ruta AI pentru 13+ și situația tokenului/debug APK. Stabilirea furnizorului precede benchmarkul și textele privacy; nu este suficientă o schimbare de etichetă 18+.

2. **Definește contractele tranzacționale** — A03, A05–A09, A14–A15; responsabil agent, cu buget decis de Daniel. Separă costul AI de cota utilizatorului; fixează identitatea, lease-ul, idempotency și ștergerea concurentă. Aceste contracte trebuie stabilite înaintea extinderii testelor și traficului.

3. **Corectează stările vizibile și adaugă regresiile** — A04, A12, A13, A21–A24; responsabil agent. Caiet gol, oferta indisponibilă, readiness WebView, raportare completă și retenție coerentă. Testele trebuie să reproducă defectul înaintea remedierii, apoi să probeze comportamentul acceptat.

4. **Validează infrastructura, matematica și premium** — A10, A11, A16, A20, A27; responsabil agent + Daniel + servicii externe. Corpus pedagogic, tranzacții Play/RevenueCat, reguli/callable, IAM, cleanup, alerte și recuperare. Daniel definitivează politica de date și economia produsului în urma măsurătorilor.

5. **Construiește și testează același candidat Android** — A18, A19, A29; responsabil agent + Daniel. AAB din commit identificat, scanare secrete/certificat, API/Billing/aliniere, instalare Play și testare pe dispozitive. Semnează acceptarea numai pe artefactul care va fi distribuit.

6. **Rulează beta și cere evaluarea Play** — A17 și toate blocajele anterioare; responsabil Daniel + Google Play. Listing, acces reviewer, declarații, testeri și perioada aplicabilă, verificarea metricilor și închiderea incidentelor. După dovezile beta se poate decide lansarea graduală și monitorizarea, într-o etapă autorizată separat.

Ordinea este bazată pe dependențe, nu pe un calendar inventat. Remedierile locale independente pot fi făcute în paralel după închiderea deciziilor care le afectează. Nicio implementare din această ordine nu a fost începută în audit.

## Jurnal de comenzi, teste și limite

<a id="T01"></a>
### T01 — Snapshot și limite de scriere

**Comandă / mecanism:** git status --porcelain=v1; git log -1 --format="%H %cI %s"; inventar rg --files, inclusiv dist/android ignorate

**Rezultat:** Status inițial gol. Commit db85cd666132008044196d193d3359d0f1b4a68a, 2026-09-05T14:08:46+03:00. Numai cele două artefacte ale auditului sunt create la livrare.

**Limită:** Git curat nu include garanții asupra fișierelor ignorate; acestea au fost inspectate separat unde sunt relevante.

<a id="T02"></a>
### T02 — Toolchain și Android

**Comandă / mecanism:** node --version; npm --version; java -version; adb devices -l

**Rezultat:** Node v22.20.0; npm 10.9.3; OpenJDK Temurin 21.0.12; adb exit 0 și niciun dispozitiv.

**Limită:** Nu s-au instalat pachete, pornit emulator sau instalat APK-uri.

<a id="T03"></a>
### T03 — TypeScript

**Comandă / mecanism:** node node_modules/typescript/bin/tsc --noEmit; node functions/node_modules/typescript/bin/tsc --noEmit -p functions/tsconfig.json

**Rezultat:** Ambele comenzi exit 0, fără erori.

**Limită:** Compilare statică fără fișiere emise; nu este build nativ.

<a id="T04"></a>
### T04 — Lint și compatibilitate locală Expo

**Comandă / mecanism:** node node_modules/eslint/bin/eslint.js . --no-cache; semver.satisfies pentru versiunile instalate față de node_modules/expo/bundledNativeModules.json

**Rezultat:** ESLint exit 0, fără output; 29 pachete comune verificate, 0 abateri.

**Limită:** Nu s-a rulat npm run check integral: poate invoca npx/Expo Doctor și genera cache sau instala unelte. Nu declar «Expo Doctor passed».

<a id="T05"></a>
### T05 — Teste mobile existente

**Comandă / mecanism:** node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/*.test.mts

**Rezultat:** Exit 0; 87 teste, 87 pass, 0 fail/skip/cancel/todo; durata raportată 732.2136 ms.

**Limită:** Logică pură plus teste care citesc textul sursei. Nu montează ecranele native și nu exercită camera sau SDK-ul Billing.

<a id="T06"></a>
### T06 — Teste backend din sursa actuală

**Comandă / mecanism:** node --import <loader ESM în data: URI> --test functions/src/*.test.ts — 15 fișiere, TS transpile în memorie, importurile relative .js rezolvate la .ts

**Rezultat:** Exit 0; 64 teste, 64 pass, 0 fail/skip/cancel/todo; 30272.8982 ms raportate.

**Limită:** Fără npm run build, care șterge și recreează lib. index.ts nu este importat de suitele testate; nu sunt apelate serviciile Gemini/RevenueCat și nu este testată concurența Firestore reală.

<a id="T07"></a>
### T07 — Legal local și public

**Comandă / mecanism:** node scripts/validate-legal.mjs; node scripts/validate-client-env.cjs development; GET HTTPS cu Node fetch pentru cele 3 pagini legale și comparație byte-cu-byte

**Rezultat:** Cele două validatoare exit 0. /confidentialitate, /termeni și /stergere-date: HTTP 200, text/html; charset=utf-8, conținut identic local; CSP, HSTS și nosniff prezente.

**Limită:** Validatorul legal detectează câmpuri goale și placeholder-e, nu conformitate. Inboxurile publice nu au primit mesaje de test. Nu s-au verificat mediile EAS production/preview.

<a id="T08"></a>
### T08 — APK-uri existente

**Comandă / mecanism:** aapt dump badging <apk>; aapt dump xmltree <apk> AndroidManifest.xml; apksigner.bat verify --print-certs <apk>; citire ZIP/ELF și SHA-256 în Node, fără extracție pe disc

**Rezultat:** 4 APK-uri din 26.08.2026, fiecare min24/target36/compile36 și Billing 8.3.0, 112 .so, fără LOAD 64-bit cu p_align<16384 și fără .so necomprimate nealiniate la 16384. apksigner exit 0 pentru toate. 2 fișiere conțin token debug și sunt semnate Android Debug.

**Limită:** Nu s-a verificat activitatea tokenului, istoricul distribuirii, executarea pe 16 KB sau proveniența din commitul curent. Tokenul a fost comparat numai în memorie și nu este reprodus.

<a id="T09"></a>
### T09 — Primul Caiet gol — probă suplimentară

**Comandă / mecanism:** node via stdin; ts.transpileModule(src/services/lessons.ts) + vm; Firebase/onSnapshot stub; emitere docs=[], docChanges=[] pentru user stabil

**Rezultat:** Exit 0; onChangeCalls=0, errors=0, cache=undefined. Proba de control colectată separat nevid→gol notifică [1,0].

**Limită:** Serviciul real este executat; transportul Firebase este simulat. Blocarea loaderului React este dedusă din NotebookScreen, nu filmată pe telefon.

<a id="T10"></a>
### T10 — Costul după refund — probă suplimentară

**Comandă / mecanism:** node via stdin; funcțiile reale reserveAnalysisQuota și settleAnalysisQuota, Firestore în memorie, globalDailyLimit=2, 12 cereri la interval virtual de 2 minute

**Rezultat:** Exit 0; 12 rezervări acceptate; după fiecare: global 1→0; welcomeUsed final 0.

**Limită:** Nu simulează concurența Firestore sau facturarea reală. Dovedește că refund permite repetarea rezervării; costul per încercare rezultă din poziția apelurilor provider din index.ts.

<a id="T11"></a>
### T11 — Modul rezultatului AI — probă suplimentară

**Comandă / mecanism:** node --input-type=module via stdin; loader TS în memorie; runProviderPipeline cu fixture schema-valid pentru modul opus, renderer real

**Rezultat:** Exit 0. requested=check, returned=solve, ready, calls=1, rejected=0. requested=solve, returned=check, ready, calls=1, rejected=0.

**Limită:** Nu măsoară frecvența acestui răspuns în Gemini; dovedește lipsa garzii de contract.

<a id="T12"></a>
### T12 — Lease processing abandonat — probă suplimentară

**Comandă / mecanism:** node via stdin; mathAnalysis.ts transpile în vm; getAnalysisStatus mereu processing; Date/setTimeout virtuale

**Rezultat:** Exit 0; 135000 ms virtuale, 108 statusCalls, 0 analyzeCalls, functions/deadline-exceeded.

**Limită:** Starea persistentă este injectată; serverul actual poate produce această stare la terminare fără catch. Nu s-a omorât vreun worker cloud.

<a id="T13"></a>
### T13 — Logout cu verificare eșuată — probă suplimentară

**Comandă / mecanism:** node via stdin; commercial.ts real transpile în vm; initializeVerifiedFirebaseServices respinge auth/network-request-failed

**Rezultat:** Exit 0; signOutCalls=0, eroarea auth/network-request-failed propagată.

**Limită:** Transportul Auth este simulat; legătura cu cold-start offline este verificată în firebase.ts: getIdToken(user,true).

<a id="T14"></a>
### T14 — Advisories fără instalare sau npm cache

**Comandă / mecanism:** POST read-only ca efect către https://registry.npmjs.org/-/npm/v1/security/advisories/bulk, cu nume/versiuni din intrările non-dev ale celor două lockfile-uri

**Rezultat:** HTTP 200 pentru 593 nume de pachete app și 248 backend. App: 3 GHSA distincte moderate; backend: 1 GHSA moderate. Niciun advisory high/critical returnat.

**Limită:** Nu este un npm audit complet cu metaversiuni și nu certifică lipsa vulnerabilităților. Nu au fost trimise cod sau valori secrete; doar nume/versiuni publice.

<a id="T15"></a>
### T15 — Verificări neexecutate și de ce

**Comandă / mecanism:** Inspecția comenzilor înainte de rulare; browser runtime: browsers.getForUrl → No browser is available, browsers.list → []

**Rezultat:** Nu s-au rulat build/export/prebuild, test:rules, deploy, teste de provider plătite, Play sandbox, native E2E sau capturi noi ale aplicației.

**Limită:** Build/emulator/export creează fișiere suplimentare ori date, interzise de mandat; testarea live ar genera cereri/stocare/cost. Browserul conectat nu este disponibil; validarea artefactelor este descrisă separat, fără pretinsă randare vizuală.


### Inventarul binarelor T08

Toate fișierele sunt în `dist/`, au versionName 1.0.0 și mtime 26.08.2026 UTC. Datele filesystem nu sunt o atestare a commitului de origine. Certificatul comun al celor două APK-uri fără token are SHA-256 `ae68bd1d758362bbd4e8718a27ac915deaf70e3056592917f0f300ed49428629`; certificatul cu DN Android Debug: `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`.

| Fișier | versionCode | Bytes | Semnatar | Token local debug prezent |
|---|---|---:|---|---|
| profu-de-mate-production-test-v1.0.0-v9.apk | 9 | 126838547 | Android Debug | DA |
| profu-de-mate-v1.0.0-production.apk | 9 | 126838771 | certificat ae68…629 | NU |
| profu-de-mate-v1.0.0-production-vc10-splash-fix.apk | 10 | 126839099 | certificat ae68…629 | NU |
| profu-de-mate-v1.0.0-vc10-local-production-p0.apk | 10 | 126841255 | Android Debug | DA |

- `profu-de-mate-production-test-v1.0.0-v9.apk`: SHA-256 `a291b3ef0f14b0bfa5707108f532540a59ad2c4d28d4906166e39bc9c7434c24`.
- `profu-de-mate-v1.0.0-production.apk`: SHA-256 `a9ada5bf5feaa29ce41ca9cef7ca24807047585240487678991c02ab0731508a`.
- `profu-de-mate-v1.0.0-production-vc10-splash-fix.apk`: SHA-256 `6d78d0fa4e7210eb0a74a92def0d0e387aa9839788e5475ef65ed92cb8f2d3b2`.
- `profu-de-mate-v1.0.0-vc10-local-production-p0.apk`: SHA-256 `16b608b646f932fc1c9d0882ae5e05d9c9f61ef93210c052f120966260793169`.

Nu am găsit AAB în inventarul întregului workspace, cu node_modules/.git excluse. Fișierul debug din android/app/build/outputs există, dar nu îl confund cu un candidat de producție. API și Billing pot fi acceptate static fără ca un APK debug să fie acceptat pentru distribuție.

## Anexă — probe reproductibile fără fișiere auxiliare

Fragmentele de mai jos au fost executate numai în memorie. În PowerShell, un fragment CommonJS se poate rula ca here-string simplu `@' ... '@ | node`; pentru fragmentul ESM T11, folosește `node --input-type=module`. Nu includ secrete și nu ating cloud-ul. Ele nu înlocuiesc testele Firestore/Android. T08 folosește direct executabilele Android SDK locale; o primă încercare cu Python nu a rulat deoarece comanda era un alias Store, apoi verificarea a fost făcută în Node.

### T09 — serviciul Caiet cu primul snapshot gol

```javascript
const fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm');
let observer,changes=0,errors=0;const user={uid:'audit-user'};
const m={exports:{}};const req=s=>{
if(s==='@react-native-firebase/app')return{getApp:()=>({})};
if(s==='@react-native-firebase/auth')return{getAuth:()=>({currentUser:user})};
if(s==='@react-native-firebase/firestore')return{getFirestore:()=>({}),collection:()=>({}),where:()=>({}),orderBy:()=>({}),query:()=>({}),onSnapshot:(_q,cb)=>{observer=cb;return()=>{}}};
if(s.endsWith('/firebase'))return{firebaseUserSessionKey:u=>u?.uid,initializeFirebaseServices:async()=>user};
if(s.endsWith('/mathContent'))return{isMathAnalysis:()=>{throw Error('should not validate empty docs')}};
throw Error(s);
};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/services/lessons.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,require:req,console,setTimeout,clearTimeout});
(async()=>{await m.exports.subscribeToFavoriteLessons(()=>changes++,()=>errors++);observer({docs:[],docChanges:()=>[]});console.log(JSON.stringify({probe:'initial-empty-notebook',onChangeCalls:changes,errors,cache:m.exports.getCachedFavoriteLessons()===undefined?'undefined':m.exports.getCachedFavoriteLessons()}));})();
```

### T10 — plafon global și refund

```javascript
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('./functions/node_modules/typescript'),{createRequire}=require('node:module');
const cache=new Map();function load(p){p=path.resolve(p);if(cache.has(p))return cache.get(p).exports;const m={exports:{}};cache.set(p,m);const native=createRequire(p);const req=s=>s.startsWith('.')&&s.endsWith('.js')?load(path.resolve(path.dirname(p),s.slice(0,-3)+'.ts')):native(s);vm.runInNewContext(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{require:req,module:m,exports:m.exports,Buffer,console,Date,Intl,process},{filename:p});return m.exports;}
const {reserveAnalysisQuota,settleAnalysisQuota}=load('functions/src/commercialAccess.ts');
const docs=new Map();const snap=r=>({exists:docs.has(r.path),data:()=>docs.get(r.path)});const set=(r,d,o)=>docs.set(r.path,o?.merge?{...docs.get(r.path),...d}:d);
const db={collection:c=>({doc:id=>({path:c+'/'+id,get:async function(){return snap(this)}})}),runTransaction:async cb=>cb({get:async r=>snap(r),set,update:(r,d)=>set(r,d,{merge:true})})};
(async()=>{const result=[];const principal={identity:'anonymous',principalId:'i_'+'a'.repeat(64)};for(let i=0;i<12;i++){let now=Date.UTC(2026,8,5,10,i*2);let requestId='analysis-test'+String(i).padStart(6,'0')+'-abcdef123456';await reserveAnalysisQuota(db,'same-user',requestId,principal,now,2);const key=[...docs.keys()].find(x=>x.startsWith('_commercialGlobal/'));const afterReserve=docs.get(key).requests;await settleAnalysisQuota(db,principal.principalId,requestId,false,()=>{});result.push({n:i+1,afterReserve,afterRefund:docs.get(key).requests});}console.log(JSON.stringify({probe:'global-cap-refunds',configuredGlobalLimit:2,reservationsAccepted:result.length,samples:result,welcomeUsed:docs.get('_commercialUsers/'+principal.principalId).welcomeRequests,mock:'sequential in-memory DB; actual source functions and Firebase Timestamp; no real provider/Firestore'}));})().catch(e=>{console.error(e);process.exitCode=1});
```

### T11 — răspunsul în modul opus

```javascript
import fs from 'node:fs';import {register} from 'node:module';import {pathToFileURL} from 'node:url';
const tsUrl=pathToFileURL(process.cwd()+'/functions/node_modules/typescript/lib/typescript.js').href;
const loader = `import fs from 'node:fs/promises';import ts from '${tsUrl}';
export async function resolve(s,c,n){if(s.startsWith('.')&&s.endsWith('.js')&&c.parentURL?.includes('/functions/src/')){let u=new URL(s.slice(0,-3)+'.ts',c.parentURL);try{await fs.access(u);return {url:u.href,shortCircuit:true}}catch{}}return n(s,c)}
export async function load(u,c,n){if(u.endsWith('.ts'))return {format:'module',shortCircuit:true,source:ts.transpileModule(await fs.readFile(new URL(u),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText};return n(u,c)}`;
register('data:text/javascript,'+encodeURIComponent(loader),import.meta.url);
const {runProviderPipeline}=await import('./functions/src/providerPipeline.ts');
const testSource=fs.readFileSync('functions/src/providerPipeline.test.ts','utf8');
const f=testSource.slice(testSource.indexOf('const text ='),testSource.indexOf('const serialize'));
const ts=(await import(tsUrl)).default;
const factory=ts.transpileModule(f+'\nexport {providerLesson};',{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {providerLesson}=await import('data:text/javascript,'+encodeURIComponent(factory));
for(const [inputMode,outputMode,verdict] of [['check','solve','not_applicable'],['solve','check','correct']]){
 let calls=0;let rejected=0;
 const result=await runProviderPipeline({mode:inputMode,imageBase64:'stub',mimeType:'image/jpeg',generate:async()=>{calls++;return JSON.stringify(providerLesson({mode:outputMode,verdict}));},onRejected:()=>rejected++});
 console.log(JSON.stringify({probe:'provider-mode',requested:inputMode,returned:result.mode,status:result.status,calls,rejected}));
}
```

### T12/T13 — lease expirat și logout

```javascript
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function compile(p,req,extra={}){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,require:req,console,Buffer,setTimeout,...extra},{filename:p});return m.exports;}
let now=0,statusCalls=0,analyzeCalls=0;class Clock extends Date{static now(){return now;}}
const math=compile('src/services/mathAnalysis.ts',s=>{
if(s==='@react-native-firebase/app')return{getApp:()=>({})};
if(s==='@react-native-firebase/functions')return{getFunctions:()=>({}),httpsCallable:(_f,name)=>async()=>{if(name==='getAnalysisStatus'){statusCalls++;return{data:{state:'processing'}}}analyzeCalls++;return{data:{}}}};
if(s==='expo-file-system')return{File:class{async base64(){return 'mock'}}};
if(s.endsWith('firebase'))return{initializeVerifiedFirebaseServices:async()=>({uid:'u'})};
if(s.endsWith('installationIdentity'))return{getInstallationToken:async()=>'a'.repeat(64)};
if(s.endsWith('mathContent'))return{isMathAnalysis:()=>true};
if(s.endsWith('analysisErrors'))return{friendlyAnalysisError:()=>''};throw Error(s);
},{Date:Clock,setTimeout:(cb,ms)=>{now+=ms;queueMicrotask(cb)}});
(async()=>{try{await math.analyzeOrResumeMathImage('solve',{uri:'cache',width:1,height:1,source:'camera'},'analysis-abcdef-abcdef',true,()=>false)}catch(e){console.log(JSON.stringify({probe:'stale-processing',elapsedVirtualMs:now,statusCalls,analyzeCalls,errorCode:e.code}));}
let signOutCalls=0;const commercial=compile('src/services/commercial.ts',s=>{
if(s==='@react-native-firebase/app')return{getApp:()=>({})};
if(s==='@react-native-firebase/auth')return{getAuth:()=>({}),signOut:async()=>{signOutCalls++}};
if(s.endsWith('firebase'))return{initializeVerifiedFirebaseServices:async()=>{throw Object.assign(Error('offline'),{code:'auth/network-request-failed'})}};
return {};
});
try{await commercial.disconnectGoogleAccount()}catch(e){console.log(JSON.stringify({probe:'cold-offline-logout',signOutCalls,errorCode:e.code}));}
})().catch(e=>{console.error(e);process.exitCode=1});
```

### T08 — verificare în memorie a APK-urilor

```javascript
const fs=require('node:fs'),zlib=require('node:zlib'),crypto=require('node:crypto'),{parseEnv}=require('node:util'),{execFileSync}=require('node:child_process');
const token=parseEnv(fs.readFileSync('.env.local','utf8')).EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN;
const aapt=process.env.LOCALAPPDATA+'/Android/Sdk/build-tools/36.0.0/aapt.exe';
for(const file of fs.readdirSync('dist').filter(x=>x.endsWith('.apk'))){
const b=fs.readFileSync('dist/'+file);let end=b.length-22;while(end>0&&b.readUInt32LE(end)!==0x06054b50)end--;
let p=b.readUInt32LE(end+16),count=b.readUInt16LE(end+10),so=0,bad=[],zipbad=[],leaks=[];
for(let i=0;i<count;i++){
if(b.readUInt32LE(p)!==0x02014b50)throw Error('central format');
let method=b.readUInt16LE(p+10),size=b.readUInt32LE(p+20),nl=b.readUInt16LE(p+28),el=b.readUInt16LE(p+30),cl=b.readUInt16LE(p+32),off=b.readUInt32LE(p+42),name=b.subarray(p+46,p+46+nl).toString();
p+=46+nl+el+cl;if(name.endsWith('/'))continue;
const start=off+30+b.readUInt16LE(off+26)+b.readUInt16LE(off+28),raw=b.subarray(start,start+size);
let data=method===0?raw:method===8?zlib.inflateRawSync(raw):null;if(!data)continue;
if(token&&data.includes(Buffer.from(token)))leaks.push(name);
if(!name.endsWith('.so')||data.readUInt32LE(0)!==0x464c457f)continue;so++;
if(method===0&&start%16384)zipbad.push(name);
if(data[4]!==2)continue;
const pho=Number(data.readBigUInt64LE(32)),esz=data.readUInt16LE(54),num=data.readUInt16LE(56),align=[];
for(let j=0;j<num;j++){const o=pho+j*esz;if(data.readUInt32LE(o)===1)align.push(Number(data.readBigUInt64LE(o+48)));}
if(align.some(x=>x<16384))bad.push({name,align});
}
const manifest=execFileSync(aapt,['dump','badging','dist/'+file],{encoding:'utf8',maxBuffer:5e6}).split(/\r?\n/).filter(x=>/^(package:|sdkVersion|targetSdkVersion|application-debuggable|uses-permission:)/.test(x));
console.log(JSON.stringify({file,bytes:b.length,modifiedUTC:fs.statSync('dist/'+file).mtime.toISOString(),sha256:crypto.createHash('sha256').update(b).digest('hex'),manifest,nativeLibraries:so,elf64Under16KB:bad,uncompressedSoMisaligned16KB:zipbad,containsKnownDebugToken:leaks.length>0,matchEntries:leaks}));
}
```

## Controlul final al auditului

Am recitit registrul pentru afirmații nesusținute și am păstrat distincțiile care pot schimba decizia: **151 teste trecute ≠ E2E**, **SDK configurat ≠ serviciu activ**, **maxim de rezervări ≠ maxim de cost**, **page publică ≠ conformitate completă**, **APK vechi valid static ≠ release din sursa curentă**, **HMAC ≠ anonim și nici dovadă de dispozitiv unic**. Retenția feedbackului din cod este 180 zile; nu a fost dedusă din documente vechi.

Cele 5 checkmarkuri au criterii restrânse și dovezi concrete; restul rămân deschise. Raportul și dashboardul folosesc același registru de 30 elemente, aceleași priorități, responsabili, dovezi și criterii. Validarea automată verifică UTF-8, structura HTML, ID-urile, legăturile interne, câmpurile obligatorii și logica filtrelor. Browserul conectat este indisponibil; nu pretind inspecție de screenshot sau randare vizuală efectivă. Lizibilitatea este evaluată structural: layout responsive, text redimensionabil, ordine semantică, contrast, etichete explicite, detalii native și imprimare. Rezultatele finale ale verificării sunt consemnate în conversație la livrare.

Validare finală executată: UTF-8 valid în ambele fișiere; parserul parse5 nu raportează erori HTML; 30/30 elemente identice între raport și dashboard pentru titlu, statut, prioritate, responsabil, impact, cauză, acțiune, acceptanță, dependențe și dovezi; 67 ID-uri HTML unice, 86 legături locale și 20 legături interne valide. Toate cele 112 combinații statut/prioritate/responsabil, căutarea fără diacritice, rezultatul gol, resetarea și deschiderea/restrângerea detaliilor au trecut în Node VM cu DOM simulat. Tokenul debug cunoscut nu apare în niciun artefact. Aceste teste nu reprezintă randare în browser sau pe Android.

**Mandatul rămâne exclusiv audit. Nicio remediere a produsului nu a fost implementată.**
