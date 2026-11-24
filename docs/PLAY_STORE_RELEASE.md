# Publicare în Google Play — pași și verificări

Actualizat: **24 noiembrie 2026**. Acesta este singurul checklist de publicare. O bifă înseamnă că există o verificare concretă; codul prezent în proiect nu dovedește că serviciul este configurat sau că funcționează în producție. După modificarea candidatului, se repetă verificările afectate.

Aplicație: `ro.profudemate.app` · Expo SDK 57 · profil EAS pentru magazin: `production` → **AAB**. Buildul de dezvoltare de pe telefon nu este candidatul de publicare.

## Situația confirmată de audit

| Problemă | Ce s-a constatat | Stare |
| --- | --- | --- |
| Premium dispărea la conectare | Schimbarea identității remonta navigatorul și revenea la Home. | Corectat în cod; testat resetul cu păstrarea ecranului Premium și eliminarea datelor vechi de cont. |
| Oferta părea să lipsească | Conținutul era înlocuit de verificarea accesului sau de conectarea Google. | Oferta rămâne vizibilă înainte de conectare și în timpul actualizării contului. |
| Nu apar prețuri și nu se poate cumpăra | `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` lipsește local și din mediile EAS verificate. | **Blocaj de configurare**, nu poate fi rezolvat prin desenarea unor prețuri în interfață. |
| Billing pe backend | Configurația locală de deploy nu activează `PROFU_ENABLE_REVENUECAT`; stadiul de securitate este `pre-play-public`. | Necesită configurare și deploy coordonat. Starea cloud nu a fost certificată de preflightul local. |
| Home apărea înaintea datelor reale | Pornirea permitea acces nul și refresh ulterior; o cerere nouă pornea la montare/focus. | Home se montează după confirmarea serverului, fonturi și toate iconițele. Snapshotul verificat este reutilizat; cererile simultane sunt deduplicate pe sesiune. |
| Verificare lentă la pornire | Încărcare dinamică suplimentară pentru stocarea securizată și etape independente executate în serie. | Stocarea intră în pachetul inițial; resursele, sesiunea și identitatea instalării se pregătesc în paralel unde sunt independente. Timpii sunt măsurați separat în development. |
| Încărcări repetate | Fonturile documentelor porneau fără un rezultat sincron în cache; încălzirea Caietului se oprea după prima citire. | Fonturi pregătite la pornire, cache reutilizat și sincronizare a Caietului păstrată pe sesiune. |
| Mișcare agitată | Tranziții diferite între ecrane, salturi elastice și animații suprapuse. | Tranziții native mai coerente, mișcări scurte pentru controale și panouri, fără reapariția întregului conținut. |
| Back în panourile lecției | Pe telefon, Back închidea lecția când era deschisă explicația alternativă. | Panouri modale native; verificat că Back închide explicația/enunțul și păstrează lecția. |

**Ordinea de lucru:** finalizăm verificarea aplicației → configurăm abonamentele → configurăm producția → construim și testăm AAB-ul din Play → completăm pagina și declarațiile → publicăm gradual.

## 1. Aplicația și verificările locale — Engineering

