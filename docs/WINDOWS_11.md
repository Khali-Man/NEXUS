# Windows 11 local research setup

**Status: instructions reviewed for PowerShell compatibility; Windows 11 and Docker Desktop have not been executed in this Linux environment. No Windows verification is claimed.** All records/accounts are fictional. NEXUS cannot summon help.

## Prerequisites

Use supported, updated Windows 11 x64, hardware virtualisation enabled in firmware, at least 8 GB RAM (16 GB recommended for builds/routing), approximately 10 GB free disk plus downloaded OSM data, Git for Windows, Node.js **24 LTS**, **pnpm 11.25.0**, and Docker Desktop with its **WSL 2 Linux-container backend** and Compose v2. ARM Windows image/tool compatibility has not been tested. Follow Docker Desktop's licence terms.

In an elevated PowerShell terminal, if WSL is not installed:

```powershell
wsl --install
wsl --update
```

Restart if prompted. Install Docker Desktop from Docker's official Windows installer, select WSL 2, start it, and wait for the engine to report ready. Use Linux containers, not Windows containers. In an ordinary PowerShell terminal:

```powershell
git --version
node --version
npm.cmd install --global pnpm@11.25.0
pnpm.cmd --version
docker version
docker compose version
wsl --status
```

Node must report v24.x. The `.cmd` commands avoid PowerShell blocking npm's unsigned `.ps1` wrappers; there is no need to disable execution-policy protection system-wide. Keep the checkout in a local user-owned directory outside OneDrive/network synchronisation, e.g. `C:\src\NEXUS`. Do not mix Windows `node_modules` with WSL/Linux dependencies.

## Install, configure and migrate

```powershell
New-Item -ItemType Directory -Force C:\src | Out-Null
Set-Location C:\src
git clone --branch review/nexus-integrated-product https://github.com/Khali-Man/NEXUS.git
Set-Location NEXUS
pnpm.cmd install --frozen-lockfile
if (!(Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
pnpm.cmd setup
```

The tracked [.env.example](../.env.example) is the environment-variable template. Local-only sample passwords are public fictional defaults; never reuse them. `setup` preserves an existing `.env`, generates a receipt secret if missing, generates an Ed25519 keypair/public trust registry if missing, starts PostGIS, applies migrations 001–004 transactionally, and seeds fictional accounts/units/scenarios. Secrets and road graphs are ignored under `.env` and `.nexus/`. Do not paste secrets into tickets, screenshots or Git.

Optional per-terminal overrides use PowerShell's environment syntax (children inherit these; `.env` does not override an already set variable):

```powershell
$env:DEMO_MODE = 'true'
$env:COOKIE_SECURE = 'false' # loopback HTTP only
$env:ALLOWED_ORIGINS = 'http://localhost:3000,http://localhost:5173,http://localhost:5174'
# If changing credentials before the first setup, edit BOTH DATABASE_URL and
# POSTGRES_PASSWORD in .env; choose DEMO_PASSWORD before the first seed.
# Custom test database URL, only if the default local password was changed:
# $env:NEXUS_TEST_DATABASE_URL = 'postgresql://nexus:<URL-encoded-password>@127.0.0.1:55432/nexus_test'
```

The same lifecycle is available as explicit commands:

```powershell
pnpm.cmd db:up
pnpm.cmd db:migrate
pnpm.cmd db:seed
docker compose -f infra/docker-compose.yml exec -T db psql -U nexus -d nexus -c 'SELECT name,applied_at FROM schema_migrations ORDER BY name;'
docker compose -f infra/docker-compose.yml exec -T db psql -U nexus -d nexus -c 'SELECT postgis_full_version();'
pnpm.cmd dev
```

Use Ctrl+C to stop the launcher. It starts API, worker, Next.js and both PWAs. Open the local addresses in [README](../README.md). Sign in as `dispatcher`, `responder`, `supervisor` or `admin` using the configured initial demo password; separate browser profiles are needed for simultaneous roles. Do not expose these local services to the public network. Windows Firewall prompts should be limited to your intended private local development use.

## Road data and routing (optional; network and Docker required)

```powershell
pnpm.cmd maps:download
pnpm.cmd maps:prepare
pnpm.cmd maps:up
$meta = Get-Content .nexus\maps\metadata.json -Raw | ConvertFrom-Json
$env:OSRM_BASE_URL = 'http://127.0.0.1:5001'
$env:ROUTING_DATA_VERSION = $meta.osmSha256
pnpm.cmd dev
```

Persist those two non-secret values in `.env` if desired; restart the API after changing them. Downloaded OSM road geometry is served locally with attribution. OSRM uses ordinary car routing and has no live traffic, closure or emergency-driving model. If downloads, coverage, snapping or the service fail, lists and straight-line distance remain usable and ETA reads unavailable. [Map provenance and operations](../infra/maps/README.md) explains licensing, snapshot refresh and coverage limits. The Docker image is pinned to a Linux image digest; the real Osogbo import and Windows container bind mounts remain unverified until run successfully on that machine.

