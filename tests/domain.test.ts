import { describe, it, expect } from "vitest";
import {
  canTransition,
  canonical,
  eventHash,
  verifyChain,
  statuses,
} from "../packages/domain/src/index";
import { createIncident } from "../packages/contracts/src/index";
import { en, t } from "../packages/i18n/src/index";
import { randomUUID } from "node:crypto";
describe("domain and localisation invariants", () => {
  it("forbids movement without acknowledgement and all terminal transitions", () => {
    expect(canTransition("OFFERED", "EN_ROUTE_REPORTED")).toBe(false);
    for (const state of statuses) {
      expect(canTransition("CLOSED", state)).toBe(false);
      expect(canTransition("CANCELLED", state)).toBe(false);
    }
    expect(canTransition("OFFERED", "ACCEPTED")).toBe(true);
  });
  it("canonicalises nested metadata independently of insertion order", () =>
    expect(canonical({ z: 1, a: { b: 2, a: 3 } })).toBe(
      canonical({ a: { a: 3, b: 2 }, z: 1 }),
    ));
  it("detects edited history, missing events, and reordered events", () => {
    const event: any = {
      sequence: 1,
      metadata: { status: "RECEIVED" },
      prev_hash: "0".repeat(64),
    };
    event.event_hash = eventHash(event);
    expect(verifyChain([event]).valid).toBe(true);
    expect(
      verifyChain([{ ...event, metadata: { status: "ACCEPTED" } }]).valid,
    ).toBe(false);
    expect(verifyChain([{ ...event, sequence: 2 }]).valid).toBe(false);
  });
  it("rejects real coordinates outside the bounded fictional demo and operational payloads", () => {
    const body = {
      client_request_id: randomUUID(),
      simulation: true,
      category: "TRAFFIC",
      description: "A fictional scenario",
      landmark: "Test landmark",
      longitude: 4.55,
      latitude: 7.77,
    };
    expect(createIncident.safeParse(body).success).toBe(true);
    expect(
      createIncident.safeParse({ ...body, simulation: false }).success,
    ).toBe(false);
    expect(createIncident.safeParse({ ...body, latitude: 40 }).success).toBe(
      false,
    );
    expect(createIncident.safeParse({ ...body, phone: "123" }).success).toBe(
      false,
    );
  });
  it("covers all stable status enums, namespaces and English plural/interpolation rules", () => {
    for (const status of statuses) expect(en.status[status]).toBeTruthy();
    for (const namespace of [
      "common",
      "citizen",
      "cad",
      "responder",
      "assurance",
      "simulation",
      "legal",
      "accessibility",
    ])
      expect((en as any)[namespace]).toBeTruthy();
    expect(t("common.count", { count: 1 })).toBe("1 record");
    expect(t("common.count", { count: 2 })).toBe("2 records");
    expect(t("accessibility.incident", { reference: "NXS-TEST" })).toContain(
      "NXS-TEST",
    );
  });
});
