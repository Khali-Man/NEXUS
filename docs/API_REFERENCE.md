# REST and realtime API

Base `/api/v1`; generated route inventory and shared Zod request schemas at `/api/v1/openapi.json`. `POST` commands require `Idempotency-Key` (maximum 128 characters); incident mutations include `expected_version` and a 3–500 character reason. Errors use `{code,message,correlationId,retryable,details?}`. Query UUIDs, dates and bounded bodies are validated. Collections use bounded limit/offset or sequence/time cursors.

| Scope             | Endpoints                                                                                                                                                                                                               |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public            | GET health, demo/reference-data, demo/map-style, demo/roads; POST demo/incidents; GET demo/incidents/:reference/status; POST demo/incidents/:reference/feedback                                                         |
| Session           | POST auth/login, auth/logout; GET auth/me                                                                                                                                                                               |
| CAD               | GET cad/overview, cad/incidents, cad/incidents/:id, :id/events, :id/candidates, :id/duplicates, cad/units, cad/network                                                                                                  |
| Operator commands | POST cad/incidents/:id/triage, ready, assignments, reassign, cancel, resolve, close, note, link; cad/assignments/:id/withdraw                                                                                           |
| Responder         | GET responder/assignments, assignments/:id, profile, sync; POST assignments/:id/accept, decline, en-route, arrived, outcome; heartbeat                                                                                  |
| Assurance         | GET assurance/metrics, incidents, incidents/:id/replay, audit/verify, audit/checkpoints, audit/checkpoints/:id/bundle, reviews, reports/export; POST audit/checkpoint, incidents/:id/reviews, incidents/:id/corrections |
| Simulator         | GET simulator/scenarios, runs/:id, settings, tamper-demo; POST scenarios/:slug/run, scenarios/:runId/step, reset, faults, settings                                                                                      |

Citizen status/feedback require `X-Receipt-Token`. Tokens are 256-bit HMAC-derived capabilities; only SHA-256 digests are stored with incidents, and retry result rows omit token values. Fragments are removed from browser URLs after session-storage exchange. No token query-string tracking or analytics.

Sessions use HttpOnly SameSite=Strict cookies, configurable Secure in TLS deployments, eight-hour expiry and PostgreSQL storage. Login throttles failures. Mutation origin validation rejects unapproved origins. Responses use no-store/no-referrer. Every privileged route enforces role and agency; field routes also enforce current fictional membership. Supervisor is distinct from admin. `DEMO_MODE=false` refuses simulator actions and new local-demo logins.

Socket.IO uses `/socket.io` with `addTrailingSlash=false` through same-origin proxies. Authentication is a server session or private reference+capability. Server-selected rooms are agency, unit or receipt. Event envelope: `{eventId,incidentId,sequence,aggregateVersion,emittedAt,type,safePayload,simulation:true}`. Citizen rooms receive sync hints only. REST replay repairs dropped events; do not infer acceptance from socket delivery.

Exports support `from`, `to`, `q`, `status`, `category` and `format=csv|pdf`; the bounded export reports its record count/total and omissions. Coordinates, narratives, user identities and receipt material are excluded. Large datasets require pagination; export limit is explicitly disclosed rather than silently claiming full coverage.

Road candidate responses include `eta_seconds`, `eta_source`, `route_distance_m`, `route_geometry`, `estimate_at`, `routing_data_version`, `traffic_aware`, `uncertainty`, `route_reason` and `ranking_basis`. Complete eligible coverage ranks by model time; failures use geographic distance with null ETA. See [maps](../infra/maps/README.md).

Checkpoint exports contain `checkpoint` (versioned Ed25519 payload/signature) and covered normalised `events`. Obtain the public trust registry independently. The list exposes computed `signatureVerification` separately from persisted `SIGNED_NOT_ANCHORED` provenance; legacy rows are unsigned. See [independent verification](AUDIT_SIGNING.md).

Zod request validation covers mutations; OpenAPI currently provides route/request inventory with limited endpoint-specific response schemas. Full response-schema/runtime validation remains partial.

UI review additions (22 October 2026):

- `GET cad/incidents?active=true` excludes closed/cancelled records; omitting it preserves the full history view. Other status/category/date/search filters still apply.
- `GET assurance/metrics` includes `acknowledged_offer_at`, the offer time belonging to the first accepted assignment. Per-incident acknowledgement duration uses this pair, including in CSV/PDF exports. First-offer timing stays separate. Missing/invalid interval endpoints are never zero-filled in the interface.
- `GET simulator/scenarios` accepts `limit` (1–30, default 6), `offset` (0–100000), `scenario` (slug) and `runStatus` (`active`, `completed`, `stopped`, or empty). It returns all fixture definitions, the scoped run page and `totalRuns`, `runLimit`, `runOffset`. Run detail and step commands enforce agency scope.
- `cad/network.settings` merges global service injections with agency-scoped `stale_locations` and `unit_unavailable` booleans. Migration 005 stores those flags. Enabled location injection survives heartbeats; enabled unit injection survives assignment release and fixture creation. Occupied units keep their assignment. Disabling refreshes locations/returns unreserved units to available, as labelled in the UI.
- Migration 006 records `scenario_runs.stopped_at`/`stop_reason`. Reset stops unfinished runs without deleting events or completed history, clears both unit flags and all service injection flags (including acknowledgement delay), and rejects further steps for stopped runs.
- Public citizen intake is bound to the seeded `dispatcher` account's fictional agency, not alphabetical agency names. Privileged fixture creation uses the authenticated administrator's agency. No public request parameter chooses an agency.
