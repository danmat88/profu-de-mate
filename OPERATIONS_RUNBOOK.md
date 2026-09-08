# Operarea backendului „Profu’ de mate”

> **Operație executată la 7 septembrie 2026:** la cererea explicită a lui Daniel, buildul Expo/EAS `production-apk` 20 a fost finalizat și verificat static, iar deployul Firebase a actualizat cele 11 funcții, regulile, indexurile și Hosting. Toate funcțiile sunt `ACTIVE`, stage `pre-play-public`. Comutatorul AI este `enabled=true`, verificat după reactivarea din 14:00:09 UTC. Documentul bugetului zilei era absent; niciun contor nu a fost resetat. Fișierul local ignorat `functions/.env.profu-de-mate-danmat88` declară acum explicit stage-ul și preflightul trece. [Jurnalul actual și limitele probelor](ASTRA_IMPLEMENTATION_STATUS.md) prevalează asupra observațiilor de mai jos redactate înaintea deployului. Alertele, restaurările și operațiunile comerciale reale nu devin verificate prin acest deploy.

Data redactării: 7 septembrie 2026. Domeniu: codul curent din workspace, inclusiv modificările necomise. Acest document descrie proceduri pentru operator; nu reprezintă dovada că infrastructura, alertele, backupurile sau accesul de producție sunt configurate. Utilizatorul a autorizat ulterior buildul EAS production-apk și deployul Firebase; executarea și verificarea lor sunt gestionate de coordonator. Ca etapă strict autorizată a rolloutului, autorul documentului a creat comutatorul de pauză AI descris mai jos; nu a publicat funcții și nu a modificat contoare.

**Stare locală:** există mecanisme pentru limitarea încercărilor AI, blocarea scrierilor după începerea ștergerii, reluarea transferurilor și reconcilierea unor operații întrerupte. **Stare externă:** inventarul read-only din 7 septembrie arată 11 funcții ACTIVE, generația v2, `europe-west1`, toate fără variabilele `PROFU_RELEASE_SECURITY_STAGE` și `PROFU_ENABLE_REVENUECAT` în `environmentVariables`. Aceasta descrie configurația returnată, nu dovedește ce versiune a codului rulează sau că noul default `play` este deja publicat. IAM, enforcementul efectiv App Check, Device Recall, secretele, calendarele Scheduler, alertele, exporturile/restaurările și conturile Play/RevenueCat rămân neconfirmate. Furnizorul AI pentru publicul 13+ și oferta premium sunt decizii separate ale lui Daniel; adaptorul AI existent nu este acceptat automat pentru lansare doar fiindcă se compilează.

Dovada inventarului: `firebase functions:list --project profu-de-mate-danmat88 --json`, executată read-only de coordonator în 2026-09-07; rezultat local `firebase-debug.functions-read.log`. La verificarea acestui document s-au extras numai ID/stare/regiune/platformă și prezența celor două chei, fără afișarea integrală a variabilelor ori secretelor. Un build EAS finalizat nu dovedește sincronizarea configurației Functions cu acel build.

## 1. Inventar operațional derivat din cod

