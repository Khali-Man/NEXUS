# NEXUS — Complete Product, UX and Engineering Specification for Codex

**Version:** 3.0 FINAL, 19 October 2026  
**Product name:** **NEXUS — Response Intelligence**  
**Product language:** English (`en-NG`) at launch; translation-ready architecture  
**Theme direction:** Dark command centre, supervisor, and administrator; light citizen application; high-contrast responder application  
**Scope lock:** Complete integrated research simulator, not a partial UI demo  
**Project category:** Integrated emergency-response coordination and accountability research simulator  
**Status:** Independent, non-operational prototype. Not affiliated with or endorsed by NPF, NCC, any emergency agency or the Nigerian 112 programme.  
**Audience:** Product designer, senior full-stack developers, Codex, technical reviewers  
**Geography:** Fictional incidents, units and agencies in a geographically plausible Osogbo-focused demonstration. Use public map roads/landmarks as permitted by map licences, but no real officer/unit location data.

> **Product promise:** A citizen can see which steps of their *simulated* emergency request have actually happened; a dispatcher can coordinate fictitious responders; a responder can reliably acknowledge or update an assignment; a supervisor can replay the exact recorded sequence and distinguish operational delays from communications failures.
>
> **Universal warning:** **RESEARCH SIMULATION — NOT CONNECTED TO EMERGENCY SERVICES. THIS APPLICATION CANNOT SUMMON HELP.** The warning must be clearly visible at public entry and in all app shells, printouts and shared screenshots, with a link to general local emergency guidance. Do not claim universal live 112 availability.


## 0. Final owner-approved decisions (binding for every application and asset)

These are **final product requirements**, not open questions for Codex to decide:

| Decision | Locked requirement | Implementation consequence |
|---|---|---|
| Brand | **NEXUS — Response Intelligence** | Public header, page titles, app icons, report covers, splash screens, README, OpenAPI title, metadata, demo fixtures and presentation materials must use NEXUS; never display NPF Nexus as the current product name. |
| Affiliation | Independent research simulator | No official insignia, NPF endorsement claim, emergency-service affiliation, 112 logo or operational contact functionality. Historic source-title mentions may retain the old wording only when explicitly labelled historical. |
| Command UI | Premium **dark** control-room experience | Dispatcher CAD, supervisor assurance and simulation administration share midnight/navy foundations, legible data-dense panels and restrained teal accents. |
| Citizen UI | Calm, trustworthy **light** experience | Citizen PWA uses bright surfaces, readable dark text, confident but non-alarming colour, generous touch targets and an obvious simulation banner. |
| Responder UI | Practical **high-contrast dark** field UI | Fixed dark styling for the primary responder workflow; connectivity/offline indicators remain extremely visible. No adaptive-theme requirement that undermines this cohesive direction. |
| Languages | **English first, translation-ready** | Ship complete and professionally written English (`en-NG`) copy, with extracted message keys in all apps, formatted dates/numbers, locale-aware accessibility strings and no untranslated literal UI strings. Yoruba and Nigerian Pidgin are future locales, not partial, unreliable translations in this release. |
| Developer workflow | Complete Codex product brief | Codex may plan work internally but must implement the entire definition of done rather than asking to build one phase and return later. |

### Global naming and style rules

- Brand canonical name in human-facing prose: **NEXUS — Response Intelligence**. Logo lockup: large `NEXUS`, small `RESPONSE INTELLIGENCE`; subtitle/disclaimer: `Independent research simulation`.
- Code and folder identifiers use neutral names (`nexus`, `cad-web`, `citizen-pwa`); public app document titles use `NEXUS — Response Intelligence | [Section]`.
- Do not call the interface `NPF Nexus` in UI, email templates, export titles, package names or screenshots. The words may appear when referencing the **source PDF** as a historical document only.
- Four-person role architecture: Citizen; Dispatcher; Responder; Supervisor. The Administrator is an additional tightly scoped simulator role, not a replacement for oversight.
- All applications display an unmistakable notice: `RESEARCH SIMULATION — NOT CONNECTED TO EMERGENCY SERVICES. THIS APPLICATION CANNOT SUMMON HELP.`
- Quality bar: credible real user flows, pixel-consistent visual language, no dead controls or fabricated results, good performance on a 320px low-end phone and a 1920px desktop, accessible contrast and clear offline states.

## 1. Product boundaries and source provenance

The user-provided *NPF Nexus Technical Blueprint* (2 pages) proposes PostgreSQL/PostGIS, Node/Express/Socket.IO, Next/Tailwind/Mapbox CAD, React/Vite citizen PWA, simulated USSD/SMS fallback, geospatial patrol unit assignment, routing and auditing. This specification **expands and revises** that conceptual outline. It is *not* an official NPF requirements document. No stakeholder approval or validated agency operating procedure is presumed.

Deliver an actual interconnected application with a backend and persistent database, not a static design, not four disconnected demos and not a public live SOS system. Build complete scope in one coherent project. The builder may internally sequence tasks for engineering quality, but is **not permitted to substitute a phase-1 mockup for the finished definition**.

### Defined audience and roles

- **Citizen / Demo Visitor:** Can create a fictional incident and privately track only their own report using a high-entropy receipt token. No mandatory signup or phone OTP; no real personal details.
- **Dispatcher:** Authenticated operations user. Reads operational incidents; triages; compares eligible units; offers, withdraws and reassigns missions; records communications and resolution actions.
- **Responder:** Authenticated simulated unit member. Can view missions offered to their unit, accept/decline, acknowledge travel/arrival and report outcome, including offline pending commands.
- **Supervisor:** Authenticated oversight user. Read-only incident-wide replay plus explicitly authorised corrective/close actions, incident review, integrity verification, anonymised performance reports.
- **Demo Administrator:** Restricted simulation settings, fictional test accounts, seed/reset, scenario playback and fault injection. Separate from supervisor so production-oriented permissions are explicit.

### In-scope

