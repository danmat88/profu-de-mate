# Profu’ de mate — research și arhitectură profesională de referință

Audiență: proprietarul produsului și viitorii dezvoltatori ai aplicației  
Data: 26 august 2026  
Statut: raport canonic de research; verdictul tehnic se actualizează numai cu dovezi  
Repository auditat: `danmat88/profu-de-mate`, branch `main`, bază `2f7556b`

## Starea implementării după research

Concluziile de mai jos descriu baseline-ul auditat la începutul cercetării. În aceeași sesiune au fost implementate local și verificate automat următoarele corecții P0:

- [x] eliminarea refreshului forțat al ID tokenului din cold start;
- [x] finalul splash-ului React desprins de accesul comercial și de rețea;
- [x] refresh comercial unic, cu TTL pentru evenimente automate și deduplicare per generație;
- [x] suspendarea refreshului de foreground în timpul Credential Manager;
- [x] invalidarea răspunsurilor și cache-ului aparținând identității vechi;
- [x] cheie locală de sesiune care diferențiază guest de Google chiar când linkarea păstrează UID-ul;
- [x] eliminarea round-tripului duplicat după purchase/restore și Google connect;
- [x] prewarm Caiet independent de refreshul comercial;
- [x] teste de comportament pentru cheia de sesiune, TTL și generația refreshului.

Dovezi locale: TypeScript + Expo Doctor 21/21, mobil 71/71, backend 58/58, Rules 8/8, integrare comercială Firestore 9/9 și export production fără token App Check debug. Un APK local `release`, minificat/resource-shrunk, versionCode 10 și patru ABI-uri a fost reconstruit din refactorizarea P0 și semnat cu certificatul debug înregistrat în Firebase; buildul EAS production nu a pornit din cauza cotei Free, cu resetare la 1 septembrie 2026. Auditul dependențelor are 0 high/critical și advisory-uri moderate tranzitive `uuid`; remedierea automată propusă ar face downgrade major incompatibil și nu a fost aplicată. `npm run legal:check` blochează corect publicarea până la completarea identității operatorului. Dovada fizică rămâne deschisă, iar APK-ul local nu validează Play signing/Billing/Integrity; prin urmare aplicația nu este încă declarată release candidate.

## Scop

Auditul acoperă traseul complet al aplicației Android:

1. lansare nativă, bootstrap React și primul ecran utilizabil;
2. sesiune Firebase anonimă, conectare Google, logout și ștergere;
3. cache local, sincronizare Firestore și Caiet;
4. acces Guest/Gratuit/Premium și consum tranzacțional;
5. Google Play Billing, RevenueCat și entitlement server-side;
6. trimiterea fotografiei, procesarea AI, idempotency și recuperarea erorilor;
7. randarea documentului matematic și performanța listelor;
8. securitate, observabilitate, responsive/adaptive UI și pregătirea Google Play.

## Presupuneri

- Android este prima și singura platformă de lansare curentă.
- Aplicația rămâne utilizabilă fără login vizibil; Firebase Anonymous Auth este identitatea tehnică inițială.
- Conectarea Google este opțională pentru folosirea inițială, dar obligatorie înainte de Premium.
- Serverul, nu telefonul, rămâne autoritatea pentru cote și entitlement.
- Fotografiile nu sunt păstrate în cloud; lecția structurată este conținutul persistent.
- Furnizorul AI final, textele juridice și activarea Play Console rămân decizii externe înainte de publicare.

## Răspuns executiv

Nu, aplicația nu este „perfectă” în starea actuală și nu ar fi profesionist să fie declarată astfel. Fundația backend este peste nivelul unui prototip obișnuit: autentificare obligatorie pentru Functions, rezervare tranzacțională, idempotency, refund, limite de cost, Rules restrictive, fuziune de cont și ștergere. Problemele principale sunt în coordonarea clientului, măsurare și dovada pe dispozitive.

Arhitectura corectă nu înseamnă „încarcă absolut tot înainte să dispară splash-ul”. Android separă explicit timpul până la primul cadru de timpul până când aplicația este complet utilizabilă. Recomandarea oficială este startup rapid, UI local imediat și actualizare asincronă; pentru o aplicație offline-first, UI citește din sursa locală, iar repository-ul sincronizează rețeaua. [S1][S2][S3]

