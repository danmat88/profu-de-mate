# Profu' de mate — Master Roadmap

Ultima actualizare: 24 august 2026
Stare produs: **beta tehnic — nu este încă pregătit pentru publicare**

Acesta este documentul principal de lucru al aplicației. După fiecare etapă:

1. se bifează numai lucrurile implementate și verificate;
2. se adaugă dovada verificării în secțiunea „Jurnal de progres”;
3. punctele blocate rămân vizibile, nu sunt declarate finalizate prin presupunere;
4. documentele specializate din `docs/` oferă detalii, dar acest roadmap stabilește ordinea.

## Legendă

- [x] Finalizat și verificat
- [~] Implementat, dar mai necesită verificare pe build/dispozitiv real
- [ ] Neînceput sau incomplet
- ⛔ Blochează lansarea publică
- 🤖 Poate fi realizat în repository/infrastructură
- 👤 Necesită o acțiune sau o decizie a publisherului

## Decizii definitive de produs

- [x] Numele aplicației este **Profu' de mate**.
- [x] Prima lansare este numai pe Android, prin Google Play.
- [x] Publisherul inițial este persoană fizică.
- [x] Publicul declarat al produsului este 13+.
- [x] V1 nu conține reclame.
- [x] V1 folosește autentificare anonimă; Google Sign-In nu este obligatoriu.
- [x] Fotografiile nu sunt păstrate în Caiet sau Firebase Storage.
- [x] Proiectul folosește un singur Firebase de producție și emulatoare locale pentru dezvoltare.
- [x] Documentele juridice, Play Console, App Check cu Play Integrity și AAB-ul public se închid în faza finală.
- [x] Furnizorul AI actual este temporar; înainte de lansare va fi înlocuit cu unul compatibil contractual cu publicul 13+ și EEA.
- [x] Tipografia interfeței este controlată de design system și nu urmează font scale din sistem; formulele au vizualizare mărită proprie.

## Date de publisher pregătite pentru etapa finală

- [x] Tip publisher: **persoană fizică**.
- [x] Domeniu disponibil: **danielmatei.dev**.
- [x] E-mail disponibil pentru conturi tehnice/administrative: **mathosting@gmail.com**.
- [~] E-mail public recomandat pentru suport și confidențialitate: **info@danielmatei.dev**; trebuie verificată livrarea și monitorizarea lui înainte de publicare.
- [ ] 👤 Numele legal complet al operatorului, exact ca în actul de identitate.
- [ ] 👤 Adresa și celelalte date cerute la verificarea Play Console.

Recomandare: `mathosting@gmail.com` rămâne adresa contului administrativ/recovery, iar `info@danielmatei.dev` devine contactul profesional vizibil public.

## Principii de produs și interfață

### Teză vizuală

Un caiet de matematică viu, jucăuș și cald, cu personalitate cartoonish, dar cu ierarhie, lizibilitate și stabilitate de produs matur.

### Plan de conținut

1. **Acasă:** alegi clar Rezolvă sau Verifică și pornești camera/galeria.
2. **Captură:** fotografiezi sau alegi imaginea fără detururi.
3. **Confirmare:** încadrezi și confirmi exact conținutul analizat.
4. **Analiză:** vezi progresul, poți anula și poți recupera o cerere întreruptă.
5. **Lecție:** urmărești pașii fără ca acțiunile să acopere ori să deplaseze conținutul.
6. **Rezumat:** vezi concluzia și înțelegi imediat că lecția poate fi salvată în Caiet.
7. **Caiet:** găsești rapid lecțiile salvate, inclusiv după un cold start fără internet.

### Teză de interacțiune

- Tranzițiile explică schimbarea de stare; nu mută imprevizibil layout-ul.
- Intrările elementelor sunt scurte, în secvență și respectă „Reduce animations”.
- Confirmările folosesc mișcare și haptics cu măsură; conținutul matematic rămâne complet stabil.

### Reguli de acceptare UX

- [ ] Acțiunea principală este vizibilă și stabilă pe orice telefon suportat.
- [ ] Conținutul variabil poate derula deliberat; dock-ul nu îl acoperă.
- [ ] Apariția conținutului asincron nu schimbă brusc înălțimea ecranului.
- [x] Font scale 100% și 200% produc același layout al aplicației; verificat fizic, cu scalarea oprită în componenta tipografică comună.
- [x] Formulele sunt livrate direct ca SVG MathJax/Fira într-un document local; pe dispozitiv, scheletul rămâne stabil până la încărcarea fonturilor și nu apare schimbarea târzie de font.
- [ ] Fiecare stare de așteptare are explicație, anulare sau cale clară de revenire.
- [ ] Toate textele sunt română naturală, cu diacritice corecte.

---

# Faza 0 — Fundație și inventar

- [x] Repository GitHub și istoric Git curate.
- [x] Expo SDK 57 și React Native 0.86 configurate.
- [x] TypeScript trece fără erori.
- [x] Expo Doctor trece 21/21.
- [x] Package Android stabil: `ro.profudemate.app`.
- [x] Firebase de producție activ pe Blaze.
- [x] Functions, Firestore Rules și indexuri publicate.
- [x] Teste backend 40/40, logică mobilă/configurație Android/randare document/Caiet 44/44 și Rules 8/8.
- [x] Identitate vizuală, iconuri și splash implementate.
- [x] Documente specializate existente inventariate.
- [x] Master roadmap creat și adoptat drept sursă principală.

