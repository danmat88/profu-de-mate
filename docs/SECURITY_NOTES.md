# Note de securitate și dependențe

Ultima verificare: 21 august 2026

## Reguli Firebase

- Firestore și Storage pornesc de la `deny-by-default`.
- Clientul nu poate crea sau modifica soluția matematică și verdictul.
- Datele din caiet sunt accesibile numai proprietarului autentificat.
- Suita locală conține 6 teste de reguli, toate trecute cu Firebase CLI 15.28.1 și Java 21.
- Nicio regulă și niciun index nu au fost încă publicate în producție.

## Audit npm

- `npm audit --omit=dev`: 15 vulnerabilități tranzitive, dintre care 8 high, 7 moderate și 0 critical.
- Avertismentele de producție provin din lanțul Expo/Metro (`image-size`, `uuid`), nu din codul aplicației.
- `npm audit fix --force` nu trebuie folosit: soluția sugerată ar coborî proiectul de la Expo SDK 57 la Expo 46 și ar rupe compatibilitatea.
- Verificarea se repetă înaintea fiecărui build de publicare și se aplică actualizările Expo compatibile imediat ce upstream publică remediile.

## Înainte de producție

- Activare App Check cu Play Integrity în development build-ul nativ.
- Rate limiting și limite de cost pe funcțiile de analiză.
- Secret Manager pentru orice cheie AI; nicio cheie în aplicație sau Git.
- Audit al regulilor și al permisiunilor IAM după implementarea backendului.