Ținta pentru Profu’ de mate este:

```text
Native splash
    ↓ aceeași culoare, fără flash și fără Activity intermediar
Local bootstrap
    ├─ fonturi și asseturi critice
    ├─ sesiunea Firebase persistentă
    ├─ markerul analizei în curs
    └─ snapshoturi locale legate de identitate
    ↓ primul cadru React stabil
Launch animation (durată deterministă, native-driven)
    ↘ operațiile de rețea pot rula în paralel, dar nu controlează animația
App shell utilizabil
    ├─ AccessRepository sincronizează cota
    ├─ NotebookRepository emite cache Firestore, apoi server
    ├─ Purchases se configurează o singură dată după ID-ul comercial stabil
    └─ UI primește stare unidirecțional, fără refresh-uri concurente
```

## Ce fac organizațiile profesioniste și ce rezultă pentru aplicație

### 1. Startup: primul cadru și „fully usable” sunt obiective diferite

Android definește TTID și TTFD ca metrici distincte, recomandă optimizarea cold startului și consideră excesiv un cold start de minimum 5 secunde. Munca grea sau nenecesară în inițializare crește timpul de lansare. Expo recomandă ascunderea splash-ului cât mai repede și testarea rezultatului într-un release build, deoarece Expo Go/development nu reproduce fidel splash-ul Android. [S1][S4]

Consecințe:

- splash-ul nativ rămâne o suprafață scurtă, nu un ecran de marketing lung;
- scena React trebuie să fie deja desenată înainte de predarea nativă;
- animația custom poate continua peste aplicația montată, dar durata sa nu se leagă de un request;
- accesul comercial, Firestore sau RevenueCat nu decid când se termină animația;
- datele sosite în timpul animației se pot aplica în spatele overlay-ului sau imediat după, fără schimbarea geometriei ecranului;
- performanța se măsoară pe release cold/warm/hot, nu se apreciază „pare rapid”.

Verdict curent:

- predarea fără fade nativ și garda `onLayout` sunt corecte conceptual;
- `firstFrameReady` depinde încă de `commercialLoading`, deci rețeaua comercială poate prelungi splash-ul React;
- providerul comercial pornește refresh, RevenueCat și prewarm Caiet în același lanț în timp ce splash-ul rulează;
- nu există măsurători TTID/TTFD pe artefactul curent.

### 2. Animațiile pot rula în paralel cu I/O, dacă UI-ul nu depinde de rezultat

React Native explică faptul că animațiile cu native driver sunt serializate și rulează pe threadul UI, independent de event loop-ul JavaScript. Așadar, regula profesionistă nu este „interzice orice fetch în timpul animației”, ci „nu bloca animația și nu-i schimba durata sau layoutul din cauza fetchului”. [S5]

Consecințe:

- asseturile critice se pregătesc înainte de prima scenă;
- animația folosește numai `opacity` și `transform`, cu `useNativeDriver: true`;
- requesturile pot fi pornite devreme pentru latență totală mai mică;
- rezultatele remote trebuie deduplicate și publicate printr-o singură sursă de stare;
- componentele păstrează spațiu stabil pentru stări `cached`, `refreshing`, `ready` și `offline`.

### 3. Autentificarea persistentă nu se reverifică forțat la fiecare cold start

Firebase păstrează sesiunea între restarturi. ID tokenurile durează aproximativ o oră, iar SDK-ul le reîmprospătează; `getIdToken(user)` returnează tokenul curent dacă mai este valid cel puțin cinci minute și îl reînnoiește altfel. `forceRefresh=true` există pentru cazurile în care tokenul este cunoscut ca invalid, nu ca rutină de startup. Callable Functions includ automat Auth și App Check când sunt disponibile. [S6][S7][S8][S9]

Consecințe:

- un utilizator persistent se restaurează local fără round-trip forțat;
- un utilizator nou primește Anonymous Auth o singură dată;
- erorile terminale de sesiune se tratează când SDK-ul/serverul le raportează;
- logout și ștergere rămân operații explicite și diferite;
- validarea critică rămâne server-side la fiecare callable.

