# Assurance CI snapshot diagnosis and five-workspace design review

Historical review of the CI-only correction at `3af9f3e`. The subsequent work addressing all five UI findings is documented in [UI_POLISH.md](UI_POLISH.md), with fresh before/after captures and separate verification.

This correction targets [GitHub Actions run 39325815728](https://github.com/Khali-Man/NEXUS/actions/runs/39325815728), commit `94062e1162844e49f7e7a06f296afbfb6167ef3d`. NEXUS remains a fictional research simulation. No product styling, branding, translations, backend behaviour or safeguards are changed by the correction.

## Artifact access and reproduced evidence

The public run/job pages confirm a failed simulator job and list artifact `nexus-verification`, ID `12222073109`, digest `sha256:6e172e239e9a32be680a02af54335e06151dab8ec5f3cef4386a3c8f1c34afff`. The authenticated artifact API is still blocked by the cloud egress proxy (`gh run view ...`: Forbidden); the logged-out official web download returns 404. **The original remote expected/actual/diff/trace have not been downloaded or inspected.** The existing environment draft already contains `api.github.com`; its presence in a saved draft does not prove runtime access.

Instead, the unchanged tests at the reported commit were run against a new isolated, migrated/seeded PostgreSQL database, using the existing production builds and the actual API/worker. Existing development/research data was preserved. This reproduced **15 passing tests and the same assurance failure category: 129,927 different pixels, reported ratio 0.11**. [Raw local reproduction](results/visual-regression-before.txt).

These three images are from that **local reproduction**, not claimed to be downloaded CI artifacts:

| Expected                                     | Actual                                   | Diff                                 |
| -------------------------------------------- | ---------------------------------------- | ------------------------------------ |
| [Expected](ci/assurance-before-expected.png) | [Actual](ci/assurance-before-actual.png) | [Diff](ci/assurance-before-diff.png) |

The locally retained Playwright trace was inspected: `/assurance/metrics` returned HTTP 200, `sampleSize:4`, and four rows. The expected image was made with accumulated local records: its pink `.table-scroll` mask extends beyond the 900px viewport. With four records, the same mask ends at **y=787**, revealing the disclaimer, rounded panel bottom and page background. The main diff is the strip below that boundary; typography, sidebar, heading, cards and top of the panel align. This is a test-input dependency on previous database history, not evidence of a changed product stylesheet. The original CI trace remains an access limitation, so the diagnosis is grounded in the independently reproduced failure and must be assessed with the new remote run.

## Correction and regression protection

- The assurance **visual test only** receives a fixed sixteen-row fictional metrics response before navigation. Sixteen rows exercise missing and present measurements while keeping the original populated-table viewport composition stable on clean and accumulated databases.
- The test waits for all sixteen rows and checks the four known metric values (`30 s`, `60 s`, `30 s`, `180 s`) and explicit missing values before accessibility analysis and screenshot comparison.
- The separate supervisor product journey continues to use the **unmocked authenticated API**. It now checks HTTP success, nonzero sample count, count/row consistency and the first rendered reference against the real response, before replay/export checks.
- All five existing PNG baselines are unchanged. `maxDiffPixelRatio:0.003`, pixel thresholds, masks, viewport, axe tags, browser-error checks and every existing test remain unchanged. No snapshots were regenerated, additional regions hidden, assertions disabled or retries used to turn a failure into a pass.
- No application/CSS changes are needed: genuine short/long histories remain free to render their natural height. Only the visual-test input becomes deterministic.

## Five-workspace visual review

Reviewed the five unaltered captures linked in [SCREENSHOTS.md](SCREENSHOTS.md) against product specification sections 4/4A. The light citizen and dark command/assurance/admin/high-contrast responder themes, Inter typography, linked-path identity, restrained teal/amber palette and conspicuous simulation warnings are consistent. The design is cohesive, but a blanket claim of final premium polish would be premature.

| Workspace     | Specific issue still visible                                                                                                                                                         | Recommended refinement, outside this test-only correction                                                                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Citizen       | The welcome page shows “Keep this private link safe” before any receipt exists. The large compass/orbit artwork feels more generic than the linked-path brand.                       | Scope receipt privacy advice to receipt/tracking; use a more specific response-journey illustration while keeping the calm light palette and acknowledgement gate.                                                    |
| Dispatcher    | With no road dataset, the large blank context canvas and small unavailable label make the primary workspace look unfinished. Narrow queue controls and microcopy are visually dense. | Validate and provision licensed roads; give unavailable-map state a stronger hierarchy/legend and retain companion lists. Improve filter grouping/readability without fabricating geographic context or ETA.          |
| Responder     | Completed missions repeat at the same card weight in the inbox. A long full-page capture makes the fixed bottom navigation appear across the scrolling card stack.                   | Give offered/current missions precedence, group/collapse completed history and verify bottom clearance at each field viewport. The full-page screenshot alone does not establish an actual navigation-overlap defect. |
| Supervisor    | The large table dominates the page, and repeated “Server confirmed” captions are generic; they do not explain measurement coverage. Long histories produce an extended page.         | Add per-metric measured/sample context, clearer duration/absolute-time definitions and appropriate table navigation. Keep missing values visible and never imply verified physical arrival.                           |
| Administrator | Nine equally weighted text-heavy cards and a long run list create a uniform catalogue appearance. Two direct-unit fault badges show unknown dashes.                                  | Group scenarios by research purpose, foreground the selected run and persist/display fault-control state. Preserve explicit reset confirmation and admin/demo enforcement.                                            |

These are identified design refinements, not silently implemented redesigns or claimed completed work. No feature, simulation warning or English-first message architecture was removed to repair CI.

## Verification

The unchanged suite reproduced the failure on a clean database. The corrected assurance snapshot passed against the **original** baseline locally. Local commands:

- `pnpm exec playwright test tests/e2e/quality.spec.ts --grep assurance`: passed against the original baseline.
- `pnpm lint`: passed.
- `pnpm typecheck`: passed.
- `pnpm test`: 84 passed, zero failed/skipped.
- `pnpm test:e2e`: full result is retained in [visual-regression-after.txt](results/visual-regression-after.txt).
- `git diff --exit-code 94062e1 -- tests/e2e/quality.spec.ts-snapshots`: passed; all baselines are byte-for-byte unchanged.

The pre-push local check does not establish a remote pass. GitHub's public workflow page exposes each run's conclusion and exact commit, independently of the blocked artifact API; the final review response supplies the new commit-specific CI run URL and observed outcome. The workflow itself is unchanged and reruns backend/database/routing/lint/TypeScript/build and all browser checks.
