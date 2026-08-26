# Stare Firebase — producție

Ultima verificare: 25 august 2026

## Proiect

- Project ID: `profu-de-mate-danmat88`
- Project number: `55112937994`
- Plan: Blaze activ; Cloud Billing Budget API este activ, iar suma și adresa pentru alertele de cost trebuie alese înainte de crearea bugetului.

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
- Profile: development APK, preview APK, `production-apk` public pre-Play și production AAB
- Configurația Android Firebase este stocată ca EAS file secret în development, preview și production.
- Numai development/preview folosesc App Check debug; mediul production nu mai conține debug token, iar tokenurile APK-urilor release interne vechi au fost revocate.
- Cheia Android de dezvoltare este generată și păstrată de EAS.
- Primul development build Android a fost finalizat cu succes pe 21 august 2026.
- Development buildul nou: `918b0038-90f8-4700-89f9-c8917bc2a2b3`, fingerprint EAS `10a4e64b1041419aa1a760d0d6e2df9f5dd02f26`, versionCode 7, finalizat pe 25 august 2026. Auditul APK confirmă package-ul, target SDK 36, `allowBackup=false`, semnătura EAS înregistrată în Firebase, resursele `google_app_id/default_web_client_id` și bibliotecile native Nitro pentru toate ABI-urile. Instalarea, cold startul prin Wi-Fi și deschiderea selectorului nativ Google Credential Manager au fost confirmate pe telefonul fizic.
- Fiind development client, acest APK este intenționat `debuggable`, permite cleartext pentru Metro și include `SYSTEM_ALERT_WINDOW`; eliminarea lor se validează pe următorul APK/AAB de producție, nu pe dev client.

## Authentication

- Anonymous: activat și versionat în `firebase.json`
- Google Sign-In: providerul Firebase este activ; clientul Web OAuth, clientul Android asociat package-ului și SHA-1, configurația Firebase actualizată și Web Client ID-ul EAS sunt configurate în development, preview și production. Aplicația folosește Android Credential Manager prin `react-native-nitro-google-signin`, nu SDK-ul legacy depreciat. `npm start` sincronizează EAS development în `.env.local` înainte de Metro și validează contractul, eliminând diferența dintre mediul buildului și bundle-ul local.
- Phone și Email/Password: neactivate

## Cloud Functions și AI

