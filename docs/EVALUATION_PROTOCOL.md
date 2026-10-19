# Research evaluation protocol

Run from the repository root with PostgreSQL available. `pnpm test:performance` creates/reuses isolated `nexus_bench`, migrates/seeds it, starts an API on 4100 and a deliberately emit-only Socket.IO baseline on 4101. This is a local controlled research experiment, not a production-capacity claim.

Five seeds at each of 100, 500 and 1000 simultaneous synthetic POSTs measure latency median/p95, errors and duplicate-reference outcomes under original-key retries. Capture total rows and committed business-event counts to ensure latency is not measured against failed requests. Limitations include process scheduling, local Docker storage and a 24-connection pool. Load generator CPU/memory are labelled as parent-process measurements, not API-container resource utilisation.

Five seeds at each of **actual wall-clock** 15s/60s/300s responder socket disconnection use a unit-specific offer. While disconnected, a dispatcher cancels the fictional incident and the baseline emits its matching event. After reconnection, the resilient REST replay must recover the missed cancellation; the original queued acknowledgement must return 409. The emit-only baseline has no history and cannot recover its missed matching event. Filter events by their own reference rather than counting unrelated concurrent scenarios.

Additional existing integration/browser checks cover retry storms, two dispatchers, cross-incident unit contention, stale locations, capability mismatch, offer expiry, clock-skewed client assertions, worker pause/recovery, source-history mutation guards, tampered copied history, map failure, private capability expiry, role/agency scope and durable offline device queuing.

k6 independently exercises 100 VUs and 500 requests using tests/performance/load.k6.js, with checks for server-confirmed receipt and a private capability. Store actual output in the verification report. Seed IDs must differ between runs when measuring fresh submissions.

Definitions: receipt latency is complete HTTP response time; replay completeness is recovered expected matching missed events / expected missed events; duplicate count concerns repeated original commands producing extra source records/events; convergence is time from reconnect initiation to authoritative replay/current state; arrival is a reported status, not independent physical verification. No claim of real emergency-response improvement follows from this simulator.