- [x] Organizează codul pe funcționalități, păstrează datele private în afara Git și elimină rapoartele/artefactele vechi.
- [x] Deschide Home numai cu acces confirmat de server și resurse pregătite. La eroare oferă reîncercare și intrare separată în Caiet offline, fără limite demonstrative.
- [x] Reutilizează accesul verificat la montare/focus; deduplică cererile și respinge răspunsurile unei identități schimbate sau ale unei porniri deja eșuate.
- [x] Pregătește toate cele 20 de iconițe, brandingul și cele 5 fonturi UI înainte de Home; reutilizează sursele locale și fonturile documentelor.
- [x] Calculează Home din cadrul real al aplicației, cu insetul superior aplicat în același render. Bara de navigare temporară a galeriei nu schimbă breakpointul sau spațierea ecranului imersiv. Indicatorul din butonul Galerie păstrează dimensiunile iconiței. Verificat prin teste pentru modificări temporare de dimensiuni/insets, anulare, redeschidere, redimensionare reală și text mărit; comparat pozițiile elementelor în previzualizare. Reproducerea nativă pe telefon rămâne de verificat.
- [x] Montează textele splashului numai după pregătirea fonturilor; păstrează titlul în Balsamiq Sans și textul secundar lizibil în Fira Sans. Verificat automat primul render fără fonturi și previzualizat la 360×802 și 320×640 cu fișierele de font reale. Verificarea acestui aspect pe Android rămâne de repetat; telefonul nu a fost disponibil la această corecție.
- [x] Verifică generarea Android izolată, fără instalare: cele 23 de imagini și cele 5 fonturi sunt în resursele native, fără avertismente de nume. Încorporarea nativă se aplică următorului build, nu modifică APK-ul deja instalat.
- [x] Separă oferta Premium de conectare și de încărcarea accesului; afișează corect indisponibilitatea plăților, fără prețuri inventate.
- [x] Protejează prețurile și răspunsurile întârziate împotriva schimbării contului; acceptă și o ofertă cu un singur plan disponibil.
- [x] Verifică automat aplicația: **227 teste**, inclusiv pornire, erori, timeout, identități diferite, resurse, cereri duplicate, integritatea matematică a celor 19 fișe de formule, 4 ghiduri EN/BAC, 31 exerciții curatate, 4 simulări complete de 100p, 975 formule SVG MathJax (246 display + 729 inline) randate nativ Skia pe Frame 0, blocare completă a ecranului la cereri AI, adaptare reală la tastatura Android și garanții 60fps Android; TypeScript și ESLint trecute cu 0 erori și 0 avertismente.
- [x] Verifică backendul: **95 teste** trecute (inclusiv `generatePracticeExercise`, `gradeExamSolution` și `mergeStudyProgress`); reguli și tranzacții în emulatoarele Firebase: **43 teste** trecute (inclusiv `/users/{uid}/studyProgress/summary`). Total: **365 teste**.
- [x] Aliniază textele legale din aplicație ([LegalScreen.tsx](../src/features/account/screens/LegalScreen.tsx)), paginile publice (`hosting/public/`) și dialogurile din Setări pentru noile module de studiu offline, progres sincronizat, generator AI și corectare foto pe barem; verificat cu `npm run legal:check`.
- [x] Exportă JavaScript-ul Android în mod production și verifică lipsa tokenurilor App Check de debug cunoscute. Aceasta nu este verificarea semnăturii unui AAB.
- [x] Verifică local identitatea legală și preflightul de deploy. Aceste comenzi nu confirmă setările serviciilor din cloud.
- [x] Verifică afișarea și navigarea de bază pe **OPPO CPH2695, Android 16, build de dezvoltare**: Home → Premium, Setări → Premium, Caiet → lecție → rezumat, editor și Camera. Verifică Back pentru explicația alternativă, enunț și ajutorul Camerei. Nu s-au efectuat achiziții, ștergeri de date sau o analiză AI nouă în această verificare; acestea rămân în pașii următori.
- [x] Măsoară pornirea pe telefon: în două restarturi complete ale procesului, pregătirea după pornirea JavaScriptului a durat **1,87 s și 1,89 s**; verificarea accesului **1,65 s și 1,69 s**, iar resursele **0,44 s**, în paralel. Home a afișat limita confirmată de server și iconițele pregătite. Aceste valori development exclud transferul/compilarea din Metro și nu reprezintă un SLA sau măsurarea candidatului Play. O primă rulare, înaintea corecției încărcării dinamice, a durat 9,23 s; backendul și rețeaua pot influența comparația.
- [x] Publică backendul actualizat (`npm run deploy:firebase` pe `profu-de-mate-danmat88`, `stage=pre-play-public`): create `generatePracticeExercise` și `gradeExamSolution`, actualizate `completeAccountMergeWithGoogle` + funcțiile existente, `firestore.rules`, `firestore.indexes.json` și paginile publice din `hosting/public/`.
- [ ] Verifică pe dispozitive reprezentative: ecran mic, text mărit, mod de mișcare redusă, revenire din fundal, rețea lentă/offline și pornire la rece. Nu bifa întregul grup după verificarea unui singur telefon.