| Suprafață | Ce declară sursa | Dovadă |
|---|---|---|
| Proiect și deploy existent | Scriptul țintește explicit `profu-de-mate-danmat88` și publică împreună functions, rules, indexes și hosting după preflightul local. Nu este un script neutru de staging. | `scripts/deploy-firebase.mjs:9–40`; `scripts/deploy-preflight.mjs` |
| Runtime | Node.js 22; Functions în `europe-west1`. AI: 120 s, 512 MiB, maximum 3 instanțe, concurență 10. | `firebase.json:22–29`; `functions/src/index.ts:153–161` |
| Identități de execuție | `profu-ai-runtime@profu-de-mate-danmat88.iam.gserviceaccount.com`, `profu-data-runtime@…`, `profu-cleanup-runtime@…`; existența și permisiunile lor nu sunt probate de declarație. | `functions/src/index.ts:68–71` |
| Secrete | `GEMINI_API_KEY`, `COMMERCIAL_IDENTITY_HMAC_KEY`; condițional `REVENUECAT_SECRET_API_KEY`, `REVENUECAT_WEBHOOK_AUTH`, `REVENUECAT_WEBHOOK_SIGNING_SECRET`. | `functions/src/index.ts:57–66` |
| Comutator AI | `_runtimeConfig/ai.enabled=false`; cache 15 s. Citirea eșuată blochează analizele noi; documentul absent normalizează la activ. Limita este `maxDailyRequests`, întreg 1–1000, implicit 300. | `functions/src/runtimeConfig.ts:3–46` |
| Buget furnizor | `_commercialGlobal/{ziEuropeBucharest}`, `providerBudgetVersion:2`, `providerAttempts`. O încercare se debitează înaintea fiecărui apel, inclusiv repair; rambursarea cotei utilizatorului nu o anulează. | `functions/src/commercialAccess.ts:283–331`; `functions/src/index.ts:191–200` |
| Pipeline AI | Maximum 3 apeluri, 35 s/apel, 100 s/pipeline, maximum 8192 tokenuri de ieșire/apel și 120000 caractere de răspuns; timeoutul ambiguu nu este reluat automat în același pipeline. | `functions/src/providerPipeline.ts:10–16,66–137` |
| Cereri reluabile | `_analysisRequests/{uid}_{requestId}`, fingerprint al modului/MIME/fotografiei, lease 130 s, cache 7 zile; un lease expirat apare `failed`. | `functions/src/analysisRequests.ts:8–66` |
| Cotă utilizator | `_commercialReservations/{principalId}_{requestId}`; reconciliere după 5 minute prin `getCommercialAccess`. Ziua comercială este Europe/Bucharest. | `functions/src/commercialAccess.ts:20–26,198,645`; `functions/src/index.ts:313–319` |
| Conturi | `_accountLifecycle/{uid}` blochează contul în tranzacțiile protejate; `deleting` și `merging` neterminate nu au termen de expirare. `deleted` expiră după 35 zile. | `functions/src/userLifecycle.ts:4–32`; `functions/src/accountMerge.ts:264–276` |
| RevenueCat | Endpoints și jobul de review există numai dacă `PROFU_ENABLE_REVENUECAT === 'true'` la discovery/runtime. Webhookul are lease 2 minute. Cererile de ștergere sunt `review_required`, fără DELETE automat. | `functions/src/index.ts:60–72,442,469,580–586,626–636`; `functions/src/revenueCatDeletion.ts` |
| Curățare | `cleanupExpiredData`: zilnic 03:15 Europe/Bucharest; funcția cu numele istoric `retryRevenueCatDeletions`: zilnic 04:15, mută joburile legacy eligibile în review, fără ștergere la furnizor. Configurarea în cloud trebuie verificată separat. | `functions/src/index.ts:626–687`; `functions/src/revenueCatDeletion.ts:34–62` |

Limita de încercări reduce expunerea; nu este o limită monetară exactă. Tokenurile de intrare, tarifele și facturarea furnizorului nu sunt contorizate monetar în cod. Circuit breakerul ține starea în memoria fiecărei instanțe: patru eșecuri consecutive, pauză 60 s; nu este un întrerupător global (`functions/src/providerCircuitBreaker.ts:1–38`).

## 2. Responsabilități și condiții înainte de rollout

| Responsabil | Acțiune înainte de trafic real | Acceptanță |
|---|---|---|
| Agent | Pregătește revizia exactă, buildurile, teste și hashurile, verifică toate modificările față de revizia publicată. | Rezultatele și SHA-256 sunt asociate aceluiași commit; nu se combină artefacte din revizii diferite. |
| Daniel | Confirmă proiectul țintă și păstrează o copie securizată a configurației nesensibile, versiunilor de secrete și reviziilor active; stabilește operatorul de incident. | Există operator nominal, acces verificat și revizie de revenire compatibilă cu secțiunea 4. Nu se exportă valori de secrete în raport/loguri. |
| Daniel + serviciu extern | Verifică identitățile IAM dedicate, accesul la Firestore/Auth, invocarea Scheduler și accesul strict la secretele necesare fiecărei funcții. | Canare autorizate reușesc; identități neautorizate sunt refuzate. Nu se acordă rol Editor doar pentru a face deployul să treacă. |
| Daniel + serviciu extern | Confirmă App Check/Play Integrity, Device Recall și certificatul APK/AAB distribuit; revocă tokenurile debug expuse dacă sunt autorizate în Firebase. | Buildul release validează atestarea; tokenul debug retras este refuzat. APK-urile vechi nu sunt redistribuite. |
| Daniel | Confirmă contractul furnizorului AI, datele trimise și eligibilitatea publicului; oferta premium separat. | Decizia și testele de integrare reale sunt înregistrate înainte de expunerea publică. |
| Daniel + serviciu extern | Configurează și probează alertele și recuperarea datelor din secțiunile 7–9. | Un incident sintetic ajunge la persoana desemnată; o restaurare izolată are rezultat verificat. |

