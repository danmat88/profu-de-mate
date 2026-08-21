# Profu' de Mate — decizii de produs

Ultima actualizare: 21 august 2026

## Public și distribuție

- Publicul primei versiuni este 13+.
- Aplicația va fi publicată inițial doar pe Google Play.
- Publisherul va fi o persoană fizică.
- Contul Google Play Console va fi creat înainte de etapa de publicare.
- Prima versiune nu va conține reclame.

## Conturi și date

- Utilizarea de bază nu va cere autentificare vizibilă.
- Firebase Anonymous Auth va crea identitatea tehnică necesară pentru securizarea datelor.
- Conectarea cu Google va fi opțională și va păstra caietul existent prin account linking.
- Fotografiile problemelor nu vor fi păstrate după procesare.
- În caiet se vor salva numai problema extrasă, explicația structurată și metadate minimale.
- Proiectul folosește un singur Firebase de producție și Firebase Emulator Suite pentru dezvoltare.

## Fluxul principal

1. Utilizatorul fotografiază problema sau alege o imagine din galerie.
2. Imaginea este orientată, redimensionată și comprimată local.
3. Utilizatorul confirmă captura și poate reface fotografia.
4. Backendul securizat extrage problema și verifică matematic rezultatul.
5. Aplicația prezintă explicația în pași, în limba română.
6. Utilizatorul salvează opțional lecția în caiet.

## Starea Firebase de producție

- Firestore Standard este activ în multi-regiunea europeană `eur3`.
- Delete protection este activată, iar PITR este oprit până la aprobarea costurilor.
- Aplicația Android finală este `ro.profudemate.app`.
- Autentificarea anonimă este activă; Google Sign-In rămâne opțional.
- Regulile și indexurile testate local au fost publicate în producție.

## Limite până la decizia finală

- Firebase Blaze nu se activează înainte de aprobarea billingului și a alertelor de buget.
- Nicio cheie AI nu este inclusă în aplicația mobilă sau în Git.