# Faza 1 — Confidențialitate locală și builduri sigure

## 1.1 Fotografii temporare

- [x] 🤖 Toate imaginile procesate sunt mutate într-un director privat administrat de aplicație; verificat fizic cu Galerie și Cameră: rămâne exact rezultatul controlat, fără copii brute `Camera`/`ImagePicker`/`ImageManipulator`.
- [x] 🤖 Versiunile intermediare de crop/rotire sunt șterse imediat: cinci rotiri consecutive au păstrat constant numai originalul sesiunii și revizia curentă, apoi anularea editorului a eliminat revizia.
- [x] 🤖 Fotografia fluxului este ștearsă la abandon, refotografiere și încheiere; săgeata aplicației și „Fă altă fotografie” sunt verificate fizic, iar fluxul principal până la rezultat a fost parcurs anterior.
- [x] 🤖 La restart se păstrează numai fotografia unei analize valide, veche de maximum 30 de minute; verificat fizic prin process-kill în Procesare, cold reopen, retry cu același `requestId`, rezultat valid și zero fișiere temporare după ieșirea din lecție.
- [~] 🤖 „Șterge toate datele” curăță imaginile, preferințele locale și dezactivează diagnosticarea; implementat, test end-to-end în așteptare.
- [x] 🤖 Test manual: Cameră/Galerie, cinci rotiri, anularea editorului și aplicarea cropului au fost verificate cu inventarul cache activ; fiecare ramură revine la zero fișiere după ieșirea din Review.

## 1.2 Backup și suprafețe suportate

- [x] 🤖 Android Auto Backup dezactivat în configurația Expo (`allowBackup=false`).
- [x] 🤖 Proiectul declară explicit Android drept platforma V1.
- [~] 🤖 Configurația și testul de regresie impun `allowBackup=false`; ultimul APK intern existent, construit înainte de hardening, are încă `true`, deci manifestul trebuie reverificat pe următorul artefact release.
- [~] 🤖 `SYSTEM_ALERT_WINDOW` este blocată explicit și protejată prin test; ultimul APK intern vechi încă o conține, iar eliminarea trebuie confirmată pe următorul APK/AAB.
- [x] 🤖 Versiunea și build number sunt citite din artefactul nativ, nu hardcodate în Setări/feedback.

## 1.3 Medii EAS/App Check

- [x] 🤖 `development`: Firebase config + App Check debug.
- [x] 🤖 `preview`: Firebase config + un debug token dedicat testării.
- [x] 🤖 `production-apk`: folosește mediul preview; nu mai consumă secrete din production.
- [~] 🤖 `production`: conține numai Firebase config și selectează Play Integrity; configurarea Play rămâne pentru Faza 7.
- [x] 🤖 Debug tokenul a fost eliminat din mediul EAS production; tokenurile buildurilor release interne vechi au fost revocate.
- [x] 🤖 `.env.example` documentează numai numele variabilelor, fără valori secrete.

**Gate Faza 1:** nicio fotografie temporară nu supraviețuiește fluxului normal, iar niciun secret/debug token nu ajunge în configurația unui build public.

# Faza 2 — Motor matematic și calitatea răspunsului

## 2.1 Randare

- [x] Schema separă proza de matematică.
- [x] LaTeX și SVG sunt validate pe backend.
- [x] MathJax/Fira produce formule stabile și accesibile.
- [x] Corpusul automat curent de formule trece.
- [x] 🤖 Lecția, explicația alternativă, enunțul și rezumatul folosesc un singur document HTML local pentru proză, formule și vizualuri, fără runtime matematic ori resurse de rețea pe telefon; fluxul a fost verificat fizic pe Xiaomi 25078RA3EE.
- [x] 🤖 SVG-urile randate sunt sanitizate și au ID-uri izolate per apariție, astfel încât formulele repetate nu se suprascriu în același document.
- [~] 🤖 Baseline-uri deterministe la 390 px există pentru matematică inline/display, sistem, matrice, formulă excepțional de lată, geometrie, grafic, tabel și axă numerică; comparația automată și ecranele rămase sunt deschise.
- [~] 🤖 Formulele uzuale lungi se micșorează proporțional ca să rămână întregi și au fost verificate fizic; numai expresiile excepțional de late folosesc scroll orizontal și indiciu, caz care mai cere un golden screenshot dedicat.
- [x] 🤖 Limită preventivă de 840 KB pentru analiza randată, cu marjă sub plafonul Firestore de 1 MiB și test automat.

## 2.2 Tipuri complete de conținut

