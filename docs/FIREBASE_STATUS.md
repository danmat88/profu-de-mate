# Stare Firebase — producție

Ultima verificare: 25 august 2026

## Proiect

- Project ID: `profu-de-mate-danmat88`
- Project number: `55112937994`
- Plan: Blaze activ; Cloud Billing Budget API nu este încă activ, iar suma și adresa pentru alertele de cost trebuie alese înainte de configurare.

## Firestore

- Bază: `(default)`
- Mod: Firestore Native, ediția Standard
- Locație: `eur3`
- Delete protection: activată
- Point-in-time recovery: oprit
- Realtime updates: activate
- Reguli: publicate din `firestore.rules`
- Indexuri: două indexuri compuse `lessons` și indexurile collection-group pentru `lessons.expiresAt`, publicate din `firestore.indexes.json` și în starea `READY`.

## Aplicații Firebase

- Android: `Profu de Mate`
- Package: `ro.profudemate.app`
- Android App ID: `1:55112937994:android:b9f51c996fd698d986a5f3`
- SHA-1 și SHA-256 ale cheii EAS de dezvoltare: înregistrate în Firebase
- Web: `Default Web App`, creat automat de Firebase CLI pentru configurarea Auth

## Expo Application Services

- Proiect: `@matdan88/profu-de-mate`
- Project ID: `787d3089-788a-4b3f-b4dd-9096a08a1ea2`
- Profile: development APK, preview APK și production AAB
- Configurația Android Firebase este stocată ca EAS file secret în development, preview și production.
- Numai development/preview folosesc App Check debug; mediul production nu mai conține debug token, iar tokenurile APK-urilor release interne vechi au fost revocate.
- Cheia Android de dezvoltare este generată și păstrată de EAS.
- Primul development build Android a fost finalizat cu succes pe 21 august 2026.
- Ultimul development build verificat și instalat: `ba006953-bb71-4398-a0e5-093a1002f80f`, fingerprint `ab7b8fd6caadee4c0fb17e57224cfa1e7fea779d`, versionCode 6, finalizat pe 24 august 2026.

## Authentication

- Anonymous: activat și versionat în `firebase.json`
- Google Sign-In: neactivat încă
- Phone și Email/Password: neactivate

## Cloud Functions și AI

- `analyzeMathImage`: revizia live `analyzemathimage-00019-lon`, publicată în `europe-west1` cu 100% trafic, Node 22, 512 MiB, timeout 120 s, `maxInstances: 3`, concurență 10 și App Check obligatoriu. Hash-ul Firebase publicat este `491d918dafab3c3a72d825979ee09dbdfc32bf2b`.
- `deleteMyData`: publicată în `europe-west1`, șterge datele și contul anonim al instalării.
- `cleanupExpiredData`: publicată și programată zilnic la 03:15 Europe/Bucharest.
- Cheia Gemini este păstrată în Secret Manager; aplicația mobilă nu o conține.
- Rate limit activ: 30 analize/zi și maximum 4/minut per instalare, cu deduplicare prin `requestId`.
- Publicat: `store:false`, refund idempotent pentru cotele zilnice la eșec, plafon global implicit de 300/zi, gardă Firestore de 840 KB, kill switch privat și circuit breaker.
- `initializeFeedbackTriage`: publicat ca trigger Eventarc; o raportare reală a primit `status`, `severity` și `expiresAt`, cu răspuns HTTP 200 în logurile serviciului.
- App Check funcționează cu debug provider în development; Play Integrity rămâne de configurat după Play App Signing.
- Test live după hardening: App Check valid, analiză `ready`, lecție temporară creată și ștearsă complet prin `deleteMyData`.
- Development buildul curent are tokenul debug înregistrat exclusiv în consola Firebase; process-kill → cold reopen → retry cu același `requestId` a produs o lecție validă, apoi cleanupul local a lăsat zero fișiere temporare.
- Contractul Gemini Structured Outputs este compact și fără uniuni vizuale incompatibile; payloadul vizual intermediar este normalizat și validat strict înainte de randare sau Firestore. Titlurile identifică exercițiul concret, iar schema/randarea extinsă acoperă conținut simbolic și vizual fără logică pe capitole. Suita backend trece 40/40.
- Deploy-ul țintit din 25 august 2026 a trecut buildul și startup probe-ul Cloud Run fără erori. Un apel extern fără Auth/App Check a fost refuzat corect cu HTTP 401 `UNAUTHENTICATED`; proba AI end-to-end pe această revizie rămâne de executat când development buildul este din nou conectat.

## IAM

- Cele trei funcții folosesc conturi de serviciu dedicate: `profu-ai-runtime`, `profu-data-runtime` și `profu-cleanup-runtime`.
- Fiecare runtime are numai acces Firestore; ștergerea are un rol custom numai cu `firebaseauth.users.delete`.
- Numai `profu-ai-runtime` poate citi secretul `GEMINI_API_KEY`.
- Contul Compute implicit nu mai are `Editor`; are numai `roles/run.builder`, verificat printr-un build și deploy real cu 3 funcții și 0 erori.
- Jobul Scheduler folosește OIDC cu `profu-cleanup-runtime`; rularea live a terminat cu HTTP 200 și `Expired data cleaned`.
- Rolurile implicite `Editor` rămase pe service agent-ul Google APIs și contul App Engine trebuie evaluate cu IAM Recommender înainte de eliminare; nu sunt folosite ca runtime de funcții.
- Cloud Monitoring nu are încă politici de alertare configurate.
- `profu-data-runtime` are `roles/eventarc.eventReceiver`; `roles/run.invoker` este acordat numai pe serviciul Cloud Run `initializefeedbacktriage`.

## Storage și fotografii

- Aplicația nu folosește Cloud Storage în v1 pentru fotografiile problemelor.
- `storage.rules` refuză toate operațiile, dar nu a fost publicat deoarece proiectul nu are încă un bucket implicit creat.
- Fotografiile sunt transmise în memorie pentru analiză și nu sunt salvate în Caiet sau Firebase Storage. Logurile limitate ale furnizorului AI sunt descrise în politica legală.

## Retenție și Hosting

- Lecții/cache nesalvate: 7 zile; contoare: 35 zile; Caiet: aproximativ 13 luni fără activitate; raportări: 180 de zile. Câmpul de expirare al raportărilor este adăugat server-side de triggerul publicat.
- Regulile Firestore pentru retenția Caietului au fost testate și publicate pe 22 august 2026.
- Jobul de retenție, autentificarea OIDC și indexul collection-group au fost testate live pe 22 august 2026.
- Site-ul static pentru Privacy, Terms și Data Deletion este pregătit local în `hosting/public`.
- Deploy-ul Hosting este blocat automat până la completarea numelui legal și e-mailului public.

## Următorul prag

- Bugete/alerte și monitorizare operațională pentru 5xx, latență, cleanup, quota, cost și raportări cu severitate mare.
- Identitatea legală și contactul public, apoi publicarea Hosting.
- Bugete/alerte și review IAM Recommender pentru cele două identități implicite Google/App Engine.
- Cont Play Console, Play App Signing și amprentele certificatului Play.
- App Check Play Integrity pe artefactul distribuit de Play.
- AAB de producție, testare închisă și verificările din `docs/PRODUCTION_CHECKLIST.md`.