- Four polished role-based user experiences with shared design language.
- Coherent fiction-only, Osogbo-centred incident simulation with configurable connectivity and unit status.
- Real persistence, real server APIs, role-based authentication, validated event state machine.
- Durable delivery/outbox and reconnection recovery with visible truthfulness about acknowledgments.
- PostGIS eligible-unit candidate discovery and labelled travel-time estimates/fallbacks.
- Per-incident tamper-evident event audit, correction events, supervisor review and export.
- Accessible polished desktop/mobile UI, end-to-end automated tests, reproducible benchmarks and documentation.

### Out of scope (must not be silently enabled)

- Actual emergency intake, phone or SMS/USSD production sending, integration with NCC 112 or government networks.
- Real police authentication records, real deployments or real responder tracking.
- NPF trademarks, rank insignia, badges or any statement of official authority without permission.
- Autonomous dispatch; live criminal risk profiling; mass monitoring of citizens or personnel.
- Unverified AI urgency decisions, biometric identification, sensitive medical record collection, public individual-officer ratings.
- Public demo that resembles an active emergency hotline; public guests must encounter a simulation acknowledgement gate and conspicuous labels.

## 2. User journeys: complete end-to-end flows

### Journey A — Successful simulated emergency

1. Citizen opens welcome page, reads simulation disclaimer, acknowledges it and chooses `Start simulation`.
2. Chooses an incident category: `Traffic collision`, `Medical assistance`, `Fire`, `Public safety`, `Other`.
3. Enters a short fictional scenario description (max 500 characters) and location via demo landmark, draggable map pin or opt-in browser geolocation. Use *fictitious* citizen identity; if actual geolocation permission is used, it must remain a client-side visual aid unless the person explicitly chooses to include an approximation in the fictional demo. For public internet demos, disable actual live GPS storage by default.
4. Reviews incident summary and clicks `Submit simulated alert`; sends a generated `client_request_id` and simulation marker by POST over HTTPS.
5. API validates payload, applies limit controls, persists incident and `incident.received` event and outbox item in a single database transaction; returns reference and capability token. UI displays `Received by simulation server`, never `Help is on the way`.
6. Authenticated dispatcher gets live event (or sync/replay), opens incident, sets triage priority with human reason and reviews location quality.
7. Dispatcher views eligible **fictional** unit candidates, including availability, freshness, route-ETA estimate and any uncertainty. Dispatcher offers an assignment to one unit.
8. Responder receives offer, views details and chooses Accept, creating authoritative `assignment.accepted` (or declines with reason).
9. Responder explicitly marks `En route`, then `Arrival reported`, then submits outcome; these transitions can be queued locally only if disconnected.
10. Dispatcher or supervisor marks incident as `Resolved` / `Closed` according to permissions after reviewing requisite events.
11. Citizen's private tracking page shows only confirmed, appropriately generalised statuses. The feedback screen opens after closure.
12. Supervisor can replay the incident, inspect decision/communications delay categories, verify audit integrity and export a watermarked report.

### Journey B — Bad connectivity and device retries

1. Responder receives a simulated assignment and goes offline.
2. Responder taps Accept. App stores an idempotent pending command *in the local encrypted-or-minimised queue* and displays `Saved on this device — awaiting confirmation`.
3. No central state transition occurs while unconnected. Dispatcher sees the offer as `Awaiting acknowledgement` and `Unit connection stale`; citizen is not told assistance is en route.
4. Reconnection worker resubmits commands with the original idempotency key, preserving original `client_occurred_at` as *unverified client assertion*, and server-received time separately.
5. API rechecks current incident version and role; accepts if still valid, or returns a typed conflict if reassigned/expired. Never force stale commands through.
6. Client resolves conflict visibly; notifies responder if dispatch offer was withdrawn and local queued acceptance could not be applied.
7. Duplicate transport retries create no duplicate authoritative business events; operator/other connected clients resync from event sequence.

### Journey C — No appropriate unit / declined / reassigned

1. No unit meets freshness/capability/availability rules: dispatcher sees `No verified eligible unit`; can hold or escalate within **simulated** agency, never falsely claim deployment.
2. An offered unit declines with reason; audit records decline; dispatcher can offer another and the old assignment remains historically visible.
3. On withdrawal or expiry the old assignment no longer accepts updates; stale responder commands must return conflict.
4. Late arrival report may create a review event but cannot silently supersede a closed/cancelled or reassigned incident.

### Journey D — Duplicate/incorrect incidents and corrections

1. A potential duplicate is shown only as a suggestion. Dispatcher can link incidents with human review and documented reason; never merge away source receipts.
2. Submitted incident may be cancelled by authorised operator with documented reason; original remains in audit history.
3. Factual mistakes are corrected by new signed correction events. No hard deletion of audit history through ordinary UI.
4. Supervisor notes whether the chain verifies. A successful hash check means **tampering is detectable within the assumed trust boundary**, not that underlying claims were true.

### Journey E — Unsafe or inappropriate attempted use

1. Public visitor reads warning that this cannot summon help; cannot accidentally send operational alerts.
2. If the description includes urgent real-world language, show immediately that the app **does not dispatch assistance** and refer to appropriate local emergency channels; do not pretend to diagnose urgency or forward a report.
3. Uploads of real case files, personal documents or precise operational locations are not supported in the base simulator.

## 3. Finished site map and screen-by-screen acceptance criteria

### Citizen PWA, LIGHT theme (confirmed)

**C1 `/` Welcome** — Full-height mobile-friendly page. Clear logo (not NPF badge), bold headline, concise feature description, simulation warning, `Start simulated request`, `How it works`, privacy link. Acknowledgement gate; interactive buttons work. Cannot look like the official emergency number.

**C2 `/demo/new/category`** — Five clearly described choices; keyboard/radio accessible, back/continue controls; remembers progress within session; focused validation.

**C3 `/demo/new/location`** — Map with movable marker and labeled mock landmark selector, manual landmark text; location precision/freshness label, no GPS permission until user requests it; no real location persistence by default; fallback if map unavailable.

**C4 `/demo/new/details`** — Description, optional safe synthetic context tags, privacy notice; validation and length counter; no real media uploading.