Comenzi locale existente pentru pregătire, fără a apela deployul: `node scripts/deploy-firebase.mjs --preflight-only`, `node node_modules/typescript/bin/tsc --noEmit`, `npm run functions:test`, `npm run test:mobile`, `npm run test:rules`, `npm run legal:check`, `npm run release:bundle-check`, `npm run release:artifact-check -- <artefact.apk|artefact.aab>`. Ultima verificare cere `PROFU_RELEASE_CERT_SHA256`; AAB cere și `BUNDLETOOL_JAR`. Aceste comenzi nu dovedesc activarea serviciilor cloud sau comportamentul pe telefon. Nu se folosesc comenzi care instalează implicit un instrument lipsă fără decizia operatorului.

Preflightul local folosește parserul strict al Firebase CLI și ordinea reală a wrapperului cu `--project` explicit: `functions/.env`, apoi `functions/.env.profu-de-mate-danmat88`. Refuză un stage absent/invalid și conflictul între shell și configurația efectivă. Stage-ul numai din shell, `.env` de la rădăcină, `.env.default` sau `.env.local` nu este suficient pentru această comandă. Inițial, pe 7 septembrie, `node scripts/deploy-firebase.mjs --preflight-only` a refuzat stage-ul absent. După autorizarea explicită a buildului production-apk și deployului, coordonatorul a creat configurația locală ignorată de Git `functions/.env.profu-de-mate-danmat88`, cu `PROFU_RELEASE_SECURITY_STAGE=pre-play-public`; **preflightul local trece acum, exit 0**. Aceasta nu dovedește deployul reușit. Cele cinci teste din `tests/deployPreflight.test.mts` trec. Preflightul nu inspectează cloudul și nu poate împiedica un operator să ocolească wrapperul prin Firebase CLI direct.

### Citirea de control înaintea migrației — 7 septembrie, 13:02 UTC

Prin clientul autentificat existent al Firebase CLI s-a executat operația Firestore `documents:batchGet` (citire, fără commit) pentru `_runtimeConfig/ai` și `_commercialGlobal/2026-09-07`. Ambele documente erau **absente** la `readTime=2026-09-07T13:02:02.128513Z` întors de server, observat local la `2026-09-07T13:02:18.863Z`. Nu existau valori declarate `enabled`/`maxDailyRequests`; codul nou normalizează absența la `true`/`300`. Nu exista la acel moment un contor legacy sau v2 pentru ziua respectivă. Absența nu trebuie extrapolată după apariția unui nou apel.

În aceeași citire de control, API Functions v2 a întors 11 funcții ACTIVE în `europe-west1`, runtime `nodejs22`, actualizate ultima dată pe 5 septembrie aproximativ 09:06 UTC și fără cele două flaguri explicite. `analyzeMathImage` avea revizia `analyzemathimage-00028-guf`, `updateTime=2026-09-05T09:06:25.108988040Z`. Dovada este metadată de serviciu, nu verificare a sursei care rulează. Rolloutul trebuie tot să pună explicit pauza, să dreneze vechile invocări și să recitească documentul zilei înaintea activării v2.

### Pauza autorizată — 7 septembrie, 13:03 UTC

După recitirea absenței documentului, s-a creat `_runtimeConfig/ai` cu unicul câmp `enabled:false`, prin `documents:commit` și precondiția server `currentDocument.exists=false`. Serverul a confirmat `commitTime` și `updateTime=2026-09-07T13:03:42.234712Z`; citirea de verificare la `readTime=2026-09-07T13:03:42.530830Z` a confirmat `enabled:false`. Dovadă locală, fără secrete: `firebase-debug.rollout-pause.log`. Niciun contor nu a fost modificat. Redeschiderea trebuie făcută de coordonator după drenare și verificarea deployului, cu recitire și precondiție `updateTime` pentru a nu suprascrie o decizie concurentă a operatorului. Acest paragraf consemnează pauza, nu declară deployul sau redeschiderea ca realizate.

## 3. Rollout cu bugetul `providerBudgetVersion=2`

Procedura de mai jos necesită fereastră de mentenanță aprobată de Daniel. Nu se execută automat prin simpla existență a runbookului.

