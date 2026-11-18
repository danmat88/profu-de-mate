# Google Play release checklist

Policy references checked: **18 November 2026**. Complete each item against the release candidate and the actual Play Console/Firebase configuration. Record a short result or a CI/Console link beside completed items; keep raw build output in `.local/` or private artifact storage.

## Repository baseline

- App identifier: `ro.profudemate.app`.
- Expo SDK 57; Android compile/target SDK configured as 36.
- EAS `production` creates an AAB and selects Play Integrity; `development` creates a development APK.
- The repository includes automated checks, account-deletion flows, AI-result reporting, and hosted legal pages. Their production behavior still needs release verification.

## 1. Product decisions — Daniel

- [ ] Confirm the launch audience, countries, supported Android versions, and minimum age. The app currently declares a minimum age of 13; verify the selected AI service’s terms and the intended audience before launch.
- [ ] Approve the AI provider/model, image and text handling, retention, content safeguards, and operating budget. Test Romanian explanations and mathematical correctness on a representative problem set.
- [ ] Decide whether Premium launches now. If enabled, finalize products, pricing, quotas, cancellation/restore behavior, and RevenueCat/Google Play Billing configuration. If deferred, verify the released app accurately presents the available offer.
- [ ] Confirm the legal operator and working support/privacy/billing contact addresses in the app and hosted pages.

## 2. Play Console and listing — Daniel

- [ ] Complete developer identity, contact, and account verification. Create/select the app with the permanent package identifier above. [Console setup](https://support.google.com/googleplay/android-developer/answer/9859152)
- [ ] Configure Play App Signing and securely retain the upload key, account recovery information, and signing fingerprints.
- [ ] Prepare the Romanian listing: app name, short/full descriptions, category, contact details, current screenshots, store icon, and feature graphic. Ensure screenshots show the release candidate.
- [ ] Complete content rating, target audience, ads, app access/reviewer instructions, and all applicable App content declarations. Supply a reviewer path through authenticated or restricted features.
- [ ] Complete Data safety from the actual behavior of the app, backend, AI provider, Firebase, Crashlytics, Google sign-in, and any billing SDKs. Reconcile it with the privacy policy and retention behavior.
- [ ] Verify the public privacy, terms, and account-deletion URLs on mobile and while signed out. Test the in-app account deletion and the web deletion request route end to end. [Account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111)
- [ ] Verify in-app reporting of unsafe/offensive AI output, delivery to the responsible operator, and the moderation response process. [AI-generated content policy](https://support.google.com/googleplay/android-developer/answer/13985936)
- [ ] Check account-specific testing requirements. Personal accounts created after 13 November 2023 currently require at least 12 testers continuously opted into a closed test for 14 days, followed by a production-access application. [Testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465)

## 3. Production configuration and signed artifact — Engineering

- [ ] Select a clean release commit and run the validation commands in the README against that revision. Investigate dependency advisories and verify retained third-party licenses.
- [ ] Validate the EAS `production` environment and Firebase configuration. Confirm the production bundle contains no App Check debug token and uses `playIntegrity`.
- [ ] Verify the live backend has `PROFU_RELEASE_SECURITY_STAGE=play`, correct secrets, least-privilege service accounts, App Check enforcement, and an explicitly chosen Device Recall policy. Coordinate the backend change with the Play-distributed client.
- [ ] Register the **Play app-signing certificate** fingerprints in Firebase/Google authentication and integrity configuration. Distinguish those fingerprints from the AAB upload certificate.
- [ ] Build a new signed **AAB** with the `production` profile and an unused, increasing version code. Record its release commit, EAS build URL, SHA-256, and expected upload certificate.
- [ ] Run `npm run release:artifact-check -- <candidate.aab>` with `PROFU_RELEASE_CERT_SHA256` and `BUNDLETOOL_JAR` configured. Verify non-debuggable output, package identifier, manifest, permissions, and debug-token checks.
- [ ] Confirm the uploaded AAB meets the current target API requirement. New Android phone apps and updates currently require **API 36 or higher**. Recheck at submission. [Target API policy](https://support.google.com/googleplay/android-developer/answer/11926878)
- [ ] Inspect every shipped native library for 16 KB page compatibility and test on a 16 KB device/environment. Review Play Console’s compatibility results. [Android page-size guidance](https://developer.android.com/guide/practices/page-sizes)
- [ ] Install the candidate from a Play testing track and verify Play Integrity, Google sign-in, native permissions, and startup using the Play-delivered signature.

## 4. Release-candidate acceptance — Engineering + Daniel

- [ ] Verify cold/warm startup, Home’s fixed viewport, top/bottom system areas, all navigation, small phones, larger text, and reduced-motion behavior.
- [ ] Exercise camera permission allow/deny/retry, gallery selection/cancellation, crop/rotate/retake, and background/foreground transitions.
- [ ] Exercise typed solve/check with fractions, powers, radicals, long formulas, editing/undo, saved drafts, and the fixed submit action.
- [ ] Exercise complete photo and typed analyses, unclear inputs, provider errors/timeouts, offline recovery, app restart, and resuming the same request without duplicate charges.
- [ ] Verify rendered formulas, lesson navigation, alternate explanations, feedback reporting, and saved notebook lessons across restart and sign-in changes.
- [ ] Verify guest access, Google linking/sign-in/sign-out, quota exhaustion, daily reset in Europe/Bucharest, account isolation, export, and account deletion. Check partially completed account operations and recovery queues.
- [ ] If Premium is enabled, test Play purchases, restore, renewals, cancellations, refunds, entitlement changes, and webhook handling with test accounts.
- [ ] Resolve blocking crashes, ANRs, accessibility problems, and Play pre-launch report findings. Confirm usable behavior on every declared supported Android version.

## 5. Operations and rollout — Engineering + Daniel

- [ ] Confirm the deployed backend revision, rules, indexes, scheduled cleanup, retention, and deletion processing match the release candidate. Keep configuration checks separate from deployment confirmation.
- [ ] Establish working error/crash alerts, provider-spend alerts, quota limits, and an operator for support, AI-content reports, and failed deletion/merge/billing review jobs.
- [ ] Verify the AI pause control (`_runtimeConfig/ai.enabled`), request recovery, and a compatible rollback procedure. Preserve monotonic provider-attempt counters during incidents.
- [ ] Define backup retention/recovery objectives and complete an isolated restore exercise consistent with account-deletion obligations.
- [ ] Run internal testing, then the required closed test. Review tester feedback and obtain production access where required.
- [ ] Complete Console declarations, review access, release notes, distribution settings, and any remaining policy warnings for the exact uploaded AAB.
- [ ] Submit the candidate for review, then use a controlled production rollout. Monitor crashes, failed analyses, authentication, quotas, spend, and support reports before expanding availability.