**C5 `/demo/new/review`** — Accurate full summary, change links for each step, unchecked simulation confirmation, no hidden signup.

**C6 `/demo/receipt/:reference`** — Large confirmation code and copy button, visible `Received by simulation server` only after HTTP confirmation, distinguish pending local request, private tracking link and safety notice. Never show assignment based on unacknowledged UI events.

**C7 `/demo/track/:receiptToken`** — Animated but accessible timeline displaying only permitted confirmed stages, current status, last confirmed server time, connectivity status, explicit unknown/awaiting states; restricted token. Local fallback with retry instructions if token invalid/expired.

**C8 `/demo/feedback/:receiptToken`** — Private optional feedback available only after valid closure. Respectful, neutral questions about clarity and service experience; not a public officer score. Explain scope of demo and data retention.

**C9 `/about`, `/privacy`, `/help`, `not-found`** — Honest explanations, privacy choices, contact-free support and accessibility. All public pages include visible simulation label.

### Dispatcher CAD, DARK theme (confirmed)

**D1 `/login`** — Demo account auth (server-backed), clear roles, no embedded production credentials, session errors, lockout throttling.

**D2 `/cad` Overview** — Real counts for received/awaiting triage/awaiting responder acknowledgement/active/resolved; last-24h metrics derived from database; incident-list preview, unit connection health, event stream. Charts have accessible table equivalents.

**D3 `/cad/live` Flagship operations map** — 72px navigation, 64px command header, 320–360px incident queue, primary responsive map area, adjustable 360–420px selected-incident panel. Map markers reflect real simulated database state and display last-updated times. No pointless neon effects; errors/loading/empty states. Filters by status/category/priority/time, text search and keyboard navigation.

**D4 `/cad/incidents/:id` Incident workspace** — Categories, narrative, landmark, map pin + confidence, created/triaged/assigned/accepted timestamps, notes, event timeline, authorised transitions. Tabs: Overview, Assignments, Timeline, Communications, Corrections. Illegal actions disabled with clear reasons and API still enforces them.

**D5 `/cad/units` Unit board** — Table + map showing fictional unit, type/capability, current available/busy/offline state, last confirmed position/time, connection freshness; sort/filter/search. Do not equate online status with availability.

**D6 `/cad/dispatch/:incidentId`** — Candidate cards with eligibility/exclusion explanation, straight-line distance, routing ETA (with provider and timestamp) or `Estimate unavailable`. Human approves offer and sees expiry. Reoffer/reassign action supports conflict safety.

**D7 `/cad/history`** — Search, date, category, operational state, reference lookup; detail navigation and export only with role permission.

**D8 `/cad/network`** — API connection, WebSocket connection, pending outbox count, last replay cursor, reconnect state, synthetic failure injection (admin only). Honest statuses, not fake percentages.

### Responder PWA, high-contrast DARK theme (confirmed)

**R1 `/responder/login`** — Sign in as fictional simulated unit, clear environment warning.

**R2 `/responder`** — Inbox: offered, active, historical missions; summary includes category, rough location, dispatcher, offer expiry. Show online/offline + pending command count persistently.

**R3 `/responder/assignments/:id`** — Read full eligible mission. Accept/decline with reason. After acceptance, show start travel, arrival reported, add outcome, completion. Every action shows `pending on device`, `submitted to server`, or `server confirmed` accurately; no success toast before confirmation.

**R4 `/responder/outbox`** — Queued commands, retries, conflicts, manual discard of invalid local commands with explicit warnings. Never enqueue a command without stable client-generated ID.

**R5 `/responder/profile`** — Fictional callsign, simulated agency, capabilities, session management. No real personal profiles.

### Supervisor assurance portal, DARK theme (confirmed)

**S1 `/assurance`** — Metrics: time to triage, offer, acknowledgement and reported arrival; coverage/missing measurements clearly indicated, never conflating simulated timeliness with operational outcomes.

**S2 `/assurance/incidents`** — Searchable read-only history with anomalous/missing acknowledgements and source confidence, permission for review notes.

**S3 `/assurance/incidents/:id/replay`** — Chronological event replay with actor role, server timestamp, client claimed timestamp, event origin, causation ID; correction history and assignment lineage.

**S4 `/assurance/audit`** — Per-incident chained hash verification with explanatory text; checkpoint metadata and tamper-detection demonstrator. Explain limits if signing/checkpoint external anchoring unavailable.

**S5 `/assurance/reports`** — Date-filtered, redacted CSV/PDF export watermarked `RESEARCH SIMULATION`; exports include metric definitions, data volume, omissions and generated timestamp.

**S6 `/assurance/reviews`** — Document exceptional delay or contested records, link evidence/artifacts by demo event ID only, no accusation algorithm, no automatic officer scoring.

### Demo administrator

**A1 `/simulator`** — Seed/reseed synthetic Osogbo scenarios; reset via explicit confirmation; change connectivity status; introduce deterministic faults (stale locations, delayed acknowledgement, dropped connection, retry, unavailable unit). Enforce strict admin-only access and special simulation environment flag. No external communication channels.

**A2 `/simulator/scenarios/:id`** — Scenario detail with fixture conditions, goals and playback/step controls. UI supports repeatability and export of scenario seed.

**A3 `/settings`** — Demo session settings, simulated agency metadata, retention controls. No unrestricted environment secrets UI.

## 4. Required UI/UX language and quality

### Identity

Use a custom NEXUS wordmark (restrained abstract linked paths or connected nodes), avoiding government crests, police shields, NPF insignia, rank colours and official 112 logos. **Brand lockup: `NEXUS` + `RESPONSE INTELLIGENCE`; full brand name: `NEXUS — Response Intelligence`.** Descriptor: `Independent research simulation`. Use exactly this naming in browser titles, installed-PWA manifests, report headings, logins, app switcher, screenshot labels and project README.

### Palette and tokens

The desktop CAD, assurance portal and simulator administrator use the **dark palette**. The citizen PWA uses the **light palette**. Responder PWA uses a durable, high-contrast **dark** field palette; all share the same typography, spacing and status semantics.