1. **Pregătire și închidere admitere.** Operatorul verifică proiectul real și revizia activă; setează explicit `_runtimeConfig/ai.enabled=false` prin accesul său administrativ. Înregistrează ora și valorile anterioare. Nu modifică `providerAttempts`, `requests`, UID-uri sau secrete. Comutatorul este citit la începutul analizei, nu înaintea fiecărui retry; pipelineurile deja admise pot continua.
2. **Drenare.** Se lasă să treacă fereastra cacheului de 15 s și durata maximă de 120 s a cererilor vechi, apoi se verifică în trafic/loguri că nu mai există invocări AI în curs din revizia veche. 150 s este un interval inițial conservator propus, nu substituie verificarea invocărilor. Un rezultat deja memorat poate fi returnat înaintea comutatorului fără un nou apel AI (`functions/src/index.ts:171–180`).
3. **Inspectarea zilei curente.** Citește `_commercialGlobal/{ziuaLocalăBucurești}`. Dacă documentul există fără versiunea 2 sau fără `providerAttempts` întreg nenegativ, noul cod îl refuză cu `budgetReason:legacy_or_invalid_counter`. Vechiul câmp `requests` era rambursabil și nu constituie istoric de cost. **Nu redenumi câmpul și nu reseta contorul la zero.**
4. **Alegerea ferestrei.** Dacă există contor legacy/invalid, păstrează AI oprit până în următoarea zi comercială. Instanțele vechi trebuie drenate înaintea acelei zile; un worker vechi nu trebuie să creeze noul document. Primul apel v2 dintr-o zi fără document inițializează contorul corect. Nu există în repository un utilitar de migrare verificat care să reconstruiască apelurile istorice; migrarea manuală ar necesita reconciliere externă de cost și review separat.
5. **Reguli și indexuri.** Confirmă în mediul țintă indexurile din `firestore.indexes.json`, inclusiv indexul pentru rezervări `principalId/state/reservedAt` și indexul collection-group `lessons.expiresAt`. Așteaptă disponibilitatea lor. Publică numai revizia pregătită a regulilor și backendului, cu aceleași bariere lifecycle și buget v2. Scriptul existent publică și hosting; pentru rollout etapizat operatorul trebuie să aleagă explicit suprafața de deploy, fără să presupună că scriptul existent o separă.
6. **Verificare cu AI încă oprit.** Probează pe conturi de test autorizate citirea accesului, refuzul fără atestare, Caietul, feedbackul și mecanismele de ștergere/transfer în mediul de test. Confirmă reviziile și identitățile efectiv active, endpoints condiționale și joburile programate.
7. **Canar controlat.** Cu furnizor eligibil și configurațiile externe confirmate, operatorul setează o limită de încercări potrivită canarului și apoi `enabled=true`. Verifică după expirarea cacheului: o analiză validă debitează o încercare și cota utilizatorului; un `unclear`/repair consumă încercările reale și rambursează numai cota utilizatorului; o reluare cu același fingerprint nu dublează lecția. Un cont aflat la ștergere nu poate produce scrieri noi.
8. **Extindere.** Extinde traficul numai după verificarea logurilor, contorului și funcțiilor fără plată. Nu activează RevenueCat și nu stabilește prețuri ca efect secundar al acestei proceduri. Daniel aprobă pragurile comerciale ulterior.

Acceptanță rollout: o singură familie de revizii compatibilă v2 servește trafic; documentul zilei are versiunea 2 și contorul rămâne monoton inclusiv după eșec/refund; fără scrieri după bariera de ștergere; indexurile sunt utilizabile; canarele și alertele au dovezi păstrate. Responsabili: agent pentru pregătirea locală; Daniel și serviciul extern pentru aplicare și verificarea reală.

## 4. Revenire și incident de cost

1. La creștere neexplicată a consumului, erori repetate sau încălcarea izolării conturilor, operatorul pune `enabled=false` și verifică drenarea ca mai sus. Păstrează logurile, SHA-urile și citirea contorului într-un spațiu restricționat; nu copiază fotografii, rezultate sau chei în canale publice.
2. **Revenirea normală este la o revizie compatibilă v2 și lifecycle.** Nu se reactivează vechiul backend care rambursa contorul global sau scria fără bariere. Revenirea la vechiul cod al cotei nu se repară prin păstrarea numelui nou al câmpului. Dacă nu există revizie compatibilă, AI rămâne oprit și agentul pregătește o corecție înaintea redeschiderii.
3. Nu elimina `_accountLifecycle` și nu readuce automat tichete `merging` la `issued`: sursa poate avea deja lecții copiate. Nu restaura reguli vechi care ignoră markerul lifecycle.
4. Pentru un incident de furnizor, nu mări limita globală și nu relua automat pipelineuri cu timeout ambiguu. `providerAttempts` rămâne consumat; scăderea lui ar anula protecția în fața apelurilor cu rezultat necunoscut.
5. Pentru o revenire a clientului, verifică compatibilitatea câmpurilor requestId/fingerprint/lifecycle, certificatul și App Check. Dacă un client vechi nu poate relua un răspuns legacy fără fingerprint, poate fi necesară o analiză nouă explicită; nu suprascrie cererea veche cu altă fotografie.

