# Note de securitate și dependențe

Ultima verificare: 24 august 2026

## Controale active

- Firestore și Storage sunt deny-by-default; regulile au 8 teste locale care trec, inclusiv interdicția accesului client la configurația operațională.
- Clientul nu poate crea soluții și nu poate modifica răspunsul/verdictul generat de backend.
- Cloud Functions cer Firebase Anonymous Auth și App Check.
- Cheia Gemini este în Secret Manager și nu este livrată în aplicație.
- Analiza are `maxInstances: 3`, timeout 120 s, limită 30/zi și 4/minut per instalare.
- `requestId` oferă idempotency pentru retry și împiedică dublarea consumului/salvării.
- Cererile eșuate restituie cota zilnică, dar rămân în fereastra anti-abuz pe minut.
- Analizele randate au o gardă de 840 KB înainte de scrierea în Firestore.
- Există circuit breaker pe instanță, kill switch privat cu cache de maximum 15 secunde și plafon agregat implicit de 300 analize/zi; schimbările sunt publicate în Functions.
- Contorul global păstrează numai totaluri agregate; UID-urile și `requestId`-urile rămân exclusiv în documentele per instalare care sunt șterse de fluxul „Șterge toate datele”.
- Release Android blochează cleartext traffic și activează minify/resource shrinking.
- Permisiunile pentru reclame, locație, microfon, notificări și acces general la media sunt blocate explicit.
- Crashlytics este implicit oprit și nu atașează intenționat fotografia în rapoarte.
- Datele expiră automat și există ștergere completă în aplicație.
- Ultimele 60 de loguri `analyzeMathImage` au fost auditate pe 22 august 2026: nu conțin fotografia, Base64-ul sau enunțul; conțin metadatele standard HTTP ale infrastructurii.

## Audit npm

La 24 august 2026:

- `npm audit --omit=dev`: 17 constatări tranzitive — 0 high, 17 moderate, 0 critical.
- `npm audit`: 21 constatări — 0 high, 21 moderate, 0 critical.
- Cele 4 constatări high din lanțul Metro/`image-size` au fost eliminate prin alinierea Metro, `metro-config` și `metro-transform-worker` la patch-ul 0.84.5 deja folosit de Expo SDK 57.
- Constatările moderate rămase includ Expo tooling, `uuid`, `xcode` și advisories propagate prin React Native Firebase.
- Nu se rulează `npm audit fix --force`: remediile propuse de npm includ downgrade-uri incompatibile, de exemplu Expo 46 sau React Native Firebase 17.
- Acestea sunt în principal dependențe de build/tooling, dar rămân risc urmărit; auditul se repetă la fiecare CI și înaintea fiecărui AAB.
- CI blochează orice constatare runtime nouă de severitate high/critical. Moderate sunt revizuite la fiecare actualizare Expo/React Native și obligatoriu înainte de release.

## Înainte de lansare

- [ ] Audit IAM și Secret Manager cu principiul least privilege.
- [ ] Buget și alerte Google Cloud.
- [ ] Play Integrity + App Check pentru certificatul Play App Signing.
- [ ] Analiză statică a AAB-ului pentru permisiuni și chei.
- [x] Review al logurilor funcțiilor pentru a confirma că nu conțin imagini/base64 sau enunțuri; obiectele brute de eroare și UID-ul din logul ștergerii au fost eliminate.
- [ ] Test de ștergere end-to-end în producție.
- [ ] Plan de incident, rotația secretului Gemini și persoană de contact.
