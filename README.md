# Profu’ de mate

Romanian Android study companion for solving and checking photographed or typed mathematics problems, studying offline formulas, practicing curated & AI exercises, and taking timed Evaluarea Națională / BAC simulations with AI rubric photo grading.

Built with Expo SDK 57, React Native, TypeScript, and Firebase. The publication backlog is maintained in [Google Play release checklist](docs/PLAY_STORE_RELEASE.md).

## Project structure

```text
src/
  app/                       App composition, 3-tab Studio shell, navigation, and startup
  features/
    home/                    Home screen and its animated surface
    capture/                 Camera, image review, and temporary images
    analysis/                Request processing and recovery
    math/                    Written editor and math rendering
    lessons/                 Lesson screens and saved notebook
    study/                   Study hub, curriculum tracks, offline formulas, and cloud sync
    practice/                Curated & AI practice sessions, repeat queue, and streaks
    exams/                   EN VIII & BAC M1/M2/M3 guides, 100p simulations, and AI rubric grading
    account/                 Settings, sign-in UI, legal disclosures, and account deletion
    access/                  Allowances, Premium, and purchases
    feedback/                In-app lesson reporting
  shared/                    Reusable UI, hooks, platform services, and types
functions/
  src/
    index.ts                 Firebase handler entry point
    analysis/                AI pipeline, validation, and math rendering
    study/                   AI practice generator and exam photo rubric grader
    accounts/                Account merging (including study progress) and deletion
    access/                  Server allowances and device identity
    billing/                 RevenueCat integration
    feedback/                Report submission and triage
    infrastructure/          Runtime configuration, cleanup, and security
    types/                   External module declarations
  tests/integration/         Emulator-backed backend tests
  scripts/                   Backend provider diagnostics
tests/
  mobile/                    App logic, study math integrity, lifecycle, and UI checks
  config/                    Build, dependency, and release checks
  firestore/                 Firestore security rules
  helpers/                   Test adapters
scripts/
  content/                   Offline MathJax Fira SVG pre-compiler for study/exam content
  env/                       Client environment validation
  firebase/                  Deployment and emulator commands
  release/                   Bundle, artifact, and legal checks
  qa/                        Math previews and isolated native validation
  lib/                       Shared script helpers
assets/                      Current branding, illustrations, and UI icons
hosting/public/              Public legal, support, and deletion pages
docs/PLAY_STORE_RELEASE.md   Publication checklist
vendor/                      Compatibility code and its license
.github/                     CI and dependency updates
```

The Expo entry point and Expo/Firebase configuration remain at the repository root, where the tools expect them. Generated validation output belongs in `.local/`, which is ignored by Git. Expo manages its own ignored `.expo/` cache; native `android/` and `ios/` directories are generated from the Expo configuration when needed.

`index.ts` registers `src/app/App.tsx` with Expo. App composition lives in `app/`; feature screens, components, services, and utilities live together under their feature. Add subfolders only as needed. Keep `shared/` independent of features and reserve it for code used across the app. ESLint enforces that shared code cannot depend on features or app composition, and features cannot depend on app composition. Backend unit tests sit beside the modules they exercise; emulator integration tests live separately.

## Local development

Use Node.js 22 and npm 10 or 11, as declared in `package.json`. For a fresh checkout, install the locked dependencies:

```powershell
npm ci
npm --prefix functions ci
```

Restore the private Firebase configuration (`google-services.json`) and authenticate the existing Expo and Firebase tools. Keep signing material in the ignored `credentials/` directory; `credentials.json` describes its local location. `.env.example` lists the client environment variables.

With dependencies and private configuration already present:

```powershell
npm start
```

This pulls the EAS `development` environment into `.env.local`, validates it, and starts Metro on the local network. Open the installed development build on a phone connected to that network or providing the laptop’s hotspot.

To reuse an already configured local environment without pulling it again:

```powershell
npm run dev:phone:local
```

## Validation

```powershell
npm run content:compile
npm run check
npm run test:mobile
npm run functions:test
npm run test:rules
npm run legal:check
npm run release:bundle-check
```

`content:compile` pre-compiles all curated formulas, exam guides, practice questions, and simulation items into offline MathJax Fira SVG (`src/features/study/data/renderedMath.generated.ts`). `test:rules` runs against a local demo Firebase project. It does not deploy infrastructure. Firebase logs from the test and deployment wrappers are collected under `.local/logs/`.

For optional visual or native diagnostics:

```powershell
node --experimental-strip-types scripts/qa/generate-math-goldens.mjs
node scripts/qa/prepare-native-validation.mjs
```

The math renderer needs `npm run functions:build` first. Generated math previews and isolated native workspaces stay under `.local/`.

## Release and operations

The EAS `development` profile creates a development APK. The `production` profile creates the Android App Bundle used for Google Play. Follow the [release checklist](docs/PLAY_STORE_RELEASE.md) for signing, Play Integrity, store declarations, testing, and rollout.

```powershell
node scripts/firebase/deploy-firebase.mjs --preflight-only
npm run deploy:firebase
```

The preflight command checks local deployment configuration. The deployment command publishes Functions, Firestore rules/indexes, and Hosting to the configured Firebase project. Backend environment files live under `functions/` and remain private.

Runtime diagnostic collection in the app is part of production support. Generated debug logs, screenshots, APKs, and historical implementation reports are not source files and do not belong in Git.