Acceptanță revenire: canarul trece pe revizia compatibilă, fără decrementarea bugetului și fără pierderea barierelor de cont. Contorul nu este o copie de configurare și nu se restaurează la o valoare mai mică decât consumul reconciliat.

## 5. App Check și Device Recall sunt două controale distincte

| Mediu/decizie | App Check | Device Recall | Condiție operațională |
|---|---|---|---|
| Production prin Play | Clientul cere `playIntegrity`; backendul implicit și `PROFU_RELEASE_SECURITY_STAGE=play` impun App Check. | Configurația comercială implicită în acest stage este `enforce`. | App Check valid nu demonstrează automat că Device Recall este disponibil. Guestul poate fi blocat cu opțiune de conectare Google. |
| Development / preview în mediu controlat | Clientul configurează `debug` explicit, cu token de test. Backendul poate păstra enforcement pentru tokenuri de test autorizate. | Un dispozitiv din afara Play poate să nu dea `PLAY_RECOGNIZED`/`LICENSED` și recall evaluat. | Pentru testarea izolată se poate decide `monitor` sau `off` în configurația mediului de test; nu este configurație acceptată implicit pentru public. |
| Canalul explicit `production-apk` înainte de Play | Clientul cere `none`, fără debug token; backendul necesită `PROFU_RELEASE_SECURITY_STAGE=pre-play-public` explicit. Backendul cu stage absent rămâne `play` și va refuza clientul fără atestare. | Implicit `off` numai în stage-ul pre-Play; `_runtimeConfig/commercial.deviceRecallMode` poate suprascrie explicit valoarea. | Protecția la nivel de dispozitiv este redusă. Canalul păstrează Auth, cote și bugetul v2; nu reprezintă validarea securității Play. La trecerea în Play se verifică și elimină orice override `off` rămas. |

Dovezi: `functions/src/releaseSecurity.ts:1–24`, `scripts/validate-client-env.cjs:69–103`, `app.config.js:3–16`, `eas.json`, `functions/src/commercialAccess.ts:65–103,443`, `functions/src/deviceRecall.ts:29–65,105–181`. Variabila stage din build nu configurează singură Functions: operatorul trebuie să verifice separat stage-ul efectiv din backend.

În `monitor`, erorile de decodare/evaluare pot întoarce `verified:false` fără blocarea tuturor guesturilor, dar un verdict valid care spune că bun-venitul a fost deja consumat produce tot `welcome_device_used`; modul monitor nu ignoră toate verdictele. Acceptanța reală pentru `enforce`: test pe build instalat din canalul Play autorizat, verdict valid și recent, marcarea `bitFirst`, apoi reinstalare/cont nou fără resetarea abuzivă a bun-venitului. Testarea face o scriere Device Recall reală și se execută numai cu dispozitiv de test și autorizarea operatorului.

## 6. Recuperarea cererilor, transferurilor și ștergerilor

### Cerere abandonată

Citește starea, timestampurile și lease-ul din `_analysisRequests/{uid}_{requestId}` fără a exporta conținutul. După 130 s, `getAnalysisStatus` clasifică o procesare veche drept `failed`; clientul poate relua aceeași fotografie și mod. Lease-ul nou respinge finalizarea celui vechi. `getCommercialAccess` reconciliază rezervări `reserved` mai vechi de 5 minute; indexul său trebuie să fie disponibil. `Stale quota reconciliation deferred` cere investigarea indexului/IAM/Firestore, nu ștergerea contorului. Acceptanță: o singură lecție/cotă finală, bugetul furnizorului include toate încercările reale și niciun worker vechi nu suprascrie noul rezultat.

### Transfer anonim → Google întrerupt

