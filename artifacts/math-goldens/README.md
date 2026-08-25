# Golden fixtures pentru documentul matematic

Aceste fișiere sunt artefacte de dezvoltare, nu asset-uri încărcate în aplicație.

- `symbolic.html` / `symbolic-390.png`: proză cu matematică inline, sistem, matrice și formulă excepțional de lată cu scroll intern.
- `visuals.html` / `visuals-390.png`: geometrie, grafic, tabel cu celulă matematică și axă numerică.

Regenerarea HTML-ului nu folosește rețeaua și nu instalează pachete:

```powershell
npm --prefix functions run build
node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/generate-math-goldens.mjs
```

Capturile curente au fost create la viewport CSS `390 × 1200`, cu Chrome și Playwright existente în mediul local. Comparația automată pixel-cu-pixel rămâne de adăugat în pipeline-ul de regresie vizuală; până atunci, schimbările intenționate ale PNG-urilor trebuie inspectate înainte de commit.
