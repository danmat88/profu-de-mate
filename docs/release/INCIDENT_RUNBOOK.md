# Profu’ de mate — runbook de incident, rollback și secrete

Ultima actualizare: 24 august 2026
Stare: operațional pentru development/beta; se completează cu Play Console și furnizorul AI final înainte de release.

## Contacte și responsabilitate

- Responsabil tehnic/publisher: Daniel Matei — numele legal complet se confirmă în Faza 6.
- Cont administrativ și recovery: `mathosting@gmail.com`.
- Contact public propus: `info@danielmatei.dev` — livrarea trebuie verificată înainte de publicare.
- Proiect Firebase/GCP: `profu-de-mate-danmat88`.
- Proiect EAS: `@matdan88/profu-de-mate`.

Nu se copiază în tichete, e-mail sau chat fotografii, Base64, enunțuri complete, tokenuri, chei ori UID-uri. Dovezile folosesc numai timestamp, versiune/build, tip de eroare și ID intern de incident.

## Severități

| Nivel | Exemplu | Acțiune inițială |
|---|---|---|
| P0 | scurgere de date/secret, ștergere greșită, cost necontrolat, acces neautorizat | oprește imediat analiza, conservă dovezile, rotește secretul afectat |
| P1 | AI indisponibil pentru majoritatea utilizatorilor, crash/ANR major, rezultate corupte | activează mentenanța, verifică ultima schimbare, rollback dacă este cazul |
| P2 | defect de layout/flow cu soluție de ocolire, problemă pe un model de telefon | oprește rollout-ul, documentează reproducerea și pregătește patch |
| P3 | defect cosmetic sau text fără impact asupra sarcinii | intră în backlog cu captură anonimizată și matricea dispozitivului |

## Oprirea imediată a analizelor AI

1. În Firebase Console → Firestore, setează documentul privat `_runtimeConfig/ai` cu `enabled: false`.
2. Așteaptă maximum 15 secunde, apoi verifică o cerere dintr-un build intern: trebuie să apară mesajul de pauză tehnică, fără apel nou la provider.
3. Verifică invocările, erorile și costul agregat; nu deschide payload-uri cu datele elevului.
4. Notează incidentul și ora activării.

Revenire: setează `enabled: true`, testează o singură analiză internă clară, urmărește erorile timp de 15 minute și abia apoi continuă testarea. Dacă documentul lipsește, valoarea implicită este activată.

## Rollback Functions

1. Menține mentenanța activă.
2. Identifică ultimul commit/tag cunoscut ca bun și compară `functions/`, `firestore.rules`, `firestore.indexes.json` și configurația EAS.
3. Dintr-un worktree separat al commitului bun rulează instalarea din lockfile, buildul și toate testele.
4. Publică numai funcția afectată, de exemplu `firebase deploy --only functions:analyzeMathImage`.
5. Rulează smoke test cu App Check valid și confirmă idempotency, cotă, retenție și lipsa datelor sensibile în loguri.
6. Reactivează analiza conform secțiunii anterioare.

Nu se face rollback prin copiere manuală din Cloud Run: funcțiile v2 rămân administrate prin Firebase Functions și cod versionat.

## Rotația secretului AI

1. Activează mentenanța.
2. Creează cheia nouă la furnizor cu proiect/scop minim și restricțiile disponibile.
3. Adaugă o versiune nouă în Secret Manager prin fluxul Firebase CLI, fără a scrie cheia în terminal history, Git, `.env` public ori documentație.
4. Redeploy numai `analyzeMathImage`, apoi rulează un smoke test intern.
5. Revocă cheia veche la furnizor după confirmarea noii revizii.
6. Verifică Secret Manager IAM: numai runtime-ul AI primește acces la secret.
7. Notează data rotației, nu valoarea cheii.

Rotație obligatorie: suspiciune de expunere, schimbarea publisherului/colaboratorilor, schimbarea providerului și înainte de release dacă cheia a fost folosită în testare extinsă.

## App Check și builduri interne

- Debug tokenurile sunt numai pentru development/preview și se revocă atunci când un dispozitiv/build nu mai este folosit.
- Production nu primește niciodată `EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN`.
- Dacă un token este suspect: revocare Firebase App Check, creare token nou cu nume/dispozitiv/data expirării, actualizare numai în mediul EAS potrivit și rebuild intern.
- După Play App Signing, release-ul folosește Play Integrity, nu debug provider.

## Incident de ștergere a datelor

1. Nu confirma utilizatorului ștergerea până când `deleteMyData` nu răspunde cu `deleted: true`.
2. Dacă RevenueCat nu răspunde, confirmă numai după ce documentul `_pendingRevenueCatDeletions/{uid}` a fost creat; jobul `retryRevenueCatDeletions` reia ștergerea profilului terț.
3. Dacă funcția cade, datele locale și sesiunea rămân disponibile pentru reîncercare; clientul curăță local numai după confirmarea serverului.
4. Verifică agregat: subcolecția utilizatorului, feedback, `_aiUsage`, `_analysisRequests`, profilul/entitlement-ul și identitatea Firebase.
5. Pentru Google, verifică separat că documentul cotei zilei nu mai conține UID, `requestIds` sau alte metadate vechi, are `retainedFor: quota-abuse-prevention` și devine eligibil pentru ștergere exact la următoarea resetare.
6. După confirmarea serverului, clientul închide sesiunea veche și creează imediat un cont anonim nou și gol; nu afișează datele contului șters.
7. Pentru o cerere publică DSAR se folosește procedura juridică din Faza 6, nu acces manual improvizat la date.

## Cost anormal sau abuz

1. Activează mentenanța dacă ritmul nu este explicabil.
2. Verifică App Check, distribuția pe coduri de răspuns, rata per minut, numărul de instalări anonime și reviziile Functions.
3. Revocă debug tokenurile suspecte și oprește buildurile interne vechi.
4. Nu mări `maxInstances`, limita zilnică ori limita pe minut în timpul incidentului.
5. Pragurile Cloud Billing și adresa de alertare se completează în Master Roadmap înainte de lansare.

## Provider indisponibil sau rezultate degradate

- Circuit breaker-ul oprește temporar apelurile după patru eșecuri consecutive pe instanță și permite o probă după 60 secunde.
- Pentru degradare de acuratețe se activează mentenanța chiar dacă providerul răspunde HTTP 200.
- Păstrează corpusul de regresie anonim, rulează benchmarkul pe commitul bun și pe candidat și nu reactiva până când pragurile Fazelor 2 și 5 sunt îndeplinite.

## Închiderea incidentului

- Cauza rădăcină și intervalul sunt documentate.
- Datele afectate și obligația de notificare sunt evaluate.
- Secretul/tokenul a fost rotit sau justificat ca neafectat.
- Există test automat ori scenariu reproductibil care previne regresia.
- Master Roadmap, registrul de securitate și Data Safety sunt actualizate dacă fluxul de date s-a schimbat.
- Pentru release, rollout-ul se reia gradual și se urmăresc crash/ANR, 5xx, P95 și costul.
