# Profu’ de mate — registru de producție

Ultima actualizare: 25 august 2026

> Ordinea și starea principală sunt menținute în `docs/MASTER_ROADMAP.md`; acest document rămâne registrul tehnic detaliat.

Legendă: `[x]` finalizat și verificat, `[~]` implementat dar mai cere verificare de lansare, `[ ]` nefăcut sau blocat de o informație/acțiune externă.

## Starea reală, pe scurt

- [x] Aplicația Android este funcțională pe telefonul fizic Xiaomi 25078RA3EE, Android 15, 720 × 1600 px.
- [x] Fluxul fotografie/galerie → crop → analiză → lecție → recapitulare → Caiet funcționează cu backendul real.
- [x] Firebase de producție `profu-de-mate-danmat88` este activ pe Blaze; funcțiile, regulile și indexurile sunt publicate.
- [x] Matematica este structurată separat de text, iar formulele sunt randate prin SVG pregătit de MathJax pe backend.
- [~] Geometria, graficele, tabelele și axele numerice au blocuri structurate validate; testul vizual pe build/dispozitiv este încă necesar.
- [x] Există ștergere completă în aplicație, raportare a răspunsurilor și diagnosticare opțională implicit oprită.
- [ ] Nu există încă un cont Google Play Console, o politică publicată, un AAB de producție sau testarea închisă obligatorie.
- [ ] Pentru documentele publice lipsesc numele legal complet al operatorului și e-mailul public de contact.

## 1. Produs și interfață

- [x] Interfață originală în română, fonturi cu diacritice corecte, iconuri proprii și identitate vizuală cartoonish coerentă.
- [x] Navigație scurtă, fără tab bar inutil: Acasă, Cameră, Confirmare, Analiză, Lecție, Rezumat și Caiet.
- [~] Layout adaptiv pentru ecrane înguste/scurte și dock-uri separate de conținut; 360×640 și 360×800 dp sunt verificate, iar telefoanele fizice mari/tabletele rămân în matrice.
- [x] Caiet ca bibliotecă stabilă, cu cache, filtrare, căutare, titluri specifice și acțiuni directe; lista nu mai montează formule sau WebView-uri.
- [x] Splash, icon adaptiv, icon monocrom, logo și mascotă finale în `assets/brand`.
- [x] Preferința Android „Reduce animations” este respectată de navigație și animațiile principale.
- [x] Există fallback global, în română, pentru erorile de randare; utilizatorul nu mai rămâne pe un ecran alb.
- [~] Semantica de bază TalkBack, rolurile, stările și ferestrele modale sunt implementate; testul manual complet cu TalkBack este încă necesar.
- [~] Tipografia fixă a design system-ului este verificată fizic cu setarea sistemului la 100% și 200%; mai sunt necesare telefoane fizice mici și mari, nu alte layouturi bazate pe font scale.

## 2. Captură și flux AI

- [x] Cameră reală, flash, galerie, permisiune modernă, stare „deschide setările”, cameră indisponibilă și retry.
- [x] Rotire, crop manual și comprimare locală înainte de upload.
- [x] Imaginile procesate au lifecycle privat și cleanup explicit; Galerie/Camera → Review lasă numai copia controlată, ieșirea/refotografierea o șterge, cinci rotiri nu acumulează revizii, cropul înlocuiește corect originalul, Back Android + redeschidere `WARM` curăță restul, iar process-kill în Procesare păstrează numai analiza validă și ajunge la zero fișiere după rezultat/ieșire.
- [x] Aplicația cere numai permisiunea Camera; microfonul, locația, notificările, Advertising ID și accesul general la poze sunt blocate explicit.
- [~] Configurația curentă blochează explicit `SYSTEM_ALERT_WINDOW` și impune `allowBackup=false`; APK-ul intern build 6, anterior hardeningului, nu reflectă încă aceste două setări, deci următorul artefact release trebuie reaudiat.
- [x] Fotografia nu este salvată în Firebase Storage sau în Caiet.
- [x] Cererile sunt autentificate anonim, protejate prin App Check și trimise unei funcții callable din `europe-west1`.
- [x] Retry-ul reutilizează același `requestId`; backendul previne taxarea și salvarea dublă.
- [x] Analiza activă este reluată cu același `requestId` după restart timp de maximum 30 de minute; process-kill, cold reopen, retry și cleanup au fost verificate fizic.
- [x] Mesaje distincte pentru offline, timeout, App Check, limită, imagine invalidă și eroare temporară de server.
- [x] Răspunsurile AI sunt etichetate vizibil cu „AI” și pot fi raportate din Lecție și Rezumat.
- [ ] Test manual cu mod avion, rețea foarte lentă, timeout de 120 secunde și reluare după revenirea conexiunii.