- [~] 🤖 Bloc structurat pentru diagramă geometrică implementat și validat automat; verificarea vizuală pe dispozitiv rămâne deschisă.
- [~] 🤖 Bloc structurat pentru grafic de funcție implementat și validat automat; verificarea vizuală pe dispozitiv rămâne deschisă.
- [~] 🤖 Bloc structurat pentru tabel/statistică, inclusiv celule MathJax, implementat și validat automat; verificarea vizuală rămâne deschisă.
- [~] 🤖 Bloc structurat pentru axă numerică implementat și validat automat; verificarea vizuală rămâne deschisă.
- [~] 🤖 Sisteme, matrici și alinieri multi-rând trec corpusul MathJax; verificarea vizuală pe dispozitiv rămâne deschisă.
- [x] V1 analizează intenționat o singură problemă sau rezolvare completă într-o fotografie; cazurile tăiate sunt refuzate drept neclare, iar suportul multi-pagină rămâne o extensie viitoare, nu un flux ambiguu în V1.
- [x] 🤖 Limita rigidă de pași a fost înlocuită cu maximum 9 pași adaptați complexității; fiecare pas backend rămâne o unitate semantică și derulează natural, fără fragmentare artificială după înălțime.

## 2.3 Acuratețe

- [ ] 👤🤖 Construim un corpus anonim de minimum 200 de fotografii reale.
- [ ] 🤖 Etichetăm OCR-ul, rezultatul, fiecare pas, verdictul și randarea.
- [ ] 🤖 Adăugăm verificare deterministă/CAS acolo unde este realist.
- [ ] 🤖 Definim taxonomia erorilor și pragurile de release.
- [ ] 🤖 Prag propus: minimum 95% extracție pe imagini clare și 90% rezultat/verdict pe domeniul declarat.
- [ ] 🤖 Cazurile incerte sunt refuzate clar, nu ghicite.

**Gate Faza 2:** matematica acceptată de backend este randată fără defecte, iar acuratețea este măsurată pe date reale, nu presupusă.

# Faza 3 — Flow, responsivitate și accesibilitate

## 3.1 Flux principal

- [x] Camera și galeria pornesc direct din Acasă.
- [x] Galeria din cameră nu schimbă intenționat înălțimea layout-ului.
- [x] Există crop și rotire.
- [x] Lecția și rezumatul au acțiuni în dock stabil.
- [x] Există coach pentru salvarea în Caiet.
- [x] 🤖 Enunțul are un panel stabil cu comutator explicit între transcrierea matematică și fotografia originală; titlul unic, formulele inline și gruparea cerințelor `a)`, `b)`, `c)` au fost verificate fizic.
- [~] 🤖 Procesarea are buton clar de oprire și revenire acasă; requestul server deja trimis poate termina în fundal, iar testul fizic este în așteptare.
- [x] 🤖 Client timeout este 135 s, peste timeoutul server de 120 s.
- [x] 🤖 Cererea în curs este memorată local cu același `requestId` și reluată după restart; process-kill, cold reopen, retry idempotent și cleanup final au fost verificate fizic pe Xiaomi 25078RA3EE.
- [ ] 🤖 Navigația Back este testată în fiecare stare, inclusiv predictive back.
- [ ] 🤖 Poziția de citire este păstrată când apar secțiuni suplimentare.

## 3.2 Responsivitate

- [x] 🤖 Test 360×640 dp prin override controlat pe telefonul fizic: Home și Cameră fără clipping al acțiunilor principale.
- [x] 🤖 Test 360×800 dp pe rezoluția nativă a telefonului fizic: fluxurile P0 auditate vizual.
- [ ] 🤖 Test 412×915 dp.
- [ ] 🤖 Test tabletă/foldable minimum 600 dp, portrait și landscape.
- [ ] 🤖 Test notch/cutout, gesture nav și navigație cu trei butoane.
- [ ] 🤖 Layout adaptiv pentru Android 16, unde blocarea portrait este ignorată pe ecrane mari.

## 3.3 Accesibilitate

- [~] Roluri și etichete TalkBack implementate în majoritatea fluxurilor.
- [~] „Reduce animations” este respectat de animațiile principale.
- [x] 🤖 Design system-ul folosește `Text`/`TextInput` comune cu font scale dezactivat; testul fizic la 100% și 200% confirmă layout identic, iar testul automat interzice importurile native accidentale.
- [ ] 🤖 Test complet TalkBack: focus, ordine, modale, crop și formule.
- [~] 🤖 Acțiunile vizibile sub 48 dp au fost mărite sau au primit hit slop; auditul fizic de contrast și target-uri rămâne deschis.
- [~] 🤖 Textele funcționale critice au minimum 12 px, acțiunile din Rezumat se extind la text mare, iar modalele de ștergere pot derula; testul fizic de clipping la 200% rămâne deschis.

## 3.4 Offline și performanță percepută

- [x] 🤖 Caietul folosește persistența offline nativă Firestore, plus cache-ul stabil din sesiunea curentă; nu duplicăm documentele/SVG-urile într-o bază paralelă.
- [~] 🤖 Cold start offline trebuie confirmat pe dispozitiv după ce același query a fost sincronizat online cel puțin o dată.
- [x] 🤖 Query Firestore server-side numai pentru `isFavorite == true`, folosind indexul compus existent.
- [x] 🤖 Cardurile Caietului nu mai montează formule sau WebView-uri: lista este o bibliotecă stabilă de lecții cu titlu specific, topic, mod, dată, pași/cerințe și acțiuni directe. Cold reload-ul și lista cu matrice, algebră și geometrie au fost verificate fizic fără flash, dubluri ori rânduri tăiate.
- [ ] 🤖 Măsurăm timpul de pornire, FPS-ul tranzițiilor și rerandările listei.

