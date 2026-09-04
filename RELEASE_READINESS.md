# Profu’ de mate — starea pregătirii pentru lansare

**Actualizat:** 2 septembrie 2026  
**Pachet Android:** `ro.profudemate.app`  
**Publisher:** Daniel Matei, persoană fizică  
**Verdict:** APK-ul de producție pentru testare reală este construit și verificat tehnic, dar aplicația **nu este încă pregătită pentru publicare în Google Play**.

## Legendă

- ✅ **Gata și verificat** — există implementare și dovadă automată sau deploy reușit.
- 🟡 **În lucru / verificare externă** — codul este pregătit, dar depinde de testare reală ori de un serviciu extern.
- ⬜ **De făcut** — necesar înainte de lansare.
- ⛔ **Blochează lansarea** — aplicația nu intră în producție până la rezolvare.

## Rezumat executiv

| Domeniu | Stare | Dovadă / pas următor |
|---|---:|---|
| Arhitectură Expo + Android | ✅ | Expo SDK 57, React Native 0.86, Node 22, Android API 36; `expo install --check` și Expo Doctor trec. |
| APK de producție pentru testare | ✅ | EAS build `6f2c516b-8154-4538-aad4-5f8fe4a57193`: `1.0.0 (11)`, target SDK 36, semnătură v2 validă. [Descarcă APK-ul](https://expo.dev/artifacts/eas/s1DfFX2ZX-1ltX80PASV9j6PjMNLBcy1iheIx7_wRDo.apk). |
| Backend Firebase | ✅ | 11 funcții Gen 2, reguli și indexuri Firestore și Hosting publicate fără erori. |
| Calitate automată | ✅ | TypeScript, ESLint, testele mobile, Functions, reguli și integrare trec. |
| Flux guest / Google / cotă | 🟡 | 5 probleme de bun-venit fără cont și 5/zi cu Google; tranzacțiile sunt testate, iar protecția guest după reinstalare se închide prin Play Integrity Device Recall. |
| Ștergerea datelor | ✅ | Ștergere din aplicație și pagină web publică; legăturile reversibile sunt eliminate, cota antifraudă nu este resetată. |
| Politici și contacte | 🟡 | Textele și paginile există; este necesară verificarea juridică finală înainte de Play. |
| Play Console | 🟡 | Cont creat; verificarea identității este în curs. Restul pașilor sunt enumerați mai jos. |
| Furnizor AI pentru utilizatori 13+ | ⛔ | Gemini rămâne temporar pentru testare; termenii actuali trebuie înlocuiți printr-un furnizor/contract compatibil înainte de lansare. |
| Plăți Premium | ⬜ | Arhitectura este pregătită și ținută dezactivată; produsele Play și RevenueCat se configurează după crearea aplicației în Play Console. |
| Testare în lumea reală | ⬜ | APK pe mai multe telefoane, rețele slabe, font 200%, cameră/galerie/crop, login/logout/reinstalare și set matematic de referință. |

### Ultimul APK verificat

- ✅ **Versiune:** `1.0.0 (11)`; profil EAS `production-apk`; distribuție internă.
- ✅ **Pachet:** `ro.profudemate.app`; `minSdk 24`; `targetSdk 36`; `compileSdk 36`.
- ✅ **Integritate:** semnătura APK Signature Scheme v2 este validă.
- ✅ **Artefact:** 121,08 MiB; SHA-256 `0D3650EC52793ADDD921E9D5402EC9E2C8FBD1D7652E03A3ED7C5DF0D30C7C54`.
- ✅ **Instalare:** [descarcă APK-ul de producție](https://expo.dev/artifacts/eas/s1DfFX2ZX-1ltX80PASV9j6PjMNLBcy1iheIx7_wRDo.apk) — linkul Expo expiră la 16 septembrie 2026; nu este linkul final din Google Play.
- 🟡 **Acceptanță:** buildul este valid tehnic; testarea funcțională pe dispozitive reale rămâne obligatorie.

## 1. Ce este deja făcut

### Aplicație și experiență

- ✅ Interfață Android în română, cameră, galerie, crop, rezolvare, verificare și Caiet.
- ✅ Layout-uri responsive și suport pentru fontul sistemului până la 200%, inclusiv documentele matematice din WebView.
- ✅ Randare structurată pentru formule, pași, explicații și rezultate; schema respinge sau repară ieșirile nevalide înainte de salvare.
- ✅ Reluarea unei analize aflate în lucru după închiderea aplicației, fără consum dublu.
- ✅ Imaginile sunt procesate temporar și nu sunt salvate în Firebase Storage ori în Caiet.
- ✅ Splash nativ și scenă React cu fundal comun; icon, adaptive icon și resurse de brand configurate.

### Cont, cotă și date

- ✅ Utilizatorul poate începe ca guest fără ecran obligatoriu de login și primește 5 probleme de bun-venit pentru instalarea curentă.
- ✅ Conectarea Google unește controlat datele guest cu identitatea contului.
- ✅ După conectarea Google, utilizatorul primește 5 probleme gratuite în fiecare zi; cota este legată de cont și decisă pe server.
- ✅ Logout-ul și rotația UID-ului anonim nu reactivează problemele guest pe aceeași instalare.
- 🟡 Într-un APK instalat direct, dezinstalarea poate șterge identitatea locală guest. Blocarea aceleiași oferte după reinstalare devine sigură numai după distribuția Play și activarea `Play Integrity Device Recall`; până atunci limităm costul server-side și nu pretindem contrariul.
- ✅ Operațiile comerciale sunt tranzacționale și idempotente; o cerere repetată nu consumă din nou.
- ✅ Lecțiile și feedbackul aparțin utilizatorului autentificat și sunt protejate prin reguli Firestore.
- ✅ Feedbackul este trimis prin callable securizat și limitat la 8 raportări/oră, nu scris direct de client.
- ✅ Ștergerea contului elimină lecțiile, feedbackul, stările de analiză și legăturile comerciale reversibile.

### Infrastructură și siguranță

- ✅ Firebase Functions Gen 2 rulează pe Node 22 în `europe-west1`, cu limite de instanțe și timeout-uri explicite.
- ✅ Firestore rules/indexes și paginile Hosting sunt publicate.
- ✅ Cheile furnizorului AI și secretele comerciale rămân server-side; bundle-ul client este verificat să nu le conțină.
- ✅ Permisiunile Android sunt reduse la cameră și billing; locația, microfonul, reclame/AD_ID și accesul larg la galerie sunt blocate.
- ✅ Backup-ul Android este dezactivat, traficul HTTP clar este interzis, release-ul este minificat.
- ✅ Crashlytics este implicit oprit și poate fi activat numai prin alegerea utilizatorului.
- ✅ Site public securizat prin CSP, HSTS, `nosniff`, `DENY` pentru framing și politică restrictivă de permisiuni.
- ✅ Firebase Storage a fost scos din configurație: aplicația nu îl folosește și un deploy normal nu mai încearcă să creeze/publice un bucket inutil.

### Calitate și reproducibilitate

- ✅ Versiunile Expo sunt aliniate oficial cu SDK 57, iar lockfile-urile sunt actualizate.
- ✅ Node `22.20.0` este fixat în EAS și `.nvmrc`; npm are interval explicit.
- ✅ Comandă unică de verificare: `npm run check`.
- ✅ Comandă unică de deploy backend: `npm run deploy:firebase`.
- ✅ CI rulează verificările tehnice și juridice fără a ascunde eșecurile.
- ✅ Nu există vulnerabilități `high` sau `critical` în dependențele runtime; avertismentele moderate tranzitive nu justifică downgrade-uri incompatibile sau `npm audit --force`.

## 2. Ce trebuie făcut înainte de Google Play

### A. Cont Play Console — Daniel

- 🟡 Așteaptă aprobarea documentelor de identitate deja încărcate.
- ⬜ Verifică numărul de telefon când opțiunea devine disponibilă.
- ⬜ Finalizează verificarea accesului la un dispozitiv Android dacă Play Console o mai solicită.
- ⬜ Creează aplicația **Profu’ de mate**, limba implicită română, tip aplicație, categorie Educație, distribuție gratuită inițial.
- ⬜ Activează Play App Signing și păstrează separat certificatul upload key.
- ⬜ Adaugă SHA-1/SHA-256 ale cheii Play App Signing în Firebase și în configurația Google Sign-In.

> Pentru conturile personale noi, Google cere în prezent un closed test cu minimum 12 testeri înscriși continuu timp de 14 zile înainte de solicitarea accesului la producție. Planificăm această perioadă, nu o descoperim la final: [cerința oficială](https://support.google.com/googleplay/android-developer/answer/14151465?hl=ro).

### B. Furnizorul AI — blocant

- ⛔ Nu publica versiunea destinată utilizatorilor de 13–17 ani cât timp analiza folosește Gemini Developer API în forma actuală.
- ⬜ Alege un furnizor și un contract ale cărui condiții permit explicit produsul și grupa de vârstă.
- ⬜ Implementează furnizorul prin adaptorul server-side existent, fără cheie în aplicație.
- ⬜ Rulează întregul corpus matematic de referință și teste comparative înainte de schimbare.
- ⬜ Actualizează politica de confidențialitate, termenii, Data Safety și textul din aplicație cu furnizorul real.

Gemini este păstrat doar pentru dezvoltare până la decizie. Blocajul provine din [termenii actuali ai Gemini API](https://ai.google.dev/gemini-api/terms), nu dintr-o limitare tehnică a aplicației.

### C. Premium și plăți

- ⬜ Decide oferta finală: 5 utilizări gratuite/zi și Premium, cu limite de utilizare rezonabilă definite server-side.
- ⬜ Creează abonamentele în Play Console, perioadele, prețurile în RON și eventual trial-ul.
- ⬜ Creează proiectul RevenueCat, entitlement-ul `premium`, offering-ul și produsele Android legate de Play.
- ⬜ Configurează secretele și webhookul semnat; abia apoi activează `PROFU_ENABLE_REVENUECAT=true` și publică endpointurile comerciale.
- ⬜ Testează cumpărare, confirmare, pending, anulare, expirare, grace period, account hold, restore, refund, offline și schimbarea contului Google.
- ⬜ Confirmă că ștergerea contului nu anulează abonamentul Play și că interfața explică separat ambele acțiuni.
- ⬜ Adaugă și verifică adresa publică impusă de Google pentru un publisher care monetizează.

### D. App Check și build-ul Play

- 🟡 APK-ul direct folosește temporar `App Check = none`; are autentificare, cote și protecții de cost, dar nu este canalul final Play.
- ⬜ După crearea aplicației în Play Console, configurează Play Integrity în Firebase App Check.
- ⬜ Înregistrează semnătura Play, verifică tokenul pe dispozitive reale și schimbă backendul în etapa `play` cu enforcement activ.
- ⬜ Generează AAB-ul `production` numai după testele de integritate și login cu semnătura Play.

### E. Declarații, pagini și conținut Play

- ✅ Contacte create: `support@danielmatei.dev`, `privacy@danielmatei.dev`, `billing@danielmatei.dev`.
- ✅ Pagini publice actuale: [prezentare](https://profu-de-mate-danmat88.web.app), [confidențialitate](https://profu-de-mate-danmat88.web.app/confidentialitate), [termeni](https://profu-de-mate-danmat88.web.app/termeni), [ștergere date](https://profu-de-mate-danmat88.web.app/stergere-date).
- ⬜ Leagă domeniul `danielmatei.dev` sau un subdomeniu stabil la paginile publice și configurează emailurile să primească și să răspundă.
- ⬜ Revizie juridică finală pentru România/UE, minori 13+, GDPR, retenție și furnizorii efectivi.
- ⬜ Completează Data Safety după comportamentul build-ului final, nu după intenții. Google cere formularul și politica de confidențialitate: [cerința oficială](https://support.google.com/googleplay/android-developer/answer/10787469?hl=ro).
- ⬜ Completează Target audience and content, Content rating, Ads = No, App access și politica privind copiii/minorii conform publicului real.
- ⬜ Verifică fluxul de ștergere în aplicație și URL-ul extern cerut pentru aplicațiile cu cont: [cerința oficială](https://support.google.com/googleplay/android-developer/answer/10144311?hl=ro).
- ⬜ Pregătește iconul 512×512, feature graphic 1024×500, capturi reale pentru telefon, descrierea scurtă/lungă în română și emailul de suport.

### F. QA obligatoriu pe versiunea finală

- ⬜ Instalează APK-ul de producție pe minimum trei telefoane Android cu dimensiuni și versiuni diferite.
- ⬜ Testează cold start, warm start, revenire din background și proces omorât de Android.
- ⬜ Testează cameră, galerie, permisiune refuzată/revocată, crop, rotire EXIF, imagini foarte mari, neclare și fără matematică.
- ⬜ Testează font 100%, 130%, 170% și 200%, display size mare, gesturi și TalkBack.
- ⬜ Testează offline, rețea lentă, timeout, retry, funcție indisponibilă și reluarea analizei fără consum dublu.
- ⬜ Testează guest → Google, logout → guest, reinstalare, ștergere date, ștergere cont și același cont pe două telefoane.
- ⬜ Rulează un corpus versionat pentru aritmetică, algebră, geometrie, trigonometrie, analiză, probabilități/statistică, tabele și probleme cu text.
- ⬜ Verifică randarea fiecărui rezultat, nu doar răspunsul AI: formule inline/display, fracții, radicali, sisteme, matrici, unități și explicații în română.
- ⬜ Urmărește crash-free sessions, erori callable, latență p50/p95, consum AI și rata de rezultate invalide pe un grup beta.

## 3. Ordinea corectă de execuție

1. ✅ Stabilizează arhitectura, dependențele, backendul, datele și testele automate.
2. 🟡 APK-ul de producție direct este generat și verificat tehnic; finalizează testarea pe dispozitive reale fără a-l confunda cu release-ul Play.
3. 🟡 Finalizează verificările contului Play și creează aplicația/listingul.
4. ⬜ Înlocuiește/contractează furnizorul AI compatibil cu 13+ și revalidează corpusul matematic.
5. ⬜ Configurează produsele Play + RevenueCat și testează toate stările de abonament.
6. ⬜ Activează Play Integrity/App Check cu semnătura Play.
7. ⬜ Închide textele legale și declarațiile Play pe baza build-ului final.
8. ⬜ Rulează QA complet și repară orice problemă; repetă până nu mai există defecte blocante.
9. ⬜ Publică AAB în closed testing; menține minimum 12 testeri timp de 14 zile.
10. ⬜ Solicită acces la producție și lansează gradual, cu monitorizare și posibilitate de oprire.

## 4. Comenzi de acceptanță

```powershell
npm ci
npm --prefix functions ci
npm run check
npm run functions:test
npm run test:mobile
npm run test:rules
npm run legal:check
npm run release:bundle-check
```

Deploy-ul backendului se face numai după trecerea verificărilor:

```powershell
npm run deploy:firebase
```

APK-ul de testare se construiește cu profilul `production-apk`; AAB-ul pentru Play se construiește mai târziu cu profilul `production`, după închiderea tuturor blocajelor.

## 5. Regula de lansare

Aplicația este „gata pentru Play” numai când toate elementele ⛔, 🟡 și ⬜ din secțiunile blocante au devenit ✅ și există dovezi: teste automate, testare pe dispozitive reale, configurare Play/RevenueCat/App Check și declarații juridice concordante cu build-ul livrat. Un build reușit singur nu înseamnă produs pregătit de lansare.
