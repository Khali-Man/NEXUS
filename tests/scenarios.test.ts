import { beforeAll, afterAll, it, expect } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { fixtures } from "../packages/simulation/src/index";
import { app } from "../apps/api/src/app";
import { pool } from "../apps/api/src/db";
import { migrate, seed } from "../tools/database";
const admin = request.agent(app);
beforeAll(async () => {
  await migrate();
  await seed();
  expect(
    (
      await admin.post("/api/v1/auth/login").send({
        username: "admin",
        password: process.env.DEMO_PASSWORD || "Nexus-Demo-2026!",
      })
    ).status,
  ).toBe(200);
});
afterAll(async () => pool.end());
for (const seed of [1, 2, 3, 4, 5])
  for (const [slug, fixture] of Object.entries(fixtures))
    it(`executes ${slug}, seed ${seed}, and its explicit goals`, async () => {
      await admin
        .post("/api/v1/simulator/reset")
        .set("Idempotency-Key", randomUUID())
        .send({ confirmation: "RESET SYNTHETIC DATA" });
      const run = await admin
        .post("/api/v1/simulator/scenarios/" + slug + "/run")
        .set("Idempotency-Key", randomUUID())
        .send({ seed });
      expect(run.status, run.text).toBe(200);
      expect(run.body.results_json.steps).toEqual(fixture.steps);
      if (slug === "duplicate-alerts") {
        expect(
          new Set(run.body.results_json.duplicateRetryReferences).size,
        ).toBe(1);
        expect(run.body.results_json.secondIncidentId).toBeTruthy();
      }
      let last: any;
      for (let step = 0; step < fixture.steps.length; step++) {
        const key = randomUUID();
        last = await admin
          .post("/api/v1/simulator/scenarios/" + run.body.id + "/step")
          .set("Idempotency-Key", key)
          .send({});
        expect(last.status, last.text).toBe(200);
        expect(last.body.step).toBe(step + 1);
        if (step === 0) {
          const repeated = await admin
            .post("/api/v1/simulator/scenarios/" + run.body.id + "/step")
            .set("Idempotency-Key", key)
            .send({});
          expect(repeated.body.step).toBe(1);
        }
      }
      expect(last.body.completed).toBe(true);
      if (slug === "audit-tamper") {
        expect(last.body.result.original.valid).toBe(true);
        expect(last.body.result.tamperedCopy.valid).toBe(false);
      }
      if (slug === "two-incidents-one-unit")
        expect(last.body.result.conflict).toBe("UNIT_INELIGIBLE");
      if (slug === "fire-no-eligible")
        expect(last.body.result.eligibleCount).toBe(0);
      if (slug === "late-arrival-conflict")
        expect(last.body.result.authoritativeStatus).toBe("CANCELLED");
    });
