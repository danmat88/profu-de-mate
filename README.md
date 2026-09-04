# Profu’ de mate

Aplicație Android în limba română pentru rezolvarea și verificarea, pas cu pas, a unei probleme de matematică fotografiate. Proiectul este într-o etapă beta tehnică și **nu este încă pregătit pentru publicare în Google Play**.

## Începe de aici

[Deschide dashboardul complet de audit și lansare](./RELEASE_DASHBOARD.html)


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

Toate comenzile trebuie să se încheie fără eroare înainte de commit sau build. Pentru publicarea infrastructurii Firebase se folosește `npm run deploy:firebase`; comanda publică numai Functions, regulile/indexurile Firestore și Hosting, deoarece aplicația nu folosește Firebase Storage.

## Fișiere care nu intră în Git

Nu se publică `.env`, `.env.local`, `functions/.env*`, `google-services.json`, chei de semnare, tokenuri App Check, APK/AAB sau foldere native generate (`android/`, `ios/`). Exemplele din `.env.example` conțin numai numele variabilelor.
