# NEXUS implementation plan

The complete uploaded 3.0 specification and build brief were read on 19 October 2026. They match the repository copies byte for byte. The brief's alternate specification filename resolves to the supplied `NEXUS_Final_Product_Specification_for_Codex.md`.

## Inspection

Baseline HEAD: 70859bd917bc28408aea90a4b71ac06adcbab6c0. Only the two requirements documents existed, with no user modifications, package manifests, implementation, tests, or agent instructions. Node 24.19, pnpm 11.25, Docker 28.4 and Compose 2.40 are present. PostgreSQL/PostGIS will run locally through Docker. No real-world service integration or paid map credential is needed.

## Implementation sequence (all are delivery requirements)

1. Shared typed contracts, stable state enums, locale catalogues, design system, deterministic synthetic fixtures, pnpm workspace and CI.
2. PostgreSQL/PostGIS migrations, sessions and memberships, atomic idempotent commands, concurrency constraints, append-only event chains, transactional outbox, checkpoint verification and replay.
3. Authenticated agency/role scoped REST + Socket.IO, citizen capabilities and private tracking, dispatch candidates, responder actions, notes/links/corrections/reviews, exports and simulator controls.
4. Next.js dark command/assurance/admin, Vite light citizen and dark responder PWAs, all enumerated routes, persistent simulation warnings, accessibility, map/list fallback, durable field outbox and reconciliation.
5. Functional lifecycle, duplicate/concurrency, stale/expiry, RBAC/IDOR, audit tamper, browser/offline/viewport, lint/typecheck/build and localisation checks. Seeded comparative reliability and load measurements.
6. Windows/Docker setup, architecture/state/API/security/localisation/evaluation documentation, exact executed results and a requirement checklist.

## Verification rules

No successful UI action before server commit. No invented ETA or operational readiness. No unexecuted test reported as passed. A passing build does not stand in for functional validation. Required failing checks remain visible until diagnosed and corrected. Track screen and engineering coverage in `docs/REQUIREMENT_CHECKLIST.md`; unverified requirements remain open.
