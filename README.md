# Profu’ de mate

Aplicație Android în limba română pentru rezolvarea și verificarea, pas cu pas, a unei probleme de matematică fotografiate. Proiectul este într-o etapă beta tehnică și **nu este încă pregătit pentru publicare în Google Play**.

## Începe de aici

- [Handoff pentru dezvoltare](docs/DEVELOPMENT_HANDOFF.md) — clonare pe alt laptop, mediu privat, telefon, build și depanare.
- [Master Roadmap](docs/MASTER_ROADMAP.md) — sursa principală pentru ce este finalizat și ce mai trebuie făcut.
- [Sistem comercial](docs/COMMERCIAL_SYSTEM.md) — contractul Guest, Google Gratuit și Premium.
- [Starea Firebase](docs/FIREBASE_STATUS.md) — infrastructura publicată și acțiunile externe rămase.
- [Checklist de producție](docs/PRODUCTION_CHECKLIST.md) — gate-ul pentru Play Store.
- [Matrice de testare](docs/release/TEST_MATRIX.md) — QA automat și fizic înainte de release.

## Pornire rapidă după configurarea laptopului

```powershell
npm ci
npm --prefix functions ci
npx --yes eas-cli@22.2.0 login
npx firebase-tools login
npm start
```

`npm start` descarcă mediul EAS `development` în `.env.local`, îl validează și pornește Expo Dev Client în LAN. Este necesar și `google-services.json`, restaurat privat conform documentului de handoff.

## Verificări înainte de commit

```powershell
npm run check
npm run functions:test
npm run test:mobile
npm run test:rules
npm run legal:check
```

Ultima comandă poate rămâne blocată intenționat până când publisherul completează identitatea legală și contactele publice. Nu se forțează publicarea Hosting sau Play Store cât timp gate-urile juridice și de release sunt deschise.

## Fișiere care nu intră în Git

Nu se publică `.env`, `.env.local`, `functions/.env*`, `google-services.json`, chei de semnare, tokenuri App Check, APK/AAB sau foldere native generate (`android/`, `ios/`). Exemplele din `.env.example` conțin numai numele variabilelor.
