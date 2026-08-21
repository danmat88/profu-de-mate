# Stare Firebase — producție

Ultima verificare: 21 august 2026

## Proiect

- Project ID: `profu-de-mate-danmat88`
- Project number: `55112937994`
- Plan observat la crearea Firestore: free tier; billingul Blaze nu a fost activat.

## Firestore

- Bază: `(default)`
- Mod: Firestore Native, ediția Standard
- Locație: `eur3`
- Delete protection: activată
- Point-in-time recovery: oprit
- Realtime updates: activate
- Reguli: publicate din `firestore.rules`
- Indexuri: două indexuri `lessons`, publicate din `firestore.indexes.json`

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
- Configurația Android Firebase este stocată ca EAS file secret pentru toate cele trei medii.
- Cheia Android de dezvoltare este generată și păstrată de EAS.
- Primul development build Android a fost finalizat cu succes pe 21 august 2026.

## Authentication

- Anonymous: activat și versionat în `firebase.json`
- Google Sign-In: neactivat încă
- Phone și Email/Password: neactivate

## Storage și fotografii

- Aplicația nu folosește Cloud Storage în v1 pentru fotografiile problemelor.
- `storage.rules` refuză toate operațiile, dar nu a fost publicat deoarece proiectul nu are încă un bucket implicit creat.
- Fotografiile vor fi procesate fără retenție și nu vor fi salvate în caiet.

## Următorul prag

- Instalarea și verificarea development buildului nativ pe telefonul fizic
- Inițializarea controlată a React Native Firebase în aplicație
- App Check în mod debug pentru dezvoltare, apoi Play Integrity pentru distribuția Play
- Amprentele Play App Signing după crearea contului Play Console
- Cloud Functions/AI numai după aprobarea Blaze, bugetelor și limitelor de cost
