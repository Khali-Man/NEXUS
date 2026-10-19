import type pg from "pg";
import { fixtures } from "../../../packages/simulation/src/index";
import { randomUUID, randomBytes, createHmac } from "node:crypto";
import {
  Fault,
  sql,
  idempotent,
  appendEvent,
  normalizeEvent,
  transaction,
} from "./db";
import {
  digest,
  canTransition,
  verifyChain,
  type Status,
} from "../../../packages/domain/src/index";
import {
  createIncident,
  receiptResponse,
  command,
  landmarks,
  scenarios,
} from "../../../packages/contracts/src/index";
export const projection = `i.*,ST_X(i.geom::geometry) AS longitude,ST_Y(i.geom::geometry) AS latitude`;
export function publicIncident(i: any) {
  return {
    reference: i.public_reference,
    status: i.status,
    category: i.category,
    created_at: i.created_at,
    updated_at: i.updated_at,
    closed_at: i.closed_at,
    simulation: true,
  };
}
export function stripPrivate(i: any) {
  const {
    receipt_token_digest: _token,
    receipt_expires_at: _expiry,
    geom: _geom,
    ...safe
  } = i;
  return safe;
}
export async function getIncident(
  id: string,
  user: any,
  db: any = {
    query: (t: string, v: any[]) => sql(t, v).then((rows) => ({ rows })),
  },
  lock = false,
) {
  const i = (
    await db.query(
      `SELECT ${projection} FROM incidents i WHERE i.id=$1 AND i.agency_id=$2 ${lock ? "FOR UPDATE OF i" : ""}`,
      [id, user.agency_id],
    )
  ).rows[0];
  if (!i) throw new Fault(404, "INCIDENT_NOT_FOUND");
  return i;
}
export async function requireReceipt(
  reference: string,
  token: string | undefined,
) {
  if (!token || token.length > 128) throw new Fault(401, "RECEIPT_REQUIRED");
  const i = (
    await sql(
      "SELECT * FROM incidents WHERE public_reference=$1 AND receipt_token_digest=$2 AND receipt_expires_at>now()",
      [reference, digest(token)],
    )
  )[0];
  if (!i) throw new Fault(404, "RECEIPT_INVALID_OR_EXPIRED");
  return i;
}
export async function createReport(req: any) {
  const body = createIncident.parse(req.body);
  if (!process.env.RECEIPT_KEY) throw new Fault(503, "RECEIPT_KEY_REQUIRED");
  const token = createHmac("sha256", process.env.RECEIPT_KEY)
    .update(body.client_request_id)
    .digest("base64url");
  const result = await idempotent(
    req,
    "citizen:" + body.client_request_id,
    "incident.create",
    async (db) => {
      await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
        "citizen-source:" + body.client_request_id,
      ]);
      const fingerprint = digest(JSON.stringify(body));
      const previous = (
        await db.query("SELECT * FROM incidents WHERE client_request_id=$1", [
          body.client_request_id,
        ])
      ).rows[0];
      if (previous) {
        if (previous.client_request_fingerprint !== fingerprint)
          throw new Fault(409, "CLIENT_REQUEST_REUSED");
        return {
          reference: previous.public_reference,
          serverTime: new Date(previous.created_at).toISOString(),
          status: "RECEIVED",
          simulation: true,
        };
      }
      const agency = (
        await db.query("SELECT id FROM agencies ORDER BY demo_name LIMIT 1")
      ).rows[0];
      if (!agency) throw new Fault(503, "SIMULATION_NOT_SEEDED");
      const reference = "NXS-" + randomBytes(5).toString("hex").toUpperCase();
      const i = (
        await db.query(
          `INSERT INTO incidents(agency_id,public_reference,category,description_sanitised,geom,landmark,location_confidence,receipt_token_digest,receipt_expires_at,client_request_id,client_request_fingerprint) VALUES($1,$2,$3,$4,ST_SetSRID(ST_MakePoint($5,$6),4326)::geography,$7,$8,$9,now()+COALESCE((SELECT (value::text)::int FROM simulation_settings WHERE key='retention_days'),7)*interval '1 day',$10,$11) RETURNING *`,
          [
            agency.id,
            reference,
            body.category,
            body.description,
            body.longitude,
            body.latitude,
            body.landmark,
            body.location_confidence,
            digest(token),
            body.client_request_id,
            fingerprint,
          ],
        )
      ).rows[0];
      await appendEvent(
        db,
        i,
        "incident.created",
        null,
        "SIMULATED_CITIZEN_REPORT",
        { status: "RECEIVED" },
        req.correlationId,
      );
      return {
        reference,
        serverTime: new Date().toISOString(),
        status: i.status,
        simulation: true,
      };
    },
  );
  return receiptResponse.parse({ ...result, receiptToken: token });
}
export async function candidates(
  id: string,
  user: any,
  db: any = {
    query: (t: string, v: any[]) => sql(t, v).then((rows) => ({ rows })),
  },
) {
  const incident = await getIncident(id, user, db);
  const rows = (
    await db.query(
      `SELECT u.*,ST_X(l.geom::geometry) AS longitude,ST_Y(l.geom::geometry) AS latitude,l.recorded_at,l.precision_m,ST_Distance(l.geom,i.geom) AS distance_m,ST_DWithin(l.geom,i.geom,15000) AS within_radius,(l.recorded_at>now()-interval '5 minutes' AND u.status_updated_at>now()-interval '5 minutes') AS fresh,EXISTS(SELECT 1 FROM assignments a WHERE a.unit_id=u.id AND a.status IN ('OFFERED','ACCEPTED','ACTIVE')) AS reserved FROM units u LEFT JOIN unit_current_locations l ON l.unit_id=u.id JOIN incidents i ON i.id=$1 WHERE u.agency_id=$2 ORDER BY ST_Distance(l.geom,i.geom) NULLS LAST`,
      [id, user.agency_id],
    )
  ).rows;
  return rows.map((u: any) => {
    const excluded = [];
    if (!u.is_simulated) excluded.push("NOT_SIMULATED");
    if (u.dispatch_status !== "AVAILABLE") excluded.push(u.dispatch_status);
    if (u.reserved) excluded.push("RESERVED");
    if (!u.fresh) excluded.push("STALE");
    if (!u.capability_tags.includes(incident.category))
      excluded.push("CAPABILITY_MISMATCH");
    if (!u.within_radius) excluded.push("OUTSIDE_RADIUS");
    return {
      ...u,
      eligible: excluded.length === 0,
      excluded_reasons: excluded,
      eta_seconds: null,
      eta_source: "UNAVAILABLE",
      estimate_at: new Date().toISOString(),
    };
  });
}
export async function perform(req: any, id: string, action: string) {
  const body = command.parse(req.body);
  const user = req.user;
  return idempotent(req, user.id, action + ":" + id, async (db) => {
    const i = await getIncident(id, user, db, true);
    if (i.version !== body.expected_version)
      throw new Fault(
        409,
        "VERSION_CONFLICT",
        "The incident changed. Refresh before trying again.",
        { status: i.status, version: i.version },
      );
    let next: Status = i.status;
    let flags: string[] = i.reason_flags || [];
    let eventType = "incident.state_changed";
    let metadata: any = { reason: body.reason };
    const isOperator = ["dispatcher", "supervisor"].includes(user.role);
    const isDispatcher = user.role === "dispatcher";
    let assignment: any;
    if (
      ["accept", "decline", "en-route", "arrived", "outcome"].includes(action)
    ) {
      if (user.role !== "responder") throw new Fault(403, "ROLE_FORBIDDEN");
      assignment = (
        await db.query(
          `SELECT a.* FROM assignments a JOIN responder_unit_memberships m ON m.unit_id=a.unit_id WHERE a.incident_id=$1 AND m.user_id=$2 AND m.valid_from<=now() AND (m.valid_to IS NULL OR m.valid_to>now()) AND a.status IN ('OFFERED','ACCEPTED','ACTIVE') FOR UPDATE OF a`,
          [id, user.id],
        )
      ).rows[0];
      if (
        !assignment ||
        (req.assignmentId && assignment.id !== req.assignmentId)
      )
        throw new Fault(409, "ASSIGNMENT_NO_LONGER_ACTIVE");
      if (
        assignment.status === "OFFERED" &&
        new Date(assignment.expires_at) < new Date()
      )
        throw new Fault(409, "OFFER_EXPIRED");
      if (action === "accept") {
        next = "ACCEPTED";
        eventType = "assignment.accepted";
        await db.query(
          "UPDATE assignments SET status='ACCEPTED',accepted_by=$2,accepted_at=now() WHERE id=$1",
          [assignment.id, user.id],
        );
      }
      if (action === "decline") {
        next = "WAITING_FOR_UNIT";
        eventType = "assignment.declined";
        await db.query(
          "UPDATE assignments SET status='DECLINED',decline_reason=$2,closed_at=now() WHERE id=$1",
          [assignment.id, body.reason],
        );
        await releaseUnit(db, assignment.unit_id);
      }
      if (action === "en-route") {
        next = "EN_ROUTE_REPORTED";
        await db.query("UPDATE assignments SET status='ACTIVE' WHERE id=$1", [
          assignment.id,
        ]);
      }
      if (action === "arrived") next = "ARRIVAL_REPORTED";
      if (action === "outcome") {
        next = "RESOLVED";
        await db.query(
          "UPDATE assignments SET status='COMPLETED',closed_at=now() WHERE id=$1",
          [assignment.id],
        );
        await releaseUnit(db, assignment.unit_id);
      }
      metadata.assignmentId = assignment.id;
    } else if (action === "triage") {
      if (!isDispatcher) throw new Fault(403, "ROLE_FORBIDDEN");
      next = "TRIAGED";
      flags = body.reason_flags || [];
      eventType = "incident.triaged";
      await db.query("UPDATE incidents SET priority=$2 WHERE id=$1", [
        id,
        body.priority || "MEDIUM",
      ]);
    } else if (action === "ready") {
      if (!isDispatcher) throw new Fault(403, "ROLE_FORBIDDEN");
      next = "WAITING_FOR_UNIT";
      flags = (await candidates(id, user, db)).some((u: any) => u.eligible)
        ? []
        : ["NO_ELIGIBLE_UNIT"];
    } else if (action === "offer") {
      if (!isDispatcher || !body.unit_id)
        throw new Fault(403, "ROLE_FORBIDDEN");
      await db.query("SELECT id FROM units WHERE id=$1 FOR UPDATE", [
        body.unit_id,
      ]);
      const candidate = (await candidates(id, user, db)).find(
        (u: any) => u.id === body.unit_id,
      );
      if (!candidate?.eligible)
        throw new Fault(
          409,
          "UNIT_INELIGIBLE",
          undefined,
          candidate?.excluded_reasons,
        );
      next = "OFFERED";
      flags = [];
      eventType = "assignment.offered";
      assignment = (
        await db.query(
          "INSERT INTO assignments(incident_id,unit_id,status,offered_by,expires_at) VALUES($1,$2,'OFFERED',$3,now()+interval '5 minutes') RETURNING *",
          [id, body.unit_id, user.id],
        )
      ).rows[0];
      await db.query(
        "UPDATE units SET dispatch_status='BUSY',status_updated_at=now() WHERE id=$1",
        [body.unit_id],
      );
      metadata = {
        ...metadata,
        assignmentId: assignment.id,
        unitId: body.unit_id,
        expiresAt: assignment.expires_at,
      };
    } else if (["withdraw", "reassign"].includes(action)) {
      if (!isDispatcher) throw new Fault(403, "ROLE_FORBIDDEN");
      assignment = (
        await db.query(
          "SELECT * FROM assignments WHERE incident_id=$1 AND status IN ('OFFERED','ACCEPTED','ACTIVE') FOR UPDATE",
          [id],
        )
      ).rows[0];
      if (!assignment) throw new Fault(409, "ASSIGNMENT_NO_LONGER_ACTIVE");
      if (action === "withdraw" && assignment.status !== "OFFERED")
        throw new Fault(409, "HANDOVER_REASON_REQUIRED");
      next = "WAITING_FOR_UNIT";
      await db.query(
        "UPDATE assignments SET status=$2,withdrawn_at=now(),closed_at=now() WHERE id=$1",
        [assignment.id, action === "withdraw" ? "WITHDRAWN" : "REASSIGNED"],
      );
      await releaseUnit(db, assignment.unit_id);
      metadata.assignmentId = assignment.id;
      flags = ["REASSIGNMENT_REQUIRED"];
    } else if (["cancel", "resolve", "close"].includes(action)) {
      if (!isOperator) throw new Fault(403, "ROLE_FORBIDDEN");
      next = (
        { cancel: "CANCELLED", resolve: "RESOLVED", close: "CLOSED" } as const
      )[action as "cancel" | "resolve" | "close"];
      if (action === "cancel") {
        const active = (
          await db.query(
            "UPDATE assignments SET status='ABORTED',closed_at=now() WHERE incident_id=$1 AND status IN ('OFFERED','ACCEPTED','ACTIVE') RETURNING unit_id",
            [id],
          )
        ).rows;
        for (const a of active) await releaseUnit(db, a.unit_id);
      }
      if (action === "resolve") {
        const active = (
          await db.query(
            "UPDATE assignments SET status='COMPLETED',closed_at=now() WHERE incident_id=$1 AND status IN ('ACCEPTED','ACTIVE') RETURNING unit_id",
            [id],
          )
        ).rows;
        for (const a of active) await releaseUnit(db, a.unit_id);
      }
    } else if (["note", "correction", "review", "link"].includes(action)) {
      if (!isOperator) throw new Fault(403, "ROLE_FORBIDDEN");
      if (
        ["correction", "review"].includes(action) &&
        user.role !== "supervisor"
      )
        throw new Fault(403, "ROLE_FORBIDDEN");
      if (action === "correction" && !body.correction_of)
        throw new Fault(400, "CORRECTION_TARGET_REQUIRED");
      eventType = "incident." + action;
      metadata = {
        ...metadata,
        text: body.text || body.reason,
        correctionOf: body.correction_of || null,
      };
      if (action === "review")
        await db.query(
          "INSERT INTO supervisor_reviews(incident_id,reviewer_id,reason,finding_text) VALUES($1,$2,$3,$4)",
          [id, user.id, body.reason, body.text || body.reason],
        );
      else if (action === "link") {
        if (!body.related_id) throw new Fault(400, "RELATED_INCIDENT_REQUIRED");
        await getIncident(body.related_id, user, db);
        await db.query(
          "INSERT INTO incident_links(a_id,b_id,relation,linked_by,reason) VALUES($1,$2,'CONFIRMED_RELATED',$3,$4)",
          [id, body.related_id, user.id, body.reason],
        );
        metadata.relatedId = body.related_id;
      } else {
        if (
          body.correction_of &&
          !(
            await db.query(
              "SELECT 1 FROM incident_events WHERE id=$1 AND incident_id=$2",
              [body.correction_of, id],
            )
          ).rowCount
        )
          throw new Fault(400, "CORRECTION_TARGET_INVALID");
        await db.query(
          "INSERT INTO incident_notes(incident_id,created_by,role,sanitized_text,correction_of) VALUES($1,$2,$3,$4,$5)",
          [
            id,
            user.id,
            user.role,
            body.text || body.reason,
            body.correction_of || null,
          ],
        );
      }
    } else throw new Fault(404, "ACTION_NOT_FOUND");
    if (next !== i.status && !canTransition(i.status, next))
      throw new Fault(409, "ILLEGAL_TRANSITION", undefined, {
        from: i.status,
        to: next,
      });
    const updated = (
      await db.query(
        "UPDATE incidents SET status=$2,reason_flags=$3,version=version+1,updated_at=now(),closed_at=CASE WHEN $2='CLOSED' THEN now() ELSE closed_at END WHERE id=$1 RETURNING *",
        [id, next, JSON.stringify(flags)],
      )
    ).rows[0];
    metadata = {
      ...metadata,
      status: next,
      previousStatus: i.status,
      reasonFlags: flags,
    };
    const event = await appendEvent(
      db,
      updated,
      eventType,
      user,
      body.reason,
      metadata,
      req.correlationId,
      body.client_occurred_at,
    );
    return { incident: stripPrivate(updated), event };
  });
}
async function releaseUnit(db: pg.PoolClient, id: string) {
  await db.query(
    "UPDATE units SET dispatch_status='AVAILABLE',status_updated_at=now() WHERE id=$1",
    [id],
  );
}
export async function expireOffers() {
  await transaction(async (db) => {
    const assignments = (
      await db.query(
        "SELECT a.*,i.version,i.status AS incident_status FROM assignments a JOIN incidents i ON i.id=a.incident_id WHERE a.status='OFFERED' AND a.expires_at<now() FOR UPDATE OF i,a SKIP LOCKED",
      )
    ).rows;
    for (const a of assignments) {
      await db.query(
        "UPDATE assignments SET status='EXPIRED',closed_at=now() WHERE id=$1",
        [a.id],
      );
      await releaseUnit(db, a.unit_id);
      const i = (
        await db.query(
          "UPDATE incidents SET status='WAITING_FOR_UNIT',version=version+1,updated_at=now() WHERE id=$1 RETURNING *",
          [a.incident_id],
        )
      ).rows[0];
      await appendEvent(
        db,
        i,
        "assignment.expired",
        { role: "system" },
        "OFFER_EXPIRED",
        { status: i.status, assignmentId: a.id },
        randomUUID(),
      );
    }
  });
}
export async function verifyAudit(user: any, id?: string) {
  const ids = await sql(
    "SELECT id FROM incidents WHERE agency_id=$1 AND ($2::uuid IS NULL OR id=$2)",
    [user.agency_id, id || null],
  );
  const results = [];
  for (const i of ids) {
    const events = (
      await sql(
        "SELECT * FROM incident_events WHERE incident_id=$1 ORDER BY sequence",
        [i.id],
      )
    ).map(normalizeEvent);
    results.push({ incidentId: i.id, ...verifyChain(events) });
  }
  return {
    assumptions:
      "Local SHA-256 chain; unsigned checkpoints; no independent external anchor. A privileged database administrator can rewrite the trust boundary.",
    results,
  };
}
export async function runScenario(req: any, slug: string, seed: number) {
  if (!scenarios.includes(slug as any))
    throw new Fault(404, "SCENARIO_NOT_FOUND");
  const scenario = (
    await sql("SELECT * FROM simulation_scenarios WHERE slug=$1", [slug])
  )[0];
  const run = (
    await sql(
      "INSERT INTO scenario_runs(scenario_id,started_by,seed) VALUES($1,$2,$3) RETURNING *",
      [scenario.id, req.user.id, seed],
    )
  )[0];
  await sql(
    "UPDATE units SET dispatch_status=CASE WHEN callsign='OSG • 01' THEN 'BUSY' ELSE 'AVAILABLE' END,status_updated_at=now() WHERE agency_id=$1 AND NOT EXISTS(SELECT 1 FROM assignments a WHERE a.unit_id=units.id AND a.status IN ('OFFERED','ACCEPTED','ACTIVE'))",
    [req.user.agency_id],
  );
  await sql(
    "UPDATE unit_current_locations l SET recorded_at=CASE WHEN u.callsign='OSG • 02' THEN now()-interval '30 minutes' ELSE now() END FROM units u WHERE u.id=l.unit_id AND u.agency_id=$1",
    [req.user.agency_id],
  );
  const fixture = fixtures[slug as keyof typeof fixtures];
  const category = fixture.category;
  const loc = landmarks[Math.abs(seed) % landmarks.length];
  const clientId = randomUUID();
  const request = {
    body: {
      client_request_id: clientId,
      simulation: true,
      category,
      description: `Synthetic ${slug} scenario, seed ${seed}. No real people or emergency.`,
      landmark: loc.name,
      longitude: loc.longitude,
      latitude: loc.latitude,
    },
    get: () => `scenario-${run.id}`,
    correlationId: req.correlationId,
  };
  const report = await createReport(request);
  const i = (
    await sql("SELECT id FROM incidents WHERE public_reference=$1", [
      report.reference,
    ])
  )[0];
  if (slug === "assignment-declined") {
    await sql(
      "UPDATE unit_current_locations SET recorded_at=now() WHERE unit_id=(SELECT id FROM units WHERE callsign='OSG • 02' AND agency_id=$1)",
      [req.user.agency_id],
    );
    await sql(
      "UPDATE units SET status_updated_at=now() WHERE callsign='OSG • 02' AND agency_id=$1",
      [req.user.agency_id],
    );
    await sql(
      "INSERT INTO responder_unit_memberships(user_id,unit_id) SELECT users.id,units.id FROM users JOIN units ON users.agency_id=units.agency_id WHERE users.role='responder' AND units.callsign='OSG • 02' AND users.agency_id=$1 ON CONFLICT DO NOTHING",
      [req.user.agency_id],
    );
  }
  if (slug === "map-unavailable")
    await sql(
      "UPDATE simulation_settings SET value='true' WHERE key='map_unavailable'",
    );
  if (slug === "medical-low-network")
    await sql(
      "UPDATE simulation_settings SET value='true' WHERE key='drop_notifications'",
    );
  let secondIncidentId = null;
  const duplicateRetryReferences: string[] = [];
  if (["two-incidents-one-unit", "duplicate-alerts"].includes(slug)) {
    const second = await createReport({
      ...request,
      body: { ...request.body, client_request_id: randomUUID() },
      get: () => `scenario-second-${run.id}`,
    });
    secondIncidentId = (
      await sql("SELECT id FROM incidents WHERE public_reference=$1", [
        second.reference,
      ])
    )[0].id;
  }
  if (slug === "duplicate-alerts") {
    for (let retry = 0; retry < 5; retry++)
      duplicateRetryReferences.push(
        String((await createReport(request)).reference),
      );
  }
  const results = {
    steps: fixture.steps,
    secondIncidentId,
    duplicateRetryReferences,
    incidentId: i.id,
    reference: report.reference,
    seed,
    slug,
    step: 0,
    goal: scenario.expected_results_json,
    conditions:
      slug === "traffic-osogbo-main"
        ? ["closest busy", "second stale", "third eligible"]
        : [],
    playback:
      "Fixture created; use step controls to advance authoritative commands.",
  };
  await sql("UPDATE scenario_runs SET results_json=$2 WHERE id=$1", [
    run.id,
    results,
  ]);
  return { ...run, results_json: results };
}
export async function advanceScenario(req: any, runId: string) {
  const run = (
    await sql("SELECT * FROM scenario_runs WHERE id=$1", [runId])
  )[0];
  if (!run) throw new Fault(404, "RUN_NOT_FOUND");
  const i = await getIncident(run.results_json.incidentId, req.user);
  const step = run.results_json.step || 0;
  const actions =
    run.results_json.steps ||
    fixtures[run.results_json.slug as keyof typeof fixtures].steps;
  if (step >= actions.length) return { completed: true, run };
  const dispatcher = (
    await sql(
      "SELECT id,role,agency_id FROM users WHERE role='dispatcher' AND agency_id=$1 LIMIT 1",
      [req.user.agency_id],
    )
  )[0];
  const responder = (
    await sql(
      "SELECT id,role,agency_id FROM users WHERE role='responder' AND agency_id=$1 LIMIT 1",
      [req.user.agency_id],
    )
  )[0];
  const action = actions[step];
  const body: any = {
    expected_version: i.version,
    reason: `Deterministic scenario step ${step + 1}, seed ${run.seed}`,
  };
  const internal = (actor: any, payload: any, suffix = "") => ({
    ...req,
    user: actor,
    body: payload,
    get: () => `scenario-step-${run.id}-${step}-${suffix}`,
    correlationId: req.correlationId,
  });
  let result: any;
  if (action === "assert-no-eligible") {
    const eligible = (await candidates(i.id, dispatcher)).filter(
      (u: any) => u.eligible,
    );
    if (eligible.length) throw new Fault(409, "FIXTURE_EXPECTATION_FAILED");
    result = { verified: true, eligibleCount: 0, status: i.status };
  } else if (action === "assert-audit-tamper") {
    const events = (
      await sql(
        "SELECT * FROM incident_events WHERE incident_id=$1 ORDER BY sequence",
        [i.id],
      )
    ).map(normalizeEvent);
    const copy = structuredClone(events);
    copy[0].reason_code = "MODIFIED_TEST_COPY";
    result = {
      original: verifyChain(events),
      tamperedCopy: verifyChain(copy),
      sourceUnchanged: true,
    };
  } else if (action === "assert-contention") {
    const second = await getIncident(
      run.results_json.secondIncidentId,
      dispatcher,
    );
    let next = second;
    if (next.status === "RECEIVED")
      next = (
        await perform(
          internal(
            dispatcher,
            { ...body, expected_version: next.version },
            "second-triage",
          ),
          next.id,
          "triage",
        )
      ).incident;
    if (next.status === "TRIAGED")
      next = (
        await perform(
          internal(
            dispatcher,
            { ...body, expected_version: next.version },
            "second-ready",
          ),
          next.id,
          "ready",
        )
      ).incident;
    const unit = (
      await sql(
        "SELECT unit_id FROM assignments WHERE incident_id=$1 AND status='OFFERED'",
        [i.id],
      )
    )[0];
    try {
      await perform(
        internal(
          dispatcher,
          { ...body, expected_version: next.version, unit_id: unit.unit_id },
          "second-offer",
        ),
        next.id,
        "offer",
      );
      throw new Fault(500, "FIXTURE_EXPECTATION_FAILED");
    } catch (e) {
      if (!(e instanceof Fault) || e.status !== 409) throw e;
      result = { verified: true, conflict: e.code, secondIncidentId: next.id };
    }
  } else if (action === "assert-stale-command") {
    const assignment = (
      await sql(
        "SELECT id FROM assignments WHERE incident_id=$1 ORDER BY offered_at DESC LIMIT 1",
        [i.id],
      )
    )[0];
    try {
      await perform(
        {
          ...internal(
            responder,
            { ...body, expected_version: i.version - 2 },
            "stale",
          ),
          assignmentId: assignment.id,
        },
        i.id,
        "arrived",
      );
      throw new Fault(500, "FIXTURE_EXPECTATION_FAILED");
    } catch (e) {
      if (!(e instanceof Fault) || e.status !== 409) throw e;
      result = {
        verified: true,
        staleCommandConflict: e.code,
        authoritativeStatus: i.status,
      };
    }
  } else {
    if (action === "offer") {
      const previous = (
        await sql(
          "SELECT unit_id FROM assignments WHERE incident_id=$1 AND status='DECLINED' ORDER BY offered_at DESC LIMIT 1",
          [i.id],
        )
      )[0];
      const candidate = (await candidates(i.id, dispatcher)).find(
        (u: any) => u.eligible && u.id !== previous?.unit_id,
      );
      if (!candidate) throw new Fault(409, "NO_ELIGIBLE_UNIT");
      body.unit_id = candidate.id;
    }
    const actor = [
      "accept",
      "decline",
      "en-route",
      "arrived",
      "outcome",
    ].includes(action)
      ? responder
      : dispatcher;
    result = await perform(internal(actor, body), i.id, action);
  }
  const nextResults = {
    ...run.results_json,
    step: step + 1,
    lastResult: result,
  };
  await sql(
    "UPDATE scenario_runs SET results_json=$2,completed_at=CASE WHEN $3 THEN now() ELSE NULL END WHERE id=$1",
    [run.id, nextResults, step + 1 >= actions.length],
  );
  return {
    step: step + 1,
    totalSteps: actions.length,
    result,
    completed: step + 1 >= actions.length,
  };
}
