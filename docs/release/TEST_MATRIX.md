# Matrice de testare înainte de release

Ultima actualizare: 26 august 2026

## Gate automat existent

| Suită | Comandă | Stare curentă |
|---|---|---|
| TypeScript + compatibilitate Expo | `npm run check` | 21/21 Expo Doctor, trece |
| Backend/schemă/randare matematică | `npm run functions:test` | 58/58, trece; include identitățile comerciale stabile, recent-auth la ștergere și contractul de securitate pre-Play/Play |
| Logică mobilă, configurație Android, tipografie, lifecycle, calitatea textelor, startup și Caiet | `npm run test:mobile` | 66/66, trece; include bootstrap-ul coordonat, cache-ul comercial legat de UID, refresh-ul unic după schimbarea identității, logout-ul sigilat, reluarea analizei din Home, blocarea pickerului Galerie și recuperarea camerei |
| Contract EAS/Metro | `npm run env:check:development`, `npm run env:check:preview`, `npm run env:check:production` | toate cele trei medii trec; production interzice App Check debug |
| Firestore Rules + tranzacții comerciale | `npm run test:rules` | Rules 8/8 și integrare comercială 9/9, trec |
| Bundle JavaScript production | `npm run release:bundle-check` | trece; bundle minificat, profil production și absența tokenului App Check debug verificate |
| APK public production | audit APK/manifest/semnătură | versionCode 9, targetSdk 36, semnătură EAS production, `debuggable=false`, cleartext/backup dezactivate și fără token App Check debug |

## Dispozitive și layout

| Caz | Cerință | Stare |
|---|---|---|
| Telefon fizic curent | Xiaomi 25078RA3EE, Android 15, 720 × 1600, densitate 320 | Fluxurile P0 auditate vizual pe development build EAS |
| Android mic | aprox. 360 × 640 dp | Home și Cameră testate prin override controlat pe telefonul fizic; dispozitiv mic separat rămâne necesar |
| Android mediu | aprox. 360 × 800 dp | Testat pe dimensiunea nativă a telefonului curent |
| Android mare | aprox. 412 × 915 dp | De testat |
| Tabletă/landscape | decizie de suport și layout controlat | De decis/testat |
| Font sistem | 100% și 200% | Verificat fizic: design system-ul păstrează layout și tipografie identice; matematica are zoom propriu |
| TalkBack | ordine focus, etichete, modale, formule, acțiuni crop | De testat manual |
| Reduce animations | fără loops/tranziții decorative | Implementat; de confirmat manual |
| Dark mode/contrast | aplicația păstrează tema proprie și contrastul | De auditat |

## Fluxuri P0

- [~] Cold start pe development build → suprafață închisă → splash React → Acasă cu iconuri și `5 din 5` a fost verificat prin capturi temporizate; primul cadru nativ cu `expo.backgroundColor: #171337` trebuie confirmat pe development buildul regenerat.
- [ ] Permisiune cameră acceptată, refuzată și „Nu mai întreba”; revenire din Setări.
- [ ] Cameră indisponibilă/onMountError și retry.
- [ ] Galerie anulată, imagine invalidă, imagine foarte mare și revenire din Photo Picker.
- [ ] Crop: mutare, toate cele 4 colțuri, rotire, reset, anulare și eroare de fișier.
- [ ] Rezolvă: problemă validă, non-matematică, poză neclară, timeout, offline și retry.
- [ ] Procesare → Acasă → „Revino la analiză”: fotografia rămâne, același `requestId` livrează rezultatul și cota este consumată o singură dată.
- [ ] Verifică: corect, parțial corect, greșit și rezolvare incompletă.
- [~] Lecție: pașii, enunțul, explicația alternativă, matricea, formula lată, vizualizarea mărită și scrollul controlat sunt implementate/verificate parțial; matricea completă P0 rămâne deschisă.
- [~] Vizualuri: baseline determinist la 390 px pentru geometrie, grafic, tabel cu celule matematice și axă numerică; mai trebuie QA fizic pe telefon mic/mare și comparație automată.
- [~] Caiet: salvare, listă normală, filă goală, filtre, deschidere și sheet-ul de scoatere/anulare verificate fizic; confirmarea scoaterii, căutarea, cold start offline și reconectarea rămân deschise.
- [ ] Raportare: toate categoriile, eroare offline și succes.
- [ ] Ștergere totală: anulare, reconfirmare Google, succes, eroare și confirmarea că UID-ul/conținutul au dispărut, iar cota opacă a zilei a rămas fără UID sau request IDs.
- [ ] Lansare forțată cu o eroare de randare: fallbackul global apare și „Reîncearcă” remontează aplicația.

