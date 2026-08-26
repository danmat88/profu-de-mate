# Profu' de mate — audit de arhitectură

Data auditului: 26 august 2026
Verdict: **fundație tehnică solidă pentru beta; aplicația nu este încă gata de publicare în Google Play.**

Acest document separă explicit trei stări:

- **verificat** — există o probă automatizată sau o inspecție directă a infrastructurii;
- **implementat** — codul există, dar mai cere probă pe artefact/dispozitiv;
- **blocat extern** — depinde de Play Console, RevenueCat, furnizorul AI ori datele publisherului.

## Arhitectura verificată

1. **Client Android:** Expo SDK 57, React Native 0.86, TypeScript strict și configurație Android-only.
2. **Identitate:** sesiune Firebase anonimă persistentă, conectare Google opțională, principal comercial stabil derivat server-side și fuziune idempotentă a Caietului.
3. **Acces comercial:** serverul rezervă tranzacțional fiecare analiză; clientul nu poate acorda probleme gratuite și cache-ul local este numai pentru afișare.
4. **Analiză AI:** Firebase Auth obligatoriu, request ID idempotent, timeout, limită per utilizator, limită de rafală, plafon global și refund tranzacțional la eșec. App Check este activ în development; APK-ul public pre-Play nu livrează un token debug și trece la Play Integrity împreună cu activarea Play App Signing.
5. **Date:** fotografia rămâne în cache-ul privat temporar și nu este urcată în Storage; lecțiile sunt create numai de backend; regulile Firestore refuză implicit orice colecție nedeclarată.
6. **Matematică:** proza și matematica au schemă structurată; formulele sunt randate server-side cu MathJax/Fira, sanitizate și afișate într-un document local fără acces la rețea.
7. **Operațiuni:** Crashlytics este opt-in, există retenție și cleanup programat, runbook de incident, kill switch AI, workflow CI și verificare reproductibilă a bundle-ului de producție.

## Dovezi curente

- TypeScript și Expo Doctor: **21/21**.
- Logică mobilă/configurație/lifecycle/startup: **66/66**.
- Functions și renderer matematic: **58/58**.
- Firestore Rules: **8/8**.
- Tranzacții comerciale în emulator: **9/9**.
- APK Android production: release minificat, semnat cu cheia EAS production, versionCode 9, targetSdk 36, patru ABI-uri și fără token App Check debug.
- Firebase live: **9 Functions Gen 2 ACTIVE** în `europe-west1`.
- Audit dependențe: **0 high / 0 critical**; advisory-urile moderate `uuid` sunt tranzitive și urmărite fără downgrade forțat incompatibil.

## Cauze structurale corectate în acest audit

- Verificarea bundle-ului production folosește acum un cache Metro izolat; nu mai poate concura cu Metro-ul de development și corupe indexul comun.
- Bootstrap-ul local are termene limită și rezultat explicit; un font, asset, cache sau marker blocat nu poate ține aplicația permanent în splash.
- Startup-ul restaurează mai întâi sesiunea Firebase și abia apoi citește snapshot-ul comercial legat de UID; nu mai există cursa care rata cache-ul și afișa contorul târziu.
- Contextul comercial este singurul proprietar al refresh-ului după conectare/deconectare; nu mai există două apeluri și două actualizări UI identice.
- Procesarea eliberează fotografia când fluxul o abandonează, dar o păstrează când utilizatorul revine la Review sau continuă analiza în fundal.

## Riscuri deschise în repository

### P0 — înaintea următorului verdict de stabilitate

- [ ] Probă fizică pe ultima revizie: cold start, warm start, offline, guest, Google, logout, reluare analiză și curățare fotografie. Telefonul nu este momentan vizibil prin ADB.
- [ ] Probă fizică pe APK-ul production versionCode 9 pentru splash-ul nativ; auditul static al artefactului a trecut.
- [ ] Înlocuirea progresivă a testelor care citesc expresii din sursă cu teste de comportament pentru componente și fluxuri, apoi E2E Android pentru traseele P0.
- [ ] Măsurători reale pentru startup, frame drops, memorie WebView și rerandările listei Caiet.

### P1 — înainte de release candidate

- [ ] Matrice fizică: 360×640, 360×800, 412×915, minimum 600 dp, cutout, gesture nav, 3-button nav și predictive back.
- [ ] Corpus anonim de minimum 200 fotografii, taxonomie a erorilor și praguri măsurate pentru OCR, rezultat, pași și verdict.
- [ ] Golden screenshots automate pentru matematică inline/display, sisteme, matrici, geometrie, grafice, tabele, axe și formule excepțional de late.
- [ ] Refactorizarea modulelor mari numai după ce fluxurile lor au teste de comportament: `NotebookScreen`, `HomeScreen`, `LaunchSplash`, `commercialAccess` și `functions/index`.
- [ ] Praguri/alerte Cloud Billing și alertă operațională pentru feedback `unsafe`.

## Blocaje externe înainte de Google Play

- [ ] Alegerea și aprobarea contractuală a furnizorului AI pentru public 13+ și EEA.
- [ ] Play Console personal, verificarea publisherului, Play App Signing și testarea închisă cerută contului.
- [ ] Produsele lunar/anual în Play Billing, proiectul RevenueCat, entitlement-ul `premium`, webhook-ul și secretele reale.
- [ ] Activarea Play Integrity și trecerea Device Recall prin `monitor` înainte de `enforce`.
- [ ] Identitatea legală completă, paginile publice finale, Data Safety și procesul extern de ștergere.
- [ ] AAB final: semnătură, permisiuni, SDK-uri, trackere, secrete, 16 KB page size și Play pre-launch report.

## Ce înseamnă „gata”

Aplicația poate fi declarată release candidate numai când toate punctele P0 sunt demonstrate pe aceeași revizie și același artefact. Poate fi declarată pregătită de publicare numai după închiderea P1 relevantă, a blocajelor externe și a auditului AAB. Niciun număr de teste unitare nu înlocuiește aceste probe.