Defect curent P0:

- `currentOrAnonymousUser()` apelează `getIdToken(current, true)` la fiecare pornire. Aceasta introduce rețea inutilă și face cold startul dependent de Auth.

### 4. Offline-first înseamnă sursă locală de adevăr pentru afișare

Ghidul Android recomandă ca fiecare repository cu rețea să aibă sursă locală, iar nivelurile superioare să citească din aceasta, nu direct din rețea. Firestore are persistență offline activă implicit pe Android și emite/sincronizează datele când conexiunea revine. [S2][S3][S10]

Consecințe:

- cota afișată pornește din snapshot local valid, apoi se reconciliază cu serverul;
- Caietul emite imediat snapshotul Firestore local și apoi modificările serverului;
- UI nu lansează requesturi duplicate din fiecare ecran;
- cache-ul nu acordă drept de analiză: preflightul și rezervarea server-side rămân autoritatea;
- starea trebuie să distingă `cached`, `refreshing`, `fresh`, `offline` și `error`, fără a goli ecranul la refresh.

Defecte curente P0/P1:

- `HomeScreen` forțează refresh la fiecare focus, deși providerul face refresh la mount și la revenirea în foreground;
- prewarm-ul Caietului este pornit numai după refreshul comercial, deși depinde de Auth/Firestore, nu de cotă;
- cache-ul suplimentar al Caietului este doar în memorie; Firestore local este sursa persistentă reală, dar contractul repository-ului nu exprimă metadata cache/server;
- ecranele pot provoca refreshuri secvențiale redundante după acțiuni comerciale.

### 5. Tranziția Google are nevoie de o singură operație de identitate

Pe Android, selectorul de credențiale este o altă Activity; `AppState` poate raporta temporar `background`, apoi `active`. Un listener generic de foreground poate porni un refresh exact în mijlocul conectării. [S11]

Defect curent P0:

- providerul ascultă foreground și face refresh;
- conectarea Google face apoi propriul refresh;
- Paywall mai face încă un refresh după `connectGoogle()`;
- un request început cu identitatea guest poate termina după schimbarea identității și poate publica/cacha un snapshot vechi;
- deduplicarea actuală protejează doar requesturile simultane identice, nu invalidează un request aparținând vechii identități.

Arhitectura țintă:

- o tranziție de identitate incrementează o generație internă;
- refreshurile automate sunt suspendate cât timp selectorul Google este deschis;
- rezultatele capturate într-o generație veche sunt ignorate și nu intră în cache;
- conectarea/deconectarea execută exact un refresh autoritativ la final;
- ecranele primesc rezultatul acelei operații, nu mai cer încă o dată aceleași date.

### 6. RevenueCat nu este al doilea procesator și trebuie configurat o singură dată

Google Play Billing procesează plata. Google recomandă verificarea achiziției înainte de acordarea beneficiilor, entitlement server-side și sincronizarea lifecycle-ului, inclusiv tranzacții pending, refund și schimbări produse când aplicația nu rulează. RevenueCat recomandă configurarea SDK-ului o singură dată, de regulă devreme în lifecycle, și verificarea `CustomerInfo` la launch/înainte de paywall; SDK-ul are cache. [S12][S13][S14][S15]

Consecințe:

- păstrăm Google Play Billing + RevenueCat + entitlement Firestore;
- RevenueCat se configurează după ce există ID-ul comercial opac și stabil;
- nu cerem offerings până când utilizatorul ajunge la paywall;
- entitlementul folosit de analiza AI rămâne server-side, nu un boolean local;
- purchase/restore returnează starea canonică și o publică o singură dată;
- webhookul trebuie autentificat, idempotent și reconciliat cu starea canonică.

Verdict curent:

- modelul conceptual este corect;
- inițializarea RevenueCat este cuplată în funcția de refresh a accesului, dar nu rulează deloc când cheia lipsește;
- purchase/restore urmate de încă un `getCommercialAccess` produc round-trip redundant;
- Premium nu poate fi validat end-to-end înainte de Play Console, produse și RevenueCat reale.

