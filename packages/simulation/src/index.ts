/** Fictional research fixtures, never operational procedures. */
export const fixtures = {
  "traffic-osogbo-main": {
    title: "Traffic · Osogbo main",
    description:
      "Fictional collision with a closest busy unit, a stale unit and a fresh eligible unit.",
    category: "TRAFFIC",
    steps: [
      "triage",
      "ready",
      "offer",
      "accept",
      "en-route",
      "arrived",
      "outcome",
      "close",
    ],
    goals: [
      "Only the fresh, capable, available unit can receive an offer.",
      "Citizen progress waits for explicit responder acknowledgement.",
    ],
  },
  "medical-low-network": {
    title: "Medical · low network",
    description:
      "Fictional medical scene with intentionally dropped realtime notifications; REST replay remains available.",
    category: "MEDICAL",
    steps: [
      "triage",
      "ready",
      "offer",
      "accept",
      "en-route",
      "arrived",
      "outcome",
      "close",
    ],
    goals: [
      "Socket loss cannot create a false citizen status.",
      "Use field offline controls to queue and reconnect.",
    ],
  },
  "fire-no-eligible": {
    title: "Fire · no eligible unit",
    description:
      "No fictional unit has the FIRE capability. Dispatch must stop at a truthful waiting state.",
    category: "FIRE",
    steps: ["triage", "ready", "assert-no-eligible"],
    goals: [
      "Zero eligible FIRE units.",
      "No automatic deployment or fabricated ETA.",
    ],
  },
  "two-incidents-one-unit": {
    title: "Contention · two incidents",
    description:
      "Two synthetic source receipts compete for one available unit. The second offer must fail safely.",
    category: "TRAFFIC",
    steps: ["triage", "ready", "offer", "assert-contention"],
    goals: [
      "At most one current assignment per unit.",
      "Both source incidents and histories remain intact.",
    ],
  },
  "assignment-declined": {
    title: "Assignment · declined",
    description:
      "A fictional responder declines; the operator records a new offer and the old assignment remains visible.",
    category: "TRAFFIC",
    steps: [
      "triage",
      "ready",
      "offer",
      "decline",
      "offer",
      "accept",
      "en-route",
      "arrived",
      "outcome",
      "close",
    ],
    goals: [
      "Declined assignment retained.",
      "Reoffer creates a distinct lineage entry.",
    ],
  },
  "duplicate-alerts": {
    title: "Alerts · duplicate transport",
    description:
      "Five identical transport retries create one source record. A second similar fictional report is a human-review suggestion.",
    category: "TRAFFIC",
    steps: ["triage", "ready"],
    goals: [
      "Identical retries return one reference.",
      "Potential duplicates are linked only by a reasoned operator command.",
    ],
  },
  "late-arrival-conflict": {
    title: "Offline · late arrival conflict",
    description:
      "After confirmed travel, a fictional arrival is queued offline. A documented handover returns the incident to waiting, then cancellation must defeat the old arrival command.",
    category: "TRAFFIC",
    steps: [
      "triage",
      "ready",
      "offer",
      "accept",
      "en-route",
      "reassign",
      "cancel",
      "assert-stale-command",
    ],
    goals: [
      "Cancellation remains authoritative.",
      "An old queued command receives a conflict instead of changing state.",
    ],
  },
  "audit-tamper": {
    title: "Audit · tampered test copy",
    description:
      "Only an in-memory copy of an event is edited. Verification must flag a mismatch while the original still verifies.",
    category: "TRAFFIC",
    steps: ["assert-audit-tamper"],
    goals: [
      "Source chain valid.",
      "Tampered copy invalid.",
      "No mutation of stored audit events.",
    ],
  },
  "map-unavailable": {
    title: "Map · unavailable",
    description:
      "Local map failure is injected. Accessible lists, landmarks and geographic distance continue to support the fictional workflow.",
    category: "TRAFFIC",
    steps: [
      "triage",
      "ready",
      "offer",
      "accept",
      "en-route",
      "arrived",
      "outcome",
      "close",
    ],
    goals: [
      "No map dependency for dispatch commands.",
      "No invented route or ETA.",
    ],
  },
} as const;
