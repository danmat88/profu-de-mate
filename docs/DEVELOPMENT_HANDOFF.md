# Handoff pentru dezvoltare — Profu’ de mate

Ultima actualizare: 25 august 2026
Branch de lucru: `main`
Repository: `https://github.com/danmat88/profu-de-mate.git`
Firebase: `profu-de-mate-danmat88`
EAS project ID: `787d3089-788a-4b3f-b4dd-9096a08a1ea2`
Android package: `ro.profudemate.app`

Acest document este punctul de pornire pe un laptop nou. Nu conține secrete și nu înlocuiește `docs/MASTER_ROADMAP.md`, care rămâne sursa principală pentru starea produsului.

## 1. Starea exactă la handoff

### Repository și client Android

- Expo SDK 57, React Native 0.86, TypeScript și Android-only sunt configurate.
- Guest, Google Sign-In opțional, cota comercială, paywall-ul feature-gated, ștergerea datelor și recuperarea Caietului sunt implementate în repository.
- APK-ul local de development a fost construit pe 25 august 2026 pentru `arm64-v8a`, `armeabi-v7a`, `x86` și `x86_64`, instalat pe Xiaomi `25078RA3EE` și deschis până la Home fără crash.
- Certificatul debug al laptopului vechi a fost înregistrat în Firebase:
  - SHA-1: `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`
  - SHA-256: `FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C`
- APK-ul și folderul `android/` sunt generate local și nu intră în Git.
- Cota EAS Android gratuită era epuizată la handoff; resetarea afișată de EAS este 1 septembrie 2026. Nu există un build EAS nou pentru această revizie.

### Backend publicat

- Cele 9 Firebase Functions necesare fluxului actual sunt `ACTIVE`, inclusiv `analyzeMathImage`, `getCommercialAccess`, `claimGuestWelcome`, `prepareAccountMerge`, `completeAccountMergeWithGoogle`, `prepareAccountLogout`, `deleteMyData`, retenția și trierea feedbackului.
- Firestore Rules și indexurile necesare sunt publicate.
- App Check este activ în development prin debug provider; producția rămâne blocată până la Play App Signing și Play Integrity.
- Secretul Gemini și secretul HMAC comercial sunt în Google Secret Manager. Nu se copiază pe laptop și nu intră în EAS sau Git.
- Endpointurile RevenueCat sunt intenționat feature-gated până când există Play Console, produsele și secretele reale.

### Ultimele verificări trecute

- Functions: 56/56.
- Logică mobilă/configurație: 53/53.
- Firestore Rules: 8/8.
- Integrare comercială Firestore: 9/9.
- TypeScript: trece.
- Expo Doctor: 21/21.
- APK local: semnătură validă, minSdk 24, targetSdk 36, toate cele patru ABI-uri.

## 2. Ce nu poate fi recuperat din Git

Următoarele sunt intenționat ignorate și trebuie restaurate sau regenerate:

| Element | Cum se recuperează | Observație |
|---|---|---|
| `.env.local` | `npm run env:sync:development` | Necesită autentificare EAS și acces la proiect. |
| `google-services.json` | Firebase Console → Project settings → aplicația Android `ro.profudemate.app` | Descarcă-l din nou după adăugarea SHA-urilor laptopului nou. |
| Token App Check debug | Mediul EAS `development` | Nu îl copia în documente, loguri sau Git. |
| Cheia debug Android | Se generează la prebuild/local Gradle sau se transferă privat | O cheie nouă produce SHA-uri noi și nu poate actualiza APK-ul semnat cu vechea cheie. |
| Secrete Functions | Google Secret Manager | Nu sunt necesare local pentru client și nu se exportă. |
| Login EAS/Firebase/GitHub | Autentificare separată pe laptopul nou | Nu copia directoarele de credentiale în repository. |

Nu copia prin Git `.env*`, `google-services.json`, `android/`, `*.jks`, APK/AAB sau capturi de diagnostic.

## 3. Pregătirea laptopului nou