### 7. Cota și analiza AI trebuie să fie tranzacționale și idempotente

Firestore garantează atomicitatea tranzacțiilor și poate relua handlerul în caz de concurență. Cloud Run Functions recomandă funcții idempotente, astfel încât retry-ul să fie sigur. [S16][S17]

Verdict curent:

- rezervarea după `requestId`, consumul numai la rezultat `ready`, refundul și plafonul global sunt o fundație corectă;
- clientul nu poate acorda singur probleme;
- rezultatul `not_math`, neclar sau eșuat nu consumă;
- rămân obligatorii teste live pentru timeout după rezervare, process-kill, retry simultan și răspuns întârziat al providerului;
- acuratețea matematică nu poate fi declarată fără corpus și evaluare măsurată.

### 8. App Check se activează prin rollout măsurat, nu prin presupunere

Firebase recomandă distribuirea clientului cu App Check, observarea metricilor și abia apoi enforcement. Pentru Play Integrity, setările diferă între instalările din Play și cele sideloaded. [S18]

Consecințe:

- development folosește debug provider cu token privat;
- APK-ul sideloaded pre-Play nu este echivalent cu buildul instalat din Play;
- release-ul Play activează Play Integrity și enforcement împreună după verificarea metricilor;
- Auth, cote, rate limit, plafon global și kill switch rămân protecții independente.

### 9. Calitatea UI nu se dovedește doar prin responsive hooks

Android cere layouturi adaptive, continuitate la resize/rotație, grafică fără distorsiuni, navigare Back corectă, targeturi accesibile și testarea tuturor fluxurilor. Pentru liste importante, Android recomandă teste de randare, iar React Native documentează optimizările și compromisurile `FlatList`. [S19][S20][S21]

Consecințe:

- `useResponsiveLayout` este util, dar nu este dovadă;
- trebuie verificat fiecare ecran pe telefon compact, telefon mare, tabletă/foldable și multi-window;
- Caietul trebuie măsurat pentru rerender, fill rate și scroll, nu doar inspectat vizual;
- scenele matematice cer golden screenshots și corpus pentru formule, sisteme, matrici, geometrie, grafice, tabele și axe;
- layouturile mari trebuie să folosească pane/list-detail unde ajută, nu să întindă cardurile de telefon.

### 10. Observabilitatea și release-ul sunt parte din produs

Google Play folosește crash rate și ANR rate ca semnale de calitate și discoverability. Aplicațiile cu cont trebuie să ofere ștergere în aplicație și prin resursă web. Din 31 august 2026, aplicațiile noi trebuie să țintească API 36; conturile personale noi cer cel puțin 12 testeri înscriși continuu 14 zile înainte de accesul production. AAB și Play App Signing sunt mecanismele normale de publicare. [S22][S23][S24][S25][S26]

Verdict curent:

- targetSdk 36, AAB profile, ștergere in-app, pagini Hosting și Crashlytics opt-in există în cod/configurație;
- Crashlytics fiind opt-in, nu există date până când utilizatorul activează diagnosticele; aceasta este o alegere de confidențialitate, dar cere o strategie separată de QA și Android vitals;
- nu există încă Play Console, testeri, Play App Signing, AAB verificat de Play, Data Safety final sau dovadă pre-launch report;
- nu există încă SLO-uri și alerte demonstrate pentru 5xx, P95, cost, quota și feedback periculos.

## Matricea diferențelor