**Gate Faza 3:** fluxurile P0 funcționează fără shift, clipping sau blocare pe matricea de dispozitive și setări de accesibilitate.

# Faza 4 — Fiabilitate, testare și operațiuni

## 4.1 Automatizare

- [x] Typecheck + Expo Doctor.
- [x] Teste Functions.
- [x] Teste Firestore Rules.
- [x] Teste pentru schema/randarea matematică backend.
- [~] 🤖 Suita pentru logica mobilă pură, configurația Android, erori, diagnosticare sigură, tipografie, lifecycle, calitatea textelor, documentul matematic și Caiet trece 44/44; serviciile native mai necesită teste pe artefacte/dispozitive.
- [ ] 🤖 Teste de componente pentru ecranele P0.
- [ ] 🤖 Teste E2E Android pentru toate fluxurile principale.
- [ ] 🤖 Teste de regresie vizuală.
- [~] 🤖 GitHub Actions rulează typecheck/Expo Doctor, Functions, Rules, audit critic și raportează separat legal readiness; workflow-ul trebuie confirmat de prima rulare GitHub.
- [x] 🤖 Dependabot configurat lunar pentru aplicație, Functions și GitHub Actions; update-urile majore sunt excluse din actualizările automate npm.

## 4.2 Erori și reziliență

- [x] Error Boundary global în română.
- [x] Mesaje separate pentru offline, timeout, App Check, limită și imagine invalidă.
- [~] 🤖 Apăsările duble sunt blocate în captură, crop, confirmare, paginarea lecției, salvare, feedback și ștergerea datelor; testele fizice pentru mod avion, rețea lentă, timeout și retry rămân deschise.
- [x] 🤖 Failure quota: cererile eșuate restituie cota zilnică rezervată; fereastra anti-abuz continuă corect să numere încercările.
- [x] 🤖 Circuit breaker, maintenance mode privat, `store:false` și garda Firestore de 840 KB sunt publicate și verificate live.
- [~] 🤖 Recuperarea cererilor idempotente după restart este implementată cu marker local expirat după 30 de minute; testul fizic rămâne deschis.

## 4.3 Cost, observabilitate și suport

- [ ] 👤 Alegem pragurile lunare de buget și adresa de alertare.
- [ ] 🤖 Configurăm Cloud Billing budgets și alerte.
- [x] 🤖 Plafon agregat de 300 de analize/zi este publicat, configurabil privat între 1 și 1000; ajustarea după buget rămâne o decizie operațională separată.
- [ ] 🤖 Alertăm la 5xx, P95 latency, cleanup failure, quota și cost anormal.
- [ ] 🤖 Dashboard agregat fără analytics invaziv pentru minori.
- [~] 🤖 Triggerul raportărilor este publicat și verificat end-to-end: adaugă status, severitate și expirare la 180 de zile; alerta pentru severitate mare rămâne deschisă.
- [~] 🤖 Erorile recuperabile și Error Boundary ajung în Crashlytics numai după opt-in, cu descriptor și stack sanitizate; verificarea pe build release rămâne deschisă.
- [x] 🤖 Runbook de incident, rotație secrete și rollback creat în `docs/release/INCIDENT_RUNBOOK.md`; pragurile de alertare rămân în punctele separate.

**Gate Faza 4:** fiecare regresie critică este detectabilă automat sau printr-o procedură reproductibilă înainte de release.

# Faza 5 — Arhitectura furnizorului AI final

Această fază este intenționat după finalizarea produsului, dar înainte de legal și Play.

- [ ] ⛔ 🤖 Introducem interfața neutră `AIProvider` pe backend.
- [ ] ⛔ 👤 Alegem un furnizor compatibil contractual cu utilizatori 13+ și EEA.
- [ ] ⛔ 🤖 Cheia rămâne exclusiv în Secret Manager.
- [~] ⛔ 🤖 Integrarea temporară Gemini folosește explicit `store:false`; politica furnizorului final trebuie verificată separat.
- [ ] ⛔ 🤖 Rulăm același benchmark de 200 de cazuri pe furnizorul candidat.
- [ ] ⛔ 🤖 Comparăm acuratețe, P95, cost, retenție, DPA și data residency.
- [ ] ⛔ 🤖 Migrăm, publicăm Functions și eliminăm Gemini din runtime/documente.

**Gate Faza 5:** furnizorul final trece benchmarkul și termenii lui permit explicit produsul, publicul și regiunea.

# Faza 6 — Legal și politici publice

- [ ] ⛔ 👤 Nume legal complet și date de operator.
- [ ] ⛔ 👤 Confirmarea funcționării `info@danielmatei.dev`.
- [ ] ⛔ 🤖 Politică de confidențialitate finală.
- [ ] ⛔ 🤖 Termeni de utilizare finali.
- [ ] ⛔ 🤖 Pagină publică pentru solicitarea ștergerii datelor.
- [ ] ⛔ 🤖 Temei legal, procesatori, transferuri, retenție și drepturi documentate.
- [ ] ⛔ 👤 Review juridic pentru utilizatori 13–15 ani și GDPR.
- [ ] ⛔ 🤖 Publicare pe `danielmatei.dev` sau Firebase Hosting, cu URL-uri stabile.
- [ ] ⛔ 🤖 `npm run legal:check` trece.
- [ ] ⛔ 🤖 Procedură DSAR/ștergere și incident de securitate.