CAD base: Midnight `#091322`, Navy `#102239`, Slate `#1B314A`, primary Teal `#1CC8B1`, Info Sky `#6BB9F7`, Warning Amber `#F4B95C`, Critical Coral `#F6797B`. Citizen light background `#F5F8FB`, ink `#142235`, white cards. Typography Geist/Inter with Geist Mono for IDs and timing. Radius 12–16px for cards, 8px for controls; 4/8/12/16/24/32/48 spacing, border and shadow restrained.

### Map interface

MapLibre GL JS with properly licensed/custom-hosted vector tiles or reputable supported provider. Map theme visually harmonised, arterial streets and landmarks readable, strong contrast. Icons distinguish incident vs available/offline/busy/stale unit. Map popovers keyboard-accessible through corresponding lists. Optional route line indicates *simulated estimated* path and source, never tracks live responders. Do not hardcode traffic-awareness if provider lacks traffic data. Use map skeleton/fallback list when map offline or provider unavailable. Attribute map data.

### Cross-surface design requirements

- **Citizen:** light, reassuring, minimalist, readable at arm's length, progressive disclosure; never use alarming red as a decorative call-to-action. The simulation notice must stay visible through the journey and tracking.
- **CAD:** a map-centred dark desktop workspace with responsive left incident queue, central geospatial canvas, right selected-incident drawer, keyboard-accessible companion lists, split-panel resizing, functional filters and restrained live-status motion.
- **Supervisor:** dark assurance workspace with precise tabular figures, explainable chart definitions, event provenance, anomaly context and screen-reader-accessible chart alternatives.
- **Responder:** dark high-contrast field app with large controls, tactile clear action confirmation, durable offline queues and persistent connectivity badges; optimise for 320px wide devices and potentially slow hardware.
- **Admin:** dark operational tools for seeded simulations, deterministic failure injection, fixture reset and test control; unmistakably not production configuration.
- **Visual QA:** deliver screenshots for the five role surfaces at specified resolutions, inspect text wrapping and contrast, no broken layout or decorative fabricated KPIs.

### Status design

Use icon + word + server timestamp, not colour alone. Uniform categories `Received`, `Needs review`, `Offered to unit`, `Accepted by unit`, `En route reported`, `Arrival reported`, `Resolved`, `Closed`, `Cancelled`, `Awaiting verification`, `Sync pending`, `Disconnected`. Explicitly label these as fictional demo workflow statuses. A banner on top of citizen PWA says `SIMULATION ONLY — DOES NOT CONTACT EMERGENCY SERVICES` and link `Understand this demo`.

### Motion and finish

Elegant 150–250ms transitions, reduced-motion support, accessible focus rings, skeleton loaders; purposeful status transitions; incident marker soft pulse only if still unattended and motion allowed; avoid full-page re-renders and busy shimmer. Drawer easing and map pan coordinated. Cards must have hierarchy, meaningful empty/error states, fully responsive 320px mobile to 4K monitor (practical max widths); 44px target minimum.

### Design acceptance

No placeholder lorem ipsum, no dead buttons, no randomly changing numbers, no invented server success, no irreversible actions without confirm/reason, no horizontally clipped CAD content at 1280px. Desktop check 1280x800, 1440x900, 1920x1080; mobile check 320x640, 375x812, 390x844, tablet 768x1024. Test keyboard, screen-reader semantics, contrast, reduced motion. Aim WCAG 2.2 AA where feasible. Inspect screenshots and fix misalignments.


## 4A. Language and translation-readiness specification (final)

**Shipping locale:** `en-NG` with polished plain-English copy appropriate for Nigerian readers. Display dates in the user's local timezone using platform `Intl`; the initial configured demo display timezone is `Africa/Lagos`. Persist and transmit timestamps as UTC ISO 8601. Units and numbers are formatted through `Intl`, not embedded numeric punctuation. Never localise unique reference IDs, enum values, API properties or audit hashes.

**Architecture:** Create `packages/i18n/` as one shared message contract used by Next.js CAD/assurance/admin and both React/Vite PWAs. Choose a maintained compatible locale library such as i18next + react-i18next, with explicit server/client handling for Next.js. Document the choice and add tests to prevent missing keys. Keep separate message namespaces such as `common`, `citizen`, `cad`, `responder`, `assurance`, `simulation`, `validation`, `status`, `accessibility`, and `legal`.

**Required deliverables:**

1. `packages/i18n/locales/en-NG/*.json` (or equivalent typed catalogue) contains **all** visible UI labels, notices, CTA text, validation errors, toast messages, empty states, navigation labels, status language, accessibility descriptions, PDF report headings and email-free notices. No hard-coded English in React components beyond structural identifiers or synthetic fixture content explicitly labelled as data.
2. Locale context/provider is installed in every frontend; `<html lang="en-NG">` or equivalent document language is correct. The PWA manifest, document metadata and printable reports identify English clearly.
3. Structured message parameters handle variable names, reference numbers and counts; use correct English pluralisation. Concatenating translated fragments is forbidden.
4. User-facing status labels map from **stable domain enums** to locale message keys; never store translated statuses in the database or emit them in API contracts.
5. Date/time formatting is locale-aware, with absolute timestamps and optional relative times clearly labelled. Local display time must not be mistaken for authoritative server UTC or offline device-asserted event time.
6. Form validation, aria-labels, chart legends, icon descriptions, privacy warnings and disconnected-state messages use the same translation system as the visible interface.
7. Allow future locales via configuration (`yo-NG` and a clearly identified Nigerian Pidgin locale after linguistic review), but **do not ship half-translated or AI-invented legal/emergency wording**. No language selector that offers locales for which a professionally reviewed complete translation is unavailable. English-only display at launch is intentional.
8. Make locale fallbacks deterministic: missing keys produce a test/CI failure; runtime fallback is English and records only a safe diagnostic. Avoid exposing internal key names to citizens.
9. Automated tests cover key inventory, interpolation, pluralisation, browser language setting, long-string layout tolerance and proper message display on all role surfaces.
10. README explains how a future translator adds and validates complete reviewed catalogues without changing the backend or domain event schema.