### Cerințe

- Git.
- Node.js 22 LTS și npm.
- JDK 17 pentru build Android local.
- Android Studio/Android SDK, Build Tools 36 și Platform Tools dacă vei construi local sau folosi ADB.
- Telefonul și laptopul în aceeași rețea pentru Expo LAN; cablul USB este opțional.

### Clonare și dependențe

```powershell
git clone https://github.com/danmat88/profu-de-mate.git
cd profu-de-mate
npm ci
npm --prefix functions ci
```

Folosește `npm ci`, nu `npm install`, pentru a respecta exact lockfile-urile comise.

### Autentificare în serviciile de dezvoltare

```powershell
npx --yes eas-cli@22.2.0 login
npx firebase-tools login
npx --yes eas-cli@22.2.0 whoami
npx firebase-tools projects:list
```

Contul EAS trebuie să vadă proiectul `matdan88/profu-de-mate`, iar Firebase CLI trebuie să vadă `profu-de-mate-danmat88`.

### Restaurarea mediului privat

```powershell
npm run env:sync:development
```

Apoi descarcă în rădăcina proiectului versiunea actuală `google-services.json` pentru aplicația Android. Validează fără a afișa valorile:

```powershell
npm run env:check:development
```

Dacă validarea raportează lipsa `google-services.json`, nu ocoli controlul și nu pune configurația în Git.

## 4. Pornirea zilnică pe telefon

În rădăcina proiectului:

```powershell
npm start
```

Această comandă sincronizează din nou mediul EAS development, validează contractul și pornește Metro cu `--dev-client --lan`.

Pe telefon:

1. deschide development buildul „Profu’ de mate”;
2. alege serverul LAN detectat;
3. dacă nu apare, introdu `http://IP-UL-LAPTOPULUI:8081?platform=android`;
4. la primul bundle după un clone/prebuild, ecranul nativ poate rămâne vizibil aproximativ 1–2 minute cât Metro compilează. Verifică activitatea Metro înainte să închizi aplicația.

Cu USB disponibil, verifică și redirecționează portul:

```powershell
adb devices -l
adb reverse tcp:8081 tcp:8081
```

Nu folosi Expo Go pentru acest proiect: Google Sign-In, Firebase native, SecureStore, App Check și RevenueCat cer development build.

## 5. Construirea unui development APK

### Varianta recomandată — EAS

Păstrează aceeași semnătură EAS și evită reînregistrarea certificatului:

```powershell
npx --yes eas-cli@22.2.0 build --platform android --profile development
```

La data handoffului, cota gratuită Android este blocată până la resetarea din 1 septembrie 2026 sau schimbarea planului EAS.

### Varianta locală

```powershell
npx expo prebuild --platform android --no-install
cd android
.\gradlew.bat app:assembleDebug
```

Artefactul rezultat este `android/app/build/outputs/apk/debug/app-debug.apk`.

Pe laptopul nou, Gradle poate genera alt `android/app/debug.keystore`. Înainte să testezi Google Sign-In:

```powershell
keytool -list -v -alias androiddebugkey -keystore android/app/debug.keystore -storepass android -keypass android
```

Adaugă SHA-1 și SHA-256 în Firebase Console, apoi descarcă din nou `google-services.json`. Dacă păstrezi APK-ul vechi pe telefon și cheia diferă, Android va refuza update-ul; dezinstalează buildul vechi sau transferă cheia veche numai printr-un canal privat și securizat.

Instalare prin ADB:

