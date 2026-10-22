// Declared fictional inputs for pixel tests only. Product journeys use the real API.
import { fixtures } from "../../../packages/simulation/src/index";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const visualIncidents = [
  "RECEIVED",
  "OFFERED",
  "EN_ROUTE_REPORTED",
  "ARRIVAL_REPORTED",
].map((status, n) => ({
  id: id(n + 1),
  public_reference: `NXS-VISUAL000${n}`,
  status,
  category: n === 2 ? "MEDICAL" : "TRAFFIC",
  priority: n === 0 ? "HIGH" : "MEDIUM",
  landmark: [
    "Fictional Olaiya landmark",
    "Fictional Oke-Fia landmark",
    "Fictional Station Road landmark",
    "Fictional research point",
  ][n],
  latitude: 7.7738 + n * 0.001,
  longitude: 4.5557 + n * 0.001,
  created_at: "2026-10-20T10:00:00Z",
  version: 1,
}));
export const visualUnits = ["BUSY", "AVAILABLE", "AVAILABLE", "OFFLINE"].map(
  (dispatch_status, n) => ({
    id: id(n + 10),
    callsign: `OSG • 0${n + 1}`,
    dispatch_status,
    fresh: n !== 1,
    latitude: 7.774,
    longitude: 4.556,
    capability_tags: ["TRAFFIC"],
  }),
);
export const visualAssignments = ["ACTIVE", "OFFERED", "COMPLETED"].map(
  (assignment_status, n) => ({
    ...visualIncidents[n],
    status:
      assignment_status === "ACTIVE"
        ? "EN_ROUTE_REPORTED"
        : assignment_status === "OFFERED"
          ? "OFFERED"
          : "CLOSED",
    assignment_id: id(n + 20),
    updated_at: "2026-10-20T10:01:00Z",
    assignment_status,
    callsign: "OSG • 03",
    expires_at: "2026-10-20T10:10:00Z",
  }),
);
export const visualScenarios = Object.entries(fixtures)
  .map(([slug, f], n) => ({
    id: id(n + 30),
    slug,
    title: f.title,
    seed_json: { ...f },
    expected_results_json: { assertions: f.goals },
  }))
  .sort((a, b) => a.slug.localeCompare(b.slug));
export const visualRuns = [0, 1].map((n) => ({
  id: id(n + 50),
  scenario_id: visualScenarios.find((s) => s.slug === "traffic-osogbo-main")!
    .id,
  seed: 2026,
  started_at: "2026-10-20T10:00:00Z",
  completed_at: n ? "2026-10-20T10:05:00Z" : null,
  results_json: {
    slug: "traffic-osogbo-main",
    incidentId: id(1),
    reference: `NXS-RUN00000${n}`,
    steps: fixtures["traffic-osogbo-main"].steps,
    step: n ? 8 : 3,
  },
}));
export const visualNetwork = {
  settings: {
    worker_paused: false,
    drop_notifications: false,
    map_unavailable: false,
    stale_locations: false,
    unit_unavailable: false,
    ack_delay_ms: 0,
  },
};
