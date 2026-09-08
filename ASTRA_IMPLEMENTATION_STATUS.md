# Profu’ de mate — starea implementării și livrarea buildului 20

Actualizat la 7 septembrie 2026, după deployul Firebase și reactivarea analizelor la 17:00:09, Europe/Bucharest. Acesta este jurnalul remedierilor și al livrării, nu un nou audit independent. [Auditul din 5 septembrie](ASTRA_INDEPENDENT_AUDIT.md) rămâne o fotografie istorică; liniile sale de cod și statuturile nu descriu automat sursa modificată ulterior.

**Buildul solicitat este finalizat în Expo/EAS. Deployul Firebase este finalizat.** Aceasta nu înseamnă că aplicația este acceptată pentru Google Play sau că toate fluxurile au fost probate pe telefon. Furnizorul AI și oferta Premium rămân deciziile amânate explicit de Daniel.

## Livrare verificată direct

| Element | Rezultat și dovadă | Limita acceptării |
|---|---|---|
| ✅ APK Expo/EAS | `eas build --platform android --profile production-apk --non-interactive --no-wait`; build **5faf1861-ab2e-428b-a8ec-0bcb503e2049**, `FINISHED`, versiune **1.0.0 (20)**. Creat 13:08:20 UTC, finalizat 13:46:17 UTC. [Pagina EAS](https://expo.dev/accounts/matdan88/projects/profu-de-mate/builds/5faf1861-ab2e-428b-a8ec-0bcb503e2049). Metadate: `firebase-debug.eas-build20-status.log`. | APK intern pre-Play; nu AAB publicat în Play. |
| ✅ Artefactul descărcat | [profu-de-mate-production-apk-v20.apk](dist/profu-de-mate-production-apk-v20.apk), **138423542 bytes**. SHA-256: `49382c4ec7c119bb1819011f2ecd32e93dc534616031f81b08e69e72a2557a62`. | Hashul identifică exact fișierul verificat. |
| ✅ Semnătură și manifest | `node scripts/verify-release-artifact.mjs dist/profu-de-mate-production-apk-v20.apk`: exit 0. Certificatul SHA-256 `ae68bd1d758362bbd4e8718a27ac915deaf70e3056592917f0f300ed49428629` coincide cu buildul EAS 19 anterior și nu este Android Debug. `ro.profudemate.app`, target API 36, min API 24, fără `debuggable=true` și fără tokenurile App Check debug cunoscute local. Loguri: `firebase-debug.eas-cert19.log`, `firebase-debug.apk20-static-check.log`. | Continuitatea certificatului cu buildul anterior nu dovedește înregistrarea certificatului Play App Signing în toate serviciile. Scanarea privește tokenurile cunoscute. |
| ✅ Aliniere ZIP | `zipalign -c -P 16 4 dist/profu-de-mate-production-apk-v20.apk`: exit 0. `aapt2 dump badging` confirmă ARM64, ARMv7, x86 și x86_64. | Verificarea ulterioară a celor 62 biblioteci ELF64 din 124 .so a găsit zero alinieri/congruențe PT_LOAD nevalide la 16 KB; dovadă: firebase-debug.apk20-elf-check.log. Rularea pe dispozitiv cu pagini de 16 KB nu este probată. |
| ✅ Deploy Firebase | `node scripts/deploy-firebase.mjs`: exit 0, `Deploy complete!`; 11 funcții actualizate, reguli și indexuri Firestore publicate, Hosting publicat. Proiect `profu-de-mate-danmat88`. Log: `firebase-debug.firebase-deploy-release20.log`. | Deploy reușit nu substituie testarea funcțională autentificată. |
| ✅ Configurație activă | Toate cele 11 funcții sunt `ACTIVE`, `pre-play-public`. AI: `analyzemathimage-00029-fuj`, actualizată 13:57:33 UTC, tot traficul pe ultima revizie. Cele trei indexuri compuse sunt `READY`. Loguri: `firebase-debug.functions-during-deploy20.log`, `firebase-debug.deploy20-metadata.log`. | Enforcementul Play și Device Recall nu sunt acceptate prin acest canal. |
| ✅ Analize reactivate | `_runtimeConfig/ai.enabled=true`, citit după scriere la **14:00:09.721597 UTC**. Reactivarea a folosit precondiția versiunii documentului, după drenare. Documentul bugetului zilei era absent; nu am resetat/decrementat contoare. `firebase-debug.rollout-reactivated20.log`. | Confirmă comutatorul administrativ. Nu am efectuat un apel matematic plătit la furnizor. |
| ✅ Probe externe limitate | Patru endpoints fără autentificare returnează 401/`UNAUTHENTICATED`. Paginile `/confidentialitate` și `/stergere-date` returnează HTTP 200 și sunt identice byte cu byte cu sursele locale. `firebase-debug.deploy20-smoke.log`. | Probe de acces și publicare; nu sunt E2E cu utilizator conectat. |

Profilul `production-apk` păstrează `EXPO_PUBLIC_APP_CHECK_PROVIDER=none`, fără token debug. `production` rămâne profilul AAB cu `playIntegrity`. Etapa backend este declarată explicit în fișierul local ignorat `functions/.env.profu-de-mate-danmat88`. Acesta a fost publicat prin deploy; nu este inclus în Git. [EAS Android builds](https://docs.expo.dev/build-reference/android-builds/) descrie buildul cloud și prebuildul Expo. Diagnosticul Gradle anterior nu a înlocuit buildul EAS livrat aici.

## Verificările locale efectuate

| Comandă | Rezultat | Dovadă locală |
|---|---|---|
| `npm run test:mobile` | **132/132**, zero eșecuri, ignorate sau anulate | `firebase-debug.mobile-final8.log` |
| `npm run functions:test` | **76/76**, zero eșecuri, ignorate sau anulate | `firebase-debug.backend-final7.log` |
| `node scripts/test-emulators.mjs`, după build Functions | **38/38**, proiect izolat `demo-profu-de-mate`, Auth + Firestore | `firebase-debug.emulator-final7.log` |
| TypeScript `tsc --noEmit`, `npm run lint` | Ambele exit 0 | `firebase-debug.types-final7.log`, `firebase-debug.lint-final7.log` |
| `npm run deps:check`, `npm run legal:check` | Ambele exit 0 | `firebase-debug.deps-final7.log`, `firebase-debug.legal-final7.log` |
| `npm run release:bundle-check` | 47 fișiere, 13051680 bytes, fără tokenurile debug cunoscute | `firebase-debug.bundle-final7.log` |
| Testele `tests/releaseGuards.test.mts` după inspecția APK | **7/7** | `firebase-debug.release-guards-apk20.log` |

Testele mobile includ simulări ale modulelor native. Cele 246 de teste din cele trei suite nu reprezintă 246 de fluxuri rulate pe Android. Ultima corecție a verificatorului de artefacte a adăugat citirea formatului numeric emis efectiv de `aapt2` 36 (`targetSdkVersion(...)=36`); verificatorul anterior îl respingea greșit. Corecția privește scriptul și testul lui, fără schimbarea aplicației din APK sau a backendului publicat.

Sursa livrată conține modificările necomise. `firebase-debug.build20-source-manifest.log` păstrează hashuri pentru 191 intrări de sursă la lansarea buildului, pornind de la HEAD `db85cd666132008044196d193d3359d0f1b4a68a`. Manifestul nu este un substitut pentru arhiva EAS și nu include toate fișierele ignorate. Nu am făcut commit sau push.

## Registrul actual al celor 30 de puncte

✅ înseamnă verificat și acceptat pentru criteriul explicit al punctului. 🟡 înseamnă implementare parțială sau probă insuficientă. ❌ defect confirmat; ⚪ absent și necesar; ⛔ blocat extern; ❓ încă neverificabil. Nu se convertește un test de serviciu într-o acceptare a ecranului nativ.

Registrul are **30 de puncte: 6 ✅, 20 🟡, 1 ❌, 0 ⚪, 2 ⛔, 1 ❓**. Aceste numere privesc punctele întregi; subtaskurile ⚪ încă lipsă sunt precizate în punctele parțiale. Nu reprezintă procent de pregătire. **8 puncte conțin implementare care poate avansa acum prin agent**, fără alegerea AI sau a prețurilor.

### A01 · ❌ · P0 — Furnizorul actual și publicul 13+

**Stadiu:** Adaptor izolat; furnizorul nu a fost înlocuit.

**Dovadă și nivel:** Verificat în cod și termenii furnizorului. Adaptorul folosește încă Gemini Developer API; alegerea AI a fost amânată explicit.

**Surse:** [functions/src/aiProvider.ts](functions/src/aiProvider.ts); [src/legal.ts](src/legal.ts); [Gemini API — Age Requirements](https://ai.google.dev/gemini-api/terms).

**Risc / limită:** Integrarea actuală nu poate fundamenta lansarea pentru publicul 13+ în condițiile publice verificate.

**Următoarea acțiune:** Daniel alege serviciul și condițiile eligibile; agentul adaptează integrarea și textele, apoi execută probele de contract.

**Acceptanță:** Condiții aplicabile pentru 13+, acces configurat, integrare și informare actualizate, teste ale furnizorului ales.

**Responsabili:** Daniel · agent · serviciu extern. **Tipul pasului:** Decizie AI / Premium.

**Dependențe / blocaje:** Decizia AI a lui Daniel; acces și termeni ai furnizorului.

### A02 · 🟡 · P0 — APK-ul nou este curat; expunerea veche rămâne de clarificat

**Stadiu:** APK 20 verificat; tokenurile istorice nu sunt declarate revocate.

**Dovadă și nivel:** Verificat direct: APK 20 nu conține tokenurile debug cunoscute și are certificatul EAS al buildului 19. Auditul a găsit tokenuri în alte APK-uri istorice.

**Surse:** [firebase-debug.apk20-static-check.log](firebase-debug.apk20-static-check.log); [firebase-debug.eas-cert19.log](firebase-debug.eas-cert19.log); [Audit istoric — A02/T08](ASTRA_INDEPENDENT_AUDIT.md).

**Risc / limită:** Buildul nou nu revocă un token vechi dacă acesta mai este autorizat în Firebase.

**Următoarea acțiune:** Inventariază înregistrarea/distribuirea tokenurilor istorice și revocă exclusiv credențialele confirmate ca expuse; păstrează verificarea fiecărui artefact.

**Acceptanță:** APK-ul distribuit trece scanarea și semnătura; există dovadă privind tokenurile istorice autorizate și canalele afectate.

**Responsabili:** agent · Daniel · serviciu extern. **Tipul pasului:** Configurare / probă externă.

**Dependențe / blocaje:** Acces App Check și istoricul distribuirii; fără valori de token în dashboard.

### A03 · 🟡 · P0 — Plafonul apelurilor AI a fost corectat

**Stadiu:** Cod reparat, teste concurente trecute, backend publicat.

**Dovadă și nivel:** Demonstrat prin teste: providerAttempts este nerefundabil, rezervat înainte de fiecare apel; refundul cotei nu îl scade. Contorul legacy este refuzat. Rolloutul nu a resetat contoare.

**Surse:** [commercialAccess.ts:294–332](functions/src/commercialAccess.ts); [index.ts:197–201](functions/src/index.ts); [functions/integration/commercialAccess.test.mjs](functions/integration/commercialAccess.test.mjs); [firebase-debug.rollout-reactivated20.log](firebase-debug.rollout-reactivated20.log).

**Risc / limită:** Plafonul este în încercări, nu în bani; costurile/tokenii reali nu au fost reconciliați cu facturarea furnizorului.

**Următoarea acțiune:** După alegerea AI, măsoară apelurile/tokenii și reconciliază consumul, inclusiv repair, timeout și răspuns neclar.

**Acceptanță:** Cel mult N apeluri la plafon N, inclusiv concurență și retry; cota se restituie separat; consumul observat se reconciliază cu furnizorul.

**Responsabili:** agent · Daniel · serviciu extern. **Tipul pasului:** Decizie AI / Premium.

**Dependențe / blocaje:** Furnizor AI și buget monetar stabilite; testele de limitare locală sunt deja trecute.

### A04 · 🟡 · P1 — Caietul gol nu mai este ignorat de abonare

**Stadiu:** Defectul serviciului reparat și acoperit de regresie.

**Dovadă și nivel:** Testul execută serviciul real cu transport simulat: primul snapshot gol notifică, iar răspunsurile altui cont sunt ignorate.

**Surse:** [lessons.ts:65 și următoarele](src/services/lessons.ts); [Test: actual Notebook subscription publishes an initial empty snapshot](tests/serviceLifecycle.test.mts); [firebase-debug.mobile-final8.log](firebase-debug.mobile-final8.log).

**Risc / limită:** Starea vizibilă pe APK 20 nu a fost probată; testul serviciului nu montează ecranul nativ.

**Următoarea acțiune:** Verifică pe APK 20 un Caiet gol, încărcare din cache, eroare/retry și schimbarea contului.

**Acceptanță:** Stare goală vizibilă fără loader blocat; actualizări și erori corecte în aceeași sesiune și fără lecțiile altui cont.

**Responsabili:** agent · Daniel. **Tipul pasului:** Validare pe dispozitiv.

**Dependențe / blocaje:** APK 20 disponibil; dispozitiv Android pentru acceptarea UI.

### A05 · ✅ · P1 — Rezultatul pentru modul opus este respins

**Stadiu:** Contract reparat și acceptat prin teste.

**Dovadă și nivel:** Pipelineul validează candidatul față de modul cerut. Testele solve→check și check→solve resping modul opus; repairul poate returna numai modul cerut.

**Surse:** [providerPipeline.ts:128–132](functions/src/providerPipeline.ts); [Testele pentru modul opus și repair](functions/src/providerPipeline.test.ts); [firebase-debug.backend-final7.log](firebase-debug.backend-final7.log).

**Risc / limită:** Acceptarea privește contractul modului, nu corectitudinea matematică a răspunsului.

**Următoarea acțiune:** Păstrează regresiile când este schimbat adaptorul AI.

**Acceptanță:** Niciun candidat cu mode diferit nu este returnat sau salvat; testele în ambele sensuri trec.

**Responsabili:** agent. **Tipul pasului:** Criteriu acceptat.

**Dependențe / blocaje:** Nu are blocaj pentru criteriul de contract; calitatea matematică este A11.

### A06 · 🟡 · P1 — Lease-ul expirat poate fi reluat

**Stadiu:** Cod client/server reparat; concurență testată.

**Dovadă și nivel:** Serverul clasifică lease-ul expirat drept failed, acordă lease nou și respinge workerul vechi; clientul reia cererea cu același identificator și fingerprint.

**Surse:** [analysisRequests.ts:16–67](functions/src/analysisRequests.ts); [src/services/mathAnalysis.ts](src/services/mathAnalysis.ts); [functions/integration/requestLifecycle.test.mjs](functions/integration/requestLifecycle.test.mjs); [tests/serviceLifecycle.test.mts](tests/serviceLifecycle.test.mts).

**Risc / limită:** Nu a fost observat pe APK 20 un kill/resume real în timpul procesării.

**Următoarea acțiune:** Testează întreruperea procesului și revenirea pe aceeași fotografie, inclusiv schimbarea contului.

**Acceptanță:** O singură lecție și cotă finală; workerul vechi nu finalizează peste cel nou; revenirea pe Android nu rămâne blocată.

**Responsabili:** agent · Daniel. **Tipul pasului:** Validare pe dispozitiv.

**Dependențe / blocaje:** APK 20 și cont/dispozitiv de test; providerul pentru analiza reală.

### A07 · 🟡 · P1 — Ștergerea blochează operațiile concurente

**Stadiu:** Barieră reparată și publicată; recuperarea generală lipsește.

**Dovadă și nivel:** Barierele deleting/merging sunt verificate în tranzacții; testele de integrare resping scrieri după ștergere. Nu există worker general pentru ștergeri abandonate după pierderea sesiunii.

**Surse:** [userLifecycle.ts:7–30](functions/src/userLifecycle.ts); [index.ts:556 și următoarele](functions/src/index.ts); [functions/integration/requestLifecycle.test.mjs](functions/integration/requestLifecycle.test.mjs); [Secțiunea recuperare ștergere parțială](OPERATIONS_RUNBOOK.md).

**Risc / limită:** O întrerupere după ștergerea Auth poate lăsa operația nefinalizată și necesită recuperare administrativă.

**Următoarea acțiune:** Construiește utilitarul de inventariere și recuperare cu dry-run și precondiții; testează întreruperea fiecărui pas pe date sintetice.

**Acceptanță:** Nicio rescriere după barieră; o ștergere întreruptă poate fi finalizată verificabil fără sesiunea dispărută și fără a afecta contul recreat.

**Responsabili:** agent · Daniel. **Tipul pasului:** Agent — implementare acum · Validare pe dispozitiv.

**Dependențe / blocaje:** Toolingul poate fi pregătit acum. Executarea pe date reale cere ținte verificate; RevenueCat este A10.

**⚪ Agent — implementare acum:** Utilitar de recuperare a ștergerilor, cu dry-run, precondiții de identitate și teste la fiecare întrerupere.

### A08 · 🟡 · P1 — Logoutul local nu mai așteaptă rețeaua

**Stadiu:** Cod reparat; regresii pentru operații blocate și tardive.

**Dovadă și nivel:** Testul de logout execută serviciul cu verificarea Firebase și cleanupul Billing care nu se rezolvă; signOutul local poate termina. Generația invalidează răspunsurile vechi.

**Surse:** [src/services/commercial.ts](src/services/commercial.ts); [src/context/CommercialContext.tsx](src/context/CommercialContext.tsx); [Test: actual logout completes locally even if Firebase verification and billing cleanup never resolve](tests/serviceLifecycle.test.mts).

**Risc / limită:** SDK-urile native și navigația offline pe APK 20 nu au fost probate direct.

**Următoarea acțiune:** Probează cold start offline, logout și reconectare; verifică dispariția lecțiilor și a fotografiei contului anterior.

**Acceptanță:** Logout fără condiție de conectivitate; nicio stare privată veche reapare după răspunsuri întârziate.

**Responsabili:** agent · Daniel. **Tipul pasului:** Validare pe dispozitiv.

**Dependențe / blocaje:** APK 20 pe Android; curățarea RC este serializată, dar o operație nativă blocată definitiv cere restart.

### A09 · 🟡 · P1 — Canalele EAS și backendul sunt aliniate pentru pre-Play

**Stadiu:** Pre-Play publicat; atestarea Play rămâne de probat.

**Dovadă și nivel:** production-apk folosește none fără token debug; production cere playIntegrity. Cele 11 funcții publicate au stage explicit pre-play-public; Device Recall implicit off în acest stage.

**Surse:** [eas.json](eas.json); [app.config.js](app.config.js); [functions/src/releaseSecurity.ts](functions/src/releaseSecurity.ts); [firebase-debug.functions-during-deploy20.log](firebase-debug.functions-during-deploy20.log); [tests/releaseGuards.test.mts](tests/releaseGuards.test.mts).

**Risc / limită:** Canalul pre-Play are protecție redusă la nivel de dispozitiv; nu dovedește enforcementul sau recall prin Play.

**Următoarea acțiune:** Configurează și probează App Check, certificatul Play și modul Device Recall pe viitorul build EAS production.

**Acceptanță:** Cereri valide acceptate, atestare invalidă refuzată și comportamentul guest/recall demonstrat pe canalul Play.

**Responsabili:** agent · Daniel · serviciu extern. **Tipul pasului:** Configurare / probă externă.

**Dependențe / blocaje:** Acces Play/App Check/Device Recall și artefactul AAB; APK-ul curent rămâne compatibil cu backendul.

### A10 · 🟡 · P1 — Premium și ștergerea RevenueCat nu sunt finalizate

**Stadiu:** SDK întărit; integrarea comercială este încă parțială.

**Dovadă și nivel:** 15 teste lifecycle verifică serializarea SDK. Syncul verifică UID-ul înainte/după fetch; cererile de ștergere sunt review_required, fără DELETE automat. Endpoints RC nu sunt activate în cloud.

**Surse:** [src/services/purchases.ts](src/services/purchases.ts); [tests/purchasesLifecycle.test.mts](tests/purchasesLifecycle.test.mts); [revenueCat.ts:81–131](functions/src/revenueCat.ts); [functions/src/revenueCatDeletion.ts](functions/src/revenueCatDeletion.ts); [functions/integration/revenueCatLifecycle.test.mjs](functions/integration/revenueCatLifecycle.test.mjs).

**Risc / limită:** Coada manuală nu finalizează ștergerea externă; syncurile concurente ale aceluiași UID nu au o regulă de ordine explicită în cod.

**Următoarea acțiune:** Adaugă regresii pentru syncuri concurente/erori HTTP și un utilitar de review. Definitivează identitatea pe generații și transferul abonamentului înainte de activare.

**Acceptanță:** Entitlementul nu regresează prin rezultat tardiv; ștergerea nu afectează contul recreat; cumpărare/restaurare/anulare verificate cu produsele reale.

**Responsabili:** agent · Daniel · serviciu extern. **Tipul pasului:** Agent — implementare acum · Decizie AI / Premium · Configurare / probă externă.

**Dependențe / blocaje:** Testele și toolingul se pot pregăti acum; politica de identitate/transfer și oferta cer Daniel și RevenueCat/Play.

**⚪ Agent — implementare acum:** Teste pentru ordonarea syncurilor aceluiași UID și 404/429/timeout; utilitar de review pentru ștergerile externe.

### A11 · 🟡 · P1 — Evaluatorul există; corpusul matematic lipsește

**Stadiu:** Framework implementat, fără benchmark acceptat.

**Dovadă și nivel:** Evaluatorul validează manifestul, completitudinea, schema, rubricile umane și latența. Codul listează modelele observațiilor, fără evaluare separată pe model. Nu există corpus pedagogic acceptat.

**Surse:** [functions/src/mathEvaluation.ts](functions/src/mathEvaluation.ts); [functions/src/mathEvaluation.test.ts](functions/src/mathEvaluation.test.ts); [scripts/evaluate-math-results.mjs](scripts/evaluate-math-results.mjs).

**Risc / limită:** Un framework fără enunțuri, imagini, răspunsuri verificate și probe live nu măsoară calitatea produsului.

**Următoarea acțiune:** Pregătește corpusul și separarea evaluării pe model; Daniel confirmă rubricile și verificarea pedagogică, apoi rulează furnizorul ales.

**Acceptanță:** Cel puțin 100 de cazuri aprobate, categorii reprezentative, răspunsuri de referință verificate și rezultate reproductibile pentru fiecare model.

**Responsabili:** agent · Daniel. **Tipul pasului:** Agent — implementare acum · Decizie AI / Premium.

**Dependențe / blocaje:** Corpusul și evaluatorul pot avansa fără alegerea AI; rezultatele live și pragurile acceptate depind de decizia produsului.

**⚪ Agent — implementare acum:** Corpus cu enunțuri/imagini/răspunsuri de referință; evaluare separată pe model și erori izolate pe caz.

### A12 · 🟡 · P1 — Raportarea este extinsă; moderarea nu este operațională

**Stadiu:** Fluxul de raportare reparat și testat.

**Dovadă și nivel:** Feedbackul acceptă lecție sau request finalizat deținut, păstrează rezultatul pentru review și nu redeschide rapoarte procesate. Există status/severity, fără instrument complet de tratare.

**Surse:** [feedbackService.ts:7–68](functions/src/feedbackService.ts); [src/components/FeedbackSheet.tsx](src/components/FeedbackSheet.tsx); [Test: non-ready AI content is reportable](functions/integration/requestLifecycle.test.mjs).

**Risc / limită:** Rapoartele pot fi stocate fără să fie preluate și rezolvate de un operator.

**Următoarea acțiune:** Implementează instrumentul de triere/rezolvare cu auditul acțiunilor; apoi conectează operatorul și canalul de notificare alese.

**Acceptanță:** Un raport unsafe este preluat, investigat și închis trasabil; accesul neautorizat este refuzat și ștergerea contului elimină raportul.

**Responsabili:** agent · Daniel. **Tipul pasului:** Agent — implementare acum · Configurare / probă externă.

**Dependențe / blocaje:** Toolingul și testele pot fi făcute acum; operatorul/canalul și proba de tratare reală rămân de stabilit.

**⚪ Agent — implementare acum:** Instrument de triere/rezolvare cu control de acces, istoric de acțiuni și teste.

### A13 · 🟡 · P2 — Retenția și curățarea au fost corectate

**Stadiu:** Curățare tranzacțională; texte publicate.

**Dovadă și nivel:** Testul păstrează lecția reînnoită în timpul curățării. Caietul reînnoiește retenția la activitate; feedbackul are 180 zile. Textele publicate coincid cu sursele.

**Surse:** [functions/src/cleanup.ts](functions/src/cleanup.ts); [src/services/lessons.ts](src/services/lessons.ts); [functions/integration/requestLifecycle.test.mjs](functions/integration/requestLifecycle.test.mjs); [hosting/public/confidentialitate.html](hosting/public/confidentialitate.html); [firebase-debug.deploy20-smoke.log](firebase-debug.deploy20-smoke.log).

**Risc / limită:** Rularea și latența curățării sub volum real nu sunt demonstrate; paritatea termenelor declarate nu are verificator automat complet.

**Următoarea acțiune:** Adaugă regresii la limitele retenției și verificarea parității declarațiilor; măsoară expirările efective și alertele de curățare.

**Acceptanță:** Datele reînnoite supraviețuiesc, cele expirate sunt eliminate în termenul declarat, iar abaterile sunt detectate.

**Responsabili:** agent · Daniel · serviciu extern. **Tipul pasului:** Agent — implementare acum · Configurare / probă externă.

**Dependențe / blocaje:** Testele și verificatorul se pot pregăti acum; măsurarea Scheduler/volum ține de operare.

**⚪ Agent — implementare acum:** Verificator al parității retențiilor și regresii pentru limitele temporale și refreshul Caietului.

### A14 · 🟡 · P1 — Analiza în așteptare este legată de sesiune

**Stadiu:** Schema și invalidarea tardivă reparate.

**Dovadă și nivel:** Schema pending cere UID-ul activ; testele resping alt cont și împiedică lectura târzie să restaureze fotografia după logout.

**Surse:** [pendingAnalysis.ts:27–39, 112–114](src/services/pendingAnalysis.ts); [src/services/sessionGuard.ts](src/services/sessionGuard.ts); [tests/serviceLifecycle.test.mts](tests/serviceLifecycle.test.mts).

**Risc / limită:** Cazul complet kill/resume și schimbare cont nu a fost observat în stocarea nativă a APK-ului 20.

**Următoarea acțiune:** Testează pe APK 20 fotografia pending după logout, ștergere și reconectare cu alt cont.

**Acceptanță:** Fotografia și rezultatul vechi nu sunt reluate, afișate sau trimise sub alt cont.

**Responsabili:** agent · Daniel. **Tipul pasului:** Validare pe dispozitiv.

**Dependențe / blocaje:** APK 20 și conturi de test; nu necesită alegerea prețurilor.

### A15 · 🟡 · P1 — Transferul conturilor este reluabil, dar nu complet operat

**Stadiu:** Idempotency și protecția targetului testate.

**Dovadă și nivel:** Transferul păstrează lecțiile targetului, deduplică utilizarea și păstrează tichetul merging după expirarea inițială. Regresiile verifică reluarea și refuzul analizei active.

**Surse:** [functions/src/accountMerge.ts](functions/src/accountMerge.ts); [functions/integration/requestLifecycle.test.mjs](functions/integration/requestLifecycle.test.mjs); [Test: bound pending notebook transfer survives eight offline days](tests/serviceLifecycle.test.mts).

**Risc / limită:** Pierderea dispozitivului/tichetului sau ștergerea targetului poate cere recuperare administrativă; nu există utilitar complet.

**Următoarea acțiune:** Construiește inspecția și recuperarea transferurilor cu dry-run și precondiții; probează apoi Google Sign-In real pe APK.

**Acceptanță:** Transfer repetabil fără lecții suprascrise, bonus de cotă sau sursă abandonată; recuperare verificată pentru pașii întrerupți.

**Responsabili:** agent · Daniel. **Tipul pasului:** Agent — implementare acum · Validare pe dispozitiv.

**Dependențe / blocaje:** Toolingul poate fi pregătit acum; proba Credential Manager/Google cere dispozitiv și conturi.

**⚪ Agent — implementare acum:** Utilitar de recuperare a transferurilor cu precondiții pentru sursă/target și raport al datelor rămase.

### A16 · ⛔ · P1 — Declarațiile și prelucrarea datelor pentru 13+

**Stadiu:** Textele există; deciziile și formularele nu sunt atestate.

**Dovadă și nivel:** Configurația legală declară 13+, operator și contacte. Formularul Data safety, temeiul aplicabil și informarea finală depind de furnizorul efectiv și datele reale.

**Surse:** [src/legal.ts](src/legal.ts); [hosting/public/confidentialitate.html](hosting/public/confidentialitate.html); [Audit — A16](ASTRA_INDEPENDENT_AUDIT.md).

**Risc / limită:** Declarații nealiniate cu traficul și retenția reală pot face publicarea neacceptabilă.

**Următoarea acțiune:** Daniel definitivează deciziile; agentul pregătește inventarul de date și textele pe integrarea finală.

**Acceptanță:** Declarațiile Play și textele reflectă datele, SDK-urile și retențiile măsurate; operatorul confirmă procesul pentru drepturile utilizatorilor.

**Responsabili:** Daniel · agent · serviciu extern. **Tipul pasului:** Decizie AI / Premium · Configurare / probă externă.

**Dependențe / blocaje:** Furnizor final, proces operator și acces Play Console.

### A17 · ⛔ · P1 — Accesul și aprobările Google Play

**Stadiu:** Build intern disponibil; publicarea Play nu este demonstrată.

**Dovadă și nivel:** EAS confirmă production-apk intern. Acesta nu demonstrează listing, acces reviewer, track-uri, testeri sau eligibilitatea contului pentru producție.

**Surse:** [firebase-debug.eas-build20-status.log](firebase-debug.eas-build20-status.log); [eas.json](eas.json); [Audit — A17](ASTRA_INDEPENDENT_AUDIT.md).

**Risc / limită:** APK intern finalizat nu înseamnă aprobare de magazin sau beta 13+ acceptată.

**Următoarea acțiune:** Completează și verifică Play Console, apoi construiește AAB production pentru track-ul autorizat.

**Acceptanță:** Cont și declarații verificate, cerințele de testare aplicabile îndeplinite, acces reviewer funcțional și decizie Play.

**Responsabili:** Daniel · serviciu extern · agent. **Tipul pasului:** Configurare / probă externă.

**Dependențe / blocaje:** Play Console, AI eligibil, A16 și acceptarea fluxurilor pe Android.

### A18 · ✅ · P1 — Buildul production-apk 20 este finalizat în Expo/EAS

**Stadiu:** Livrare verificată pentru canalul solicitat.

**Dovadă și nivel:** EAS FINISHED, 1.0.0 (20), ID 5faf1861-ab2e-428b-a8ec-0bcb503e2049. APK-ul descărcat are hash verificat și certificatul existent; 11 funcții Firebase și Hosting publicate.

**Surse:** [Build EAS 20](https://expo.dev/accounts/matdan88/projects/profu-de-mate/builds/5faf1861-ab2e-428b-a8ec-0bcb503e2049); [firebase-debug.apk20-static-check.log](firebase-debug.apk20-static-check.log); [firebase-debug.firebase-deploy-release20.log](firebase-debug.firebase-deploy-release20.log); [firebase-debug.build20-source-manifest.log](firebase-debug.build20-source-manifest.log).

**Risc / limită:** Acceptarea este pentru APK-ul pre-Play și deploy; testarea funcțională pe dispozitiv și AAB Play sunt separate.

**Următoarea acțiune:** Folosește exact APK-ul 20 pentru proba pe telefon; păstrează identificarea buildului la orice înlocuire.

**Acceptanță:** Build EAS finalizat, artefact descărcat identificat prin hash și verificări statice trecute. Criteriu îndeplinit pentru APK-ul solicitat.

**Responsabili:** agent. **Tipul pasului:** Criteriu acceptat.

**Dependențe / blocaje:** A19 pentru funcționare observată; A17 pentru AAB/Play.

### A19 · ❓ · P1 — Fluxurile APK-ului 20 pe telefon

**Stadiu:** Candidatul există; acceptarea nativă lipsește.

**Dovadă și nivel:** Au fost rulate teste de logică și emulatoare Firebase. Emulatorul Android de diagnostic a fost oprit la cererea lui Daniel; nu a validat fluxurile APK-ului EAS 20.

**Surse:** [firebase-debug.mobile-final8.log](firebase-debug.mobile-final8.log); [firebase-debug.emulator-final7.log](firebase-debug.emulator-final7.log); [APK EAS 20](dist/profu-de-mate-production-apk-v20.apk).

**Risc / limită:** Camera, importul, decuparea, navigația, accesibilitatea și performanța pot avea defecte neacoperite de testele de servicii.

**Următoarea acțiune:** Testează APK 20: cameră/import/decupare, rezultat/Caiet, offline, kill/resume, conturi, text mărit și TalkBack; înregistrează rezultatele.

**Acceptanță:** Scenarii esențiale trecute pe dispozitive reprezentative, fără pierderi/amestecare de date; rezultate și probleme trasabile.

**Responsabili:** agent · Daniel. **Tipul pasului:** Validare pe dispozitiv.

**Dependențe / blocaje:** APK disponibil; dispozitive/conturi de test și furnizor pentru probe matematice reale.

### A20 · 🟡 · P1 — Deployul este făcut; operarea mai cere implementare și probe

**Stadiu:** Runbook și deploy existente; alerte/restaurare neacceptate.

**Dovadă și nivel:** Deployul 11 funcții/reguli/indexuri/Hosting este demonstrat. Runbookul descrie rollout, revenire și incidente. Nu există definiții complete versionate pentru alerte sau restaurare probată.

**Surse:** [firebase-debug.firebase-deploy-release20.log](firebase-debug.firebase-deploy-release20.log); [firebase-debug.deploy20-metadata.log](firebase-debug.deploy20-metadata.log); [OPERATIONS_RUNBOOK.md](OPERATIONS_RUNBOOK.md); [functions/src/runtimeConfig.ts](functions/src/runtimeConfig.ts).

**Risc / limită:** Un incident de cost, curățare sau pierdere a datelor poate fi detectat ori recuperat târziu.

**Următoarea acțiune:** Pregătește definițiile alertelor, instrumentele de recuperare și proba de restaurare izolată; Daniel stabilește operatorul, pragurile și retenția backupului.

**Acceptanță:** Incidentul sintetic ajunge la operator; restaurarea izolată respectă țintele RPO/RTO și nu reintroduce date șterse sau reduce contoare.

**Responsabili:** agent · Daniel · serviciu extern. **Tipul pasului:** Agent — implementare acum · Configurare / probă externă.

**Dependențe / blocaje:** Definițiile și procedurile executabile pot fi pregătite acum; pragurile, destinațiile și aplicarea reală cer configurația serviciilor.

**⚪ Agent — implementare acum:** Definiții versionate de alerte/log metrics și procedură executabilă de restaurare izolată, cu verificări ale datelor șterse.

### A21 · 🟡 · P1 — Regresiile de release au fost adăugate

**Stadiu:** 246 teste trecute; acceptarea E2E nu este completă.

**Dovadă și nivel:** 132 teste mobile, 76 backend și 38 integrare/rules trecute. Verificator de artefacte, preflight deploy și configurație CI există; execuția CI remote și proba nativă completă nu sunt atestate.

**Surse:** [firebase-debug.mobile-final8.log](firebase-debug.mobile-final8.log); [firebase-debug.backend-final7.log](firebase-debug.backend-final7.log); [firebase-debug.emulator-final7.log](firebase-debug.emulator-final7.log); [.github/workflows/quality.yml](.github/workflows/quality.yml); [scripts/deploy-preflight.mjs](scripts/deploy-preflight.mjs).

**Risc / limită:** Numărul de teste nu certifică SDK-urile native, plățile sau toate operațiile distribuite.

**Următoarea acțiune:** Rulează verificările pe revizia candidatului în CI și execută scenariile E2E pe APK-ul EAS; păstrează rezultatele asociate buildului.

**Acceptanță:** Regresiile critice trec în pipeline și pe candidatul livrat la nivelul potrivit; niciun rezultat vechi nu este prezentat drept probă pentru alt build.

**Responsabili:** agent · Daniel. **Tipul pasului:** Validare pe dispozitiv · Configurare / probă externă.

**Dependențe / blocaje:** CI remote și A19; plățile/furnizorul final au dependențele A10/A11.

### A22 · 🟡 · P2 — Advisories runtime eliminate; toolingul rămâne de revizuit

**Stadiu:** 0 runtime; 4 intrări moderate în arborele de dezvoltare.

**Dovadă și nivel:** Ultimele scanări înregistrate: root și Functions runtime 0 advisories; scanarea completă root are 4 moderate, 0 high/critical. Actualizările compatibile și adaptorul CJS au teste/build EAS trecut.

**Surse:** [firebase-debug.runtime-audit-final4.log](firebase-debug.runtime-audit-final4.log); [firebase-debug.backend-audit-final4.log](firebase-debug.backend-audit-final4.log); [firebase-debug.full-audit-final2.log](firebase-debug.full-audit-final2.log); [tests/dependencyCompatibility.test.mts](tests/dependencyCompatibility.test.mts); [vendor/decode-uri-component/UPSTREAM.md](vendor/decode-uri-component/UPSTREAM.md).

**Risc / limită:** Toolingul de dezvoltare încă include pachete semnalate. Zero advisories runtime nu este garanție de securitate.

**Următoarea acțiune:** Reverifică lanțurile afectate și o versiune compatibilă a instrumentelor; aplică doar remedierea validată cu instalare curată, teste și EAS.

**Acceptanță:** Advisories rămase eliminate sau justificat delimitate cu dovadă; lockfile reproductibil și fără regresie în build.

**Responsabili:** agent. **Tipul pasului:** Agent — implementare acum.

**Dependențe / blocaje:** Disponibilitatea unui fix compatibil în upstream; nu forța upgrade-uri majore fără probă.

**⚪ Agent — implementare acum:** Analiză și remediere compatibilă a celor 4 intrări moderate din dependențele de dezvoltare.

### A23 · 🟡 · P2 — Oferta Premium are eroare și retry limitate

**Stadiu:** Logică reparată; store real neprobat.

**Dovadă și nivel:** latestTask/deadline invalidează răspunsuri vechi și iese din încărcare la eroare/timeout; regresiile verifică retry și schimbarea sesiunii.

**Surse:** [src/screens/PaywallScreen.tsx](src/screens/PaywallScreen.tsx); [src/utils/latestTask.ts](src/utils/latestTask.ts); [tests/asyncPresentation.test.mts](tests/asyncPresentation.test.mts).

**Risc / limită:** Controllerul este testat; ecranul nativ și prețurile Google Play nu au fost observate în oferta finală.

**Următoarea acțiune:** Probează eroare, ofertă absentă, retry și schimbare cont pe dispozitiv; apoi prețurile produselor alese.

**Acceptanță:** Nicio încărcare infinită; mesaj și retry utilizabile; răspunsurile vechi nu înlocuiesc oferta contului curent.

**Responsabili:** agent · Daniel · serviciu extern. **Tipul pasului:** Validare pe dispozitiv · Decizie AI / Premium.

**Dependențe / blocaje:** APK pentru UI; produse Play/RevenueCat pentru oferta reală.

### A24 · 🟡 · P2 — Fonturile și WebView au fallback

**Stadiu:** Timeouturi și text de rezervă implementate.

**Dovadă și nivel:** Fonturile au limită 3 s, readiness WebView 12 s și randare nativă de rezervă. Testele exercită timeoutul fonturilor și păstrarea titlurilor/formulelor.

**Surse:** [MathDocumentView.tsx:44, 66–69](src/components/MathDocumentView.tsx); [src/utils/mathDocumentFallback.ts](src/utils/mathDocumentFallback.ts); [tests/asyncPresentation.test.mts](tests/asyncPresentation.test.mts).

**Risc / limită:** Fallbackul text nu reproduce diagramele; lizibilitatea și retryul pe Android trebuie probate.

**Următoarea acțiune:** Verifică fonturi indisponibile, WebView blocat, text mărit și retry pe APK 20, inclusiv lecții cu diagrame.

**Acceptanță:** Nicio lecție nu rămâne invizibilă în loader; textul de rezervă este lizibil și limitările diagramelor sunt clare.

**Responsabili:** agent · Daniel. **Tipul pasului:** Validare pe dispozitiv.

**Dependențe / blocaje:** APK 20 și dispozitiv; fixture-uri sintetice pot fi folosite fără AI live.

### A25 · ✅ · P2 — Tipuri, lint și compatibilitate Expo

**Stadiu:** Verificări locale trecute; EAS compilat.

**Dovadă și nivel:** TypeScript și lint exit 0; expo install --check fără abateri. Expo 57/RN 0.86/React 19.2.3; build EAS 20 FINISHED.

**Surse:** [firebase-debug.types-final7.log](firebase-debug.types-final7.log); [firebase-debug.lint-final7.log](firebase-debug.lint-final7.log); [firebase-debug.deps-final7.log](firebase-debug.deps-final7.log); [package.json](package.json).

**Risc / limită:** Verificările statice nu acoperă comportamentul Android sau toate dependențele tranzitive.

**Următoarea acțiune:** Reexecută verificările la modificări relevante de sursă/dependențe.

**Acceptanță:** Tipurile, lintul și compatibilitatea declarată trec; acceptare limitată la aceste verificări.

**Responsabili:** agent. **Tipul pasului:** Criteriu acceptat.

**Dependențe / blocaje:** Fără blocaj pentru criteriul static; A19 rămâne separat.

### A26 · ✅ · P2 — Suitele locale și de integrare trec

**Stadiu:** 246 teste acceptate în domeniul lor.

**Dovadă și nivel:** 132 mobile + 76 backend + 38 emulatoare Firebase, fără eșecuri/skip/anulări. Cele 7 teste ale verificatorului de release au fost rerulate după corectarea parserului aapt2.

**Surse:** [firebase-debug.mobile-final8.log](firebase-debug.mobile-final8.log); [firebase-debug.backend-final7.log](firebase-debug.backend-final7.log); [firebase-debug.emulator-final7.log](firebase-debug.emulator-final7.log); [firebase-debug.release-guards-apk20.log](firebase-debug.release-guards-apk20.log).

**Risc / limită:** Teste mobile cu adaptoare simulate și integrare pe proiect demo; nu sunt 246 fluxuri native reale.

**Următoarea acțiune:** Păstrează regresiile și adaugă probe pentru fiecare defect nou observat.

**Acceptanță:** Suitele enumerate trec, fără ignorarea testelor; domeniul și simulările sunt precizate.

**Responsabili:** agent. **Tipul pasului:** Criteriu acceptat.

**Dependențe / blocaje:** A19/A21 pentru proba native/CI; cele 7 teste rerulate nu sunt adăugate artificial la totalul 246.

### A27 · 🟡 · P1 — Regulile Firestore sunt testate și publicate

**Stadiu:** Autorizare locală verificată; E2E autentificat incomplet.

**Dovadă și nivel:** 9 teste de reguli în emulator trec; regulile sunt publicate. Patru callable-uri fără autentificare răspund 401/UNAUTHENTICATED.

**Surse:** [firestore.rules](firestore.rules); [tests/firestore.rules.test.mjs](tests/firestore.rules.test.mjs); [firebase-debug.emulator-final7.log](firebase-debug.emulator-final7.log); [firebase-debug.deploy20-smoke.log](firebase-debug.deploy20-smoke.log).

**Risc / limită:** Testele demo și refuzul anonim nu dovedesc toate permisiunile identităților runtime sau accesul conturilor reale.

**Următoarea acțiune:** Probează citire/scriere proprietar vs alt cont, ștergere/merge și IAM pe conturi de test, fără export de date reale.

**Acceptanță:** Accesul legitim funcționează, accesul între conturi și după barieră este refuzat, iar serviciile au drepturile strict necesare.

**Responsabili:** agent · Daniel · serviciu extern. **Tipul pasului:** Validare pe dispozitiv · Configurare / probă externă.

**Dependențe / blocaje:** Conturi de test și acces la mediul țintă; nu necesită oferta Premium.

### A28 · ✅ · P2 — Paginile legale actualizate sunt publicate

**Stadiu:** Conținut public comparat cu sursa.

**Dovadă și nivel:** După deploy, politica de confidențialitate și pagina de ștergere au HTTP 200 și sunt identice byte cu byte cu sursele. Identitatea legală locală trece validatorul.

**Surse:** [firebase-debug.deploy20-smoke.log](firebase-debug.deploy20-smoke.log); [firebase-debug.legal-final7.log](firebase-debug.legal-final7.log); [hosting/public/confidentialitate.html](hosting/public/confidentialitate.html); [hosting/public/stergere-date.html](hosting/public/stergere-date.html).

**Risc / limită:** Acceptarea privește publicarea textelor; conformitatea, inboxurile și termenii AI finali nu sunt certificate.

**Următoarea acțiune:** Actualizează și republică textele după alegerea furnizorului și a ofertei; verifică separat procesarea cererilor la contactele afișate.

**Acceptanță:** Textele modificate sunt accesibile public și coincid cu revizia locală; criteriul de publicare este îndeplinit.

**Responsabili:** agent. **Tipul pasului:** Criteriu acceptat.

**Dependențe / blocaje:** A01/A16 pentru conținutul final și deciziile legale.

### A29 · ✅ · P2 — APK 20: API 36 și verificări statice 16 KB

**Stadiu:** Verificat pe artefactul EAS actual.

**Dovadă și nivel:** Manifest target 36/min 24; zipalign -c -P 16 4 exit 0. Inspectate 124 biblioteci native, dintre care 62 ELF64: zero segmente LOAD cu aliniere/congruență 16 KB invalidă.

**Surse:** [firebase-debug.apk20-static-check.log](firebase-debug.apk20-static-check.log); [firebase-debug.apk20-alignment.log](firebase-debug.apk20-alignment.log); [firebase-debug.apk20-elf-check.log](firebase-debug.apk20-elf-check.log).

**Risc / limită:** Verificarea statică nu demonstrează executarea pe un dispozitiv cu pagini de 16 KB sau aprobarea Play.

**Următoarea acțiune:** Păstrează verificarea pentru AAB/APK-ul viitor și probează pornirea pe Android cu pagini de 16 KB.

**Acceptanță:** Manifest și alinieri ZIP/ELF64 acceptate pe APK 20; rularea reală este criteriu separat A19.

**Responsabili:** agent. **Tipul pasului:** Criteriu acceptat.

**Dependențe / blocaje:** Dovada se referă la SHA-256 49382c4ec7c119bb1819011f2ecd32e93dc534616031f81b08e69e72a2557a62.

### A30 · 🟡 · P2 — Minimizarea datelor este implementată; traficul nu este măsurat complet

**Stadiu:** Cod verificat; acceptarea completă rămâne deschisă.

**Dovadă și nivel:** Payloadul lecției nu include fotografia; adaptorul are store:false și diagnosticele sunt opt-in. Barierele de ștergere și retenția au probe separate.

**Surse:** [Payload lecție după validarea rezultatului](functions/src/index.ts); [functions/src/aiProvider.ts](functions/src/aiProvider.ts); [firebase.json](firebase.json); [src/services/diagnostics.ts](src/services/diagnostics.ts).

**Risc / limită:** Configurația din cod nu demonstrează singură toate datele/retentiile SDK-urilor și ale furnizorului.

**Următoarea acțiune:** Inspectează traficul APK-ului cu diagnostice off/on și inventariază datele efectiv trimise, apoi reconciliază informarea.

**Acceptanță:** Fotografia nu persistă în lecții; colectarea diagnostică respectă opțiunea, iar destinatarii și retențiile sunt documentate din probe.

**Responsabili:** agent · Daniel. **Tipul pasului:** Validare pe dispozitiv · Decizie AI / Premium.

**Dependențe / blocaje:** Dispozitiv și furnizor AI final; constatarea istorică accepta numai traseul de date din cod.


## Verdict și ordine rămasă

- **Dezvoltare:** poate continua pe APK-ul EAS 20 și backendul actualizat; verificările locale enumerate sunt trecute.
- **Testare reală:** artefactul este disponibil; acceptarea fluxurilor pe dispozitiv este încă de făcut.
- **Beta închisă pentru publicul 13+:** neacceptată încă; furnizor eligibil, scenarii reale și proces operațional necesare.
- **Producție Google Play:** neacceptată încă; buildul/deployul nu elimină deciziile de produs și verificările Play.

Ordinea următoare: implementările independente din A07/A10/A11/A12/A13/A15/A20/A22 pot avansa în paralel cu proba APK-ului 20 pe dispozitiv; apoi integrarea deciziilor Daniel despre AI/Premium, evaluarea matematică/comercială și operarea probate; în final AAB EAS `production`, testarea prin Play și publicarea. Nu există un procent de pregătire sau o probabilitate estimată de aprobare.

## Verificarea actualizării dashboardului

Registrul A01–A30 din acest raport și cel din HTML folosesc aceleași 30 de înregistrări. Verificarea a confirmat zero erori parse5, ID-uri unice și ținte locale existente. În Microsoft Edge headless au trecut **672 combinații de filtre**, filtrul rapid cu cele 8 puncte de implementare pentru agent, căutarea fără diacritice, starea fără rezultate, resetarea, deschiderea/închiderea detaliilor și navigarea prin hash la un punct ascuns de filtre. Pagina nu depășește orizontal viewporturile 320/390/768/1440 px; capturile desktop și mobile au fost inspectate. Dovadă: [jurnal verificare dashboard](firebase-debug.dashboard-current-validation.log).

În această actualizare s-au modificat documentele de stare și s-au completat probele statice ELF ale APK-ului 20. Sursele aplicației și configurația cloud nu au fost modificate; nu a fost lansat alt build sau deploy.