## Conturi și acces comercial

- [ ] Vizitator nou: 5/5, o problemă `ready` → 4/5, `not_math`/`unclear`/timeout → fără consum.
- [ ] Închidere, process-kill, restart telefon și actualizare păstrează sesiunea Google și cota.
- [ ] Vizitator cu probleme folosite → Google nou/existent: consumul se unește fără bonus.
- [ ] Același Google pe două telefoane consumă aceeași cotă zilnică; două cereri simultane nu depășesc limita.
- [ ] Deconectare: contul și Caietul rămân pe server, telefonul primește un spațiu temporar separat, reconectarea recuperează exact starea anterioară.
- [ ] 5/5 Google → o problemă `ready` → 4/5 → ștergere definitivă → același Google în aceeași zi → 4/5, nu 5/5.
- [ ] Ștergere date Android/reinstalare → reconectare Google: Caiet, Premium și cota zilei sunt recuperate.
- [ ] Device Recall pe artefact Play: un vizitator nu poate revendica din nou pachetul după reinstalare/reset; `UNEVALUATED` urmează fallbackul către Google.
- [ ] Purchase/restore/renewal/cancel/expiration/refund/transfer sunt verificate din trackul Play, inclusiv după ștergerea contului aplicației.

## Lifecycle imagini — probe fizice

- [x] Galerie → Review: există exact o copie în directorul privat controlat și zero fișiere brute în cache-urile `ImagePicker`/`ImageManipulator`.
- [x] Săgeata aplicației din Review → Acasă: copia controlată este ștearsă imediat.
- [x] Back Android din Review → launcher → redeschidere `WARM`: restul abandonat este șters la inițializare.
- [x] Cameră → Review → refotografiere/anulare: exact o copie controlată în Review, zero fișiere brute, apoi zero fișiere rămase.
- [x] Cinci rotiri consecutive → anulare: maximum original + revizia curentă, apoi zero revizii intermediare și zero fișiere după ieșirea din Review.
- [x] Aplică un crop: rămâne numai rezultatul aplicat, apoi zero fișiere la abandon; combinat cu proba de cinci rotiri confirmă că reviziile nu se acumulează.
- [x] Process-kill în Procesare → cold reopen: markerul și fotografia validă supraviețuiesc, retry-ul păstrează același `requestId`, lecția este livrată, iar ieșirea lasă zero fișiere controlate/brute și zero markere pending.

## Corpus matematic pentru benchmark

Minimum 200 de cazuri etichetate, fără date personale:

- 30 aritmetică și fracții;
- 35 algebră, ecuații, inecuații și sisteme;
- 25 funcții, grafice, limite, derivate și integrale;
- 35 geometrie plană/spațială, inclusiv desene;
- 20 trigonometrie;
- 15 probabilități și statistică;
- 15 vectori, matrici și numere complexe;
- 25 scris de mână dificil, lumină slabă, perspectivă și conținut irelevant în cadru.

Pentru fiecare caz se notează separat: OCR/enunț, rezultat final, corectitudinea fiecărui pas, calitatea explicației, LaTeX/randare, verdictul de verificare și timpul total.

## Praguri propuse pentru closed testing

- 0 crash-uri/ANR-uri reproductibile în fluxurile P0.
- 100% dintre formulele acceptate de backend se afișează fără text brut LaTeX, clipping sau schimbare de font.
- Minimum 95% enunț extras corect pe fotografii clare din domeniul declarat.
- Minimum 90% rezultat și verdict corect pe corpusul acceptat; cazurile neclare trebuie refuzate, nu ghicite.
- P95 analiză sub 20 secunde pe conexiune normală; timeoutul trebuie să fie recuperabil.
- 100% ștergere confirmată pentru datele controlate de aplicație.

## Build release

- [x] Exportul JavaScript Android în profil `production` trece și nu conține tokenul App Check debug.
- [ ] `production` AAB construit cu EAS CLI compatibil (`>=22.2.0`).
- [ ] AAB analizat pentru permisiuni, trackere și secret leakage.
- [ ] Target/compile API 36 confirmat din artefact.
- [ ] Compatibilitate 16 KB page size confirmată.
- [ ] Play pre-launch report fără P0/P1.
- [ ] App Check Play Integrity confirmat pe artefactul distribuit de Play.
- [ ] Internal testing, apoi minimum 12 testeri/14 zile în closed testing dacă se aplică noului cont personal.
