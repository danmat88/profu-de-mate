# Profu’ de mate — registru de producție

Ultima actualizare: 26 august 2026

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
- [ ] Pentru documentele publice lipsește numele legal complet al operatorului; `info@danielmatei.dev` este introdus, dar livrarea și monitorizarea adresei trebuie verificate.

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
- [x] Aplicația cere numai Camera și permisiunea tehnică Google Play Billing; microfonul, locația, notificările, Advertising ID și accesul general la poze sunt blocate explicit.
- [x] APK-ul production versionCode 9 blochează `SYSTEM_ALERT_WINDOW`, impune `allowBackup=false`, este `debuggable=false` și dezactivează cleartext; manifestul și semnătura au fost auditate.
- [x] Fotografia nu este salvată în Firebase Storage sau în Caiet.
- [x] Cererile sunt autentificate anonim sau Google și trimise unei funcții callable din `europe-west1`; App Check este activ în development, iar canalul public pre-Play folosește temporar Auth + limite server-side până la Play Integrity.
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
- [x] Anonymous Auth rămâne intrarea implicită; Google linking opțional este implementat, dar providerul extern nu este încă activat.
- [~] App Check este activ în development prin debug provider. APK-ul public pre-Play nu conține token debug, iar enforcement-ul callable este oprit temporar până la activarea simultană Play Integrity client/backend după Play App Signing.
- [x] Secretul Gemini este în Secret Manager; cheia nu este în aplicație sau Git.
- [x] `analyzeMathImage`: Node 22, 512 MiB, timeout 120 s, `maxInstances: 3`, concurrency 10.
- [x] Contractul live este 5 probleme de bun-venit / 5 gratuite zilnic cu Google / 30 Premium implicit, maximum 4/minut și plafon global; numai rezultatul `ready` consumă. Guest folosește un principal de instalare, iar Google un principal HMAC stabil; niciunul nu depinde de UID-ul Firebase recreabil.
- [x] Kill switch privat, circuit breaker, `store:false` și gardă de 840 KB sunt implementate, testate și publicate.
- [x] `deleteMyData` șterge lecții, feedback, cache, profil și utilizatorul Firebase, indiferent dacă RevenueCat este activ. Cota HMAC a zilei este sanitizată și reținută numai până după resetare; revizia este publicată și testul de regresie 4/5 → ștergere → recreare → 4/5 trece în integrarea Firestore.
- [x] `cleanupExpiredData` rulează zilnic la 03:15 Europe/Bucharest.
- [x] Jobul Scheduler, OIDC și indexul collection-group pentru retenție au fost testate live cu HTTP 200.
- [x] Retenție: 7 zile pentru lecții nesalvate/cache, 35 zile pentru contoare zilnice/rezervări și aproximativ 13 luni pentru profilul comercial minim, entitlement/evenimente și Caiet inactiv.
- [x] Firestore și Storage sunt deny-by-default; clientul nu poate crea sau modifica răspunsul matematic.
- [x] Audit al logurilor: fără fotografie/Base64/enunț; loggerul propriu păstrează numai statusuri și descriptori de eroare fără mesaj.
- [x] 8 teste de reguli, 9 teste tranzacționale Firestore, 58 teste backend și 66 teste de logică mobilă/configurație Android/lifecycle/text/Caiet/startup trec local; Expo Doctor trece 21/21.
- [ ] După primul upload în Play: adăugarea SHA-1/SHA-256 ale certificatului Play App Signing în Firebase.
- [ ] După certificatul Play: înregistrarea aplicației în Play Integrity și verificarea App Check pe build release.
- [ ] Buget Google Cloud și alerte de cost configurate la praguri explicite.
- [~] Runtime-urile sunt separate și least-privilege, contul Compute nu mai are `Editor`, cheia Gemini este limitată la runtime-ul AI, iar secretul identității comerciale este limitat la runtime-urile AI/date care îl folosesc; mai trebuie review IAM Recommender pentru rolurile implicite Google APIs/App Engine.
- [ ] Alertare operațională pentru erori 5xx, latență, invocări, cost și raportări `unsafe`.
- [~] Triage server-side și expirare la 180 de zile sunt publicate și verificate end-to-end printr-o raportare reală; alerta automată pentru severitate mare rămâne de configurat.

