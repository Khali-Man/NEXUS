# NEXUS — Response Intelligence

**RESEARCH SIMULATION — NOT CONNECTED TO EMERGENCY SERVICES. THIS APPLICATION CANNOT SUMMON HELP.**

Independent, local Nigerian-context coordination and accountability research simulator. All accounts, units, incidents and scenarios are fictional. No official affiliation, operational emergency intake, outgoing SMS/USSD, government integration or real responder tracking exists.

## Run locally

Windows 11 execution remains untested. See [the complete PowerShell, WSL/Docker, migration, signing-key and troubleshooting guide](docs/WINDOWS_11.md).

Install **Node.js 24 LTS**, **pnpm 11.25.0** (`npm install --global pnpm@11.25.0`) and **Docker Desktop with Linux containers and Compose**. Run these commands in the repository root from PowerShell, Terminal or Bash:

```powershell
pnpm install --frozen-lockfile
pnpm setup
pnpm dev
```

`setup` preserves an existing `.env`, copies `.env.example` if absent, generates a local receipt derivation key and Ed25519 audit signing keys, starts PostgreSQL/PostGIS, applies versioned migrations and seeds fictional users, four units and nine scenarios. It is repeatable. An existing user password is preserved when reseeding. Start Docker Desktop first. The tracked example contains only deliberately fictional local defaults; never reuse those credentials elsewhere. Changing a PostgreSQL password after creating its named volume also requires changing the database role's password; changing `.env` alone does not update an existing database.

| Application                    | Local address                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------- |
| Command, assurance, simulator  | http://localhost:3000                                                           |
| Light citizen PWA              | http://localhost:5173                                                           |
| High-contrast responder PWA    | http://localhost:5174/responder                                                 |
| API health / generated OpenAPI | http://localhost:4000/api/v1/health / http://localhost:4000/api/v1/openapi.json |
| PostgreSQL/PostGIS             | 127.0.0.1:55432                                                                 |

These addresses are local development instructions, not hosted previews. Keep the product local/private. HTTP is for loopback development; private remote hosting requires TLS and `COOKIE_SECURE=true` with exact `ALLOWED_ORIGINS`.

Demo usernames are `dispatcher`, `responder`, `supervisor`, and `admin`. The initial local password is **`Nexus-Demo-2026!`**, configurable with `DEMO_PASSWORD` before first seed. Use separate browser profiles/private contexts for different simultaneous roles: session cookies on localhost are shared across ports within one browser profile.

1. Sign into the simulator as `admin`, choose a seed and create `Traffic · Osogbo main`. Advance the fixture one step at a time, or operate it manually in separate dispatcher/responder browser profiles.
2. A citizen can acknowledge the warning, choose a category and fictional location, describe a synthetic situation, review, and submit. A private fragment link is exchanged into session storage and removed from the address bar.
3. Dispatcher triages with a reason, marks ready, compares candidate eligibility, then explicitly offers an assignment.
4. The responder accepts, reports travel, reports arrival and records an outcome. Dispatcher/supervisor closes after review. Citizen tracking reflects committed states only.
5. Supervisor replays the history, appends reviews/corrections, verifies event chains and signed checkpoints and exports redacted watermarked CSV/PDF.

**Freshness is real:** positions/status become stale after five minutes. Creating a scenario refreshes the appropriate synthetic fixture; an online responder heartbeats its own fictional unit memberships. Connection and availability remain separate concepts.

