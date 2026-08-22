# Draft Google Play Data Safety — Profu’ de mate

Ultima actualizare: 22 august 2026

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
| User-generated content | Da: enunțul extras, pașii și raportul ales | Necesar pentru lecție; raportul este opțional | Funcționalitate, prevenirea abuzului, suport | 7 zile nesalvat; aprox. 13 luni fără activitate în Caiet; raport până la ștergerea tuturor datelor |
| User IDs | Da: Firebase UID anonim | Necesar | Cont tehnic, securitate, sincronizare | Până la ștergerea datelor/contului tehnic |
| App interactions | Da: salvarea lecției, modul rezolvă/verifică și cota de analiză | Necesar | Funcționalitate, securitate și prevenirea fraudei | Lecții conform retenției; contoare maximum 35 zile |
| Crash logs | Numai dacă utilizatorul activează Diagnosticare | Opțional | Analytics/diagnosticarea aplicației | Conform retenției Crashlytics configurate de furnizor; trebuie verificată înainte de release |
| Diagnostics | Numai dacă utilizatorul activează Diagnosticare | Opțional | Stabilitate și depanare | Conform retenției Crashlytics; fotografia nu este atașată intenționat |
| Device or other IDs | Posibil prin Firebase Auth/App Check/Play Integrity | Necesar pentru securitate | Securitate, prevenirea fraudei și funcționalitate | Conform Firebase/Google; verificare finală în SDK Index și traficul AAB |
| Adresă IP/metadate rețea | Da, automat în logurile Cloud Run | Necesar pentru transportul și protejarea serviciului | Securitate, diagnosticare și operare | Bucket-ul implicit Cloud Logging: în mod normal 30 de zile |

## Date necolectate intenționat

- Nume, adresă, e-mail sau număr de telefon în aplicație.
- Contacte, microfon, notificări, calendar sau SMS. Aplicația nu cere permisiune de locație și nu calculează locația, dar infrastructura primește adresa IP; trebuie confirmat în formular dacă aceasta cere declararea „Approximate location”.
- Advertising ID, informații financiare, sănătate, activitate fizică sau istoricul web.
- Biblioteca completă de fotografii; Android Photo Picker oferă numai imaginea aleasă.

## Flux tehnic

1. Imaginea este aleasă/fotografiată, rotită, decupată și comprimată local.
2. Funcția callable verifică Firebase Auth și App Check.
3. Imaginea este transmisă în memorie către Gemini pentru analiză; nu este scrisă în Firebase Storage.
4. În Firestore se salvează numai rezultatul structurat, metadatele minime, cota și feedbackul ales.
5. Jobul zilnic șterge datele ajunse la termen; utilizatorul poate șterge imediat totul din Setări.

## Verificări înainte de trimitere

- [ ] Completează numele legal și e-mailul din politica publică.
- [ ] Confirmă în Play SDK Index declarațiile pentru fiecare Firebase SDK inclus.
- [ ] Capturează traficul unui production AAB și compară-l cu tabelul.
- [ ] Confirmă retenția Crashlytics și termenii Gemini valabili la data lansării.
- [ ] Decide cu juristul dacă Google este exclusiv „service provider” pentru toate fluxurile.
- [ ] Verifică dacă formularul Play cere răspuns separat pentru prelucrarea efemeră a fotografiei.

Surse oficiale de verificat la fiecare release:

- https://support.google.com/googleplay/android-developer/answer/10787469
- https://firebase.google.com/support/privacy
- https://ai.google.dev/gemini-api/docs/zdr
- https://ai.google.dev/gemini-api/terms
