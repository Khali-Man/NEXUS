# Osogbo roads and modelled travel estimates

NEXUS uses **public OpenStreetMap roads + self-hosted OSRM ordinary-car routing**, with MapLibre rendering local GeoJSON. All incidents and units remain fictional; no fleet telemetry, emergency agency, traffic feed, geocoder or outgoing dispatch integration is connected. There are no paid-provider credentials. Public road geometry is geographic context, not sensitive operational data.

## Provision a local public snapshot

From the repository root, with Docker running and HTTPS access to `overpass-api.de` and `ghcr.io`:

```sh
pnpm maps:download
pnpm maps:prepare
pnpm maps:up
```

`maps:download` queries only public highways in bounding box south/west/north/east **7.65,4.45,7.90,4.70** around Osogbo. It sends no incident, user or unit data. Two Overpass queries retrieve visual geometry and a complete-node XML extract; their snapshots may differ slightly if OSM changes between queries. Files, source/base/download times, road count and XML SHA-256 are stored under ignored `.nexus/maps/`. The importer rejects incomplete/remark responses and does not install partial downloads. Treat Overpass as a best-effort public data source; respect its rate limits, and do not run imports during active research sessions.

`maps:prepare` stops only the optional routing service, then runs OSRM extract with `/opt/car.lua`, MLD partition and customization. The pinned image is `ghcr.io/project-osrm/osrm-backend@sha256:855614a38f464b0558a2ad6eaa7cb8c139f39887da9b38b485ce453c6e6e6124`. `maps:up` serves its graph only on loopback port 5001. Larger studies can use a dated/checksummed Geofabrik Nigeria `.osm.pbf` extract, clipped with a complete-way buffer before preparation. Preserve source, licence, checksum and OSRM profile/image in the study record; no full-country graph is downloaded automatically.

Set these non-secret API variables in `.env`, then restart the API:

```dotenv
OSM_ROADS_FILE=.nexus/maps/osogbo-roads.geojson
OSRM_BASE_URL=http://127.0.0.1:5001
ROUTING_DATA_VERSION=<osmSha256 from .nexus/maps/metadata.json>
```

On PowerShell, read metadata with `$meta = Get-Content .nexus\maps\metadata.json -Raw | ConvertFrom-Json` and set `$env:ROUTING_DATA_VERSION = $meta.osmSha256`. See [Windows instructions](../../docs/WINDOWS_11.md). Use `docker compose -f infra/docker-compose.yml --profile routing logs routing` to diagnose graph startup. The old synthetic street grid has been removed: absent public roads, the map is a labelled geographic context background with fictional markers, accessible lists and no road claim.

## Route semantics and failure behaviour

Eligibility remains authoritative PostGIS geography: simulated/available agency units, suitable capability, fresh position/status, not reserved, within 15 km. **Only** the read-only candidate endpoint asks OSRM for up to 12 eligible units, outside assignment transactions. Commands never wait on a router while holding dispatch locks. Coordinates are longitude-first, bounded to the study area; service URLs come from owner settings, never user input. HTTP has a 1.5-second timeout, no redirects, bounded response size and strict response/geometry validation. Snapping farther than 200 metres is rejected. Identical concurrent requests coalesce; successful routes cache two minutes and failures ten seconds, with a 256-entry bound.

Responses expose provider `OSRM_OSM_CAR`, model seconds, road metres/geometry, estimate UTC timestamp, dataset version, snapped distances and `traffic_aware:false`. UI shows a **model travel estimate**, source/snapshot, and optional dashed route overlay. Complete eligible coverage ranks by model time; otherwise the whole list falls back to geographic distance. Dispatch remains a human decision.

These are ordinary-car model times using OSM access/one-way/speed/profile assumptions. OSM in Osogbo may omit roads, turns, surfaces, access restrictions and recent changes. There is **no live traffic, flood/closure feed, traffic-light delay calibration, emergency-driving privilege, calibrated uncertainty interval or arrival guarantee**. Never infer measured response performance from these estimates. Check roads against the study area before accepting research results.

Missing configuration/data, service outage, timeout, no route, excessive snapping, invalid geometry or out-of-area coordinates yield `eta_seconds:null`, `eta_source:UNAVAILABLE`, a reason and no route line. Straight-line metres remain labelled. Rendering failure preserves all lists. An optional licensed `MAP_STYLE_URL` can supply richer tiles/labels/sprites/glyphs with attribution and allowed network hosts; a tile provider does not itself supply routing.

## Licensing and validation boundary

OSM data is © OpenStreetMap contributors under [ODbL](https://www.openstreetmap.org/copyright). MapLibre displays attribution when local roads load. Retain source/attribution for redistribution and comply with ODbL database obligations. The engine test network under `tests/routing/` is original fictional geometry, never installed as the public-road map.

`pnpm test:routing` starts the pinned OSRM container, prepares that fictional network, verifies one-way route differences and outage fallback. Vitest additionally exercises HTTP provider responses, no-route/invalid responses, snapping, coverage and deduplication. **These checks do not validate actual Osogbo data quality.** Cloud egress blocked Overpass/Geofabrik during this review; real road import, city-route smoke checks and Windows Docker mounts remain unresolved until those operations run. Record metadata and inspect several routes before claiming Osogbo routing verified.
