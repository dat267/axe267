# Modernization review

The project already uses Svelte 5 runes, Tailwind CSS 4, Vite 8, and structured Go logging. A framework rewrite would add risk without addressing the main findings. This pass keeps the UI, API routes, Firestore schema, and EPUB cache keys intact.

## Addressed

- **High: API-key email impersonation.** `firestore.rules` previously checked the key owner's UID but not `userEmail`. The backend trusts that email when writing or deleting notifications. New keys must match both the authenticated UID and token email.
- **High: reading-progress ownership takeover.** Updates previously checked only the proposed UID, allowing a caller to overwrite another user's progress with their own UID. Updates now require ownership of the existing document as well. Legacy documents without a UID remain migratable by their owner.
- **Reader first-use failure.** Reading an absent progress document was denied by the rules, rather than returning an empty snapshot. A user can now check for an absent document under their own UID prefix. Existing documents still require ownership.
- **Concurrent rate-limiter race.** `backend/handlers.go` read the count after releasing its mutex. Incrementing and deciding whether to reject a request now occur under the same lock. A concurrent regression test runs with the Go race detector.
- **Request cancellation.** Notification storage operations now receive `r.Context()` instead of the process-wide background context.
- **Incomplete JSON/body validation.** Notification POST requests must contain one JSON value with no trailing non-whitespace data, and the size limit applies to the entire body, including trailing whitespace.
- **EPUB cache write failures.** A cache quota error no longer causes a second download. Stale versions are removed only after the replacement is stored, preserving an offline copy if the write fails.
- **Dependency advisories.** Updated compatible locked dependencies and minimum overrides for `shell-quote`, `@xmldom/xmldom`, and `@grpc/grpc-js`. Both npm audits report zero known vulnerabilities at verification time. Firebase remains at the previous locked version, 12.12.1, to avoid an unrelated bundle-size increase observed during the upgrade trial.
- **Inconsistent verification.** Pull requests now run the same reusable validation workflow as deployments and releases. It includes frontend tests, lint, build, Go vet/race tests, and emulator-backed Firestore tests. Node 24 LTS and the Go module's version are used consistently in CI. Release installs now use the npm lockfile and receive the Firebase build variables used by deployment.
- **Documentation drift.** Added the missing root `build` script, documented reproducible installs and verification, and corrected the claim that every Storage overwrite necessarily rotates its download token.

## Production action required

The reviewed frontend, backend, and rules were deployed to `axe267` on 2026-10-10 (UTC). Rule changes do not retroactively validate existing documents. Before treating the API-key impersonation issue as resolved in production, review existing `api_keys` records against their owners' Firebase Auth accounts and revoke keys with mismatched UID/email pairs. Do not log or export plaintext keys during this audit. The deployment does not replace this existing-key audit.

## Follow-up findings

1. **Rate-limit trust and memory bounds:** `clientIP()` trusts the first `X-Forwarded-For` value without an explicit proxy trust policy. Confirm Cloud Run's actual header behavior before relying on that value for abuse prevention. The process-local `rateLimiters` map never evicts inactive addresses and is not shared across instances. Consider authenticated UID limits, bounded eviction, and an upstream abuse limit in a separate change.
2. **API-key lifecycle:** `firebaseVerifier.VerifyAPIKey()` only checks the stored key record, not whether its Firebase Auth account has been disabled or deleted. `deleteAccount()` deletes the Auth user but does not delete API-key records. Define and test revocation semantics before extending account deletion.
3. **Reader identity/versioning:** `progressDocId()` and `locationsStorageKey()` derive identity from sanitized titles. Distinct files with the same or similarly sanitized titles can share progress or pagination data. Storage overwrites can retain a download URL. Creation rules also accept arbitrary progress document IDs, so a user can reserve another user's expected ID with their own UID. Define migration-safe ID constraints and a file-path/version scheme with backward-compatible handling of saved data.
4. **Async lifecycle risks:** `authStore.svelte.js` publishes admin lookups without checking that the user is still current. `Reader.svelte` has pending book-open, location-generation, and delayed progress-save work that can outlive a close or user change. Add deferred-promise tests and cancellation/identity guards before changing these flows.
5. **Browser and release coverage:** The existing Playwright test only checks a transient loading state. Frontend server binaries, their external `dist` assets, and cross-platform launch behavior are not covered by the validation workflow. Add stable unauthenticated/authenticated browser scenarios and packaged-server smoke tests as a separate pass.

## Verification boundaries

Regression tests reproduced the authorization, absent-progress, race, cancellation, JSON, and cache failures before their fixes. The Firestore tests run against a local `demo-axe` emulator and include positive checks for normal key creation, progress updates, and legacy migration. No production credentials or database access are needed.

Local unit tests, lint, frontend build, Firestore emulator tests, npm audits, and workflow syntax validation were run.

## Live deployment verification

- Hosting: `https://axe267.web.app`; the deployed HTML and all 15 generated assets match the local production build byte for byte.
- Cloud Run: `axe-backend-00046-khh` is ready and receives 100% of traffic in `asia-southeast1`.
- Firestore: the active ruleset `0d22d5de-efc1-4159-9773-3564bb7a495a` matches the reviewed local rules exactly. Storage rules and configured indexes were also deployed. One existing index absent from the local configuration was preserved.
- Live API: health returns HTTP 200 with `status: ok` through both Hosting and Cloud Run. Unauthenticated notification POST/DELETE requests return HTTP 401; OPTIONS/CORS checks pass.
- Browser: headless Chromium verified desktop (1440 by 900) and mobile (390 by 844) sign-in screens, sign-up/reset form navigation, and authentication gates on `/reader`, `/settings`, `/integrations`, and `/notifications`. No uncaught page exceptions, failed site requests, or horizontal overflow were observed.
- Screenshots: `tmp/live-verification/desktop.png` and `tmp/live-verification/mobile.png` (local, git-ignored).
- Cloud Run logs: no ERROR-or-higher entries were returned for the new revision during the post-deployment check.

Authenticated reader/notification flows, production rule behavior using ordinary user credentials, and the cross-platform release matrix were not exercised. No accounts, notifications, books, or API keys were created, deleted, or revoked during live verification. No git commit or push was made.