- Identifică tichetul și verifică `sourceUserId`, `sourcePrincipalId`, `targetUserId`, `targetPrincipalId` și starea. Nu schimba proprietarul și nu furniza tichetul altui cont.
- `issued` are termen 7 zile; un tichet expirat cere refacerea fluxului autorizat. `merging` elimină `expiresAt` intenționat și blochează sursa prin `_accountLifecycle/{sourceUid}`. Markerul trebuie să conțină același tichet.
- Reluarea preferată este `completeAccountMergeWithGoogle` prin client, cu același cont Google și aceeași identitate de instalare. Copierea folosește IDs deterministe și creează numai lecțiile lipsă; consumul transferat este deduplicat. `completed` reexecutat reia curățarea sursei. Dovezi: `functions/src/accountMerge.ts:148–185,213–369`; `functions/src/index.ts:412–440`.
- Dacă dispozitivul/tichetul a fost pierdut sau targetul este și el la ștergere, nu există un worker automat de recuperare în sursele citite. Daniel verifică identitatea și starea reală; agentul pregătește o operație administrativă limitată și reviewabilă înaintea oricărei aplicări. Nu se elimină manual bariera pentru a debloca UI.

Acceptanță: lecțiile existente în target sunt păstrate, fiecare lecție sursă eligibilă există o singură dată, feedbackul aparține targetului, cota nu crește prin retry, sursa Auth/date este curățată și markerul ajunge `deleted`. Testele locale nu substituie recuperarea demonstrată în mediul țintă.

### Ștergere parțială

`deleteMyData` începe cu markerul `deleting`; pentru Google cere autentificare recentă. Eșecul nu elimină markerul și nu îi adaugă TTL. Reluarea prin aceeași sesiune autorizată poate relua operațiile idempotente; ștergerea Auth deja efectuată acceptă `auth/user-not-found`. `finishAccountDeletion` se aplică doar după pașii necesari (`functions/src/index.ts:556–634`; `functions/src/userLifecycle.ts:17–32`).

Nu există în cod un job general care să reia automat toate markerele `deleting`. Dacă sesiunea nu mai există sau contul Auth a dispărut înaintea finalizării markerului, Daniel și agentul verifică țintele rămase și pregătesc o recuperare administrativă. Nu cer utilizatorului să recreeze vechiul UID și nu tratează o autentificare nouă drept dovadă că ștergerea veche s-a încheiat.

Pentru RevenueCat, `_pendingRevenueCatDeletions/{principalId}` păstrează acum cererea în `state:review_required`, cu `reviewReason:customer_identity_reused_across_account_generations`; nu execută DELETE la furnizor. Principalul HMAC este reutilizat când contul se recreează și API-ul de ștergere nu are în această integrare o condiție de generație. Un DELETE întârziat poate șterge profilul nou. Jobul cu numele istoric `retryRevenueCatDeletions` inspectează maximum 100 joburi legacy scadente și le mută în review, eliminând `nextAttemptAt`; întoarce `completed:0` (`functions/src/revenueCatDeletion.ts:4–62`; `functions/src/index.ts:580–586,626–636`).

**Rezolvarea externă rămâne deschisă.** Daniel verifică solicitarea și starea reală a clientului cu RevenueCat; agentul poate pregăti separarea identității de cumpărare pe generație înaintea automatizării. Nu executa DELETE orbește după simpla absență a unui profil Firestore, nu reintroduce `nextAttemptAt`, nu șterge cererea pentru a obține coada goală. Elementele cu `reviewReason:invalid_legacy_identity` necesită investigație și păstrarea trasabilității. Dacă se dezactivează flagul RevenueCat, jobul nu mai clasifică elementele legacy, iar reviewul rămâne necesar. Ștergerea datelor nu trebuie prezentată ca anulare a abonamentului Play.

Acceptanță: datele personale enumerate de `deleteMyData` lipsesc, Auth nu mai are vechiul cont, markerul este `deleted`, nicio scriere concurentă nu recreează datele, iar coada RevenueCat este rezolvată sau raportată separat utilizatorului. Pot rămâne datele minimizate antiabuz definite în `functions/src/dataDeletion.ts:30–173`: contor Google pentru ziua curentă și markere de instalare fără UID/legătura Google, nu lecții/fotografii. Nu se promite ștergerea acestor markere înaintea termenelor documentate.

## 7. Monitorizare și alerte propuse