## Verification

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm test:routing
pnpm build
# After the build, start pnpm start in a separate terminal for browser/PWA tests.
pnpm exec playwright install chromium
pnpm test:e2e
pnpm test:performance
# Separately, with pnpm start running and no other tests using PostgreSQL:
pnpm test:db-restart
```

On Windows set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to your installed Chrome/Chromium executable, or remove that variable to use Playwright's downloaded browser. The cloud environment uses `/usr/bin/chromium` when available. Tests use the separate `nexus_test` database; comparative experiments use `nexus_bench`, preserving the development dataset. The database account needs local CREATE DATABASE permission for those test databases. The benchmark performs five seeds at each of 100/500/1000 concurrent synthetic submissions and actual 15-second, 60-second and five-minute disconnects; allow about six minutes. It raises its own isolated local rate-limit configuration to 50,000 requests/minute, while the default application rate limit remains 2,000/minute.

`pnpm test:db-restart` intentionally restarts the local research database container, then verifies API/session/command and worker/realtime recovery. Run it separately from other database-dependent checks.

The k6 script is `tests/performance/load.k6.js`. `pnpm test:k6` starts its own isolated benchmark API and uses Linux Docker host networking. Native k6 can instead target a separately started local benchmark API through `BASE_URL`. On Windows Docker Desktop host networking must be enabled or use `host.docker.internal` and an appropriate bind address. See [evaluation protocol](docs/EVALUATION_PROTOCOL.md) and [measured results](docs/VERIFICATION_RESULTS.md).

Production frontend builds are `apps/cad-web/.next` and both PWA `dist` directories. `pnpm --filter @nexus/cad-web start` serves built Next.js. The PWAs need a static server with SPA fallback plus `/api` and `/socket.io` reverse proxies to the API. `pnpm dev` runs the integrated development workflow; `pnpm start` serves all production builds with the same API/worker and same-origin proxies for local verification. No public deployment is performed.

## Maps and offline operation

Public OpenStreetMap geometry can be imported with `pnpm maps:download`, then `pnpm maps:prepare` and `pnpm maps:up` prepare/serve a pinned local OSRM car-routing graph. Configure `OSRM_BASE_URL` and `ROUTING_DATA_VERSION` as documented in [map configuration](infra/maps/README.md). Candidate cards show source, timestamp, model travel time and an optional route overlay. No live traffic or arrival guarantee is claimed. Missing data/service yields explicitly unavailable ETA and geographic distance; a labelled background/list fallback remains usable without external data. Real Osogbo import/route verification is currently blocked by the cloud network policy.

Manual and scheduled audit checkpoints now use Ed25519. Download covered-history bundles in supervisor audit and verify with `pnpm audit:verify bundle.json independently-held-public-keys.json`. See [key management, rotation, revocation and trust limits](docs/AUDIT_SIGNING.md). Legacy unsigned records remain labelled. No external anchor is configured.

After a production PWA's first successful load, its service worker caches public static shell/assets only. APIs, receipt data and narratives are never service-worker cached. Field commands retain only assignment ID, expected version, action, reason and claimed time in local storage. Offline commands are visibly pending; reconnect retries the same key. Conflicts require operator review; sign-out clears the queue. Shared devices should be signed out.

## Maintenance and troubleshooting

- `pnpm db:up`, `pnpm db:migrate`, `pnpm db:seed` can be run separately from the root. Migrations are transactionally versioned; seeds preserve existing accounts.
- To cancel all active synthetic incidents, use the admin reset control and type `RESET SYNTHETIC DATA`. Events remain append-only; reset does not delete research history or destroy the Docker volume.
- Stop `pnpm dev` with Ctrl+C. It terminates the process groups it started. Ports are fixed; Vite refuses to silently choose another port.
- Missing `RECEIPT_KEY`: run `pnpm setup`. Keep the generated ignored `.env` private and retain it to reproduce capabilities. Rotating it affects derived retry tokens; expire existing receipts when rotating.
- If package tools cannot write home caches in the cloud, export `XDG_DATA_HOME=/workspace/.cache/data`, `XDG_CACHE_HOME=/workspace/.cache` and `npm_config_cache=/workspace/.cache/npm`. The checked-in npm configuration uses workspace caches. On another machine pnpm may use its standard platform cache; the project does not rely on its contents.
- Map/WebGL failure: use the list, location label and candidate cards. Headless Chromium in this cloud uses software WebGL for screenshot QA.
- `409` means version, assignment or idempotency conflict. Refresh and review; never change a queued command's version/key merely to force it through.
- No fake success for an expired receipt or unauthenticated session. Credentials are never embedded in frontend components.

## Engineering documents

[Implementation plan](docs/IMPLEMENTATION_PLAN.md), [decisions](docs/CODEX_DECISIONS.md), [architecture](docs/ARCHITECTURE.md), [state machines](docs/STATE_MACHINE.md), [API](docs/API_REFERENCE.md), [threat model](docs/THREAT_MODEL.md), [localisation](docs/LOCALISATION.md), [UI guidelines](docs/UI_GUIDELINES.md), [requirement checklist](docs/REQUIREMENT_CHECKLIST.md), [five-workspace inventory and gaps](docs/IMPLEMENTATION_INVENTORY.md).

The original full requirements remain in `NEXUS_Final_Product_Specification_for_Codex.md`. Consult the checklist for exact verification and outstanding limitations; neither research measurements nor a hash check establish operational emergency-service readiness.
