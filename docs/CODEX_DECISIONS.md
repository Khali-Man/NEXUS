# Engineering decisions

- Preserve the canonical NEXUS — Response Intelligence identity, final surface themes and English-first shared translation architecture.
- TypeScript/pnpm workspaces; Next.js App Router for command/assurance/admin, React/Vite for the two PWAs. Express modular backend with Zod REST contracts, Socket.IO notifications, Vitest and Playwright. No microservice decomposition beyond the durable worker.
- PostgreSQL 17/PostGIS 3.5 using SQL migrations and parameterised pg queries. Transactions lock aggregates; unique partial assignment constraints and unit locks protect contention. Actor-scoped idempotency serialises retries and rejects mismatched payloads.
- HttpOnly SameSite cookie sessions stored in PostgreSQL. Scrypt password hashes, bounded login attempts, origin checks, Helmet headers and strict role/agency membership checks. Local synthetic demo accounts only. Non-demo privileged use is refused rather than implying production authorisation/MFA readiness.
- 256-bit private receipt capabilities, SHA-256 digests at rest, explicit expiry, browser fragment-to-session handling and no tracking analytics. Citizen API projections never expose unit positions, operator identities or internal notes.
- Append-only canonical SHA-256 event chains with database mutation guards and checkpoints; no claim of external anchoring or immunity to database administrators.
- Outbox worker uses `FOR UPDATE SKIP LOCKED` and bounded retry scheduling, PostgreSQL notifications wake API realtime delivery. REST replay remains authoritative after reconnect; sockets do not prove human acknowledgement.
- Local licensed synthetic map geometry with MapLibre and accessible companion lists. External tile/routing services are optional; distance-only candidates explicitly report ETA unavailable. Never fabricate speeds or routes.
- Store only fictional Osogbo landmarks. Optional browser GPS is a temporary client-side aid, never written as precise visitor coordinates. No outbound SMS/USSD or government integration.
- Shared i18next/react-i18next en-NG catalogue, stable enum-to-message mapping, Intl dates defaulting to Africa/Lagos. Future complete human-reviewed languages require catalogue validation; no partial locale selector.
- Browser responder queue contains minimal commands with stable keys/version/timestamps, no narratives or tokens; clears on logout. Service workers cache static public shells only, never API responses.
- Development remains local. Docker is available. Browser binaries, packages and images use normal TLS/integrity verification. Set npm cache under /workspace because the home directory is restricted.
