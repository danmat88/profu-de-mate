# Draft Google Play Data Safety — Profu’ de mate

Ultima actualizare: 25 august 2026

Acesta este un draft tehnic pentru completarea formularului din Play Console. Răspunsurile finale trebuie comparate cu formularul actual, SDK Index și traficul observat pe AAB-ul final.

## Răspunsuri generale propuse

- Aplicația colectează sau transmite în afara dispozitivului date ale utilizatorului: **Da**.
- Datele sunt criptate în tranzit: **Da**, prin HTTPS/Firebase callable; cleartext este dezactivat în release.
- Utilizatorul poate cere ștergerea datelor: **Da**, din Setări → Șterge toate datele.
- Aplicația folosește reclame sau Advertising ID: **Nu**; permisiunea `AD_ID` este blocată explicit.
- Datele sunt vândute: **Nu**.
- Partajare cu terți în sensul formularului: propunere **Nu**, dacă Firebase și Gemini sunt declarați furnizori de servicii care procesează date numai pentru funcționalitatea aplicației. Confirmarea juridică și contractuală este obligatorie.

## Categorii de date

| Categorie Play | Colectată | Obligatorie/opțională | Scop | Retenție |
|---|---:|---|---|---|
| Fotografii | Da, când utilizatorul trimite o problemă | Necesară pentru analiza aleasă | Funcționalitatea aplicației | Nu este pusă în Storage/Caiet; transmisă către Gemini și poate exista în loguri limitate de siguranță ale furnizorului conform termenilor serviciului |
| User-generated content | Da: enunțul extras, pașii și raportul ales | Necesar pentru lecție; raportul este opțional | Funcționalitate, prevenirea abuzului, suport | 7 zile nesalvat; aprox. 13 luni fără activitate în Caiet; raport maximum 180 de zile sau până la ștergerea tuturor datelor |
| Personal info — nume și e-mail | Numai dacă utilizatorul alege Google Sign-In | Opțional | Gestionarea contului, recuperarea Caietului și Premium | Până la ștergerea contului aplicației |
| User IDs | Da: Firebase UID; identificatorul Google numai după conectarea aleasă; pentru cotă este derivat un HMAC opac | Necesar pentru UID; Google opțional | Cont tehnic, securitate, sincronizare și prevenirea resetării artificiale | UID-ul și identitatea de cont până la ștergere; după ștergere, numai HMAC-ul și consumul zilei până la următoarea resetare, apoi curățare automată asincronă |
| Purchase history | Da pentru Premium: produs, stare, expirare și identificatori tehnici ai achiziției; aplicația nu primește cardul | Opțional | Achiziții, entitlement și prevenirea fraudei | Starea curentă cât timp contul există; evenimente tehnice aproximativ 13 luni |
| App interactions | Da: salvarea lecției, modul rezolvă/verifică și cota de analiză | Necesar | Funcționalitate, securitate și prevenirea fraudei | Lecții conform retenției; contoare zilnice/rezervări maximum 35 zile; profil tehnic minim maximum aproximativ 13 luni |
| Crash logs | Numai dacă utilizatorul activează Diagnosticare | Opțional | Analytics/diagnosticarea aplicației | Conform retenției Crashlytics configurate de furnizor; trebuie verificată înainte de release |
| Diagnostics | Numai dacă utilizatorul activează Diagnosticare | Opțional | Stabilitate și depanare | Conform retenției Crashlytics; fotografia nu este atașată intenționat |
| Device or other IDs | Da prin Firebase Auth/App Check/Play Integrity; Device Recall după aprobarea beta | Necesar pentru securitate | Securitate, prevenirea fraudei și funcționalitate | Conform Firebase/Google; Device Recall și retenția anti-abuz trebuie validate juridic înainte de activare |
| Adresă IP/metadate rețea | Da, automat în logurile Cloud Run | Necesar pentru transportul și protejarea serviciului | Securitate, diagnosticare și operare | Bucket-ul implicit Cloud Logging: în mod normal 30 de zile |

## Date necolectate intenționat

- Adresă poștală sau număr de telefon. Numele și e-mailul apar numai dacă utilizatorul alege conectarea Google.
- Contacte, microfon, notificări, calendar sau SMS. Aplicația nu cere permisiune de locație și nu calculează locația, dar infrastructura primește adresa IP; trebuie confirmat în formular dacă aceasta cere declararea „Approximate location”.
- Advertising ID, informații financiare, sănătate, activitate fizică sau istoricul web.
- Biblioteca completă de fotografii; Android Photo Picker oferă numai imaginea aleasă.

## Flux tehnic

1. Imaginea este aleasă/fotografiată, rotită, decupată și comprimată local.
2. Funcția callable verifică Firebase Auth și App Check.
3. Imaginea este transmisă în memorie către Gemini pentru analiză; nu este scrisă în Firebase Storage.
4. Dacă utilizatorul alege Google, Firebase păstrează identitatea furnizată, iar Caietul este legat de cont. Backendul derivă separat un HMAC stabil pentru cota zilnică, iar un bilet local criptat protejează fuziunea întreruptă.
5. Pentru Premium, Google Play procesează plata, RevenueCat validează achiziția, iar Firebase păstrează numai starea necesară accesului și cotei.
6. În Firestore se salvează numai rezultatul structurat, metadatele minime, cota și raportarea aleasă.
7. Jobul zilnic șterge datele ajunse la termen; utilizatorul poate șterge datele contului din Setări. Abonamentul Google Play și retențiile de securitate explicate în politică sunt tratate separat.

## Verificări înainte de trimitere

- [ ] Completează numele legal și e-mailul din politica publică.
- [ ] Confirmă în Play SDK Index declarațiile pentru fiecare Firebase SDK inclus.
- [ ] Confirmă declarațiile Google Sign-In, RevenueCat, Google Play Billing, Play Integrity și SecureStore din SDK Index și documentația lor curentă.
- [ ] Capturează traficul unui production AAB și compară-l cu tabelul.
- [ ] Confirmă retenția Crashlytics și termenii Gemini valabili la data lansării.
- [ ] Decide cu juristul dacă Google este exclusiv „service provider” pentru toate fluxurile.
- [ ] Verifică dacă formularul Play cere răspuns separat pentru prelucrarea efemeră a fotografiei.

Surse oficiale de verificat la fiecare release:

- https://support.google.com/googleplay/android-developer/answer/10787469
- https://firebase.google.com/support/privacy
- https://ai.google.dev/gemini-api/docs/zdr
- https://ai.google.dev/gemini-api/terms