**Non-goal:** Developing new speech recognition, machine translation or a multilingual AI assistant. This release is translation-ready, not multilingual at runtime.

## 5. Authoritative state models

### Incident state (`incident_status`)

- `RECEIVED` — first successful server record.
- `TRIAGED` — dispatcher approved priority/category or marked insufficient information.
- `WAITING_FOR_UNIT` — ready but no approved offer is active.
- `OFFERED` — one active assignment offer exists, awaiting acceptance.
- `ACCEPTED` — unit has positively acknowledged assignment.
- `EN_ROUTE_REPORTED` — responder's travelling status accepted by server.
- `ARRIVAL_REPORTED` — responder's arrival status accepted by server; not externally verified arrival.
- `RESOLVED` — outcome recorded by authorised role.
- `CLOSED` — final administrative closure by dispatcher/supervisor.
- `CANCELLED` — authorised cancellation with reason.

`NEEDS_INFORMATION`, `NO_ELIGIBLE_UNIT`, `REASSIGNMENT_REQUIRED` are explicit **substates/reason flags**, not ambiguous overlapping values in top-level status. Avoid `SUBMITTED` server-side because it represents a client attempt rather than a persisted incident.

**Allowed ordinary edges:** `RECEIVED→TRIAGED`; `TRIAGED→WAITING_FOR_UNIT`; `WAITING_FOR_UNIT→OFFERED`; `OFFERED→ACCEPTED`; `OFFERED→WAITING_FOR_UNIT` on rejection/withdrawal/expiry; `ACCEPTED→EN_ROUTE_REPORTED`; `EN_ROUTE_REPORTED→ARRIVAL_REPORTED`; `ARRIVAL_REPORTED→RESOLVED`; `RESOLVED→CLOSED`; incident may be cancelled from early non-terminal states by approved roles with reason; exceptional reassignment from active states requires documented handover and a new assignment, never silent overwrite. Closed/CANCELLED are terminal except append-only review/correction metadata events that do not rewrite past state.

### Assignment state

`OFFERED→ACCEPTED→ACTIVE→COMPLETED` or `OFFERED→DECLINED|EXPIRED|WITHDRAWN`; `ACCEPTED|ACTIVE→REASSIGNED|ABORTED` with authorised transition reason. Only one active accepted/offer assignment per incident in the initial simulator. Preserve all previous assignments for history.

### Delivery state

Separate message delivery from incident workflow. A command may be `LOCAL_ONLY`, `QUEUED`, `SENT_UNCONFIRMED`, `SERVER_COMMITTED`, `REJECTED_CONFLICT`, `FAILED_RETRYABLE`. Notification to a socket room isn't the same as a human reading/accepting. Include `client_occurred_at` separately from verified `server_committed_at`.

### Concurrency model

Every mutating request carries `Idempotency-Key`, `expected_version` or concurrency token, actor session and correlation ID. Transaction locks incident row, checks role/transition/version, writes business change + appended event + outbox in same transaction. Database unique partial constraints stop two active offers, even if two dispatchers act simultaneously. Retry same key returns same authoritative result, not another event. HTTP 409 for version conflicts with safe current state, event sequence monotonic per incident.

## 6. Full database schema contract

PostgreSQL + PostGIS migration scripts with typed timestamps `timestamptz` and UUID primary keys. Store current unit positions in `unit_current_locations` and optional historical synthetic telemetry in `unit_location_history` with retention. Schema:

1. `agencies`: id, demo_name, category, is_simulated.
2. `users`: id, demo_name, role enum, agency_id, password_hash/managed_auth_id, active, created_at, last_login_at.
3. `responder_unit_memberships`: user_id, unit_id, valid_from, valid_to.
4. `units`: id, agency_id, callsign, unit_type, capability_tags array/related table, dispatch_status, status_updated_at, is_simulated.
5. `unit_current_locations`: unit_id PK, geom geography(Point,4326), precision_m, recorded_at, source, is_simulated.
6. `unit_location_history` (optional synthetic): id, unit_id, geom, recorded_at, expire_at.
7. `incidents`: id, public_reference UNIQUE, source_channel, category, priority, description_sanitised, geom geography(Point,4326), landmark, location_confidence, location_accuracy_m, status, reason_flags jsonb, version integer, receipt_token_digest, created_at, updated_at, closed_at, is_simulated.
8. `assignments`: id, incident_id, unit_id, status, offered_by, offered_at, expires_at, accepted_by, accepted_at, withdrawn_at, decline_reason, closed_at. Partial unique index on active/offer statuses per incident.
9. `incident_events`: id, incident_id, sequence integer, event_type, actor_type, actor_id nullable, aggregate_version, reason_code, metadata jsonb, client_occurred_at nullable, server_occurred_at, correlation_id, prev_hash, event_hash, UNIQUE(incident_id, sequence).
10. `outbox_events`: id, aggregate_type, aggregate_id, event_id, topic, payload jsonb, created_at, next_attempt_at, attempts, delivered_at nullable, last_error nullable; worker safely claims rows; failure and retry metrics.
11. `client_commands`: idempotency_key, actor_id/session scope, request_fingerprint, command_type, result_json, created_at, expires_at; unique actor+key, reject reuse with different body.
12. `incident_notes`: id, incident_id, created_by, role, sanitized_text, visibility, created_at, correction_of nullable; never presented to citizens unless explicitly citizen-visible.
13. `incident_links`: id, a_id, b_id, relation `POSSIBLE_DUPLICATE|CONFIRMED_RELATED`, linked_by, reason, created_at.
14. `citizen_feedback`: id, incident_id, receipt_token_scope, response_clarity_score, free_text, submitted_at, reviewed_at nullable; avoid personally identifying ratings.
15. `supervisor_reviews`: id, incident_id, reviewer_id, review_type, reason, finding_text, created_at, resolved_at.
16. `audit_checkpoints`: id, checkpoint_at, scope, root_hash, signer_key_id, signature nullable, anchor_reference nullable, verification_status.
17. `simulation_scenarios`: id, slug, title, seed_json, expected_results_json, enabled.
18. `scenario_runs`: id, scenario_id, started_by, seed, started_at, completed_at, results_json.
19. `security_audit_events`: id, actor_id nullable, action, resource_kind, resource_id, occurred_at, ip_hash nullable, result; avoid putting sensitive location/content into general logs.

