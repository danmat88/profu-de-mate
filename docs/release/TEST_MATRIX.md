# Matrice de testare înainte de release

Ultima actualizare: 22 august 2026

## Gate automat existent

| Suită | Comandă | Stare curentă |
|---|---|---|
| TypeScript + compatibilitate Expo | `npm run check` | 21/21 Expo Doctor, trece |
| Backend/schemă/randare matematică | `npm run functions:test` | 9/9, trece |
| Firestore Rules | `npm run test:rules` | 7/7, trece |

## Dispozitive și layout

| Caz | Cerință | Stare |
|---|---|---|
| Telefon fizic curent | Xiaomi 25078RA3EE, Android 15, 720 × 1600, densitate 320 | Testat fluxul principal |
| Android mic | aprox. 360 × 640 dp | De testat |
| Android mediu | aprox. 360 × 800 dp | Testat parțial pe telefonul curent |
| Android mare | aprox. 412 × 915 dp | De testat |
| Tabletă/landscape | decizie de suport și layout controlat | De decis/testat |
| Font sistem | 100%, 130%, 200% | De testat |
| TalkBack | ordine focus, etichete, modale, formule, acțiuni crop | De testat manual |
| Reduce animations | fără loops/tranziții decorative | Implementat; de confirmat manual |
| Dark mode/contrast | aplicația păstrează tema proprie și contrastul | De auditat |

## Fluxuri P0

- [ ] Instalare curată → splash → Acasă fără flash alb.
- [ ] Permisiune cameră acceptată, refuzată și „Nu mai întreba”; revenire din Setări.
- [ ] Cameră indisponibilă/onMountError și retry.
- [ ] Galerie anulată, imagine invalidă, imagine foarte mare și revenire din Photo Picker.
- [ ] Crop: mutare, toate cele 4 colțuri, rotire, reset, anulare și eroare de fișier.
- [ ] Rezolvă: problemă validă, non-matematică, poză neclară, timeout, offline și retry.
- [ ] Verifică: corect, parțial corect, greșit și rezolvare incompletă.
- [ ] Lecție: fiecare pas, enunț expandat, explicație alternativă, formule lungi și scroll controlat.
- [ ] Caiet: salvează, scoate, listă goală, căutare, filtre, offline cache și reconectare fără flash.
- [ ] Raportare: toate categoriile, eroare offline și succes.
- [ ] Ștergere totală: anulare, succes, eroare și confirmarea că UID-ul/data au dispărut.
- [ ] Lansare forțată cu o eroare de randare: fallbackul global apare și „Reîncearcă” remontează aplicația.

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

- [ ] `production` AAB construit cu EAS CLI compatibil (`>=22.2.0`).
- [ ] AAB analizat pentru permisiuni, trackere și secret leakage.
- [ ] Target/compile API 36 confirmat din artefact.
- [ ] Compatibilitate 16 KB page size confirmată.
- [ ] Play pre-launch report fără P0/P1.
- [ ] App Check Play Integrity confirmat pe artefactul distribuit de Play.
- [ ] Internal testing, apoi minimum 12 testeri/14 zile în closed testing dacă se aplică noului cont personal.