```powershell
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

## 6. Verificarea clone-ului înainte de modificări

Rulează în această ordine:

```powershell
npm run check
npm run functions:test
npm run test:mobile
npm run test:rules
```

Rezultatul așteptat la handoff este 56/56 Functions, 53/53 mobile, 8/8 Rules, 9/9 integrare Firestore și Expo Doctor 21/21.

`npm run legal:check` rămâne intenționat blocant până la completarea identității legale; nu este o eroare tehnică de clone.

## 7. Următoarea ordine concretă de lucru

Nu începe Premium sau Play Store înaintea validării fluxului gratuit actual.

### P0 — validează pe buildul nou Guest + Google

- [ ] Guest nou: 5/5; un rezultat `ready` devine 4/5; `not_math`, `unclear`, timeout și eroare nu consumă.
- [ ] Închidere, process-kill și restart: identitatea instalării și contorul rămân neschimbate.
- [ ] Google Sign-In pe APK-ul nou: conectarea reușește și păstrează Caietul/consumul fără bonus.
- [ ] Logout: serverul sigilează instalarea înainte de logout; spațiul guest rezultat nu primește alt 5/5.
- [ ] Același Google după ștergerea datelor/reinstalare recuperează cota zilei și Caietul.
- [ ] Ștergerea definitivă cere autentificare Google recentă și nu reface 5/5 în aceeași zi.
- [ ] Rulează o analiză reală din Cameră și una din Galerie pe Functions publicate; verifică și refundul la eșec.

### P1 — închide calitatea produsului actual

- [ ] Completează matricea fizică P0: permisiuni, crop, Back/predictive back, offline, rețea lentă, timeout, raportare și ștergere.
- [ ] Verifică 412×915 dp, minimum 600 dp, landscape, notch, gesture nav și navigație cu trei butoane.
- [ ] Testează TalkBack și Reduce animations pe toate modalele și formulele.
- [ ] Adaugă teste de componente/E2E și regresie vizuală pentru fluxurile principale.
- [ ] Construiește corpusul anonim de minimum 200 de fotografii și stabilește pragurile reale de acuratețe.
- [ ] Adaugă verificare matematică deterministă/CAS acolo unde este realist.

### P2 — operațiuni și cost

- [ ] Alege bugetul lunar și adresa de alertare.
- [ ] Configurează alertele pentru cost, 5xx, P95 latency, quota, cleanup și feedback cu severitate mare.
- [ ] Revizuiește recomandările IAM pentru identitățile implicite Google APIs/App Engine.
- [ ] Măsoară cold start, FPS, rerandări și latența reală a analizelor.

### P3 — Premium și Play, după ce P0/P1 sunt stabile

- [ ] Creează și verifică Play Console personal.
- [ ] Creează aplicația, Play App Signing și primul track intern.
- [ ] Creează abonamentul lunar/anual în Google Play.
- [ ] Configurează RevenueCat, entitlement-ul `premium`, offering-ul, secretele și webhook-ul.
- [ ] Testează purchase, restore, renewal, cancel, expiration, refund și transfer din Google Play.
- [ ] Activează App Check Play Integrity și apoi Device Recall în `monitor`; `enforce` numai după rezultate reale.

### P4 — legal și release

- [ ] Completează numele legal, adresa publisherului și verifică `info@danielmatei.dev`.
- [ ] Obține review-ul juridic pentru GDPR, 13–15 ani și furnizorul AI.
- [ ] Înlocuiește/confirmă furnizorul AI compatibil contractual înainte de publicare.
- [ ] Publică Hosting numai după trecerea gate-ului legal.
- [ ] Construiește AAB-ul final, verifică permisiuni, secrete, 16 KB page size și Play pre-launch report.
- [ ] Rulează internal testing, apoi closed testing și staged rollout conform cerințelor contului.

Detaliile și checkboxurile canonice rămân în `docs/MASTER_ROADMAP.md`, `docs/PRODUCTION_CHECKLIST.md` și `docs/release/TEST_MATRIX.md`.

## 8. Regula de final de sesiune

Înainte să schimbi laptopul sau să închizi o etapă:

```powershell
git status --short
npm run check
npm run functions:test
npm run test:mobile
npm run test:rules
git add -A
git diff --cached --check
git diff --cached --stat
git commit -m "mesaj clar"
git push origin main
```

După push, verifică `git status --short` gol și faptul că `origin/main` indică același commit local. Nu include niciodată fișierele private enumerate la secțiunea 2.
