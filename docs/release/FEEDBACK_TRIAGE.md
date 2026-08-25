# Triage pentru raportările lecțiilor

Ultima actualizare: 24 august 2026

Acest flux este operațional, nu un substitut pentru benchmarkul matematic. Raportările nu conțin fotografia și nu trebuie completate manual cu fotografia, enunțul integral, UID-ul sau alte date personale.

## Câmpuri administrate de backend

- `status`: pornește cu `new`; valorile de lucru recomandate sunt `new`, `reviewing`, `resolved`, `dismissed`.
- `severity`: `high` pentru conținut nepotrivit, `medium` pentru răspuns greșit, `low` pentru explicație neclară sau altă problemă.
- `createdAt`: momentul trimiterii de către aplicație.
- `updatedAt`: ultima modificare operațională.
- `expiresAt`: ștergere automată după maximum 180 de zile.
- `category`, `lessonId`, `appVersion`: context minim pentru reproducere.

Clientul poate numai să creeze raportarea minimă. Nu poate citi colecția și nu poate seta `status`, `severity`, `expiresAt` sau o rezoluție.

## Ritm de lucru înainte de un panou administrativ

1. Deschide colecția `feedback` în Firebase Console fără să copiezi datele în tichete publice.
2. Tratează `severity=high` în aceeași zi și celelalte raportări în maximum trei zile lucrătoare.
3. Reproduce problema numai cu un caz de test anonim sau sintetic.
4. Marchează `reviewing`, apoi `resolved` ori `dismissed`; notează o rezoluție tehnică scurtă, fără conținutul elevului.
5. Dacă există un risc sistemic, activează kill switch-ul AI și urmează `INCIDENT_RUNBOOK.md`.
6. Adaugă regresia anonimizată în corpusul de 200 de cazuri dacă raportul confirmă o eroare matematică sau de randare.

## Automatizări rămase înainte de lansare

- alertă pentru orice raportare `severity=high`;
- metrică agregată pe categorie și versiunea aplicației;
- timp până la prima examinare și până la rezolvare;
- panou minimal numai dacă volumul nu mai poate fi gestionat sigur în Firebase Console.
