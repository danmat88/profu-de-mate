# Sistem comercial — Profu’ de mate

Ultima actualizare: 25 august 2026
Stare: **fluxul Guest + Google Gratuit este configurat și publicat; Premium rămâne feature-gated până la Google Play Console și RevenueCat**

Acest document este contractul unic pentru acces, conturi și abonamente. Nu se schimbă limitele, denumirile sau comportamentul de plată direct în interfață fără actualizarea contractului și a testelor.

## Modelul comercial decis

| Stare | Probleme disponibile | Persistență | Plată |
|---|---:|---|---|
| Vizitator, fără Google | 5 în total, ca bun-venit | principal opac al instalării păstrat în SecureStore; Device Recall va acoperi reinstalarea după activarea în Play | nu |
| Gratuit, cu Google | 5 pe zi | același cont, pe orice telefon | nu |
| Premium | 30 pe zi, configurabil server-side | același cont și aceeași achiziție Google Play | abonament lunar sau anual |

Reguli definitive:

- utilizatorului îi spunem **„probleme”**, niciodată „credite”;
- Rezolvă și Verifică folosesc aceeași alocație;
- se consumă o problemă numai când rezultatul final are starea `ready`;
- `not_math`, `unclear`, eroarea furnizorului, timeoutul și retry-ul aceleiași cereri nu consumă o problemă;
- nu există reclame, pachete de credite, plan săptămânal, lifetime sau promisiunea falsă „nelimitat”;
- calitatea matematicii este aceeași pentru Gratuit și Premium;
- limitele zilnice se resetează la ora 00:00 în `Europe/Bucharest`, inclusiv la schimbarea orei de vară;
- limita Premium de 30/zi este o gardă de cost și abuz. Poate fi schimbată din configurația privată după măsurarea costului real.

## Experiența utilizatorului

1. Aplicația pornește fără login vizibil și creează o identitate Firebase anonimă.
2. Home arată discret câte probleme au rămas.
3. Confirmarea fotografiei verifică accesul înainte de a deschide Procesarea; fotografia nu se pierde dacă accesul este blocat.
4. După pachetul de bun-venit, aplicația explică beneficiul Google: Caiet recuperabil și 5 probleme gratuite zilnic.
5. Conectarea unui cont Google nou păstrează același UID și același Caiet, dar mută problemele de bun-venit deja folosite în cota zilei, fără bonus ascuns.
6. Dacă acel Google exista deja, backendul unește lecțiile și consumul fără să acorde probleme suplimentare, apoi șterge identitatea anonimă veche. Biletul de fuziune este păstrat temporar în SecureStore și reluat automat după restart sau căderea rețelei.
7. Paywall-ul arată două planuri, cu prețurile localizate citite direct din Google Play prin RevenueCat.
8. După cumpărare sau restaurare, aplicația cere serverului o sincronizare canonică; webhook-ul rămâne mecanismul continuu pentru reînnoire, expirare, refund și transfer.
9. Abonamentul se administrează în Google Play. Ștergerea datelor aplicației nu anulează abonamentul.
10. Deconectarea și ștergerea sunt acțiuni diferite: deconectarea păstrează contul, Caietul, cota și Premium; ștergerea elimină contul și datele recuperabile.
11. Înainte de logout, serverul marchează instalarea ca deja asociată unui cont; dacă marcarea nu reușește, logout-ul nu continuă. UID-ul anonim nou nu poate redeschide cele 5 probleme de bun-venit.
12. Închiderea, repornirea și actualizarea aplicației păstrează sesiunea Firebase. La pornire, tokenul este reverificat online și cade pe copia locală numai dacă rețeaua lipsește; un cont șters din alt loc trece într-un spațiu guest gol, fără un nou bonus dacă instalarea fusese deja asociată. După ștergerea datelor Android sau reinstalare este necesară reconectarea Google, dar datele și cota revin de pe server.

## Autoritatea și datele server-side

Clientul nu poate scrie sau citi direct nicio colecție comercială. Firestore Rules păstrează implicit accesul blocat.

- `_commercialUsers/{principal}` — pachetul de bun-venit, blocarea post-login, fereastra anti-burst și Device Recall pentru principalul opac `i_…` sau profilul de cont `g_…`;
- `_commercialUsage/{principalHmac_zi}` — consumul zilnic comun Gratuit/Premium, legat de un HMAC stabil al identității Google și nu de UID-ul Firebase recreabil;
- `_commercialReservations/{principal_requestId}` — rezervare idempotentă, apoi `consumed` ori `refunded`;
- `_commercialGlobal/{zi}` — plafon agregat pentru costul furnizorului;
- `_commercialEntitlements/{principal}` — copie server-side a entitlement-ului RevenueCat;
- `_commercialEvents/{eventId}` — idempotency și lease pentru webhook-uri at-least-once;
- `_pendingRevenueCatDeletions/{principal}` — reîncercare server-side când ștergerea din serviciul terț nu răspunde, fără a bloca ștergerea datelor Firebase;
- `_accountMergeTickets/{ticket}` — tichet aleator, unic și scurt pentru fuziunea unui UID anonim cu un Google existent; finalizarea cere și secretul aceleiași instalări;
- `_runtimeConfig/commercial` — limitele și modul Device Recall, inaccesibile clientului.