**Gate Faza 6:** textele din aplicație, documentele publice și comportamentul tehnic descriu exact același flux de date.

# Faza 7 — Play Console, App Check și distribuție

- [ ] ⛔ 👤 Cont personal Google Play Console și verificarea identității/dispozitivului.
- [ ] ⛔ 👤 Aplicație creată cu package-ul `ro.profudemate.app`.
- [ ] ⛔ 👤 Play App Signing activat.
- [ ] ⛔ 🤖 SHA-1/SHA-256 Play App Signing adăugate în Firebase.
- [ ] ⛔ 🤖 Play Integrity legat de proiectul Firebase.
- [ ] ⛔ 🤖 App Check înregistrat, monitorizat și apoi impus.
- [ ] ⛔ 🤖 Production AAB construit cu EAS CLI compatibil.
- [ ] ⛔ 🤖 AAB auditat: permisiuni, SDK-uri, trackere, secrete, dimensiune și 16 KB.
- [ ] ⛔ 🤖 Store listing, feature graphic și screenshoturi release.
- [ ] ⛔ 🤖 Data Safety, content rating, target audience și AI disclosure.
- [ ] ⛔ 👤 Minimum 12 testeri înscriși continuu 14 zile, dacă se aplică noului cont personal.
- [ ] ⛔ 🤖 Pre-launch report fără P0/P1.
- [ ] ⛔ 🤖 Internal → closed → staged rollout, cu rollback pregătit.

**Gate final:** toate punctele marcate ⛔ sunt închise și dovezile sunt adăugate mai jos.

---

# Jurnal de progres și dovezi

## 24 august 2026 — Audit inițial

- `npm run check`: trecut; TypeScript și Expo Doctor 21/21.
- `npm run functions:test`: trecut; 27/27 după protecțiile de mărime, circuit breaker, refund idempotent, plafon agregat fără identificatori, trierea feedbackului și contractul vizualurilor matematice structurate.
- `npm run test:rules`: trecut; 8/8, inclusiv interdicția colecțiilor operaționale interne.
- APK intern verificat: target SDK 36, semnătură validă, compatibilitate 16 KB.
- Firebase live verificat: Functions active, Rules/indexuri publicate, Hosting încă nepublicat.
- Riscuri confirmate: imagini temporare fără lifecycle explicit, `allowBackup=true`, medii EAS amestecate, Play Integrity neconfigurat și furnizor AI temporar incompatibil cu publicul 13+.

## 24 august 2026 — Faza 1, implementare inițială

- Creat `src/services/temporaryImages.ts`; numai copiile produse de aplicație sunt administrate și șterse, niciodată originalul din Galerie.
- Crop/rotire curăță reviziile înlocuite; abandonarea rutei curăță fotografia după tranziție; cold start curăță resturile unui crash.
- „Șterge toate datele” curăță fotografiile/preferințele locale și oprește Crashlytics pentru identitatea nouă.
- Expo config verificat: `platforms=[android]`, `android.allowBackup=false`, target SDK 36.
- EAS CLI actualizat la 22.2.0.
- Mediul EAS preview are propriul Firebase config și propriul App Check debug token.
- Mediul EAS production nu mai conține debug token; cele două tokenuri ale APK-urilor release interne vechi au fost revocate.
- Verificări: `npm run check` trecut, Expo Doctor 21/21; testul fizic rămâne deschis deoarece niciun telefon nu era conectat prin ADB.

## 24 august 2026 — Analiză și retenție provider

- Ecranul de procesare permite oprirea și revenirea acasă fără ca utilizatorul să rămână blocat până la timeout.
- După 20 s apare o explicație stabilă pentru analiza lentă, fără adăugarea/înlăturarea unei secțiuni care să mute layout-ul.
- Timeout client mărit la 135 s față de limita serverului de 120 s.
- Cererile Gemini Interactions sunt stateless prin `store:false`; schimbarea a fost publicată în deploy-ul Functions verificat ulterior în aceeași zi.
- Verificări după schimbare: TypeScript trecut, build Functions trecut.

## 24 august 2026 — Gărzi backend pentru cost și stocare

- Analizele eșuate după rezervare restituie cota zilnică; fereastra de un minut păstrează încercarea pentru a împiedica ocolirea protecției anti-abuz.
- Analiza randată este respinsă peste 840 KB, păstrând marjă pentru metadatele Firestore sub limita de 1 MiB per document.
- Verificare inițială: `npm run functions:test` trecut, 11/11.

## 24 august 2026 — Caiet și offline

- Query-ul Caietului cere din Firestore numai lecțiile favorite și le ordonează server-side după `createdAt`.
- Indexul compus necesar era deja publicat și verificat.
- Persistența nativă Firestore rămâne sursa offline; cache-ul JavaScript evită skeleton/flashing în aceeași sesiune.
- Testul cold-start offline rămâne în matricea fizică și nu este declarat trecut fără dispozitiv.

## 24 august 2026 — CI și recuperarea unei analize întrerupte