Toate pragurile următoare sunt **propuneri de operare**, nu alerte existente sau SLO-uri demonstrate. Daniel configurează destinația și serviciul extern; agentul poate pregăti definițiile după confirmarea platformei. Înaintea activării, verifică pe o intrare reală unde apare mesajul loggerului și numele serviciului/reviziei. Nu presupune că un filtru de câmpuri este corect doar fiindcă textul există în cod.

| Semnal real / sursă | Prag inițial propus | Acțiune și dovadă de acceptanță |
|---|---|---|
| `Provider attempt reserved` (`index.ts:199`) și `providerAttempts` din ziua curentă | Avertizare la 70% din limită, critic la 90%; salt față de rata canarului | Operator verifică retryurile și traficul; oprește AI la anomalie. Probă: pragul sintetic notifică, iar contorul nu este decrementat. |
| `Math analysis failed` (`index.ts:262`) | 3 evenimente în 5 minute pentru canar; calibrare după volum real | Citește doar `name/code`, corelează cu metricile funcției și furnizorul. Excepțiile `HttpsError` ies înaintea acestui log: contorizarea lui singură nu măsoară toate eșecurile callable. |
| `Structured math response rejected` (`index.ts:203`) | Mai mult de 10 respingeri în 15 minute sau rata de repair depășește pragul benchmarkului aprobat | Separă `stage`, `requestKind`, `mode`; investighează schema/rendererul. O respingere poate fi urmată de succes; nu o număra automat ca lecție eșuată. |
| `Math image analyzed` (`index.ts:245`) | Lipsa succeselor când există trafic; distribuție neobișnuită `status/mode/stored` | Compară și latența/erorile platformei. Acest log nu conține duration și nu produce singur p95. Metrică de latență necesară din platformă. |
| `Stale quota reconciliation deferred` (`index.ts:318`) | Cel puțin 3/15 minute sau rezervări vechi care cresc | Verifică indexul rezervărilor, IAM și disponibilitatea Firestore. Probează reluarea fără refund al bugetului furnizorului. |
| `_accountLifecycle` cu `deleting`/`merging` și `updatedAt` vechi; tichete `merging` | Mai vechi de 15 minute pentru canar | Alertă operațională bazată pe citire controlată; codul nu are scheduler pentru această inspecție. Reia secțiunea 6, fără a șterge markerul. |
| `User data deletion failed` (`index.ts:621`) | Orice eveniment în beta | Asociază incidentul în spațiul restricționat cu solicitarea utilizatorului; logul sigur nu conține UID, deci nu inventa o corelare automată. |
| `RevenueCat webhook failed` / `RevenueCat webhook processed` (`index.ts:547–551`) | Orice eșec persistent; duplicatele nu trebuie să dubleze efectele | Verifică autentificarea și semnătura, coada furnizorului și `_commercialEvents`, apoi resync autorizat. Nu activa Premium manual ca primă reacție. |
| `RevenueCat deletion requires review` / `RevenueCat deletion review queued` (`index.ts:585,635`), `_pendingRevenueCatDeletions.state=review_required` | Orice cerere nouă se preia; escaladare dacă nu are operator în 24 h | Daniel și serviciul extern rezolvă generația corectă. `completed:0` este intenționat; nu constituie ștergere reușită și nu se rezolvă prin retry DELETE. |
| `Expired data cleaned` (`index.ts:672`) | Nicio rulare reușită în 26 h sau date expirate acum peste 26 h | Inspectează Scheduler, runtime și indexurile, apoi retry autorizat. Numărul zero șters nu este un eșec dacă nu existau date expirate. |

Logurile de mai sus nu includ conținutul fotografiei ori răspunsul AI. Nu adăuga `request.data`, outputul furnizorului sau cheile la alertele de diagnostic. Bugetele monetare ale proiectului/furnizorului și alertele lor sunt necesare separat; codul nu le configurează.

## 8. Feedback și moderare

`submitLessonFeedback` acceptă o lecție sau un request finalizat aparținând utilizatorului, nu ambele IDs. Raportul stochează `reportedResult`, categoria, versiunea aplicației, `status:new`, severitatea și expirare după 180 zile; nu fotografia. Categorii: `unsafe` → `high`, `wrong_answer` → `medium`, `unclear`/`other` → `low`; maximum 8 raportări/oră/utilizator (`functions/src/feedbackService.ts:7–50`, `feedbackTriage.ts:1–13`, `feedbackSubmission.ts:1–34`).

