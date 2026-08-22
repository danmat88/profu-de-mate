# Profu' de Mate — decizii de produs

Ultima actualizare: 22 august 2026

## Public și distribuție

- Publicul primei versiuni este 13+.
- Aplicația va fi publicată inițial doar pe Google Play.
- Publisherul va fi o persoană fizică.
- Contul Google Play Console va fi creat înainte de etapa de publicare.
- Prima versiune nu va conține reclame.

## Conturi și date

- Utilizarea de bază nu va cere autentificare vizibilă.
- Firebase Anonymous Auth va crea identitatea tehnică necesară pentru securizarea datelor.
- Google Sign-In nu intră în v1; poate fi adăugat ulterior prin account linking dacă testele arată că sincronizarea între telefoane este necesară.
- Fotografiile problemelor nu vor fi păstrate după procesare.
- În caiet se vor salva numai problema extrasă, explicația structurată și metadate minimale.
- Lecțiile nesalvate expiră după 7 zile, iar Caietul după aproximativ 13 luni fără activitate, pentru a evita date orfane după dezinstalare.
- Proiectul folosește un singur Firebase de producție și Firebase Emulator Suite pentru dezvoltare.

## Fluxul principal

1. Utilizatorul fotografiază problema sau alege o imagine din galerie.
2. Imaginea este orientată, redimensionată și comprimată local.
3. Utilizatorul confirmă captura și poate reface fotografia.
4. Backendul securizat extrage problema, generează explicația și validează structura și randarea matematică.
5. Aplicația prezintă explicația în pași, în limba română.
6. Utilizatorul salvează opțional lecția în caiet.

## Starea Firebase de producție

- Firestore Standard este activ în multi-regiunea europeană `eur3`.
- Delete protection este activată, iar PITR este oprit până la aprobarea costurilor.
- Aplicația Android finală este `ro.profudemate.app`.
- Autentificarea anonimă este activă; Google Sign-In rămâne opțional.
- Regulile și indexurile testate local au fost publicate în producție.
- Funcțiile AI, ștergerea completă, curățarea automată, App Check debug și limitele de cost sunt active.

## Limite până la decizia finală

- Nicio cheie AI nu este inclusă în aplicația mobilă sau în Git.
- Răspunsurile AI pot greși; v1 nu va pretinde verificare deterministă universală.
- Nu se publică aplicația înainte de clarificarea juridică pentru publicul 13–15 ani și utilizarea Gemini.
- Nu se publică Hosting înainte de completarea identității legale și a e-mailului public.
