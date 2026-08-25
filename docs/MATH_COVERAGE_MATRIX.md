# Matricea de acoperire matematică

Ultima actualizare: 25 august 2026

Acest document definește ce înseamnă „suportat” în Profu’ de mate. O formulă randată cu succes nu dovedește singură că fotografia a fost citită corect sau că rezolvarea este corectă.

## Porțile obligatorii

| Poartă | Criteriu | Stare |
|---|---|---|
| Structură | Proza, matematica și vizualurile sunt separate și validate înainte de stocare | [x] |
| Randare | Fiecare bloc acceptat este randat local, fără LaTeX brut, rețea sau schimbare târzie de font | [x] automat; [~] baseline 390 px creat, comparație automată în lucru |
| Pedagogie | Enunț complet, pași cu câte o idee, răspuns exact și alternativă coerentă | [x] contract; [ ] benchmark real |
| Verificare | Modul „Verifică” distinge corect, parțial corect și greșit și localizează prima eroare | [x] contract; [ ] benchmark real |
| Incertitudine | Imaginea neclară/incompletă este refuzată, nu completată prin presupuneri | [x] contract; [ ] rată măsurată pe corpus real |
| Accesibilitate | Fiecare formulă/vizual are citire naturală în română | [x] schemă; [ ] audit TalkBack complet |

## Familii simbolice

Toate familiile de mai jos folosesc același contract generic `text | math | visual`; nu există ecrane ori patch-uri speciale pentru o problemă anume.

| Familie | Exemple structurale din corpus | Randare backend | Lecție completă validată | Acuratețe pe fotografii reale |
|---|---|---:|---:|---:|
| Aritmetică, fracții, procente, rapoarte | fracții compuse, puteri, radicali, proporții | [x] | [x] | [ ] |
| Zecimale, unități, notație științifică | virgulă zecimală, conversii, unități pătrate/cubice | [x] | [x] | [ ] |
| Algebră elementară | polinoame, factorizări, expresii raționale, modul | [x] | [x] | [ ] |
| Ecuații, inecuații și sisteme | cazuri, intervale, transformări aliniate | [x] | [x] | [ ] |
| Exponențiale și logaritmi | legi de calcul, ecuații exponențiale/logaritmice | [x] | [x] | [ ] |
| Funcții și geometrie analitică | domeniu, compunere, coordonate, distanță, pantă | [x] | [x] | [ ] |
| Trigonometrie | identități, ecuații, vectori și produs scalar | [x] | [x] | [ ] |
| Șiruri și progresii | termen general, recurențe, sume | [x] | [x] | [ ] |
| Limite, derivate și integrale | limite, derivate, integrale definite/nedefinite | [x] | [x] | [ ] |
| Algebră liniară | vectori, matrici, determinanți, sisteme | [x] | [x] | [ ] |
| Numere complexe | formă algebrică, modul, argument | [x] | [x] | [ ] |
| Combinatorică și probabilități | combinări, probabilitate condiționată, evenimente | [x] | [x] | [ ] |
| Statistică | medie, dispersie, tabele cu valori matematice | [x] | [x] | [ ] |
| Mulțimi și logică | operații, cuantificatori, implicații | [x] | [x] | [ ] |
| Geometrie plană și în spațiu | relații, unghiuri, lungimi, arii, volume | [x] | [x] | [ ] |
| Demonstrații și inducție | ipoteză, concluzie, pași argumentativi | [x] structură | [x] contract | [ ] |
| Probleme aplicate | mișcare, amestecuri, procente, matematică financiară | [x] | [x] contract | [ ] |

## Moduri de prezentare

| Conținut | Implementare | Stare |
|---|---|---|
| Proză și matematică în același paragraf | document HTML local cu SVG inline și metrici comune | [x] |
| Derivări pe mai multe rânduri | blocuri succesive sau `aligned` când trebuie citite împreună | [x] |
| Sisteme, matrici, determinanți, fracții ample | MathJax/Fira randat pe backend | [x] |
| Formule excepțional de late | potrivire controlată, apoi scroll dedicat și zoom | [x] baseline 390 px; [ ] comparație automată |
| Geometrie | puncte, segmente, cercuri și poligoane validate | [~] QA fizic pe fixture reprezentativ |
| Grafic de funcție | axe, grilă și serii validate în interval | [~] QA fizic pe fixture reprezentativ |
| Tabel/statistică | antet, rânduri și celule matematice randate înainte de stocare | [~] QA fizic pe fixture reprezentativ |
| Axă numerică | intervale și capete deschise/închise validate | [~] QA fizic pe fixture reprezentativ |
| Fotografia originală | disponibilă în panelul enunțului când o reprezentare sigură nu poate fi reconstruită | [x] în fluxul curent |
| Caiet | listă fără formule; documentul complet se deschide în lecție | [x] QA fizic |

## Goluri reale, fără cosmetizare

- [ ] Corpus anonim de minimum 200 de fotografii reale, echilibrat pe tipar/scris de mână, clase, domenii și calitatea imaginii.
- [ ] Etichetare separată pentru OCR, date, cerință, rezultat, fiecare pas, verdict și defecte de randare.
- [ ] Verificare deterministă pentru aritmetică, ecuații și alte familii unde un CAS poate confirma rezultatul fără a înlocui explicația.
- [~] Baseline-uri la 390 px pentru formule inline, formule late, sisteme, matrici și cele patru vizualuri structurate; lipsesc comparația automată și viewport-urile suplimentare.
- [ ] Taxonomie de erori și praguri de release măsurate, inclusiv rata de refuz corect pentru imagini neclare.
- [ ] Extinderea vizualurilor numai după fixture-uri reale: diagrame statistice, arbori de probabilitate și marcaje geometrice avansate nu sunt declarate suportate astăzi.

## Ordinea de închidere

1. Golden fixtures deterministe pentru randare și layout.
2. Corpusul real de 200 de fotografii și instrumentul de etichetare.
3. Benchmarkul furnizorului AI pe același corpus.
4. Verificare deterministă pentru familiile eligibile.
5. Praguri de release și regresie obligatorie înainte de fiecare build Play.