Contoarele zilnice și rezervările expiră după maximum 35 de zile. Profilul comercial minim, copia entitlement-ului și evenimentele tehnice expiră după maximum aproximativ 13 luni dacă nu sunt reîmprospătate. La ștergerea contului, UID-ul, conținutul și ID-urile cererilor sunt eliminate; numai HMAC-ul opac și numărul folosit în ziua curentă pot rămâne până la următoarea resetare, strict pentru prevenirea resetării artificiale. Atunci documentul devine eligibil pentru ștergerea automată și nu mai participă la cota noii zile. Ștergerea RevenueCat are coadă separată când serviciul terț nu răspunde.

Identitatea comercială Google este derivată server-side cu HMAC-SHA256 și secretul `COMMERCIAL_IDENTITY_HMAC_KEY`. Pentru guest, aplicația generează o valoare aleatoare de 256 de biți în SecureStore, iar serverul derivă un principal `i_…` cu același HMAC. Pentru cont, principalul stabil este `g_…`. Identificatorul Google, e-mailul, tokenul brut al instalării și UID-ul Firebase nu apar în ID-ul documentului de cotă. Secretul HMAC nu se rotește fără o procedură explicită de dublă citire; în proiectul curent, baza comercială este resetată înaintea primei activări și nu există migrare.

Configurația privată implicită:

```json
{
  "welcomeLimit": 5,
  "freeDailyLimit": 5,
  "premiumDailyLimit": 30,
  "premiumEntitlementId": "premium",
  "deviceRecallMode": "off"
}
```

Modurile Device Recall sunt `off`, `monitor` și `enforce`. Se trece la `enforce` numai după aprobarea beta, testul pe artefact instalat din Play și observarea modului `monitor`.

## Securitatea plăților și a entitlement-ului

- Google Play Billing este singurul procesator de plată Android.
- RevenueCat gestionează produsele, receipt validation, entitlement-ul și restaurarea; nu este un al doilea procesator de plată.
- aplicația folosește principalul comercial opac și stabil drept RevenueCat App User ID, nu UID-ul Firebase; Premium este cumpărat și sincronizat numai după conectarea Google, pe principalul `g_…`;
- cheia publică RevenueCat există numai în build; cheia secretă există numai în Secret Manager;
- webhook-ul verifică atât headerul de autorizare, cât și HMAC-SHA256 peste corpul brut, cu toleranță de 5 minute;
- event ID-ul este idempotent, iar un webhook valid declanșează citirea stării canonice `/subscribers/{principal}` înainte să actualizeze Firestore;
- anularea reînnoirii nu revocă imediat Premium; accesul rămâne până la expirare. Expirarea sau refundul sunt reflectate prin sincronizarea canonică.

## Activare externă — ordinea exactă

Aceste puncte nu pot fi bifate doar din repository.

### 1. Google și Firebase Auth

- [x] 🤖 Providerul Google este activ în Firebase Authentication.
- [ ] 👤 Confirmă ecranul OAuth și adresa publică de suport.
- [~] 🤖 SHA-1 și SHA-256 ale cheii EAS sunt înregistrate; certificatul Play App Signing se adaugă după crearea aplicației în Play Console.
- [x] 🤖 Web Client ID-ul Firebase este configurat în development, preview și production EAS.
- [x] 🤖 Clientul folosește Credential Manager prin integrarea Nitro recomandată pentru aplicațiile Android noi; SDK-ul Google Sign-In legacy a fost eliminat.
- [x] 🤖 Mediul development este sincronizat și validat înainte de Metro; selectorul nativ Google a fost deschis pe development buildul fizic fără eroare de configurare, iar anularea revine curat în aplicație.
- [x] 🤖 Secretul Functions `COMMERCIAL_IDENTITY_HMAC_KEY` a fost generat cu 64 de bytes, păstrat exclusiv în Secret Manager și legat numai la runtime-urile AI/date care îl folosesc; valoarea nu intră în EAS, Git sau aplicație.

### 2. Google Play Console și produsele

- [ ] 👤 Creează și verifică acel cont Play Console personal.
- [ ] 👤 Creează aplicația `ro.profudemate.app`, activează Play App Signing și încarcă primul AAB într-un track de test.
- [ ] 👤 Creează un abonament `profu_premium` cu două base plans auto-renewing: lunar și anual.
- [ ] 👤 Completează prețurile și disponibilitatea pe țări. Nu hardcoda prețurile în aplicație.
- [ ] 👤 Adaugă testerii de licență și conturile pentru closed testing.

### 3. RevenueCat

