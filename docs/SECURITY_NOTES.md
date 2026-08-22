# Note de securitate și dependențe

Ultima verificare: 22 august 2026

## Controale active

- Firestore și Storage sunt deny-by-default; regulile publicate au 7 teste locale care trec.
- Clientul nu poate crea soluții și nu poate modifica răspunsul/verdictul generat de backend.
- Cloud Functions cer Firebase Anonymous Auth și App Check.
- Cheia Gemini este în Secret Manager și nu este livrată în aplicație.
- Analiza are `maxInstances: 3`, timeout 120 s, limită 30/zi și 4/minut per instalare.
- `requestId` oferă idempotency pentru retry și împiedică dublarea consumului/salvării.
- Release Android blochează cleartext traffic și activează minify/resource shrinking.
- Permisiunile pentru reclame, locație, microfon, notificări și acces general la media sunt blocate explicit.
- Crashlytics este implicit oprit și nu atașează intenționat fotografia în rapoarte.
- Datele expiră automat și există ștergere completă în aplicație.
- Ultimele 60 de loguri `analyzeMathImage` au fost auditate pe 22 august 2026: nu conțin fotografia, Base64-ul sau enunțul; conțin metadatele standard HTTP ale infrastructurii.

## Audit npm

La 22 august 2026:

- `npm audit --omit=dev`: 21 constatări tranzitive — 4 high, 17 moderate, 0 critical.
- `npm audit`: 25 constatări — 4 high, 21 moderate, 0 critical.
- Cele 4 high provin din lanțul Metro/`image-size`; constatările moderate includ Expo tooling, `uuid`, `xcode` și advisories propagate prin React Native Firebase.
- `npm audit fix` fără `--force` a fost rulat și proiectul a rămas compatibil: Expo Doctor 21/21.
- Nu se rulează `npm audit fix --force`: remediile propuse de npm includ downgrade-uri incompatibile, de exemplu Expo 46 sau React Native Firebase 17.
- Acestea sunt în principal dependențe de build/tooling, dar rămân risc urmărit; auditul se repetă înaintea fiecărui AAB și se aplică numai actualizări compatibile verificate cu Expo SDK 57.

## Înainte de lansare

- [ ] Audit IAM și Secret Manager cu principiul least privilege.
- [ ] Buget și alerte Google Cloud.
- [ ] Play Integrity + App Check pentru certificatul Play App Signing.
- [ ] Analiză statică a AAB-ului pentru permisiuni și chei.
- [x] Review al logurilor funcțiilor pentru a confirma că nu conțin imagini/base64 sau enunțuri; obiectele brute de eroare și UID-ul din logul ștergerii au fost eliminate.
- [ ] Test de ștergere end-to-end în producție.
- [ ] Plan de incident, rotația secretului Gemini și persoană de contact.