- Adăugat workflow GitHub Actions fără secrete: aplicație, Expo Doctor, Functions, Firestore Rules și audit care blochează numai vulnerabilitățile runtime critice.
- Verificarea legală rulează informativ în dezvoltare; gate-ul de release rămâne blocant în Fazele 6–7.
- Dependabot este limitat la actualizări npm non-major și grupează familia Expo/React pentru review compatibil cu SDK-ul.
- O singură analiză activă poate supraviețui maximum 30 de minute unui process-kill; la redeschidere folosește același `requestId`, deci backendul răspunde idempotent.
- La terminarea lecției, stiva este normalizată la `Home → Summary`; Back nu mai poate reveni la un ecran Review cu fotografia deja ștearsă.
- Verificări locale: TypeScript trecut; Firestore Rules 8/8. Testul fizic de restart a fost închis ulterior în aceeași zi; prima rulare a workflow-ului pe GitHub rămâne deschisă până la următorul push cerut de publisher.

## 24 august 2026 — Reziliența furnizorului AI

- Comutatorul privat `_runtimeConfig/ai.enabled=false` poate opri analizele în maximum 15 secunde, fără update al aplicației; clienții nu au acces la document.
- După patru erori consecutive pe o instanță, circuit breaker-ul oprește temporar apelurile și permite o probă după 60 de secunde.
- Mesajul din aplicație diferențiază pauza tehnică de o eroare generică de conexiune.
- Verificare la momentul implementării: build Functions și teste backend 16/16; refund-ul este testat inclusiv împotriva dublei restituiri. Numărul curent al suitei este 27/27.

## 24 august 2026 — Baza testelor mobile

- Adăugat `npm run test:mobile` fără framework suplimentar, folosind test runner-ul Node 22 și type stripping.
- Sunt acoperite fraza TalkBack pentru conținut mixt, identificarea și căutarea lecțiilor din Caiet, lipsa rendererelor matematice grele în listă, scoaterea directă din Caiet și respingerea lecțiilor fără pași.
- Verificare la momentul implementării: teste mobile 4/4; suita curentă a crescut la 44/44 și workflow-ul CI o rulează înainte de testele Firestore Rules.

## 24 august 2026 — Remedierea auditului Metro

- Metro, `metro-config` și `metro-transform-worker` sunt fixate la patch-ul 0.84.5, compatibil cu intervalul React Native 0.86 și deja folosit de Expo SDK 57.
- Dependența vulnerabilă `image-size` a dispărut din arbore; auditul runtime a trecut de la 4 high la 0 high/critical.
- CI blochează de acum orice advisory runtime high sau critical, atât în aplicație, cât și în Functions.
- Cele 17 constatări runtime moderate rămase sunt documentate ca risc de tooling/tranzitiv și nu sunt „reparate” prin downgrade-urile majore propuse de npm.
- Verificare după override: TypeScript trecut, Expo Doctor 21/21 și testele mobile disponibile la acel moment 4/4; suita curentă este 20/20.

## 24 august 2026 — Accesibilitate tactilă și experimentul de text mare

- Acțiunile din Rezumat, Lecție, Confirmare, Procesare, Crop, Caiet și Setări au minimum 48 dp ori o zonă de atingere echivalentă.
- A fost implementat și auditat un layout alternativ pentru font scale mare; testul fizic a arătat că afectează excesiv identitatea vizuală.
- Decizia a fost înlocuită ulterior, verificabil, cu tipografie fixă la nivelul design system-ului; zonele tactile și semantica TalkBack rămân păstrate.

## 24 august 2026 — Formule, overflow și zoom dedicat

- Formulele nu mai urmează font scale al sistemului; dimensiunea din lecție rămâne stabilă, iar mărirea este oferită prin vizualizarea dedicată.
- Formulele care nu încap păstrează o scară lizibilă, se glisează orizontal și afișează „GLISEAZĂ FORMULA”, plus instrucțiune TalkBack.
- Verificare statică la acel moment: TypeScript trecut. Vizualizarea mărită este acum implementată; golden screenshots rămân în Faza 2.

## 24 august 2026 — Vizualuri matematice și gardă pentru limba română

- Schema 4 adaugă blocuri structurate pentru geometrie, grafice, tabele și axe numerice, păstrând citirea lecțiilor vechi cu schema 3.
- Vizualurile sunt validate pe backend; aplicația nu execută și nu afișează SVG arbitrar furnizat de model.
- Formulele din celulele tabelelor sunt randate prin același MathJax/Fira ca restul lecției.
- Graficele limitează seriile și punctele, geometria verifică referințele dintre puncte, iar tabelele și intervalele resping dimensiunile sau domeniile incoerente.
- Formulele lungi au acum vizualizare mărită, scroll și instrucțiuni TalkBack.
- Testele mobile verifică automat UTF-8, diacriticele uzuale și etichetele UI rămase accidental în engleză.
- Verificări curente: TypeScript trecut, backend 27/27 și logică mobilă/configurație Android/text 20/20.

## 24 august 2026 — Plafon agregat de cost

- Pe lângă limita de 30 de analize/zi/instalare și 4/minut, backendul rezervă atomic și dintr-un plafon global zilnic.
- Valoarea implicită este 300/zi și poate fi schimbată privat prin `_runtimeConfig/ai.maxDailyRequests`, între 1 și 1000, fără update al aplicației.
- Eșecurile restituie idempotent atât cota instalării, cât și cota globală; încercările rapide rămân în fereastra anti-abuz.
- Documentul global păstrează numai totalul agregat, fără UID-uri ori `requestId`-uri; deduplicarea este făcută de rezervarea per instalare, care intră în ștergerea completă a datelor.
- Această gardă reduce expunerea înainte de Play Integrity; nu înlocuiește bugetele și alertele Cloud Billing care cer pragul lunar ales de publisher.

