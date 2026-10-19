# Verification results

Validation date: 19 October 2026. This is a local independent research simulator, not an operational emergency system.

## Executed checks

- Repeatable `pnpm setup`: PostgreSQL/PostGIS health, versioned migrations and synthetic seed succeeded without deleting history or replacing existing accounts.
- `pnpm lint` and both root/Next.js TypeScript checks passed.
- Vitest: **75 tests passed** across domain/localisation, PostgreSQL integration/security, realtime and all nine deterministic scenarios at five seeds each. No expected failures/skips replace required assertions.
- Production Next.js and both Vite builds succeeded. MapLibre is split into a deferred client chunk; its bundle-size advisory remains an optimisation opportunity, not a hidden failed build.
- **14 production Chromium browser tests passed**, including the five-surface axe/visual regressions. Browser flows verify citizen receipt/tracking, CAD filtering/detail/units, assurance replay/download, simulator controls, responder profile/outbox, keyboard/reduced-motion/viewports and the complete offline lifecycle. The final browser report and screenshots are retained under `artifacts/`.
- Five-surface axe checks and screenshot baselines cover citizen, command, assurance, simulator and responder. Low-contrast citizen secondary copy found by axe was corrected before baseline acceptance.

A real PostgreSQL container restart was also exercised: the API, sessions, new commands, worker delivery and the dedicated notification listener recovered in about 2.04 seconds. See [database-restart.json](results/database-restart.json). The listener reconnects with bounded backoff and prompts clients to reconcile; notification dispatch still does not prove browser receipt.

The final complete browser run and unit/integration run are retained in [browser-results.json](results/browser-results.json) and [test-results.txt](results/test-results.txt); successful build output is [build-results.txt](results/build-results.txt). The browser suite also exercised a French browser locale with English fallback, denied and mocked on-device GPS, long strings at 320px and throttled network conditions (120ms latency, 200 KiB/s download, 100 KiB/s upload).

The offline browser lifecycle actually disconnects the field context, queues acceptance without changing the central OFFERED state, navigates to the cached PWA outbox while offline, reconnects with the original key, reports progress and closes the incident. Citizen tracking then shows the nine confirmed states and removes the capability fragment from the address bar.

## Measured comparative experiments

Raw output: [benchmark-results.json](results/benchmark-results.json). The final measured run began at 15:37:08 UTC and completed at 15:42:10 UTC. Node 24.19.0; Linux; four available CPUs; 35,743,760,384 bytes reported host memory; local PostgreSQL/PostGIS and a 24-connection API pool. The host also performed verification work, so these are shared-host observations with visible run-to-run variation.

| Simultaneous requests | Seeds | Durable median range | Durable p95 range | Emit-only baseline p95 range | API errors / duplicate references |
| --------------------- | ----- | -------------------- | ----------------- | ---------------------------- | --------------------------------- |
| 100                   | 5     | 182–530 ms           | 298–673 ms        | 24–310 ms                    | 0 / 0                             |
| 500                   | 5     | 504–880 ms           | 857–1,234 ms      | 70–243 ms                    | 0 / 0                             |
| 1,000                 | 5     | 1,233–3,114 ms       | 2,434–4,713 ms    | 866–1,699 ms                 | 0 / 0                             |

The durable engine completed **8,000 fresh synthetic submissions**, plus original-key retries. The faster baseline intentionally omits durable state and replay; its latency is not equivalent functionality. All 15 real wall-clock outage cases (15s/60s/300s × five seeds) recovered the expected missed cancellation; the emit-only baseline recovered zero matching missed events. Every stale queued acceptance returned 409. Observed reconnect-to-replay completion ranged **70–373 ms**. These are five-seed descriptive ranges, not a general statistical guarantee.

Independent k6 output: [k6.txt](results/k6.txt). **100 VUs, 500 HTTP requests, 1,000 checks passed, zero HTTP failures**. Median request time 243.77 ms; p95 460.63 ms. This is a separate fresh-request run against the isolated benchmark database and a raised local test rate limit, not the public default rate-limit policy.

## Boundaries and unrun checks

Windows/Docker Desktop execution, non-Chromium browsers, manual screen-reader review, independent penetration testing, external map/routing services, external audit anchoring and production emergency-service use were not validated here. The default tested map mode is an explicit synthetic schematic with companion lists and unavailable ETA. No real emergency contact, official endorsement, real tracking or real responder deployment is present.

The GitHub Actions workflow is provided but has not been executed on GitHub from this session. Current-host validation and generated build artefacts do not imply publication or deployment elsewhere.