| Domeniu | Stare curentă | Țintă profesională | Prioritate |
|---|---|---|---|
| Native → React splash | handoff fără fade, scenă păzită prin layout | confirmare pe release + TTID/TTFD | P0 |
| Durata splash | corectată local: navigarea desenată este singurul readiness gate | confirmare fizică pe release, independentă de rețea | P0 QA |
| Firebase session | corectată local: fără refresh forțat la cold start | probă cold/offline + refresh automat/on-demand | P0 QA |
| Refresh access | corectat local: owner unic, TTL și force explicit | teste native și telemetrie | P0 QA |
| Google transition | corectată local: generație, suspendare foreground și invalidare stale | probă Credential Manager pe două telefoane | P0 QA |
| Cache access | UID-bound și display-only | păstrat, plus status `cached/fresh/offline` | P1 |
| Caiet | Firestore listener + cache memory | repository reactiv, metadata cache/server | P1 |
| RevenueCat | configure după access; offerings în paywall | aceeași idee, dar lifecycle separat și update unic | P1/blocat extern |
| AI quota | tranzacțional/idempotent/refund | probe live de concurență și failure injection | P0/P1 |
| Matematică | document local MathJax/SVG | golden tests + corpus + scoruri | P1 |
| UI adaptive | hooks și QA limitat | matrice Android oficială + teste vizuale/E2E | P1 |
| Observabilitate | Crashlytics opt-in, diagnostics safe | SLO, alerte, Android vitals, runbook probat | P1/P2 |
| Play | config pregătit parțial | Play Console, AAB, signing, testeri, pre-launch | extern |

## Ordinea corectă de implementare

### Etapa A — P0 client architecture — implementată local

- [x] eliminarea refreshului forțat al ID tokenului din cold start;
- [x] desprinderea finalului splash-ului de accesul comercial;
- [x] coordonator unic pentru refresh, cu TTL, force și invalidare pe generația identității;
- [x] eliminarea refreshurilor duplicate din Home/Paywall/Settings;
- [x] prewarm Caiet independent de accesul comercial;
- [~] teste comportamentale pentru politicile pure și contractele sursă; traseele native cold/warm/offline și Credential Manager rămân în Etapa B.

### Etapa B — P0 verificare fizică

- release APK pe minimum două telefoane reale;
- cold/warm/hot, offline, rețea lentă și process-kill;
- Guest 5→4, restart, Google link/merge, logout sigilat și reinstalare;
- analiză Camera/Galerie, timeout, retry și reluare;
- capturi/trace pentru flash, layout shift și rerender.

### Etapa C — P1 data/UI/math

- repository reactiv pentru Caiet și metadata cache/server;
- teste de componentă și E2E pentru liste, sheeturi, Back și rotație;
- golden screenshots pentru documentul matematic;
- corpus anonim de minimum 200 imagini și scoruri separate OCR/rezultat/pași/verdict;
- layouturi adaptive pentru >=600dp și foldable/multi-window.

### Etapa D — P1/P2 operațiuni

- strategie explicită Crashlytics/consimțământ și test de raport release;
- dashboarduri și alerte pentru 5xx, P95, cost, quotas, cleanup și feedback unsafe;
- failure injection pentru provider, Firestore contention și webhook retry;
- buget lunar și kill switch exersat, nu doar documentat.

### Etapa E — Premium și Play

- Play Console personal, aplicație și Play App Signing;
- produse lunar/anual, RevenueCat, entitlement și webhook reale;
- purchase/pending/restore/renew/cancel/expire/refund/reinstall pe track Play;
- Play Integrity în monitor, apoi enforcement;
- legal, Data Safety, ștergere web, AAB, 12 testeri/14 zile și staged rollout.

## Limitări

- Research-ul definește standardul și defectele demonstrabile din cod; nu poate certifica vizual fiecare ecran fără dispozitiv conectat și capturi ale aceleiași revizii.
- Nu există încă date Play Console/Android vitals, deci nu putem afirma rate reale de crash, ANR sau startup.
- Nu există produse Google Play/RevenueCat reale, deci plățile rămân neverificate end-to-end.
- Calitatea matematică nu este demonstrată statistic până la corpusul etichetat și review uman.
- Conformitatea pentru public 13–17 ani și furnizorul AI necesită decizie contractuală/juridică înainte de publicare.

## Recomandare finală

Nu se rescrie aplicația din nou de la zero. Backendul comercial și pipeline-ul AI au mecanisme care merită păstrate. Se refactorizează coordonarea clientului în ordinea P0 de mai sus, se măsoară pe release, apoi se închid UI/math, observabilitatea și blocajele Play. Orice checklist bifat trebuie să indice testul, artefactul și revizia pe care a trecut.

## Surse

