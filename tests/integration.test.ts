import { beforeAll, afterAll, describe, it, expect } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { app } from "../apps/api/src/app";
import { pool, sql, normalizeEvent, passwordHash } from "../apps/api/src/db";
import { verifyChain } from "../packages/domain/src/index";
import { migrate, seed } from "../tools/database";
import { tick } from "../apps/worker/src/index";
const agents: any = {};
let agency: string;
let unitA: string;
let unitB: string;
async function report(key = randomUUID()) {
  const body = {
    client_request_id: key,
    simulation: true,
    category: "TRAFFIC",
    description: "Synthetic integration-test collision; no real people.",
    landmark: "Fictional Olaiya test landmark",
    longitude: 4.5557,
    latitude: 7.7738,
  };
  const response = await request(app)
    .post("/api/v1/demo/incidents")
    .set("Idempotency-Key", key)
    .send(body);
  expect(response.status, response.text).toBe(200);
  const row = (
    await sql("SELECT * FROM incidents WHERE public_reference=$1", [
      response.body.reference,
    ])
  )[0];
  return { row, receipt: response.body, body, key };
}
async function act(
  i: any,
  action: string,
  extra: any = {},
  actor = "dispatcher",
  key = randomUUID(),
) {
  return agents[actor]
    .post("/api/v1/cad/incidents/" + i.id + "/" + action)
    .set("Idempotency-Key", key)
    .send({
      expected_version: i.version,
      reason: "Synthetic verification reason",
      ...extra,
    });
}
async function prepareOffer(unit = unitA) {
  const r = await report();
  let i = (await act(r.row, "triage")).body.incident;
  i = (await act(i, "ready")).body.incident;
  const offered = await act(i, "assignments", { unit_id: unit });
  expect(offered.status, offered.text).toBe(200);
  return {
    ...r,
    row: offered.body.incident,
    assignment: offered.body.event.metadata.assignmentId,
  };
}
async function respond(r: any, action: string, key = randomUUID()) {
  return agents.responder
    .post("/api/v1/responder/assignments/" + r.assignment + "/" + action)
    .set("Idempotency-Key", key)
    .send({
      expected_version: r.row.version,
      reason: "Synthetic responder test",
      client_occurred_at: "2026-01-01T00:00:00.000Z",
    });
}
beforeAll(async () => {
  await migrate();
  await seed();
  await sql(
    "UPDATE units SET dispatch_status='BUSY',status_updated_at=now() WHERE callsign='OSG • 01'",
  );
  await sql(
    "UPDATE unit_current_locations SET recorded_at=now()-interval '30 minutes' WHERE unit_id=(SELECT id FROM units WHERE callsign='OSG • 02')",
  );
  for (const role of ["dispatcher", "responder", "supervisor", "admin"]) {
    const agent = request.agent(app);
    const res = await agent.post("/api/v1/auth/login").send({
      username: role,
      password: process.env.DEMO_PASSWORD || "Nexus-Demo-2026!",
    });
    expect(res.status).toBe(200);
    agents[role] = agent;
    agency = res.body.agency_id;
  }
  for (const suffix of ["A", "B"]) {
    const u = (
      await sql(
        "INSERT INTO units(agency_id,callsign,unit_type,capability_tags,dispatch_status) VALUES($1,$2,'PATROL',ARRAY['TRAFFIC'],'AVAILABLE') RETURNING id",
        [agency, "TEST-" + suffix + "-" + randomUUID().slice(0, 5)],
      )
    )[0];
    await sql(
      "INSERT INTO unit_current_locations(unit_id,geom) VALUES($1,ST_SetSRID(ST_MakePoint(4.556,7.774),4326)::geography)",
      [u.id],
    );
    await sql(
      "INSERT INTO responder_unit_memberships(user_id,unit_id) SELECT id,$1 FROM users WHERE role='responder'",
      [u.id],
    );
    if (suffix === "A") unitA = u.id;
    else unitB = u.id;
  }
});
afterAll(async () => {
  await pool.end();
});
describe("persistent secured workflow", () => {
  it("health checks the real database and supplies reference data", async () => {
    expect((await request(app).get("/api/v1/health")).body.ok).toBe(true);
    expect(
      (await request(app).get("/api/v1/demo/reference-data")).body.landmarks
        .length,
    ).toBe(4);
  });
  it("requires a session and enforces roles, origin and bounded input", async () => {
    expect((await request(app).get("/api/v1/cad/incidents")).status).toBe(401);
    expect((await agents.responder.get("/api/v1/cad/incidents")).status).toBe(
      403,
    );
    expect(
      (
        await agents.dispatcher
          .post("/api/v1/simulator/reset")
          .send({ confirmation: "RESET SYNTHETIC DATA" })
      ).status,
    ).toBe(403);
    expect(
      (
        await agents.dispatcher
          .post("/api/v1/auth/logout")
          .set("Origin", "https://evil.example")
          .send({})
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post("/api/v1/demo/incidents")
          .send({ simulation: false })
      ).status,
    ).toBe(400);
  });
  it("sets HttpOnly SameSite cookies, refuses bad passwords and expires sessions", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({
        username: "dispatcher",
        password: process.env.DEMO_PASSWORD || "Nexus-Demo-2026!",
      });
    expect(res.headers["set-cookie"][0]).toContain("HttpOnly");
    expect(res.headers["set-cookie"][0]).toContain("SameSite=Strict");
    expect(
      (
        await request(app)
          .post("/api/v1/auth/login")
          .send({ username: "dispatcher", password: "wrong" })
      ).status,
    ).toBe(401);
    const agent = request.agent(app);
    await agent.post("/api/v1/auth/login").send({
      username: "dispatcher",
      password: process.env.DEMO_PASSWORD || "Nexus-Demo-2026!",
    });
    await agent.post("/api/v1/auth/logout").send({});
    expect((await agent.get("/api/v1/auth/me")).status).toBe(401);
  });
  it("commits one incident and one outbox/event under retry storms, with no raw capability stored", async () => {
    const r = await report();
    const retries = await Promise.all(
      Array.from({ length: 12 }, () =>
        request(app)
          .post("/api/v1/demo/incidents")
          .set("Idempotency-Key", r.key)
          .send(r.body),
      ),
    );
    expect(
      retries.every(
        (x) =>
          x.status === 200 && x.body.receiptToken === r.receipt.receiptToken,
      ),
    ).toBe(true);
    expect(
      (
        await sql("SELECT * FROM incident_events WHERE incident_id=$1", [
          r.row.id,
        ])
      ).length,
    ).toBe(1);
    expect(
      (
        await sql("SELECT * FROM outbox_events WHERE aggregate_id=$1", [
          r.row.id,
        ])
      ).length,
    ).toBe(1);
    const stored = (
      await sql(
        "SELECT result_json FROM client_commands WHERE actor_scope=$1",
        ["citizen:" + r.key],
      )
    )[0];
    expect(JSON.stringify(stored)).not.toContain(r.receipt.receiptToken);
    const freshTransportKey = await request(app)
      .post("/api/v1/demo/incidents")
      .set("Idempotency-Key", randomUUID())
      .send(r.body);
    expect(freshTransportKey.body.reference).toBe(r.receipt.reference);
    const mismatch = await request(app)
      .post("/api/v1/demo/incidents")
      .set("Idempotency-Key", r.key)
      .send({ ...r.body, description: "A changed fictional description" });
    expect(mismatch.status).toBe(409);
  });
  it("protects citizen receipts and returns only safe statuses", async () => {
    const r = await report();
    expect(
      (
        await request(app).get(
          "/api/v1/demo/incidents/" + r.receipt.reference + "/status",
        )
      ).status,
    ).toBe(401);
    const res = await request(app)
      .get("/api/v1/demo/incidents/" + r.receipt.reference + "/status")
      .set("X-Receipt-Token", r.receipt.receiptToken);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("RECEIVED");
    expect(JSON.stringify(res.body)).not.toMatch(
      /description_sanitised|receipt_token_digest|agency_id|longitude/,
    );
    await sql(
      "UPDATE incidents SET receipt_expires_at=now()-interval '1 second' WHERE id=$1",
      [r.row.id],
    );
    expect(
      (
        await request(app)
          .get("/api/v1/demo/incidents/" + r.receipt.reference + "/status")
          .set("X-Receipt-Token", r.receipt.receiptToken)
      ).status,
    ).toBe(404);
  });
  it("enforces geography metres, longitude/latitude ordering and excludes busy/stale/mismatched units", async () => {
    const r = await report();
    const candidates = (
      await agents.dispatcher.get(
        "/api/v1/cad/incidents/" + r.row.id + "/candidates",
      )
    ).body.items;
    const c = candidates.find((u: any) => u.id === unitA);
    expect(c.eligible).toBe(true);
    expect(c.distance_m).toBeGreaterThan(0);
    expect(c.distance_m).toBeLessThan(100);
    expect(c.eta_seconds).toBeNull();
    expect(
      candidates.find((u: any) => u.callsign === "OSG • 01").excluded_reasons,
    ).toContain("BUSY");
    expect(
      candidates.find((u: any) => u.callsign === "OSG • 02").excluded_reasons,
    ).toContain("STALE");
    expect(
      candidates.find((u: any) => u.callsign === "OSG • 04").excluded_reasons,
    ).toContain("CAPABILITY_MISMATCH");
  });
  it("blocks illegal transitions and stale versions without side effects", async () => {
    const r = await report();
    expect((await act(r.row, "close")).status).toBe(409);
    const ok = await act(r.row, "triage");
    expect(ok.status).toBe(200);
    expect((await act(r.row, "triage")).body.code).toBe("VERSION_CONFLICT");
    expect(
      (
        await sql(
          "SELECT count(*)::int AS n FROM incident_events WHERE incident_id=$1",
          [r.row.id],
        )
      )[0].n,
    ).toBe(2);
  });
  it("serialises competing dispatchers so only one current offer survives", async () => {
    const r = await report();
    let i = (await act(r.row, "triage")).body.incident;
    i = (await act(i, "ready")).body.incident;
    const offers = await Promise.all([
      act(i, "assignments", { unit_id: unitA }),
      act(i, "assignments", { unit_id: unitB }),
    ]);
    expect(offers.map((x) => x.status).sort()).toEqual([200, 409]);
    expect(
      (
        await sql(
          "SELECT * FROM assignments WHERE incident_id=$1 AND status='OFFERED'",
          [i.id],
        )
      ).length,
    ).toBe(1);
    const updated = offers.find((x) => x.status === 200)!.body.incident;
    expect((await act(updated, "cancel")).status).toBe(200);
  });
  it("completes citizen → triage → offer → acknowledgement → outcome → closure and feedback", async () => {
    const r = await prepareOffer();
    const key = randomUUID();
    let response = await respond(r, "accept", key);
    expect(response.status, response.text).toBe(200);
    expect((await respond(r, "accept", key)).body.event.id).toBe(
      response.body.event.id,
    );
    r.row = response.body.incident;
    for (const action of ["en-route", "arrived", "outcome"]) {
      response = await respond(r, action);
      expect(response.status, response.text).toBe(200);
      r.row = response.body.incident;
    }
    response = await act(r.row, "close", {}, "supervisor");
    expect(response.status).toBe(200);
    const tracked = await request(app)
      .get("/api/v1/demo/incidents/" + r.receipt.reference + "/status")
      .set("X-Receipt-Token", r.receipt.receiptToken);
    expect(tracked.body.status).toBe("CLOSED");
    expect(tracked.body.timeline.map((x: any) => x.status)).toEqual([
      "RECEIVED",
      "TRIAGED",
      "WAITING_FOR_UNIT",
      "OFFERED",
      "ACCEPTED",
      "EN_ROUTE_REPORTED",
      "ARRIVAL_REPORTED",
      "RESOLVED",
      "CLOSED",
    ]);
    const feed = await request(app)
      .post("/api/v1/demo/incidents/" + r.receipt.reference + "/feedback")
      .set("X-Receipt-Token", r.receipt.receiptToken)
      .set("Idempotency-Key", randomUUID())
      .send({
        response_clarity_score: 5,
        free_text: "Clear synthetic timeline",
      });
    expect(feed.status).toBe(200);
  });
  it("retains declined and withdrawn assignment lineage and rejects old offline commands", async () => {
    const r = await prepareOffer();
    const declined = await respond(r, "decline");
    expect(declined.status).toBe(200);
    r.row = declined.body.incident;
    expect((await respond(r, "accept")).status).toBe(409);
    const offer = await act(r.row, "assignments", { unit_id: unitA });
    expect(offer.status).toBe(200);
    r.row = offer.body.incident;
    expect((await respond(r, "accept")).status).toBe(409);
    await act(r.row, "cancel");
    const history = await agents.dispatcher.get(
      "/api/v1/cad/incidents/" + r.row.id,
    );
    expect(history.body.assignments).toHaveLength(2);
    expect(history.body.assignments[0].status).toBe("DECLINED");
  });
  it("expires offers and returns to waiting with an explicit appended event", async () => {
    const r = await prepareOffer();
    await sql(
      "UPDATE assignments SET expires_at=now()-interval '1 second' WHERE id=$1",
      [r.assignment],
    );
    expect((await respond(r, "accept")).body.code).toBe("OFFER_EXPIRED");
    await tick();
    const detail = await agents.dispatcher.get(
      "/api/v1/cad/incidents/" + r.row.id,
    );
    expect(detail.body.status).toBe("WAITING_FOR_UNIT");
    expect(detail.body.assignments[0].status).toBe("EXPIRED");
  });
  it("rejects offline arrival after cancellation/withdrawal and keeps citizen truthfulness", async () => {
    const r = await prepareOffer();
    const old = r.row.version;
    r.row = (await act(r.row, "cancel")).body.incident;
    r.row.version = old;
    expect((await respond(r, "arrived")).status).toBe(409);
    const tracked = await request(app)
      .get("/api/v1/demo/incidents/" + r.receipt.reference + "/status")
      .set("X-Receipt-Token", r.receipt.receiptToken);
    expect(tracked.body.status).toBe("CANCELLED");
  });
  it("applies membership and agency scope to details, commands, replay and export", async () => {
    const r = await report();
    const otherAgency = (
      await sql(
        "INSERT INTO agencies(demo_name,category) VALUES($1,'RESEARCH') RETURNING id",
        ["ZZZ isolation " + randomUUID()],
      )
    )[0];
    const username = "isolated-" + randomUUID();
    await sql(
      "INSERT INTO users(username,demo_name,role,agency_id,password_hash) VALUES($1,'Isolated demo','dispatcher',$2,$3)",
      [username, otherAgency.id, passwordHash("Isolated-Demo-Password!")],
    );
    const agent = request.agent(app);
    await agent
      .post("/api/v1/auth/login")
      .send({ username, password: "Isolated-Demo-Password!" });
    expect((await agent.get("/api/v1/cad/incidents/" + r.row.id)).status).toBe(
      404,
    );
    expect((await agent.get("/api/v1/cad/incidents")).body.total).toBe(0);
    expect(
      (await agents.responder.get("/api/v1/assurance/reports/export")).status,
    ).toBe(403);
    expect(
      (
        await agents.responder.get(
          "/api/v1/responder/assignments/" + randomUUID(),
        )
      ).status,
    ).toBe(404);
  });
  it("preserves correction/review provenance and detects tampering in copied audit data", async () => {
    const r = await report();
    let response = await agents.supervisor
      .post("/api/v1/assurance/incidents/" + r.row.id + "/corrections")
      .set("Idempotency-Key", randomUUID())
      .send({
        expected_version: 1,
        reason: "Correct fictional context",
        correction_of: (
          await sql("SELECT id FROM incident_events WHERE incident_id=$1", [
            r.row.id,
          ])
        )[0].id,
      });
    expect(response.status, response.text).toBe(200);
    response = await agents.supervisor
      .post("/api/v1/assurance/incidents/" + r.row.id + "/reviews")
      .set("Idempotency-Key", randomUUID())
      .send({
        expected_version: 2,
        reason: "Missing reported milestone reviewed",
      });
    expect(response.status).toBe(200);
    const replay = (
      await agents.supervisor.get(
        "/api/v1/assurance/incidents/" + r.row.id + "/replay",
      )
    ).body;
    expect(replay.items.length).toBe(3);
    expect(replay.reviews.length).toBe(1);
    const events = (
      await sql(
        "SELECT * FROM incident_events WHERE incident_id=$1 ORDER BY sequence",
        [r.row.id],
      )
    ).map(normalizeEvent);
    expect(verifyChain(events).valid).toBe(true);
    const copy = structuredClone(events);
    copy[0].reason_code = "tamper";
    expect(verifyChain(copy).valid).toBe(false);
    await expect(
      sql(
        "UPDATE incident_events SET reason_code='tamper' WHERE incident_id=$1",
        [r.row.id],
      ),
    ).rejects.toThrow("append-only");
  });
  it("resumes worker outage and replays all missed versions", async () => {
    await sql(
      "UPDATE simulation_settings SET value='true' WHERE key='worker_paused'",
    );
    const r = await report();
    await act(r.row, "triage");
    expect(await tick()).toBe(0);
    expect(
      (
        await sql(
          "SELECT * FROM outbox_events WHERE aggregate_id=$1 AND delivered_at IS NULL",
          [r.row.id],
        )
      ).length,
    ).toBe(2);
    await sql(
      "UPDATE simulation_settings SET value='false' WHERE key='worker_paused'",
    );
    for (let batch = 0; batch < 100; batch++) {
      await tick();
      if (
        !(
          await sql(
            "SELECT 1 FROM outbox_events WHERE aggregate_id=$1 AND delivered_at IS NULL",
            [r.row.id],
          )
        ).length
      )
        break;
    }
    const missed = await agents.dispatcher.get(
      "/api/v1/cad/incidents/" + r.row.id + "/events?cursor=0",
    );
    expect(missed.body.items.map((e: any) => e.sequence)).toEqual([1, 2]);
    expect(
      (
        await sql(
          "SELECT * FROM outbox_events WHERE aggregate_id=$1 AND delivered_at IS NOT NULL",
          [r.row.id],
        )
      ).length,
    ).toBe(2);
  });
  it("produces redacted CSV/PDF and unsigned checkpoints with truthful metrics", async () => {
    const csv = await agents.supervisor.get(
      "/api/v1/assurance/reports/export?format=csv",
    );
    expect(csv.status).toBe(200);
    expect(csv.text).toContain("RESEARCH SIMULATION");
    expect(csv.text).not.toContain("description_sanitised");
    const pdf = await agents.supervisor.get(
      "/api/v1/assurance/reports/export?format=pdf",
    );
    expect(pdf.status).toBe(200);
    expect(pdf.headers["content-type"]).toContain("pdf");
    const checkpoint = await agents.supervisor
      .post("/api/v1/assurance/audit/checkpoint")
      .set("Idempotency-Key", randomUUID())
      .send({ reason: "Verification" });
    expect(checkpoint.body.signature).toBeNull();
    expect(checkpoint.body.verification_status).toBe("LOCAL_ONLY");
    const verification = await agents.supervisor.get(
      "/api/v1/assurance/audit/verify",
    );
    expect(verification.body.results.every((r: any) => r.valid)).toBe(true);
    expect(
      (await agents.supervisor.get("/api/v1/assurance/metrics")).body
        .sampleSize,
    ).toBeGreaterThan(0);
  });
  it("gates deterministic scenario/fault controls and preserves history on reset", async () => {
    expect(
      (await agents.admin.get("/api/v1/simulator/scenarios")).body.items,
    ).toHaveLength(9);
    const run = await agents.admin
      .post("/api/v1/simulator/scenarios/traffic-osogbo-main/run")
      .set("Idempotency-Key", randomUUID())
      .send({ seed: 42 });
    expect(run.status, run.text).toBe(200);
    const step = await agents.admin
      .post("/api/v1/simulator/scenarios/" + run.body.id + "/step")
      .set("Idempotency-Key", randomUUID())
      .send({});
    expect(step.status, step.text).toBe(200);
    const count = (
      await sql("SELECT count(*)::int AS n FROM incident_events")
    )[0].n;
    const reset = await agents.admin
      .post("/api/v1/simulator/reset")
      .set("Idempotency-Key", randomUUID())
      .send({ confirmation: "RESET SYNTHETIC DATA" });
    expect(reset.body.historyPreserved).toBe(true);
    expect(
      (await sql("SELECT count(*)::int AS n FROM incident_events"))[0].n,
    ).toBeGreaterThanOrEqual(count);
  });
  it("keeps communication notes and human-related receipts in append-only context", async () => {
    const a = await report(),
      b = await report();
    const note = await act(a.row, "note", {
      text: "Synthetic internal communication only",
    });
    expect(note.status, note.text).toBe(200);
    expect(note.body.incident.status).toBe("RECEIVED");
    const linked = await act(note.body.incident, "link", {
      related_id: b.row.id,
    });
    expect(linked.status, linked.text).toBe(200);
    const detail = await agents.dispatcher.get(
      "/api/v1/cad/incidents/" + a.row.id,
    );
    expect(detail.body.notes[0].sanitized_text).toBe(
      "Synthetic internal communication only",
    );
    expect(detail.body.links[0].b_id).toBe(b.row.id);
    const citizen = await request(app)
      .get("/api/v1/demo/incidents/" + a.receipt.reference + "/status")
      .set("X-Receipt-Token", a.receipt.receiptToken);
    expect(citizen.body.timeline).toHaveLength(1);
    expect(JSON.stringify(citizen.body)).not.toContain(
      "Synthetic internal communication",
    );
  });
  it("documents active handover and rejects the old assignment command", async () => {
    const r = await prepareOffer();
    r.row = (await respond(r, "accept")).body.incident;
    const handover = await act(r.row, "reassign");
    expect(handover.status, handover.text).toBe(200);
    expect(handover.body.incident.status).toBe("WAITING_FOR_UNIT");
    expect(handover.body.incident.reason_flags).toContain(
      "REASSIGNMENT_REQUIRED",
    );
    r.row = handover.body.incident;
    expect((await respond(r, "arrived")).status).toBe(409);
    const history = await agents.dispatcher.get(
      "/api/v1/cad/incidents/" + r.row.id,
    );
    expect(history.body.assignments.at(-1).status).toBe("REASSIGNED");
  });
  it("records information flags and rejects malformed or oversized JSON", async () => {
    const r = await report();
    const triage = await act(r.row, "triage", {
      reason_flags: ["NEEDS_INFORMATION"],
    });
    expect(triage.body.incident.reason_flags).toContain("NEEDS_INFORMATION");
    expect(
      (
        await request(app)
          .post("/api/v1/demo/incidents")
          .set("Content-Type", "application/json")
          .send("{")
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post("/api/v1/demo/incidents")
          .send({ description: "x".repeat(20000) })
      ).status,
    ).toBe(413);
  });
});