## 3. Matematică

- [x] Schema separă proza de LaTeX și refuză notația matematică brută ascunsă în text.
- [x] Backendul validează JSON-ul, LaTeX-ul și dimensiunile SVG înainte să trimită lecția în aplicație.
- [x] Corpus automat de randare pentru 41 de familii/expresii din aritmetică, algebră, analiză, geometrie, trigonometrie, probabilități, matrici, vectori, logică, ecuații diferențiale și matematică financiară.
- [x] Formulele inline folosesc același ritm tipografic cu textul; formulele complexe sunt SVG stabile, fără schimbare ulterioară de font.
- [x] Moduri separate „Rezolvă” și „Verifică”, cu verdict `correct`, `partially_correct` sau `incorrect`.
- [ ] Benchmark de acuratețe pe minimum 200 de fotografii reale, împărțite pe clase, domenii, scris de mână, tipar și calitatea pozei.
- [ ] Verificator matematic independent pentru cazurile unde se poate valida determinist rezultatul; în prezent validarea este structurală, iar raționamentul rămâne generat de model.
- [ ] Politică de calitate: prag de acceptare, taxonomie de erori, review uman pentru rapoarte și regresii înaintea fiecărui release.

## 4. Firebase și securitate

- [x] Firestore Standard în `eur3`, delete protection activ, PITR oprit.
- [x] Anonymous Auth activ și obligatoriu pentru datele utilizatorului.
- [x] App Check activ în development prin debug provider și impus de funcțiile callable.
- [x] Secretul Gemini este în Secret Manager; cheia nu este în aplicație sau Git.
- [x] `analyzeMathImage`: Node 22, 512 MiB, timeout 120 s, `maxInstances: 3`, concurrency 10.
- [x] Limită de cost publicată: 30 analize/zi/instalare, maximum 4 într-un minut și plafon agregat implicit de 300/zi; duplicatele nu consumă din nou cota, iar eșecurile restituie cotele zilnice.
- [x] Kill switch privat, circuit breaker, `store:false` și gardă de 840 KB sunt implementate, testate și publicate.
- [x] `deleteMyData` șterge lecții, feedback, contoare, cache-ul cererilor și utilizatorul anonim.
- [x] `cleanupExpiredData` rulează zilnic la 03:15 Europe/Bucharest.
- [x] Jobul Scheduler, OIDC și indexul collection-group pentru retenție au fost testate live cu HTTP 200.
- [x] Retenție: 7 zile pentru lecții nesalvate/cache, 35 zile pentru contoare și aproximativ 13 luni de inactivitate pentru Caiet.
- [x] Firestore și Storage sunt deny-by-default; clientul nu poate crea sau modifica răspunsul matematic.
- [x] Audit al logurilor: fără fotografie/Base64/enunț; loggerul propriu păstrează numai statusuri și descriptori de eroare fără mesaj.
- [x] 8 teste de reguli, 40 teste backend și 44 teste de logică mobilă/configurație Android/lifecycle/text/Caiet trec local; Expo Doctor trece 21/21.
- [ ] După primul upload în Play: adăugarea SHA-1/SHA-256 ale certificatului Play App Signing în Firebase.
- [ ] După certificatul Play: înregistrarea aplicației în Play Integrity și verificarea App Check pe build release.
- [ ] Buget Google Cloud și alerte de cost configurate la praguri explicite.
- [~] Runtime-urile sunt separate și least-privilege, contul Compute nu mai are `Editor`, iar secretul este limitat la runtime-ul AI; mai trebuie review IAM Recommender pentru rolurile implicite Google APIs/App Engine.
- [ ] Alertare operațională pentru erori 5xx, latență, invocări, cost și raportări `unsafe`.
- [~] Triage server-side și expirare la 180 de zile sunt publicate și verificate end-to-end printr-o raportare reală; alerta automată pentru severitate mare rămâne de configurat.