- [S1] Android Developers — [App startup time](https://developer.android.com/topic/performance/vitals/launch-time)
- [S2] Android Developers — [Build an offline-first app](https://developer.android.com/topic/architecture/data-layer/offline-first)
- [S3] Android Developers — [Data layer](https://developer.android.com/topic/architecture/data-layer)
- [S4] Expo SDK 57 — [SplashScreen](https://docs.expo.dev/versions/v57.0.0/sdk/splash-screen/)
- [S5] React Native — [Animations and native driver](https://reactnative.dev/docs/next/animations)
- [S6] Firebase — [Users in Firebase projects](https://firebase.google.com/docs/auth/users)
- [S7] Firebase — [JavaScript Auth API: getIdToken](https://firebase.google.com/docs/reference/js/auth)
- [S8] Firebase — [Manage user sessions](https://firebase.google.com/docs/auth/admin/manage-sessions)
- [S9] Firebase — [Call functions from your app](https://firebase.google.com/docs/functions/callable)
- [S10] Firebase — [Access Firestore data offline](https://firebase.google.com/docs/firestore/manage-data/enable-offline)
- [S11] React Native — [AppState](https://reactnative.dev/docs/appstate)
- [S12] Android Developers — [Integrate Google Play Billing](https://developer.android.com/google/play/billing/integrate)
- [S13] Android Developers — [Integrate Google Play with your backend](https://developer.android.com/google/play/billing/backend)
- [S14] RevenueCat — [Configuring the SDK](https://www.revenuecat.com/docs/getting-started/configuring-sdk)
- [S15] RevenueCat — [Getting subscription status](https://www.revenuecat.com/docs/customers/customer-info)
- [S16] Firebase — [Firestore transactions and batched writes](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [S17] Google Cloud — [Cloud Run functions best practices](https://docs.cloud.google.com/run/docs/tips/functions-best-practices)
- [S18] Firebase — [App Check with Play Integrity](https://firebase.google.com/docs/app-check/android/play-integrity-provider)
- [S19] Android Developers — [Core app quality guidelines](https://developer.android.com/develop/adaptive-apps/quality-guidelines/core-app-quality)
- [S20] Android Developers — [Adaptive app quality guidelines](https://developer.android.com/develop/adaptive-apps/quality-guidelines/adaptive-app-quality)
- [S21] React Native — [FlatList](https://reactnative.dev/docs/flatlist)
- [S22] Play Console Help — [Android vitals](https://support.google.com/googleplay/android-developer/answer/9844486)
- [S23] Play Console Help — [Account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111)
- [S24] Play Console Help — [Target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878)
- [S25] Play Console Help — [Testing requirements for personal accounts](https://support.google.com/googleplay/android-developer/answer/14151465)
- [S26] Android Developers — [About Android App Bundles](https://developer.android.com/guide/app-bundle)

## Claim-to-source ledger

| Afirmație | Surse |
|---|---|
| Startupul profesionist separă primul cadru de conținutul complet utilizabil | S1 |
| UI offline-first citește local și sincronizează prin repository | S2, S3, S10 |
| Splash-ul Expo trebuie ascuns repede și verificat într-un release | S4 |
| Native driver protejează animația de event loop-ul JS | S5 |
| Firebase persistă sesiunea și refreshuiește tokenul la nevoie | S6, S7, S8 |
| Callable Functions atașează automat Auth/App Check | S9 |
| Selectorul Android poate produce tranziții AppState background/active | S11 |
| Entitlementul de plată trebuie verificat și sincronizat server-side | S12, S13 |
| RevenueCat se configurează o singură dată devreme și folosește cache CustomerInfo | S14, S15 |
| Cota concurentă trebuie implementată atomic și retry-ul să fie idempotent | S16, S17 |
| App Check se distribuie, se măsoară și apoi se impune | S18 |
| Calitatea UI cere teste adaptive, vizuale, Back și de performanță | S19, S20, S21 |
| Crash/ANR influențează calitatea și discoverability în Play | S22 |
| Conturile create în aplicație impun traseu de ștergere | S23 |
| API 36, closed testing și AAB sunt cerințe/recomandări curente de publicare | S24, S25, S26 |