- [ ] 👤 Creează proiectul și aplicația Google Play cu package-ul exact.
- [ ] 👤 Conectează credentialele Google Play cerute de RevenueCat.
- [ ] 👤 Creează entitlement-ul exact `premium`.
- [ ] 👤 Creează offering-ul curent și mapează pachetele `$rc_monthly` și `$rc_annual` la cele două base plans.
- [ ] 👤 Setează Restore Behavior la transfer către noul App User ID, adecvat aplicației cu login opțional.
- [ ] 👤 Pune cheia publică Android în `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` în EAS.
- [ ] 👤 Configurează webhook-ul `revenueCatWebhook`, un header de autorizare aleator și HMAC signing.
- [ ] 👤 Confirmă planul RevenueCat care include webhook-uri; în oferta RevenueCat disponibilă la data acestui document, webhook-urile sunt funcție Pro.
- [ ] 👤 Creează secretele Functions: `REVENUECAT_SECRET_API_KEY`, `REVENUECAT_WEBHOOK_AUTH`, `REVENUECAT_WEBHOOK_SIGNING_SECRET`.

### 4. Play Integrity și Device Recall

- [ ] 👤 Leagă Play Integrity de proiectul Cloud/Firebase și acordă identității runtime dreptul minim necesar pentru decode/write.
- [ ] 👤 Completează cererea beta Device Recall; după aprobare, activează verdictul în Play Console.
- [x] 🤖 Project number este configurat în toate mediile EAS prin `EXPO_PUBLIC_PLAY_INTEGRITY_PROJECT_NUMBER`.
- [ ] 🤖 Rulează minimum un ciclu în `monitor`, verifică rata `UNEVALUATED`, apoi schimbă `_runtimeConfig/commercial.deviceRecallMode` în `enforce`.

### 5. Publicare și test final

- [x] 🤖 Rules și funcțiile Guest/Google sunt publicate, inclusiv principalul stabil al instalării, blocarea server-side înainte de logout, principalul Google HMAC și ștergerea disponibilă independent de RevenueCat; funcțiile Premium rămân intenționat neexportate până la secretele RevenueCat reale. Activarea folosește `PROFU_ENABLE_REVENUECAT=true` în mediul Functions numai după configurarea externă.
- [~] 🤖 Development APK-ul local al reviziei curente este construit și instalat, iar Home pornește fără crash; certificatul debug este în Firebase. QA-ul Guest/Google complet pe acest APK rămâne deschis, buildul EAS nou este blocat temporar de cota lunară, iar plățile RevenueCat rămân inactive până la cheia publică și produsele reale.
- [ ] 🤖 Pentru plata reală, construiește AAB și instalează aplicația din trackul Google Play; un APK sideloaded nu este dovada finală pentru Billing/Device Recall.
- [ ] 🤖 Testează: guest 0→5, rezultat neclar fără consum, retry idempotent, link Google nou, merge Google existent, 5/zi, cumpărare lunară/anuală, anulare, expirare, refund, restore, reinstall, offline și ștergerea datelor.
- [ ] 👤 Confirmă prețurile, textele juridice, politica de refund și răspunsul suportului înainte de lansare.

## Resetare curată, fără migrare

În acest proiect nu se păstrează compatibilitate cu vechile documente comerciale. Pentru resetarea anunțată de publisher:

1. se oprește folosirea buildurilor vechi și nu se șterge nimic cât timp există testeri activi care trebuie păstrați;
2. publisherul șterge utilizatorii Firebase Authentication și datele Firestore vechi din consola proiectului;
3. se creează o singură dată secretul `COMMERCIAL_IDENTITY_HMAC_KEY`, apoi se publică Functions, Rules și indexurile acestei revizii;
4. `_runtimeConfig/commercial` poate lipsi — backendul pornește sigur cu valorile implicite din acest document — sau poate fi recreat explicit cu aceleași valori;
5. abia apoi se instalează development buildul nou și se șterg datele locale ale buildurilor vechi de pe telefoanele de test;
6. primul test pornește cu UID anonim nou și colecții comerciale goale. Nu se rulează script de migrare și nu se copiază contoarele vechi.

## Dovezi automate curente

- Functions build și 58/58 teste backend trecute;
- TypeScript și Expo Doctor 21/21 trecute;
- 66/66 teste mobile/configurație trecute, inclusiv regresiile pentru Credential Manager, ciclul de viață al contului, refresh-ul unic după schimbarea identității, cache-ul comercial legat de Firebase UID, startup-ul coordonat, reluarea analizei din Home, blocarea pickerului Galerie, recuperarea camerei și contractul EAS/Metro;
- Rules 8/8 confirmă că noile colecții comerciale sunt inaccesibile clienților;
- 9/9 teste de integrare pe emulatorul Firestore trec pentru concurență, idempotency, refund, plafonul de bun-venit, biletul legat de instalare, legarea Google fără bonus, UID anonim rotit fără bonus nou, sigilarea instalărilor vechi și recrearea aceluiași Google fără resetarea cotei;
- testarea pe development build nou și testarea cumpărăturilor din Play rămân deschise și nu sunt declarate finalizate.