## 4.1 Comercial, Google și abonamente

- [x] Modelul, nomenclatura și toate stările sunt documentate în `docs/COMMERCIAL_SYSTEM.md`.
- [x] Quota server-side, fusul București, refundul, entitlement-ul, fuziunea conturilor și webhook-ul semnat sunt implementate și testate.
- [x] Tranzacțiile comerciale trec 9/9 pe emulator: concurență, idempotency, refund, plafon, bilet legat de instalare, Google fără bonus, rotația UID-ului guest fără 5/5 nou, instalări legacy sigilate și ștergere/recreare fără resetarea cotei Google.
- [x] Fuziunea Google se reia din SecureStore după restart și biletul poate fi finalizat numai de instalarea emitentă; sesiunea persistă, logout-ul cere mai întâi sigilarea instalării pe server și nu acordă un nou 5/5, ștergerea definitivă cere reconfirmare Google, iar ștergerea RevenueCat are retry server-side.
- [x] Home, Confirmare, Procesare, paywall și Setări au fluxuri comerciale fără pierderea fotografiei.
- [x] Prețurile sunt citite din Google Play/RevenueCat; aplicația nu inventează prețuri sau reduceri.
- [~] Provider Google, OAuth/Web Client ID și SHA-urile EAS sunt verificate; certificatul Play App Signing se adaugă după primul AAB.
- [ ] Abonament Google Play cu base plans lunar/anual, proiect RevenueCat, entitlement `premium` și offering curent.
- [ ] Secrete RevenueCat, webhook Authorization + HMAC și restore behavior configurate.
- [ ] Purchase, restore, renewal, expiration, refund și transfer testate dintr-un track Google Play.
- [ ] Device Recall aprobat, verificat întâi în `monitor`, apoi activat în `enforce`.

## 5. Date, minori și legal

- [x] Public țintă declarat: 13+, fără reclame; aplicația începe fără login, iar Google apare contextual și rămâne opțional pentru folosirea inițială.
- [x] Ecran în aplicație pentru confidențialitate, retenție, utilizarea AI și termeni simpli.
- [x] Diagnosticarea Crashlytics este implicit oprită și controlată de utilizator.
- [x] Deconectarea și ștergerea sunt acțiuni separate; ștergerea are confirmare clară, reconfirmare Google, stare de eroare și explică retenția minimă anti-abuz.
- [x] Draftul Data Safety este în `docs/release/DATA_SAFETY.md`.
- [ ] Numele legal complet al operatorului persoană fizică.
- [~] E-mail public propus: `info@danielmatei.dev`; livrarea și monitorizarea trebuie confirmate înainte de publicare.
- [ ] Politică de confidențialitate și termeni găzduiți pe un URL public, activ și nemodificabil fără versionare.
- [ ] Revizuire juridică pentru GDPR, utilizatori 13–15 ani, temeiul prelucrării și mecanismul potrivit de consimțământ/autoritate parentală.
- [ ] DPIA/LIA și registru al activităților de prelucrare, dacă review-ul juridic stabilește că sunt necesare.
- [ ] Confirmare scrisă privind eligibilitatea și termenii Gemini pentru produsul și publicul 13+ înainte de lansarea publică.
- [ ] Procedură de răspuns la cereri de acces/ștergere și incidente de securitate.

## 6. Build și Google Play

- [x] Expo SDK 57, React Native 0.86, Android package `ro.profudemate.app`.
- [x] `compileSdkVersion` și `targetSdkVersion` 36; minify și resource shrinking activate pentru release; cleartext dezactivat.
- [x] Android Auto Backup este dezactivat și proiectul declară explicit numai platforma Android pentru V1.
- [x] Profile EAS: development APK, preview APK, `production-apk` public pre-Play și production AAB cu `autoIncrement`.
- [x] Exportul JavaScript production este verificat reproductibil și refuză orice token App Check debug.
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
