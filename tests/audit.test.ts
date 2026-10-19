import { beforeAll, afterAll, it, expect } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { ensureAuditKeys } from "../tools/audit-keygen";
import { app } from "../apps/api/src/app";
import { pool } from "../apps/api/src/db";
import { migrate, seed } from "../tools/database";
import { signatureStatus } from "../apps/api/src/audit";
import { canonical, digest } from "../packages/domain/src/index";
const dir = mkdtempSync(join(tmpdir(), "nexus-audit-"));
const previous = {
  config: process.env.AUDIT_SIGNING_CONFIG,
  trust: process.env.AUDIT_TRUSTED_KEYS_FILE,
};
const trustFile = join(dir, "trust.json");
let agent: ReturnType<typeof request.agent>, bundle: any;
function verify(
  bundleValue = bundle,
  registry = JSON.parse(readFileSync(trustFile, "utf8")),
) {
  const path = join(dir, "bundle.json"),
    trusted = join(dir, "independent-trust.json");
  writeFileSync(path, JSON.stringify(bundleValue));
  writeFileSync(trusted, JSON.stringify(registry));
  return spawnSync(
    process.execPath,
    ["tools/verify-checkpoint.mjs", path, trusted],
    { encoding: "utf8" },
  );
}
async function checkpoint() {
  const r = await agent
    .post("/api/v1/assurance/audit/checkpoint")
    .set("Idempotency-Key", randomUUID())
    .send({ reason: "Independent fictional research verification" });
  expect(r.status, r.text).toBe(200);
  const exported = await agent.get(
    "/api/v1/assurance/audit/checkpoints/" + r.body.id + "/bundle",
  );
  expect(exported.status).toBe(200);
  return exported.body;
}
beforeAll(async () => {
  process.env.AUDIT_SIGNING_CONFIG = join(dir, "signing.json");
  process.env.AUDIT_TRUSTED_KEYS_FILE = trustFile;
  ensureAuditKeys();
  await migrate();
  await seed();
  const report = await request(app)
    .post("/api/v1/demo/incidents")
    .set("Idempotency-Key", randomUUID())
    .send({
      client_request_id: randomUUID(),
      simulation: true,
      category: "TRAFFIC",
      description: "Fictional signing verification",
      landmark: "Fictional landmark",
      longitude: 4.5557,
      latitude: 7.7738,
    });
  expect(report.status).toBe(200);
  agent = request.agent(app);
  expect(
    (
      await agent.post("/api/v1/auth/login").send({
        username: "supervisor",
        password: process.env.DEMO_PASSWORD || "Nexus-Demo-2026!",
      })
    ).status,
  ).toBe(200);
  bundle = await checkpoint();
});
afterAll(async () => {
  for (const [k, v] of [
    ["AUDIT_SIGNING_CONFIG", previous.config],
    ["AUDIT_TRUSTED_KEYS_FILE", previous.trust],
  ]) {
    if (v === undefined) delete process.env[k!];
    else process.env[k!] = v;
  }
  rmSync(dir, { recursive: true, force: true });
  await pool.end();
});
it("independently verifies an API-exported signed history with Node's standard library", () => {
  const r = verify();
  expect(r.status, r.stderr).toBe(0);
  expect(JSON.parse(r.stdout)).toMatchObject({
    signature: "VALID",
    history: "VALID",
    externallyAnchored: false,
  });
});
it("rejects envelope changes, modified/rehashed history, truncation and signature substitution", () => {
  for (const mutate of [
    (b: any) => (b.checkpoint.signed_payload.scope = randomUUID()),
    (b: any) => (b.checkpoint.signed_payload.reason = "Changed reason"),
    (b: any) =>
      (b.checkpoint.signed_payload.checkpointAt = "2020-01-01T00:00:00.000Z"),
    (b: any) => (b.checkpoint.signature = Buffer.alloc(64).toString("base64")),
    (b: any) => b.events.pop(),
    (b: any) => {
      b.events[0].reason_code = "REWRITTEN";
      const { event_hash: _hash, ...data } = b.events[0];
      b.events[0].event_hash = digest(canonical(data));
    },
  ]) {
    const b = structuredClone(bundle);
    mutate(b);
    expect(verify(b).status).toBe(1);
  }
});
it("retains verification across rotation, binds checkpoint linkage and rejects revoked/unknown keys", async () => {
  const oldId = bundle.checkpoint.signer_key_id;
  ensureAuditKeys(true);
  expect(verify().status).toBe(0);
  const newer = await checkpoint();
  expect(newer.checkpoint.signer_key_id).not.toBe(oldId);
  expect(newer.checkpoint.signed_payload.previousCheckpointHash).toBe(
    digest(canonical(bundle.checkpoint.signed_payload)),
  );
  expect(verify(newer).status).toBe(0);
  const registry = JSON.parse(readFileSync(trustFile, "utf8"));
  registry.keys.find((k: any) => k.id === oldId).status = "revoked";
  expect(verify(bundle, registry).status).toBe(1);
  expect(signatureStatus(bundle.checkpoint, registry)).toBe("REVOKED_KEY");
  expect(verify(bundle, { version: 1, keys: [] }).status).toBe(1);
});
it("refuses signing without a private key and enforces checkpoint append-only storage", async () => {
  process.env.AUDIT_SIGNING_CONFIG = join(dir, "missing.json");
  const r = await agent
    .post("/api/v1/assurance/audit/checkpoint")
    .set("Idempotency-Key", randomUUID())
    .send({ reason: "Missing key test" });
  expect(r.status).toBe(503);
  expect(r.body.code).toBe("AUDIT_SIGNING_UNAVAILABLE");
  await expect(
    pool.query("UPDATE audit_checkpoints SET root_hash='changed' WHERE id=$1", [
      bundle.checkpoint.id,
    ]),
  ).rejects.toThrow("append-only");
  process.env.AUDIT_SIGNING_CONFIG = join(dir, "signing.json");
});
