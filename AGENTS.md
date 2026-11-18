# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Source organization

- `index.ts` registers `src/app/App.tsx`; keep navigation and startup composition in `src/app/`.
- Keep related screens, components, services, and utilities together in `src/features/<feature>/`. Create subfolders only when needed.
- Keep reusable foundations in `src/shared/`; shared code must not import from app or feature modules.
- Group backend modules by domain under `functions/src/`, with unit tests beside the code and emulator tests in `functions/tests/integration/`.
- Put app tests under `tests/mobile/`, configuration checks under `tests/config/`, and Firestore rules tests under `tests/firestore/`.
- Keep scripts in their existing purpose-based directories and update package commands, CI, and the README when moving them.

## Repository hygiene

- Keep release tasks in `docs/PLAY_STORE_RELEASE.md`.
- Write generated logs, screenshots, exports, native validation copies, and build artifacts under `.local/` (ignored by Git).
- Update the existing release checklist instead of adding implementation journals, audit dashboards, or duplicate status documents.
- Preserve local environment files, Firebase configuration, and signing credentials when cleaning generated files.