## 5. Date, minori și legal

- [x] Public țintă declarat: 13+, fără reclame și fără autentificare vizibilă în v1.
- [x] Ecran în aplicație pentru confidențialitate, retenție, utilizarea AI și termeni simpli.
- [x] Diagnosticarea Crashlytics este implicit oprită și controlată de utilizator.
- [x] Ștergerea datelor este disponibilă în aplicație, cu confirmare clară și stare de eroare.
- [x] Draftul Data Safety este în `docs/release/DATA_SAFETY.md`.
- [ ] Numele legal complet al operatorului persoană fizică.
- [ ] E-mail public de suport/confidențialitate.
- [ ] Politică de confidențialitate și termeni găzduiți pe un URL public, activ și nemodificabil fără versionare.
- [ ] Revizuire juridică pentru GDPR, utilizatori 13–15 ani, temeiul prelucrării și mecanismul potrivit de consimțământ/autoritate parentală.
- [ ] DPIA/LIA și registru al activităților de prelucrare, dacă review-ul juridic stabilește că sunt necesare.
- [ ] Confirmare scrisă privind eligibilitatea și termenii Gemini pentru produsul și publicul 13+ înainte de lansarea publică.
- [ ] Procedură de răspuns la cereri de acces/ștergere și incidente de securitate.

## 6. Build și Google Play

- [x] Expo SDK 57, React Native 0.86, Android package `ro.profudemate.app`.
- [x] `compileSdkVersion` și `targetSdkVersion` 36; minify și resource shrinking activate pentru release; cleartext dezactivat.
- [x] Android Auto Backup este dezactivat și proiectul declară explicit numai platforma Android pentru V1.
- [x] Profile EAS: development APK, preview APK și production AAB cu `autoIncrement`.
- [x] Un development APK EAS este construit și instalat pe telefon.
- [ ] Cont personal Google Play Console, taxa unică și verificarea identității.
- [ ] Crearea aplicației în Play Console cu numele „Profu’ de mate” și package-ul exact.
- [ ] Primul AAB de producție, Play App Signing și testarea artefactului din Play, nu doar development APK.
- [ ] Verificare 16 KB page size și Android vitals/pre-launch report pe AAB-ul final.
- [ ] Declarații Play: public 13–15, 16–17 și 18+; fără reclame; App access fără login; content rating; Data Safety; AI-generated content; declarația pentru asset-uri generate cu AI.
- [ ] Pentru un cont personal nou: minimum 12 testeri înscriși continuu 14 zile în closed testing înainte de cererea pentru production access.
- [ ] Listing, icon 512 × 512, feature graphic 1024 × 500, minimum 2 screenshot-uri de telefon, e-mail și URL de confidențialitate.
- [ ] Internal test → closed test → staged rollout; oprire automată dacă apar crash-uri, ANR-uri sau regresii de acuratețe.

## 7. Gate obligatoriu înainte de release public

Release-ul public nu se face până când toate punctele de mai jos sunt adevărate:

1. Identitatea legală și contactul public sunt completate în aplicație și pe web.
2. Review-ul juridic acoperă explicit utilizatorii 13–15 ani și folosirea Gemini.
3. Benchmarkul matematic și matricea de dispozitive trec pragurile stabilite.
4. App Check cu Play Integrity funcționează pe artefactul semnat de Play.
5. Data Safety corespunde exact traficului observat și SDK-urilor din AAB.
6. Closed testing-ul obligatoriu este finalizat și nu există defecte P0/P1 deschise.
7. AAB-ul final trece pre-launch report, verificarea 16 KB și testul de ștergere a datelor.