Comenzi uzuale, folosind dependențele deja instalate:

```powershell
npm run test:mobile
npm run functions:test
npm run test:rules
npm run legal:check
npm run release:bundle-check
node scripts/firebase/deploy-firebase.mjs --preflight-only
```

Capturile, înregistrările și logurile de diagnostic rămân în `.local/`, ignorat de Git. Bara albastră „Refreshing…” din sesiunea Expo de dezvoltare apare când se aplică modificări de cod; verificarea pentru utilizatorii finali se repetă pe buildul Play.

## 2. Activează Premium cu produse reale — Daniel + Engineering

- [ ] Confirmă dacă Premium intră în prima versiune publică. Dacă se amână, aprobă explicit cum se prezintă oferta indisponibilă; nu publica accidental o promisiune de cumpărare nefuncțională.
- [ ] Confirmă limitele gratuite/Premium, prețurile, moneda, țările și planurile oferite. Nu introducem prețuri demonstrative în aplicația livrată.
- [ ] În Play Console, creează/verifică abonamentul, planurile de bază lunare/anuale și prețurile regionale; activează planurile și distribuția lor. [Configurarea produselor](https://www.revenuecat.com/docs/getting-started/entitlements/android-products)
- [ ] Conectează aplicația Android corectă la RevenueCat și validează accesul contului de serviciu Google Play. Leagă produsele de entitlementul folosit de backend (`premiumEntitlementId`) și de oferta curentă cu pachetele disponibile. [Oferte și produse](https://www.revenuecat.com/docs/getting-started/displaying-products)
- [ ] Adaugă cheia **publică Android** RevenueCat în variabila EAS `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` pentru mediile folosite; sincronizează mediul local. Cheia secretă RevenueCat nu intră niciodată în `EXPO_PUBLIC_*` sau în Git.
- [ ] Configurează pe backend `PROFU_ENABLE_REVENUECAT=true` și secretele `REVENUECAT_SECRET_API_KEY`, `REVENUECAT_WEBHOOK_AUTH`, `REVENUECAT_WEBHOOK_SIGNING_SECRET`. Pregătește și verifică deployul funcțiilor `syncPremiumAccess`, `revenueCatWebhook` și al procesării ștergerilor externe.
- [ ] În RevenueCat, configurează URL-ul webhookului, Authorization și **semnarea HMAC**. Backendul verifică ambele; simpla creare a URL-ului nu este suficientă. Trimite un eveniment de test și verifică procesarea idempotentă. [Webhookuri](https://www.revenuecat.com/docs/integrations/webhooks)
- [ ] Configurează testerii de licență Google Play și instalează candidatul dintr-un track Play. Verifică prețurile localizate și perioada înainte de confirmarea cumpărării.
- [ ] Execută achiziție de test, anularea dialogului, plată în așteptare, confirmare întârziată, restaurare și reinstalare. Confirmă același cont Profu’ și absența achizițiilor duplicate.
- [ ] Execută reînnoire, anulare a reînnoirii, expirare, rambursare/revocare și schimbare de cont. Confirmă entitlementul în backend, limitele din aplicație și administrarea abonamentului din Google Play.

## 3. Deciziile de produs și datele legale — Daniel

- [ ] Confirmă publicul, țările, versiunile Android acceptate și vârsta minimă. Aplicația declară în prezent 13+; verifică termenii serviciului AI și publicul ales.
- [ ] Aprobă modelul AI, prelucrarea imaginilor și textului, retenția, protecțiile de conținut și bugetul. Verifică explicațiile în română și corectitudinea pe un set reprezentativ de probleme.
- [ ] Confirmă operatorul legal și adresele funcționale pentru suport, confidențialitate și plăți, în aplicație și în paginile publice.
- [ ] Testează ștergerea contului și a datelor în aplicație, plus solicitarea web, inclusiv tratarea profilului extern de billing și informarea că abonamentul Play se anulează separat. [Cerințe de ștergere](https://support.google.com/googleplay/android-developer/answer/13327111)
- [ ] Testează raportarea rezultatelor AI greșite/nepotrivite și stabilește persoana care primește și soluționează raportările. [Politica pentru conținut AI](https://support.google.com/googleplay/android-developer/answer/13985936)

## 4. Configurează producția și construiește AAB-ul — Engineering

- [ ] Alege commitul candidat și rulează verificările din README pe acea revizie. Verifică vulnerabilitățile dependențelor și licențele păstrate.
- [ ] Validează mediul EAS `production`, configurația Firebase și `playIntegrity`, fără token de debug în client.
- [ ] Pregătește trecerea coordonată a backendului la `PROFU_RELEASE_SECURITY_STAGE=play`, App Check și politica Device Recall. Verifică setările și secretele efectiv deployate; nu deduce starea cloud din fișierele locale.
- [ ] Activează/verifică Play App Signing și înregistrează amprentele **certificatului de semnare Play** în Firebase, Google authentication și Play Integrity. Păstrează separat certificatul cheii de upload și copiile de recuperare.
- [ ] Construiește un **AAB semnat** cu profilul EAS `production` și un `versionCode` nou. Înregistrează commitul, URL-ul buildului EAS, SHA-256 și certificatul de upload așteptat.
- [ ] Rulează `npm run release:artifact-check -- <candidate.aab>` cu `PROFU_RELEASE_CERT_SHA256` și `BUNDLETOOL_JAR` configurate. Verifică pachetul, semnătura, manifestul, permisiunile, lipsa debugului și a tokenurilor de debug.
- [ ] Confirmă target API în AAB: pentru aplicații Android de telefon noi și actualizări, cerința curentă este **API 36 sau mai nou**. Reverifică la încărcare. [Cerința Google Play](https://support.google.com/googleplay/android-developer/answer/11926878)
- [ ] Verifică bibliotecile native și rezultatele Play Console pentru compatibilitatea cu pagini de memorie de 16 KB; testează într-un mediu corespunzător. [Ghid Android](https://developer.android.com/guide/practices/page-sizes)
- [ ] Instalează aplicația din trackul Play și verifică startup, Play Integrity, autentificarea Google, Camera și billing cu semnătura livrată de Play.

## 5. Testează candidatul distribuit prin Play — Engineering + Daniel

- [ ] Repetă verificarea vizuală și tranzițiile pe candidatul Play, inclusiv accesul gratuit, Premium și accesul expirat. Bara de dezvoltare și instrumentele de debug nu trebuie să apară.
- [ ] Măsoară startup rece/cald și revenirea din fundal pe candidatul Play, cu rețea bună/slabă și offline. Înregistrează separat timpul până la prima imagine, până la Home interactiv și latența verificării accesului; compară mediană/p95 pe dispozitive reprezentative. Testele de timeout și numerele obținute pe development nu înlocuiesc aceste măsurători.
- [ ] Testează Camera: permisiune acceptată/refuzată, retry, galerie și anulare, crop, rotire, refotografiere și revenire din fundal.
- [ ] Testează „Scrie problema”: rezolvare/verificare, fracții, puteri, radicali, formule lungi, undo, drafturi și butonul de trimitere.
- [ ] Testează analiza foto și scrisă: succes, input neclar, eroare de provider, timeout, offline, restart și reluarea aceluiași request fără consum dublu.
- [ ] Testează lecția, formulele, explicațiile alternative, rezumatul, raportarea și salvarea/ștergerea din Caiet, inclusiv după restart.
- [ ] Testează platforma „Învață”: schimbare nivel de studiu (din Hub și Setări), formule offline + favorite în Caiet, teste rapide + coada „De repetat”, generare exerciții AI, ghidurile EN/BAC, simulări complete 100p + cronometru + Back guard și corectare foto pe barem (inclusiv rambursare cotă la poză neclară).
- [ ] Testează vizitator, conectare Google, logout, transferul Caietului și al progresului de studiu (`studyProgress/summary`), conturi diferite, epuizarea limitei și resetarea zilnică în Europe/Bucharest, inclusiv schimbarea orei.
- [ ] Testează ștergerea contului, operațiile întrerupte și recuperarea după eșec; verifică izolarea datelor între conturi.
- [ ] Rezolvă crashuri, ANR-uri, probleme de accesibilitate și raportul de pre-lansare Play. Confirmă comportamentul pe versiunile Android declarate.

## 6. Completează pagina și declarațiile în Play Console — Daniel

- [ ] Finalizează verificarea contului de dezvoltator și aplicația cu identificatorul permanent `ro.profudemate.app`.
- [ ] Pregătește numele, descrierile în română, categoria, datele de contact, iconul, grafica de prezentare și capturi din candidatul final.
- [ ] Completează ratingul de conținut, publicul, reclamele, instrucțiunile de acces pentru reviewer și toate declarațiile aplicabile din App content.
- [ ] Completează Data safety din comportamentul real al aplicației, Firebase/Crashlytics, Google sign-in, AI și billing; aliniază declarațiile cu politica de confidențialitate și retenția datelor.
- [ ] Verifică public, de pe mobil și fără autentificare, paginile de confidențialitate, termeni, suport și ștergere a contului.
- [ ] Verifică cerința aplicabilă contului tău: pentru conturi personale create după 13 noiembrie 2023 sunt necesari minimum **12 testeri înscriși continuu timp de 14 zile** într-un test închis, apoi cerere de acces la producție. [Cerințe de testare](https://support.google.com/googleplay/android-developer/answer/14151465)

## 7. Publică și urmărește lansarea — Daniel + Engineering

- [ ] Confirmă revizia backendului deployat, regulile, indexurile, retenția, curățarea programată și procesarea ștergerilor.
- [ ] Configurează alerte pentru crashuri, autentificare, erori AI/billing și costuri; numește responsabilul pentru suport, raportări și operații eșuate.
- [ ] Verifică oprirea temporară AI (`_runtimeConfig/ai.enabled`), limitele de consum, recuperarea requesturilor și procedura de rollback compatibilă cu datele existente.
- [ ] Stabilește retenția backupurilor și verifică restaurarea într-un mediu izolat, compatibilă cu obligațiile de ștergere a datelor.
- [ ] Finalizează testarea internă și testul închis cerut, rezolvă feedbackul și obține accesul la producție dacă se aplică.
- [ ] Completează notele versiunii, distribuția, accesul reviewerului și avertismentele rămase pentru AAB-ul exact încărcat.
- [ ] Trimite la review și lansează gradual. Urmărește crashurile, analizele eșuate, autentificarea, achizițiile, limitele, costurile și suportul înainte de extinderea distribuției.

## Dovezile candidatului de publicare

De completat când există candidatul Play, fără secrete:

| Element | Valoare |
| --- | --- |
| Commit candidat | De completat |
| Versiune / versionCode | De completat |
| Build EAS / AAB SHA-256 | De completat |
| Track Play / URL pentru testeri | De completat |
| Rezultat testare billing și webhook | De completat |
| Rezultat QA pe candidatul Play | De completat |
| Responsabil / data aprobării lansării | De completat |