Operatorul desemnat de Daniel verifică într-un instrument cu acces restricționat `feedback` cu `status:new`, prioritar `severity:high`. Propunere inițială: preluare a celor high în aceeași zi și investigare a oricărei recurențe înaintea extinderii canarului. Nu există aici o consolă de moderare sau un job care să trimită automat notificări; agentul poate pregăti această integrare după alegerea operatorului/canalului.

Pentru fiecare raport se consemnează, în procesul intern ales, responsabilul, decizia, dovada matematică ori problema de siguranță și măsura adoptată. Câmpuri precum `assignedTo`, `resolvedAt` și stări suplimentare sunt o schemă propusă, nu un contract deja implementat. Nu pune datele copilului sau rezultatul integral în notificări. La conținut periculos repetat, aplică pauza AI și corecția verificată a furnizorului/promptului înaintea reluării. Triggerul `initializeFeedbackTriage` completează numai rapoarte legacy fără status și nu redeschide unul deja procesat (`feedbackService.ts:53–68`).

Acceptanță: o raportare `unsafe` de test ajunge la operator fără ieșirea utilizatorului din aplicație, rezultatul este lizibil după expirarea cacheului cererii, există o decizie trasabilă și ștergerea contului elimină raportul chiar dacă triggerul este reluat. Capturarea feedbackului singură nu înseamnă că moderarea este operațională.

## 9. Backup și restaurare

În configurațiile citite nu există definiție de backup periodic, export automat sau procedură executabilă de restaurare. `cleanupExpiredData` și `expiresAt` sunt ștergere/retentie, nu backup; `firestore.indexes.json` declară indexuri, nu politică TTL sau backup. Starea efectivă a funcțiilor de backup din serviciul extern este necunoscută.

1. Daniel alege RPO/RTO și retenția copiilor, cu limita de păstrare a datelor și ștergerile utilizatorilor. Propunere pentru planificare: RPO 24 h, RTO 4 h; acestea nu sunt promisiuni până la o probă cronometrată.
2. Operatorul inventariază separat Firestore, Firebase Auth, versiunile regulilor/indexurilor, configurațiile runtime și referințele versiunilor de secrete. O copie Firestore nu reprezintă copia Auth, a cheilor HMAC sau a abonamentelor Play/RevenueCat. Exporturile sunt protejate și accesibile numai persoanelor autorizate.
3. Prima restaurare se face într-un proiect/bază izolată cu trafic și joburi oprite. Service accounturile din sursă sunt fixate pe proiectul real; nu porni codul nemodificat în alt proiect presupunând izolare. Agentul pregătește parametrizarea mediului înainte de executarea unui test separat de runtime.
4. Verifică numărul și conținutul unor lecții sintetice, UID-urile, ownershipul, regulile și indexurile. Înaintea oricărei reveniri în producție reconciliază ștergerile și transferurile efectuate după copia restaurată, păstrează barierele lifecycle și exclude datele care nu mai trebuie restaurate.
5. Nu restaura orbește `_commercialGlobal` dintr-o copie veche: ar reduce bugetul zilei și ar permite cost dublu. Păstrează monoton consumul reconciliat sau menține AI oprit până în ziua următoare. Nu reactiva entitlementuri vechi pe baza unei copii; resincronizează cu sursa autoritativă după autorizare. Nu reexecuta automat cozi/triggeruri dintr-un backup fără verificarea efectelor externe.
6. Reconcilierea `_pendingRevenueCatDeletions`, a markerelor de ștergere și a conturilor Auth trebuie să prevină reintroducerea datelor șterse. Dacă dovada necesară lipsește, restaurarea în producție este blocată; agentul pregătește o recuperare limitată a datelor care pot fi demonstrate.

Acceptanță: Daniel și serviciul extern prezintă o restaurare izolată cronometrată, cu dovezi de ownership, fără reintroducerea datelor șterse și fără scăderea contorului de cost; RPO/RTO măsurate îndeplinesc ținta acceptată. Documentul și existența unui buton de export nu satisfac această condiție.

## 10. Înregistrarea fiecărei operații

Fișa operațiunii trebuie să conțină: operatorul, proiectul și mediul, data/intervalul cu fus orar, commitul și hashurile artefactelor, configurația nesensibilă înainte/după, versiunea bugetului, probele executate, rezultatul, incidentele și calea de revenire. Se atașează dovezi din mediul real; se marchează distinct orice pas rămas local, neexecutat sau blocat extern. În momentul redactării, acest runbook este **pregătit local; rolloutul, alertele și recuperarea în cloud nu sunt demonstrate**.