## 24 august 2026 — Triage și retenția raportărilor

- Triggerul `initializeFeedbackTriage` adaugă server-side `status`, `severity`, `updatedAt` și expirare la 180 de zile; clientul nu poate falsifica aceste câmpuri.
- Categoria `unsafe` este prioritate mare, `wrong_answer` medie, iar celelalte categorii prioritate mică.
- Curățarea zilnică include raportările expirate, iar procedura de lucru este în `docs/release/FEEDBACK_TRIAGE.md`.
- Testele Rules confirmă că aplicația nu poate crea o raportare deja marcată drept rezolvată. Triggerul a fost publicat și verificat live; alerta automată pentru prioritate mare rămâne deschisă.

## 24 august 2026 — Build fizic, infrastructură live și tipografie stabilă

- Development build EAS `ba006953-bb71-4398-a0e5-093a1002f80f`, fingerprint `ab7b8fd6caadee4c0fb17e57224cfa1e7fea779d`, a fost instalat cu succes pe Xiaomi 25078RA3EE, Android 15.
- Fluxurile Home, Cameră, Galerie, Confirmare/Crop, Lecție, Rezumat, Caiet, raportare și Setări au fost auditate vizual la 360×800 dp; Home și Cameră au fost verificate și la 360×640 dp prin override controlat, apoi rezoluția a fost restaurată.
- `analyzeMathImage`, `deleteMyData`, `cleanupExpiredData` și `initializeFeedbackTriage` sunt active. O raportare reală a primit server-side `status`, `severity` și `expiresAt`, iar triggerul a răspuns HTTP 200.
- Contul runtime al triggerului are `eventarc.eventReceiver`, iar dreptul `run.invoker` este limitat la serviciul Cloud Run țintă.
- Toate textele și câmpurile aplicației trec prin `Typography.tsx` cu font scale dezactivat; matematica folosește zoomul propriu. Capturile fizice la font system 100% și 200% confirmă același layout.
- Un test de arhitectură interzice importurile directe de `Text`/`TextInput` native și folosirea font scale pentru SVG-urile matematice.
- Verificări după decizie: TypeScript trecut, Expo Doctor 21/21 și logică mobilă/text 20/20.

## 24 august 2026 — Runbook operațional

- Documentate severitățile P0–P3, kill switch-ul AI, rollback-ul Functions din Git, rotația secretului, revocarea App Check debug, incidentele de ștergere și cost anormal.
- Contactul administrativ și contactul public propus sunt separate; documentul interzice copierea fotografiilor, enunțurilor, UID-urilor și secretelor în tichete.

## 24 august 2026 — Lifecycle fizic pentru imaginile din Galerie

- Pipeline-ul șterge imediat copiile brute din cache-urile Android `ImagePicker` și `ImageManipulator`; în Review rămâne exact o copie privată administrată de aplicație.
- Săgeata proprie din Review șterge copia înainte de revenirea pe Acasă, verificat pe Xiaomi 25078RA3EE.
- Back Android poate închide activitatea înainte ca o operație programată după tranziție să ruleze; curățarea de startup nu mai este limitată la o singură execuție per proces.
- Redeschiderea `WARM` după acest abandon a eliminat copia rămasă și toate cache-urile brute; ecranul Acasă execută și o curățare de siguranță la fiecare revenire în focus.
- Camera → Review a lăsat exact o copie controlată și zero copii brute; „Fă altă fotografie” a șters-o imediat.
- Cinci rotiri succesive au păstrat un plafon constant de două fișiere (original + revizia curentă); anularea editorului a revenit la unul, iar ieșirea din Review la zero.
- Aplicarea cropului a înlocuit originalul cu exact un rezultat controlat; după abandonul din Review au rămas zero fișiere controlate și zero copii brute.

## 24 august 2026 — Recuperarea analizei și contractul providerului

- O analiză a fost întreruptă forțat în Procesare; markerul local și fotografia controlată au supraviețuit unui cold reopen și au păstrat același `requestId`.
- Tokenul App Check debug al development buildului curent a fost înregistrat numai în Firebase, fără a fi scris în cod, documentație sau Git; Play Integrity rămâne neschimbat pentru faza finală.
- Cauza erorii providerului a fost izolată prin probe diferențiale: schema Structured Outputs repeta uniuni vizuale complexe și era respinsă înainte de analizarea imaginii.
- Contractul de generare este acum compact și fără uniuni incompatibile; vizualul serializat este normalizat și trece apoi prin aceeași validare Zod strictă pentru geometrie, grafice, tabele și axe numerice.
- Proba directă cu promptul de producție a trecut schema providerului și validarea strictă. `analyzeMathImage` revizia `00017-zin` a fost publicată cu 100% trafic.
- Retry-ul fizic a produs o lecție validă cu trei pași; markerul `pending` a fost eliminat, iar după ieșirea din lecție inventarul a confirmat zero fotografii controlate, copii brute sau markere de analiză.
- Verificări: backend 27/27; lifecycle mobil 20/20; App Check valid în development.