Index GiST for geographic columns; BTree for incident status/created_at/reference, assignment foreign keys and event sequence; row access enforced at API layer with explicit per-role/agency scope. Store coordinates securely. Prefer small no-sensitive-data fixtures and scheduled demo resets.

## 7. Public and internal API contracts

Use REST over HTTPS for all authoritative commands, typed Zod request/response contracts and OpenAPI docs generated from source. Socket.IO for push and replay notification. Standard error shape `{code, message, correlationId, retryable, details?}` without sensitive internals. Include pagination for collections and UTC ISO times.

### Citizen demo

- `POST /api/v1/demo/incidents` — fictional incident, idempotent, returns reference + one-time receipt token and server time.
- `GET /api/v1/demo/incidents/:reference/status` — requires receipt capability token; only citizen-safe status and generalised timeline.
- `POST /api/v1/demo/incidents/:reference/feedback` — restricted private token, closed record only.
- `GET /api/v1/demo/reference-data` — incident categories, fictional locations, demo disclosures.

### Dispatcher

- `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`; server-side safe sessions.
- `GET /api/v1/cad/overview`, `GET /api/v1/cad/incidents`, `GET /api/v1/cad/incidents/:id`, `GET /api/v1/cad/incidents/:id/events`.
- `POST /api/v1/cad/incidents/:id/triage`.
- `GET /api/v1/cad/incidents/:id/candidates`.
- `POST /api/v1/cad/incidents/:id/assignments` (offer).
- `POST /api/v1/cad/assignments/:id/withdraw`, `POST /api/v1/cad/incidents/:id/cancel`, `POST /api/v1/cad/incidents/:id/resolve`, `POST /api/v1/cad/incidents/:id/close` with permissions and reasons.
- `GET /api/v1/cad/units`, `GET /api/v1/cad/network`.

### Responder

- `GET /api/v1/responder/assignments` and `GET /api/v1/responder/assignments/:id` (unit membership required).
- `POST /api/v1/responder/assignments/:id/accept`, `/decline`, `/en-route`, `/arrived`, `/outcome`; idempotent and version checked.
- `GET /api/v1/responder/sync?cursor=...` for reconnection, never depend solely on Socket.IO delivery.

### Supervisor / Admin

- `GET /api/v1/assurance/metrics`, `/incidents`, `/incidents/:id/replay`, `/audit/verify`, `/reports/export`.
- `POST /api/v1/assurance/incidents/:id/reviews`, `/corrections` with supervised reasons and append-only trail.
- `GET /api/v1/simulator/scenarios`, `POST /api/v1/simulator/scenarios/:id/run`, `POST /api/v1/simulator/reset`, `POST /api/v1/simulator/faults` gated by admin role + simulator enabled.

### Realtime event envelopes

Topic set `incident.created`, `incident.triaged`, `incident.state_changed`, `assignment.offered`, `assignment.accepted`, `assignment.declined`, `unit.status_updated`, `system.sync_required`, `system.connection_state`.

Envelope `{eventId, incidentId?, sequence?, aggregateVersion?, emittedAt, type, safePayload, simulation:true}`. Authorise rooms for dispatcher/agency/unit; no public broadcast of personal or operational details. On reconnect query missed events from trusted API and reconcile; do not assume `socket connected` means all events were received.

## 8. Dispatch algorithm and geographic data

Filter candidate units: `is_simulated`, `AVAILABLE`, authorised agency in demo, suitable `capability_tags`, fresh status + location within configured age, within radius. `ST_DWithin` for indexed geographic filtering. Include exact SQL unit tests with longitude/latitude ordering and `geography`/metres. Rank by **estimated** road-network travel time when routing data available; label timestamp/provider. On routing failure present distance-only candidates explicitly labelled `ETA unavailable`, never use invented traffic speeds as fact. Include excluded unit reasons (busy, stale, no capabilities, offline). Dispatcher manually confirms; no autonomous deployment.

Support deliberate `Unit A closest but busy`, `Unit B available but stale`, `Unit C eligible with fresh position` demo. Simulation coordinates may be near public landmarks in Osogbo, but must not depict live police or emergency fleet locations.

## 9. Reliability and audit engineering

### Durable writes and replay

Create event + state + outbox in atomic DB transaction. Worker picks pending outbox row with `FOR UPDATE SKIP LOCKED`, retries using bounded exponential backoff. Dispatcher/field client maintains last event sequence, fetches missed versions after reconnect and repairs gaps. UI reconciles against latest authoritative REST snapshot after significant reconnect. Stable command idempotency keys, TTL with safe repeat responses and conflict policy. Check browser storage constraints; PWA `Background Sync` is optional and cannot be assumed supported. Provide manual retry and online event listeners. Failure injection deterministically tests disconnect/reconnect and server restart.

### Integrity

Append-only events with chained SHA-256 digest of canonical serialisation including sequence, server timestamp, actor and previous hash; checkpoint digests at scheduled intervals. For true strong assurance require independently protected signing keys / external checkpoint storage; absent those, label demo integrity as *tamper-evident under defined assumptions*, not immutable against all privileged administrators. Event correction preserves original and creates new linked event.

### Time semantics

Authoritative display time uses server-committed UTC. Client-observed time labelled separately. Offline arrival report says `Arrived — reported after reconnect at [server time]` where appropriate, not that server verified the actual arrival time.

## 10. Security, privacy and abuse-prevention definition

