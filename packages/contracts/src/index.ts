import { z } from "zod";
export const categories = [
  "TRAFFIC",
  "MEDICAL",
  "FIRE",
  "PUBLIC_SAFETY",
  "OTHER",
] as const;
export const createIncident = z
  .object({
    client_request_id: z.string().uuid(),
    simulation: z.literal(true),
    category: z.enum(categories),
    description: z.string().trim().min(8).max(500),
    landmark: z.string().min(2).max(120),
    longitude: z.number().min(4.45).max(4.7),
    latitude: z.number().min(7.65).max(7.9),
    location_confidence: z.enum(["LANDMARK", "MANUAL"]).default("LANDMARK"),
  })
  .strict();
export const command = z
  .object({
    expected_version: z.number().int().positive(),
    reason: z.string().trim().min(3).max(500),
    client_occurred_at: z.string().datetime().optional(),
    reason_flags: z
      .array(
        z.enum([
          "NEEDS_INFORMATION",
          "NO_ELIGIBLE_UNIT",
          "REASSIGNMENT_REQUIRED",
        ]),
      )
      .max(3)
      .optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
    unit_id: z.string().uuid().optional(),
    text: z.string().trim().max(1000).optional(),
    related_id: z.string().uuid().optional(),
    correction_of: z.string().uuid().optional(),
  })
  .strict();
export const login = z
  .object({
    username: z.string().min(2).max(80),
    password: z.string().min(1).max(128),
  })
  .strict();
export const feedback = z
  .object({
    response_clarity_score: z.number().int().min(1).max(5),
    free_text: z.string().trim().max(500).default(""),
  })
  .strict();
export const landmarks = [
  {
    id: "ola-iya",
    name: "Olaiya junction · fictional scene",
    longitude: 4.5557,
    latitude: 7.7738,
  },
  {
    id: "freedom",
    name: "Freedom Park · fictional scene",
    longitude: 4.558,
    latitude: 7.782,
  },
  {
    id: "station",
    name: "Old railway area · fictional scene",
    longitude: 4.549,
    latitude: 7.768,
  },
  {
    id: "stadium",
    name: "Stadium road · fictional scene",
    longitude: 4.568,
    latitude: 7.792,
  },
];
export const scenarios = [
  "traffic-osogbo-main",
  "medical-low-network",
  "fire-no-eligible",
  "two-incidents-one-unit",
  "assignment-declined",
  "duplicate-alerts",
  "late-arrival-conflict",
  "audit-tamper",
  "map-unavailable",
] as const;
export type IncidentInput = z.infer<typeof createIncident>;
export const receiptResponse = z.object({
  reference: z.string().regex(/^NXS-[A-F0-9]{10}$/),
  receiptToken: z.string().min(40),
  serverTime: z.string().datetime(),
  status: z.literal("RECEIVED"),
  simulation: z.literal(true),
});
export const eventEnvelope = z.object({
  eventId: z.string().uuid(),
  incidentId: z.string().uuid().optional(),
  sequence: z.number().int().positive().optional(),
  aggregateVersion: z.number().int().positive().optional(),
  emittedAt: z.string().datetime(),
  type: z.string(),
  safePayload: z.record(z.unknown()),
  simulation: z.literal(true),
});
export const errorResponse = z.object({
  code: z.string(),
  message: z.string(),
  correlationId: z.string().uuid(),
  retryable: z.boolean(),
  details: z.unknown().optional(),
});
export const scenarioInput = z
  .object({ seed: z.number().int().min(0).max(2147483647) })
  .strict();
export const faultInput = z
  .object({
    fault: z.enum([
      "worker_paused",
      "drop_notifications",
      "map_unavailable",
      "stale_locations",
      "unit_unavailable",
      "ack_delay_ms",
    ]),
    enabled: z.boolean(),
    delay_ms: z.number().int().min(0).max(10000).optional(),
  })
  .strict();
export const resetInput = z
  .object({ confirmation: z.literal("RESET SYNTHETIC DATA") })
  .strict();
export const settingsInput = z
  .object({
    retention_days: z.number().int().min(1).max(30),
    agency_name: z.string().trim().min(5).max(80),
  })
  .strict();
export const checkpointInput = z
  .object({ reason: z.string().min(3).max(500) })
  .strict();