## 24 august 2026 — Auditul manifestului release existent

- A fost descărcat și inspectat direct APK-ul `production-apk` build 6, EAS `2b5baf2f-5a32-4566-8291-8de9a2d668f9`, nu doar configurația sursă.
- Artefactul vechi confirmă `usesCleartextTraffic=false` și `extractNativeLibs=false`, dar conține `allowBackup=true` și `android.permission.SYSTEM_ALERT_WINDOW`; punctele nu au fost bifate fals.
- Configurația curentă impunea deja `allowBackup=false`; `SYSTEM_ALERT_WINDOW` este acum inclusă explicit în `blockedPermissions`.
- Un test automat verifică Android-only, backupul oprit, lista minimă de permisiuni solicitate și toate permisiunile sensibile blocate. Dovada finală rămâne manifestul următorului artefact release.

## 24 august 2026 — Document matematic unificat

- Lecția, explicația alternativă, enunțul transcris și recapitularea folosesc acum același document local pentru proză, formule MathJax/Fira și vizualuri structurate; nu există MathJax, CDN sau recalculare matematică pe telefon.
- Fonturile documentului sunt asset-uri locale și sunt încărcate complet înainte de montarea WebView-ului, eliminând schimbarea târzie de font; schimbarea pasului actualizează DOM-ul existent fără remontarea view-ului nativ.
- Formulele compacte curg în rând cu textul, derivările complexe au ritm vertical comun, iar sistemele, matricile, tabelele, geometria, graficele și axele numerice rămân în același document.
- Proza este escapata, SVG-ul este sanitizat, ID-urile MathJax sunt izolate per apariție, navigarea și rețeaua sunt blocate, iar cookie-urile/stocarea DOM sunt dezactivate.
- Panelul problemei separă clar „Enunț citit” de „Fotografia ta”; Caietul păstrează matematica completă în lecția deschisă și nu mai montează formule în lista virtualizată, eliminând clipirea și preview-urile matematice ambigue.
- Interfața de lectură a fost simplificată după QA fizic: fără ramă și umbră grea, cu titluri mai compacte, ritm editorial, dock redus și fără titluri duplicate în panouri.
- Formulele uzuale lungi se potrivesc automat pe lățime; expresiile excepțional de late păstrează scrollul dedicat. Parserul grupează cerințele răspândite între text și formule, dar nu confundă formulări precum „la punctul a)” cu un subpunct nou.
- Verificări: TypeScript trecut, Android bundle exportat, mobil 44/44, backend 40/40 și Firestore Rules 8/8. Lecția completă, scrollul, enunțul, explicația alternativă, recapitularea și deschiderea unei lecții cu matrice din Caiet au fost verificate fizic pe Xiaomi 25078RA3EE.

## 25 august 2026 — Caietul ca bibliotecă de lecții

- Lista a fost refăcută ca bibliotecă, nu ca mini-renderer matematic: titlul specific al exercițiului este informația principală, iar topicul, modul, data, pașii și numărul de cerințe formează metadatele de orientare.
- Cardurile au o singură suprafață de tip pagină, cotor colorat, umbră cartoonish controlată și înălțime stabilă. Nu există containere de formule, WebView-uri sau selecții speciale pentru anumite capitole.
- Fiecare problemă are acțiuni separate „Deschide” și „Scoate”. Scoaterea folosește `isFavorite=false`, se reflectă imediat în listă și este protejată de un sheet animat propriu cu anulare și mesaj de eroare, fără alerta nativă Android.
- Problemele verificate afișează direct verdictul „Corectă”, „Parțial corectă” sau „De corectat”, cu un ton vizual consecvent, fără logică specială pentru un anumit capitol de matematică.
- Căutarea folosește în continuare enunțul original, titlul, topicul, LaTeX și citirea accesibilă; filele afișează numărători reale și au stări goale cu acțiunea relevantă.
- Promptul backend cere acum un titlu de 3-10 cuvinte care identifică exercițiul concret, nu doar capitolul. Schimbarea este validată în suita backend 40/40 și a fost publicată controlat pe 25 august 2026 în revizia `analyzemathimage-00019-lon`, cu 100% trafic.
- QA fizic: cold reload, patru lecții (inclusiv matrice, puteri și geometrie), fila goală „Verificate”, deschiderea lecției și deschiderea/anularea sheet-ului „Scoate” au trecut pe Xiaomi 25078RA3EE. Nicio lecție nu a fost eliminată în timpul testului.

## Documente asociate

- `docs/MATH_COVERAGE_MATRIX.md` — acoperirea matematică reală, separată pe structură, randare, pedagogie și acuratețe
- `docs/PRODUCTION_CHECKLIST.md` — audit de producție detaliat
- `docs/PRODUCT_DECISIONS.md` — decizii de produs
- `docs/FIREBASE_STATUS.md` — situația infrastructurii
- `docs/SECURITY_NOTES.md` — securitate și dependențe
- `docs/release/TEST_MATRIX.md` — matrice de dispozitive și scenarii
- `docs/release/DATA_SAFETY.md` — draft tehnic Data Safety
- `docs/release/STORE_LISTING_RO.md` — draft listing în română