- `analyzeMathImage`: revizia publicată la 26 august 2026 este `ACTIVE` în `europe-west1`, cu Node 22, 512 MiB, timeout 120 s, `maxInstances: 3`, concurență 10 și principal comercial HMAC stabil.
- `deleteMyData`: revizia publicată la 25 august 2026 este `ACTIVE`, cu hash `cf1d8178431d899a38f9f513b9360e8b9cc7a45a`; șterge conținutul și utilizatorul Firebase anonim sau Google, indiferent dacă RevenueCat este activ. Pentru Google cere și server-side o autentificare recentă, iar documentul cotei este înlocuit strict cu numai principalul HMAC, ziua, numărul folosit și metadatele de expirare/curățare.
- `cleanupExpiredData`: publicată și programată zilnic la 03:15 Europe/Bucharest.
- Cheia Gemini este păstrată în Secret Manager; aplicația mobilă nu o conține.
- Sistemul 5 bun-venit / 5 gratuit zilnic / 30 Premium, cu rezervare tranzacțională, plafon global și refund pentru orice rezultat diferit de `ready`, este publicat în `analyzeMathImage`.
- `getCommercialAccess`, `claimGuestWelcome`, `prepareAccountMerge`, `completeAccountMergeWithGoogle` și `prepareAccountLogout` sunt active, fiecare cu Auth obligatoriu și identitatea `profu-data-runtime`. Guest folosește principalul opac al instalării, Google folosește principalul HMAC al furnizorului, biletul de fuziune cere aceeași instalare, iar logout-ul este refuzat dacă serverul nu poate sigila instalarea. UID-ul Firebase recreabil nu mai poate reseta cota.
- Endpointurile Premium (`syncPremiumAccess`, `revenueCatWebhook`, ștergerea RevenueCat și retry-ul) sunt feature-gated și nu sunt exportate/deployate până când există proiectul, produsele și secretele RevenueCat reale; nu folosim secrete placeholder.
- Publicat: `store:false`, refund idempotent pentru cotele zilnice la eșec, plafon global implicit de 300/zi, gardă Firestore de 840 KB, kill switch privat și circuit breaker.
- `initializeFeedbackTriage`: publicat ca trigger Eventarc; o raportare reală a primit `status`, `severity` și `expiresAt`, cu răspuns HTTP 200 în logurile serviciului.
- App Check funcționează cu debug provider în development. Pentru `production-apk`, clientul folosește explicit providerul `none`, nu livrează token debug, iar enforcement-ul callable este temporar dezactivat; Play Integrity și enforcement-ul revin simultan după Play App Signing.
- Test live după hardening: App Check valid, analiză `ready`, lecție temporară creată și ștearsă complet prin `deleteMyData`.
- Development buildul curent are tokenul debug înregistrat exclusiv în consola Firebase; process-kill → cold reopen → retry cu același `requestId` a produs o lecție validă, apoi cleanupul local a lăsat zero fișiere temporare.
- Contractul Gemini Structured Outputs este compact și fără uniuni vizuale incompatibile; payloadul vizual intermediar este normalizat și validat strict înainte de randare sau Firestore. Titlurile identifică exercițiul concret, iar schema/randarea extinsă acoperă conținut simbolic și vizual fără logică pe capitole. Suita backend trece 58/58.
- Deploy-ul comercial țintit din 25 august 2026 a publicat 4 funcții cu 0 erori și a acordat acces la secret numai runtime-urilor `profu-ai-runtime` și `profu-data-runtime`. Proba AI end-to-end și fluxurile nedistructive de cont pe această revizie rămân de executat pe telefonul fizic.

## IAM

- Funcțiile folosesc trei conturi de serviciu dedicate în funcție de sarcină: `profu-ai-runtime`, `profu-data-runtime` și `profu-cleanup-runtime`.
- `profu-data-runtime` are `roles/datastore.user`, `roles/eventarc.eventReceiver` și rolul personalizat minim cu exact `firebaseauth.users.get/delete`; nu are `Editor` sau Firebase Admin. Accesul la secretele RevenueCat se acordă numai când endpointurile Premium sunt activate.
- Numai `profu-ai-runtime` poate citi secretul `GEMINI_API_KEY`.
- Contul Compute implicit nu mai are `Editor`; are numai `roles/run.builder`, verificat printr-un build și deploy real cu 3 funcții și 0 erori.
- Jobul Scheduler folosește OIDC cu `profu-cleanup-runtime`; rularea live a terminat cu HTTP 200 și `Expired data cleaned`.
- Rolurile implicite `Editor` rămase pe service agent-ul Google APIs și contul App Engine trebuie evaluate cu IAM Recommender înainte de eliminare; nu sunt folosite ca runtime de funcții.
- Cloud Monitoring nu are încă politici de alertare configurate.
- `profu-data-runtime` are `roles/eventarc.eventReceiver`; invocarea publică a webhook-ului trebuie limitată logic de Authorization + HMAC, iar celelalte callables rămân protejate de Auth și controalele comerciale server-side. App Check se adaugă înapoi odată cu Play Integrity.

## Storage și fotografii

- Aplicația nu folosește Cloud Storage în v1 pentru fotografiile problemelor.
- `storage.rules` refuză toate operațiile, dar nu a fost publicat deoarece proiectul nu are încă un bucket implicit creat.
- Fotografiile sunt transmise în memorie pentru analiză și nu sunt salvate în Caiet sau Firebase Storage. Logurile limitate ale furnizorului AI sunt descrise în politica legală.

## Retenție și Hosting

- Lecții/cache nesalvate: 7 zile; contoare zilnice și rezervări: 35 zile; profil comercial minim, entitlement/evenimente tehnice și Caiet: aproximativ 13 luni; raportări: 180 de zile. Câmpul de expirare al raportărilor este adăugat server-side de triggerul publicat.
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