- Fictional accounts and incidents only. No requirement for real telephone numbers, BVN, national ID, health data, actual officer identity, real case files or coordinates.
- Passwords hashed appropriately or reputable auth provider for demonstrator; secure HttpOnly SameSite cookies and CSRF mitigations as appropriate, login throttling, session expiry and multi-factor requirement for privileged production-oriented pathways.
- RBAC and agency scoping enforced **server-side on every route and realtime subscription**, tested for IDOR and role escalation. Do not trust only client-side hidden buttons.
- Citizen tracking capability token with >=128-bit unpredictability, token hash at rest and expiry. Avoid writing token in analytics/referrer URLs; use a private session or fragment-to-session exchange approach for display if feasible.
- Limit fields, escape output, safe JSON parsing, no unrestricted file upload, bounded inputs and body size, CSP, TLS, secret rotation practices, no keys in Git; `env.example` with fictional placeholders.
- Don't pre-cache citizen details in PWA service worker; cache only public static assets and synthetic non-sensitive fixtures. Explain offline command storage risks; persist minimal command content and wipe on logout/reset.
- No public individual employee ratings or punitive auto-classification. Aggregated operational reports show data completeness and response context.
- Emergency-service deployment requires official authorisation, governance, privacy impact assessment, appropriate cross-agency integration and field validation; independent research prototype is **not** operationally deployable as-is.

## 11. Research evaluation and benchmark suite

**Research question:** Under controlled unreliable-network conditions, how does an acknowledgement-aware, event-persisted simulated CAD layer compare with a basic emit-only real-time app in status accuracy, duplicate handling and recovery?

Build reproducible seeded tests against (A) deliberately simplified ephemeral WebSocket baseline and (B) Nexus resilient engine. Compare not only raw latency but correctness.

Required experiments (at least 5 seeds each, then more if efficient):

- 100, 500 and 1,000 concurrent synthetic incident submissions in defined local/staging load tests, without suggesting production capacity.
- Responder disconnected for 15 seconds, 60 seconds and 5 minutes; reconnect and verify sequence replay.
- Duplicate citizen POST and responder accept status under retry storms (must not duplicate business events).
- Two dispatchers simultaneously offering assignment to different units (at most one valid current offer).
- Unit stale location and expired offer, routing service unavailable, time skew from offline responder, worker outage/restart.
- Incident cancellation while old responder device remains offline; queued command fails safely on reconnect.
- Audit event modification in test copy triggers integrity failure.
- Keyboard/mobile flows, denial of GPS, low data bandwidth simulation, map failure and reduced motion.

Metrics with definitions: median/p95 receipt creation latency, replay completeness (% expected events recovered), incorrect citizen-state count (target zero in defined test cases), duplicate committed business event count (target zero), time from connection restored to converged authoritative state, API errors, memory/CPU, incorrect availability due to staleness, relative dispatch candidate travel-time estimate under declared routing model. Report actual results, hardware, seed, scenario, confidence/limitations. Never promise real emergency response improvement from simulation alone.

## 12. Scenarios and fixture catalogue

Create stable demo scenario set with explanations and deterministic seeds:

- `traffic-osogbo-main` — fictional road collision near public landmark; 3 synthetic units; one busy, one stale, one eligible.
- `medical-low-network` — medical call; responder loses connectivity and queues acknowledgement.
- `fire-no-eligible` — capability mismatch and no eligible available unit.
- `two-incidents-one-unit` — contention among two incidents; human-approved conflict handling.
- `assignment-declined` — unit decline, reoffer and history preserved.
- `duplicate-alerts` — user resend and potential incident duplicates; idempotency + human review.
- `late-arrival-conflict` — cancellation occurs before offline arrival update; conflict not silently committed.
- `audit-tamper` — test copy of history modified; verifier flags mismatch.
- `map-unavailable` — routing/vector tiles unavailable; operations remain possible through list and manual landmark info.

Demo admin can reset seed and replay from start. No random changing UI counts: counts derive from seeded events and authoritative database.

## 13. Final repo layout

```text
nexus/
  apps/
    cad-web/                  # Next.js desktop CAD + assurance + admin
    citizen-pwa/              # React/Vite mobile light theme
    responder-pwa/            # React/Vite mobile responder
    api/                      # Fastify or Express TS + Socket.IO
    worker/                   # PostgreSQL durable outbox worker
  packages/
    ui/                       # shared tokens / primitives / components
    i18n/                     # en-NG catalogues, typed keys, locale formatting
    contracts/                # Zod DTOs, API and event schemas
    domain/                   # state machines / permissions / validators
    simulation/               # immutable fixtures / scenario generator
    config/                   # shared TS, lint, formatting settings
  infra/
    docker-compose.yml
    db/migrations/
    maps/
  docs/
    PRODUCT_SPEC.md
    ARCHITECTURE.md
    STATE_MACHINE.md
    API_REFERENCE.md
    THREAT_MODEL.md
    EVALUATION_PROTOCOL.md
    UI_GUIDELINES.md
    LOCALISATION.md
    CODEX_DECISIONS.md
  tests/
    e2e/
    fault/
    performance/
    security/
  .github/workflows/
  .env.example
  README.md
```

Tech stack: TypeScript throughout, pnpm workspaces, Next.js App Router for CAD/assurance, Vite React PWAs for citizen/responder, Tailwind + shadcn/ui/Radix + Lucide + optional Motion, TanStack Query, MapLibre GL JS with properly licensed map tiles, PostgreSQL/PostGIS, Node.js Fastify OR Express (Codex must choose one and record decision), Socket.IO, database-backed outbox worker, OpenAPI, Vitest, Playwright, Supertest-style API tests, k6 for load, Docker Compose and CI. Use one modular backend; do not overcomplicate with microservices. For optional reports, generate PDF/CSV backend with redaction and simulation watermark.

## 14. Definition of done (must be met before declaring complete)

