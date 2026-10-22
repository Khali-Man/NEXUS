# Verification results — preservation review

This is the historical 19 October preservation record. See [the 22 October UI review and current checks](UI_POLISH.md) for the subsequent interface changes, expanded tests and screenshot contracts.

Validation host: Linux, 19 October 2026; Node 24.19.0, pnpm 11.25.0, Docker Engine 28.4.0, PostgreSQL 17.5/PostGIS 3.5.2. This is a fictional private research simulation. No operational emergency-service readiness is asserted.

## Exact commands and observed results

Commands ran from the repository root. Local production services were started with `pnpm start` after the frontend build; browser tests targeted those services. Database-restart testing ran separately from other database-dependent checks.

| Command                          | Actual result                                                                                                                                                                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm install --frozen-lockfile` | Passed; all six physical workspace projects already up to date; no lockfile/dependency changes.                                                                                                                                                                    |
| `pnpm setup`                     | Passed; existing database/history/accounts preserved, migrations 001–004 applied, local receipt and Ed25519 configuration present. Repeat setup passed.                                                                                                            |
| `pnpm lint`                      | Passed.                                                                                                                                                                                                                                                            |
| `pnpm typecheck`                 | Passed for root and Next.js.                                                                                                                                                                                                                                       |
| `pnpm exec prettier --check .`   | Passed; original specifications and raw output archives are deliberately excluded from formatting.                                                                                                                                                                 |
| `pnpm test`                      | **84 passed**, seven files, zero failed/skipped in the final run at 21:09:03 UTC.                                                                                                                                                                                  |
| `pnpm test:routing`              | Passed against the actual pinned OSRM Docker engine; fictional fixture one-way path 331 m forward / 995 m return, model 48 seconds forward; service outage produced unavailable ETA.                                                                               |
| `pnpm build`                     | Next.js and both Vite production builds passed. Deferred MapLibre chunk size remains an optimisation advisory.                                                                                                                                                     |
| `pnpm test:e2e`                  | **16 passed**, zero failed/flaky/skipped in the final production Chromium run (1.4 minutes), including five-role axe/visual checks, 320px through 4K layouts, offline lifecycle, route presentation/fallback and signed-history download/independent verification. |
| `pnpm test:performance`          | Passed; 15 load runs across five seeds at 100/500/1,000 concurrency; 8,000 fresh submissions; zero API errors and duplicate references. All 15 outage cases recovered the expected missed event and rejected stale commands with 409.                              |
| `pnpm test:k6`                   | Passed; 100 VUs, 500 requests, 1,000/1,000 checks, zero HTTP failures. Median 1.61 s, p95 3.48 s on this shared host.                                                                                                                                              |
| `pnpm test:db-restart`           | Passed at 21:09:39 UTC; API/session/new command/worker notification recovered after an actual Postgres container restart, measured 2,194.83 ms.                                                                                                                    |
| `pnpm maps:download`             | **Blocked/failed**, exit 1: the egress proxy rejected the Overpass request with HTTP 403. Actual Osogbo road import is not verified.                                                                                                                               |

Vitest covers domain/localisation (7), real PostgreSQL integration/security including retry storm and routing API ranking/fallback (21), independent signed-history verification/rotation/tampering/key refusal (4), HTTP route provider failure/coalescing (2), deterministic scenarios (45), and authenticated realtime/revocation/reconnect (5). Tests use isolated `nexus_test`; load experiments use `nexus_bench`. No development history was reset or overwritten to make verification pass.

During test development, a new audit assertion used the wrong error field; it was corrected to the documented `{code,...}` shape. The route integration fixture initially inherited too many fresh units from earlier tests; it now isolates/restores fixture freshness explicitly. Browser route selectors were corrected to use the Overview tab and allow the timestamp following unavailable ETA. These failed attempts were investigated; they are not counted as passes or masked through skips/baseline replacement.

## Fresh comparative measurements

Raw [benchmark-results.json](results/benchmark-results.json), run **21:01:35.094–21:06:40.658 UTC**. Four host CPUs, 35,743,760,384 reported memory bytes, 24-connection pool, isolated benchmark API rate limit 50,000/minute. Builds, tests and browser verification shared host resources during portions of the run. Parent-process resource counters describe the load generator, not isolated API CPU/memory. Existing fictional benchmark history was retained; these measurements are not a pristine empty-database capacity estimate.

| Concurrent requests | Seeds | Durable median range | Durable p95 range | Emit-only baseline p95 range |
| ------------------- | ----- | -------------------- | ----------------- | ---------------------------- |
| 100                 | 5     | 260–784 ms           | 336–1,041 ms      | 42–514 ms                    |
| 500                 | 5     | 663–1,418 ms         | 1,192–1,962 ms    | 143–527 ms                   |
| 1,000               | 5     | 1,579–4,822 ms       | 2,597–7,723 ms    | 371–2,469 ms                 |

The deliberately simpler emit-only baseline has no durable state/replay; its latency is not equivalent functionality. Across the five seeds for each requested 15/60/300-second disconnection, resilient replay recovered the expected cancellation in all 15 cases; the baseline recovered zero matching missed events. Every stale queued acknowledgement returned 409. Requested and measured intervals differ under host contention:

| Requested offline interval | Measured offline range | Reconnect-to-replay range |
| -------------------------- | ---------------------- | ------------------------- |
| 15 s                       | 20.65–21.18 s          | 5,455–5,523 ms            |
| 60 s                       | 60.30–60.76 s          | 175–182 ms                |
| 300 s                      | 303.20–303.71 s        | 2,596–3,021 ms            |

Independent [k6.txt](results/k6.txt) is a separate fresh-request run. These descriptive measurements vary with shared CPU scheduling, storage, database size and concurrent verification. They do not establish production capacity, statistical generality or real emergency-response improvement.

## Evidence and boundaries

Raw [test output](results/test-results.txt), [build output](results/build-results.txt), [browser report](results/browser-results.json), [routing engine evidence](results/routing-engine.json), and [database restart](results/database-restart.json) accompany the source. Five current unmasked application captures were visually reviewed and are linked in [SCREENSHOTS.md](SCREENSHOTS.md). Automated shell baselines mask changing IDs, clocks, counts and live map/data regions; unmasked application screenshots are separate evidence. Baselines were not replaced to hide failures.

Signed checkpoints and exported histories are independently checked by a separate Node process using only standard-library cryptography and a separately supplied public registry. They are **not externally anchored** and do not prove physical events. Public key fingerprints are safe metadata; private keys, `.env`, database volumes, dependencies, generated app builds and Playwright traces are excluded from Git.

**Not executed/verified:** Windows 11/Docker Desktop; actual Osogbo OSM import/real-city routes; non-Chromium and native mobile PWA installation; manual screen-reader review; independent penetration testing; KMS/HSM custody; external timestamp/anchor; GitHub Actions remote execution. Complete Windows instructions, routing operations and signing trust limits are documented. See [inventory](IMPLEMENTATION_INVENTORY.md) for remaining partial implementation requirements, including API response-schema coverage, review evidence workflow and automatic history/TTL deletion. No public deployment, real emergency integration or live responder tracking was performed.

Git preservation and the blocked actual PR attempt are recorded in [GIT_PRESERVATION.md](GIT_PRESERVATION.md); [PR_DESCRIPTION.md](PR_DESCRIPTION.md) is ready for review. Git push succeeded; GitHub API POST was rejected by the environment proxy.