## Protect and verify audit keys

After setup, restrict the generated key directory's Windows ACL to your account. Review the command output; local IT policy can impose additional permissions:

```powershell
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
icacls '.nexus\keys' /inheritance:r /grant:r "${identity}:(OI)(CI)F"
icacls '.nexus\keys'
pnpm.cmd audit:keygen --rotate
```

Stop API/worker during rotation and ACL/registry edits. Copy **only** `trusted-public-keys.json` independently to the verifier; authenticate its SHA-256 fingerprint through a separate trusted channel. Export a bundle from the supervisor audit page, then:

```powershell
pnpm.cmd audit:verify 'C:\review\nexus-checkpoint.json' 'C:\review\trusted-public-keys.json'
$LASTEXITCODE # 0 only if signature and covered history both verify
```

[Signing and rotation guidance](AUDIT_SIGNING.md) describes revocation and the limits of local trust.

## Verification commands (results must be recorded on Windows)

```powershell
pnpm.cmd lint
pnpm.cmd typecheck
pnpm.cmd test
pnpm.cmd test:routing
pnpm.cmd build
pnpm.cmd exec playwright install chromium
pnpm.cmd start # leave running in terminal A after build
```

In terminal B, from the checkout:

```powershell
Remove-Item Env:PLAYWRIGHT_CHROMIUM_EXECUTABLE -ErrorAction SilentlyContinue
pnpm.cmd test:e2e
pnpm.cmd test:performance # includes actual five-minute offline intervals
pnpm.cmd test:k6
# Run separately after the above; intentionally restarts the local Postgres container:
pnpm.cmd test:db-restart
```

Use Playwright's downloaded Chromium by default. Linux visual baselines are not Windows visual verification: Playwright generates platform-specific snapshot names, so Windows baselines require explicit visual review before acceptance; do not blindly update them to manufacture passing tests. For Docker k6, enable Docker Desktop host networking (Desktop 4.34+); the supplied runner uses `--network host`. Alternatively install native k6 and target an explicitly started isolated benchmark API with `BASE_URL`. Never run database-restart checks alongside other database-dependent tests. Never run `build` against the `.next` tree while `dev`/`start` is serving it.

## Troubleshooting

| Symptom                                      | Action                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Docker named-pipe/daemon unavailable         | Start Docker Desktop; confirm Linux containers, `wsl --status`, and `docker version` server response. Resolve virtualisation/WSL prerequisites before retrying.                                                                                                                                                                      |
| `pnpm.ps1 cannot be loaded`                  | Use `pnpm.cmd`/`npm.cmd`; reopen the terminal after installing Node.                                                                                                                                                                                                                                                                 |
| Port already in use                          | `Get-NetTCPConnection -State Listen -LocalPort 3000,4000,5173,5174,55432,5001` identifies listeners. Inspect `Get-Process -Id <PID>` and stop only your known old NEXUS process; fixed ports are intentional.                                                                                                                        |
| Database password fails after editing `.env` | Existing Docker volumes retain their original database-role password. Back up research data and change the role password interactively with `docker compose -f infra/docker-compose.yml exec db psql -U nexus -d nexus`, then `\password nexus`; update `.env` consistently. Do not delete the volume to bypass a password mismatch. |
| Migration or seed fails                      | Inspect the exact error and migration ledger. Migrations roll back on error; rerun after fixing the prerequisite. Seeding preserves existing passwords, so changing DEMO_PASSWORD does not reset existing accounts.                                                                                                                  |
| Key unavailable / checkpoint 503             | Run `pnpm.cmd audit:keygen` if no config exists; inspect paths/ACLs and independently held public registry. Do not silently generate replacement trust for a damaged or missing existing private key. Outbox delivery continues while signing is unavailable.                                                                        |
| Map/ETA absent                               | Confirm public road download, graph preparation and `docker compose -f infra/docker-compose.yml --profile routing logs routing`. Verify API environment and restart it. Overpass outages/rate limits require waiting or using an owner-prepared licensed extract. Do not present geodesic distance as road ETA.                      |
| Browser stale assets/offline shell           | Close old tabs, reload online, inspect Application → Service Workers; sign out before clearing device state, since unsent fictional commands are local.                                                                                                                                                                              |
| 401 or role changes across apps              | Localhost cookies span ports. Use separate browser profiles and sign in again; receipt expiry is distinct from staff sessions.                                                                                                                                                                                                       |
| 409 on queued responder command              | Refresh and review assignment/version/expiry. Do not alter its original key/version to force success.                                                                                                                                                                                                                                |
| Slow build or filesystem locks               | Use a local short path, stop prior app processes, exclude generated folders from synchronisation, and use an environment with adequate RAM. Keep antivirus protection enabled.                                                                                                                                                       |

To stop services without destroying history: Ctrl+C in the launcher, then `docker compose -f infra/docker-compose.yml --profile routing stop`. Do not use `down -v` unless you intentionally approve permanent loss of the local research database. Admin reset cancels synthetic work while retaining append-only history.