- All four applications and admin scenario controls open, look cohesive, and interact with one persistent backend. Every public label, installed-app name and report uses **NEXUS — Response Intelligence** branding with honest simulation notices.
- All enumerated screens and links are implemented, or documented with explicit approved scope change; no fake buttons.
- A fictional citizen's submission appears in CAD and follows authorised transitions through responder acknowledgement to closure; citizen receipt shows accurate confirmed states.
- Simulated network outage queues appropriate field commands and recovers; stale commands fail visibly; duplicate POSTs/commands do not duplicate committed events.
- Dispacher candidate list excludes stale/busy/ineligible units, documents ETA provenance/fallback and requires human approval.
- Supervisor can replay event history, inspect reasons and corrections, verify audit chain and export a redacted/watermarked report.
- Auth and role/agency boundaries tested; tracking tokens private; synthetic records only; no functional live emergency integrations.
- Runs on Windows + Docker Desktop with documented command list, bootstrap script, migrations, deterministic seeds, test logins, CI and environment template.
- Pass lint/typecheck/unit/integration/e2e/security smoke tests; successful production builds; responsive screenshots for CAD and both mobile PWAs. Verify **dark CAD/assurance/admin**, **light citizen**, **high-contrast dark responder**, and full `en-NG` message-key coverage.
- Reproducible network-fault and load benchmarks with **measured** results and clear limitations.
- Every viewport and export has clear simulation/no official endorsement disclosure; no official NPF logos.

## 15. Running locally and documenting outcomes

README must specify supported current Node LTS, pnpm and Docker installation; commands to install workspace dependencies; Docker Compose startup; migrate+seed; start all apps concurrently; URLs/ports; demo accounts; scenario reset; run full tests/benchmarks; map provider configuration; and troubleshooting. Do not assume paid map/tile provider availability: provide fully functional map fallback and low-dependency local demo mode. No real keys in docs. No uncontrolled deployment by default. Codex reports actual tests run and unresolved gaps. Make script behaviour cross-platform or Windows PowerShell friendly.


## 16. Final engineering brief for Codex (canonical; same text provided separately)

> You are responsible for delivering **NEXUS — Response Intelligence**, a complete, integrated, independent Nigerian-context **emergency-response coordination and accountability research simulator**. Treat this specification as the binding contract for the **finished product**, not a prototype UI, not a phase-one MVP and not a request for an execution-phases presentation.
>
> **Final owner decisions:** use the canonical brand name **NEXUS — Response Intelligence**; no NPF or official emergency-service branding or implied endorsement. Make the **command centre, supervisor portal and simulator administration dark** with premium, disciplined operations design. Make the **citizen PWA light**, calm and accessible. Make the **responder PWA high-contrast dark** for field usability. Ship **English (`en-NG`)** only, implemented through one shared **translation-ready localisation architecture**, with all messages externalised and a documented path to professionally reviewed Yoruba and Nigerian Pidgin locales later. These are confirmed requirements; do not ask the owner to reselect them.
>
> Build the complete scope in this document: citizen journeys, CAD map and incident queue, responder workflows and offline outbox, supervisor assurance/replay/reporting, restricted simulator controls, real authenticated API + Socket.IO, PostgreSQL/PostGIS, strict role permissions, authoritative state machines and concurrency control, transactional outbox and replay, human-approved dispatch ranking and ETA uncertainty, tamper-evident append-only history, deterministic synthetic Osogbo scenarios, security and privacy protection, reproducible performance tests and full Windows local setup. All systems must actually work together on one persistent dataset.
>
> Before implementation, inspect the repository and write `docs/IMPLEMENTATION_PLAN.md` and `docs/CODEX_DECISIONS.md`. Codex can break its work into internally managed tasks, but **must keep the entire finished specification in scope** and continue through the definition of done. Do not stop after screen designs or treat features as future enhancements unless the owner explicitly changes the scope. For serious blockers, report exact affected requirements and safe options rather than fabricating results.
>
> Build real connected interfaces with an exceptional aesthetic standard and accessible layouts. Every visible control works or is transparently disabled; no hard-coded fabricated status, decorative unrelated KPI, dead button or false `Help is on its way` claim. Render demo-specific status based solely on confirmed server events. Use an obvious and persistent `RESEARCH SIMULATION — NOT CONNECTED TO EMERGENCY SERVICES. THIS APPLICATION CANNOT SUMMON HELP.` label. No actual emergency intake, real responder tracking, real police datasets or live government integrations.
>
> Verify every flow and edge case, including duplicate submissions, two competing dispatchers, responder rejection, stale units, map/routing failure, offline status queuing, reconnect replay, stale-command conflict, audit tampering and accessible mobile behaviour. Run and report actual lint, TypeScript, unit, API integration, DB, E2E, RBAC, security smoke, build, localisation coverage, visual regression, fault and load checks. Capture/screenshots review and fix design problems. Document exact Docker/Windows commands and demo users. Finish with an explicit requirement-by-requirement checklist and disclose any remaining limitations.

## 17. Signed-off product decisions and implementation defaults

### Owner decisions — confirmed, not open for re-selection

1. **Brand:** `NEXUS — Response Intelligence`. Never advertise the app as an official NPF system.
2. **Visual direction:** dark command centre, assurance and admin; light citizen; responder high-contrast dark.
3. **Language:** English `en-NG` first, fully translation-ready; future reviewed Yoruba and Nigerian Pidgin catalogues are not release dependencies.
4. **Scope:** full interconnected researched simulator delivered from one comprehensive Codex brief, not an instruction to stop after sequential product phases.

### Technical defaults (Codex should implement unless a documented real blocker arises)

- Browser GPS is opt-in demo convenience; do not store actual visitor precise coordinates by default; select fictional landmarks and coordinates for persisted scenarios.
- Map rendering uses licensed vector tiles with tested map/list fallback; no paid external mapping subscription is necessary to run tests.
- SMS/USSD provider payloads may be mocked only; no outbound messages to actual emergency services.
- Keep deployment private, invitation-only or local. Never make a public site which an ordinary person may mistake for an operational SOS service.
- Use Git-tracked configuration samples without secrets, synthetic deterministic demo data and documented local development on Windows.
- Where product details remain unspecified, choose the simpler safe technical option, record the decision and keep end-to-end behaviour conformant to the contract.

## 18. Reference points

User source: *NPF Nexus Technical Blueprint*, pages 1–2. Supplemental conceptual inspiration only: Socket.IO official delivery guarantees, PostGIS `ST_DWithin`, MapLibre GL JS official documentation, browser geolocation permission rules and Nigeria Data Protection Act 2023. Validate authoritative documentation when implementing against current library versions. Do not claim the spec represents approved NPF practice.
