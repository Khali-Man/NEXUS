import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { parse, serialize } from "cookie";
import { randomBytes, randomUUID } from "node:crypto";
import PDFDocument from "pdfkit";
import { en } from "../../../packages/i18n/src/catalogue";
import { createCheckpoint, signatureStatus, trustedKeys } from "./audit";
import { mapConfig, mapStyle, roadsFile } from "./maps";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  Fault,
  sql,
  passwordMatches,
  idempotent,
  normalizeEvent,
  appendEvent,
} from "./db";
import { digest, verifyChain } from "../../../packages/domain/src/index";
import {
  login,
  createIncident,
  scenarioInput,
  faultInput,
  resetInput,
  settingsInput,
  checkpointInput,
  command,
  feedback,
  landmarks,
  categories,
} from "../../../packages/contracts/src/index";
import {
  projection,
  stripPrivate,
  createReport,
  requireReceipt,
  publicIncident,
  getIncident,
  candidates,
  perform,
  verifyAudit,
  runScenario,
  advanceScenario,
} from "./service";
export const app = express();
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: any;
      correlationId: string;
    }
  }
}
app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
  }),
);
app.use((req, res, next) => {
  req.correlationId = randomUUID();
  res.setHeader("X-Correlation-Id", req.correlationId);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.get("Origin");
    const allowed = (
      process.env.ALLOWED_ORIGINS ||
      "http://localhost:3000,http://localhost:5173,http://localhost:5174"
    ).split(",");
    if (origin && !allowed.includes(origin))
      return next(new Fault(403, "ORIGIN_FORBIDDEN"));
  }
  next();
});
app.use(express.json({ limit: "16kb" }));
app.use(
  "/api",
  rateLimit({
    windowMs: 60000,
    limit: Number(process.env.RATE_LIMIT_PER_MINUTE || 2000),
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
);
export async function sessionFromCookie(cookie: string | undefined) {
  const session = parse(cookie || "").nexus_session;
  if (!session) return null;
  return (
    (
      await sql(
        "SELECT u.id,u.username,u.demo_name,u.role,u.agency_id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id_digest=$1 AND s.expires_at>now() AND u.active=true",
        [digest(session)],
      )
    )[0] || null
  );
}
app.use(async (req, _res, next) => {
  try {
    req.user = await sessionFromCookie(req.get("cookie"));
    next();
  } catch (e) {
    next(e);
  }
});
const asyncRoute =
  (fn: (req: Request, res: Response) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res)).catch(next);
const definitions: any[] = [];
const route = (
  method: string,
  path: string,
  roles: string[] | null,
  fn: (req: Request, res: Response) => Promise<any>,
) => {
  definitions.push({ method, path, roles });
  return (app as any)[method](
    "/api/v1" + path,
    asyncRoute(async (req, res) => {
      if (roles && (!req.user || !roles.includes(req.user.role)))
        throw new Fault(
          req.user ? 403 : 401,
          req.user ? "ROLE_FORBIDDEN" : "AUTHENTICATION_REQUIRED",
        );
      if (method === "post" && path.startsWith("/responder/assignments/")) {
        const delay =
          (
            await sql(
              "SELECT value FROM simulation_settings WHERE key='ack_delay_ms'",
            )
          )[0]?.value || 0;
        if (delay)
          await new Promise((resolve) =>
            setTimeout(resolve, Math.min(10000, Number(delay))),
          );
      }
      const result = await fn(req, res);
      if (!res.headersSent && !res.locals.streaming) res.json(result);
    }),
  );
};
const operators = ["dispatcher", "supervisor"];
const all = ["dispatcher", "responder", "supervisor", "admin"];
route("get", "/health", null, async () => {
  await sql("SELECT 1");
  return { ok: true, simulation: true };
});
app.post(
  "/api/v1/auth/login",
  rateLimit({
    windowMs: 60000,
    limit: 30,
    skipSuccessfulRequests: true,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
  asyncRoute(async (req, res) => {
    if (process.env.DEMO_MODE !== "true")
      throw new Fault(503, "NON_DEMO_AUTH_DISABLED");
    const data = login.parse(req.body);
    const user = (
      await sql("SELECT * FROM users WHERE username=$1 AND active=true", [
        data.username,
      ])
    )[0];
    if (!user || !passwordMatches(data.password, user.password_hash)) {
      await sql(
        "INSERT INTO security_audit_events(action,resource_kind,result,ip_hash) VALUES('LOGIN','SESSION','DENIED',$1)",
        [digest(req.ip || "")],
      );
      throw new Fault(401, "INVALID_CREDENTIALS");
    }
    const token = randomBytes(32).toString("base64url");
    await sql(
      "INSERT INTO sessions(id_digest,user_id,expires_at) VALUES($1,$2,now()+interval '8 hours')",
      [digest(token), user.id],
    );
    await sql("UPDATE users SET last_login_at=now() WHERE id=$1", [user.id]);
    res.setHeader(
      "Set-Cookie",
      serialize("nexus_session", token, {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.COOKIE_SECURE === "true",
        path: "/",
        maxAge: 8 * 3600,
      }),
    );
    res.json({
      id: user.id,
      role: user.role,
      demo_name: user.demo_name,
      agency_id: user.agency_id,
    });
  }),
);
route("get", "/auth/me", all, async (req) => req.user);
route("post", "/auth/logout", all, async (req, res) => {
  const token = parse(req.get("cookie") || "").nexus_session;
  await sql("DELETE FROM sessions WHERE id_digest=$1", [digest(token || "")]);
  res.setHeader(
    "Set-Cookie",
    serialize("nexus_session", "", {
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    }),
  );
  return { ok: true };
});
route("get", "/demo/reference-data", null, async () => ({
  categories,
  landmarks,
  ...mapConfig(),
  simulation: true,
  disclosure:
    "RESEARCH SIMULATION — NOT CONNECTED TO EMERGENCY SERVICES. THIS APPLICATION CANNOT SUMMON HELP.",
}));
route("get", "/demo/map-style", null, async () => mapStyle());
route("get", "/demo/roads", null, async (_req, res) => {
  res.locals.streaming = true;
  res.type("application/geo+json").sendFile(roadsFile());
});
route("post", "/demo/incidents", null, async (req) => createReport(req));
route("get", "/demo/incidents/:reference/status", null, async (req) => {
  const i = await requireReceipt(
    String(req.params.reference),
    req.get("X-Receipt-Token"),
  );
  const events = await sql(
    "SELECT sequence,aggregate_version,metadata->>'status' AS status,server_occurred_at FROM incident_events WHERE incident_id=$1 AND metadata ? 'status' AND event_type IN ('incident.created','incident.triaged','incident.state_changed','assignment.offered','assignment.accepted','assignment.declined','assignment.expired','simulation.reset') ORDER BY sequence",
    [i.id],
  );
  return {
    ...publicIncident(i),
    timeline: events,
    cursor: events.at(-1)?.sequence || 0,
  };
});
route("post", "/demo/incidents/:reference/feedback", null, async (req) => {
  const i = await requireReceipt(
    String(req.params.reference),
    req.get("X-Receipt-Token"),
  );
  const body = feedback.parse(req.body);
  if (i.status !== "CLOSED") throw new Fault(409, "FEEDBACK_REQUIRES_CLOSURE");
  return idempotent(req, "receipt:" + i.id, "feedback", async (db) => {
    await db.query(
      "INSERT INTO citizen_feedback(incident_id,receipt_token_scope,response_clarity_score,free_text) VALUES($1,$2,$3,$4) ON CONFLICT(incident_id) DO UPDATE SET response_clarity_score=excluded.response_clarity_score,free_text=excluded.free_text",
      [
        i.id,
        i.receipt_token_digest,
        body.response_clarity_score,
        body.free_text,
      ],
    );
    return { ok: true };
  });
});
route("get", "/cad/overview", operators, async (req) => {
  const counts = await sql(
    "SELECT status,count(*)::int AS count FROM incidents WHERE agency_id=$1 GROUP BY status",
    [req.user.agency_id],
  );
  const metrics = await sql(
    "SELECT count(*)::int AS received_24h,count(*) FILTER(WHERE status='CLOSED')::int AS closed_24h FROM incidents WHERE agency_id=$1 AND created_at>now()-interval '24 hours'",
    [req.user.agency_id],
  );
  return { counts, metrics: metrics[0], serverTime: new Date().toISOString() };
});
async function listIncidents(req: Request) {
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50)),
    offset = Math.max(0, Number(req.query.offset) || 0);
  const query = String(req.query.q || "").slice(0, 120),
    status = String(req.query.status || ""),
    category = String(req.query.category || ""),
    priority = String(req.query.priority || "");
  const rows = await sql(
    `SELECT ${projection},count(*) OVER()::int AS total FROM incidents i WHERE agency_id=$1 AND ($2='' OR public_reference ILIKE '%'||$2||'%' OR description_sanitised ILIKE '%'||$2||'%' OR landmark ILIKE '%'||$2||'%') AND ($3='' OR status=$3) AND ($4='' OR category=$4) AND ($5='' OR priority=$5) AND ($6::timestamptz IS NULL OR created_at>=$6) AND ($7::timestamptz IS NULL OR created_at<=$7) AND (NOT $10::boolean OR status NOT IN ('CLOSED','CANCELLED')) ORDER BY created_at DESC LIMIT $8 OFFSET $9`,
    [
      req.user.agency_id,
      query,
      status,
      category,
      priority,
      req.query.from || null,
      req.query.to || null,
      limit,
      offset,
      req.query.active === "true",
    ],
  );
  return {
    items: rows.map(stripPrivate),
    total: rows[0]?.total || 0,
    limit,
    offset,
  };
}
route("get", "/cad/activity", operators, async (req) => ({
  items: (
    await sql(
      "SELECT e.*,i.public_reference FROM incident_events e JOIN incidents i ON i.id=e.incident_id WHERE i.agency_id=$1 ORDER BY e.server_occurred_at DESC LIMIT 8",
      [req.user.agency_id],
    )
  ).map(normalizeEvent),
}));
route("get", "/cad/incidents", operators, listIncidents);
route("get", "/cad/incidents/:id", operators, async (req) => {
  const i = await getIncident(String(req.params.id), req.user);
  const assignments = await sql(
    "SELECT a.*,u.callsign FROM assignments a JOIN units u ON u.id=a.unit_id WHERE incident_id=$1 ORDER BY offered_at",
    [i.id],
  );
  const notes = await sql(
    "SELECT * FROM incident_notes WHERE incident_id=$1 ORDER BY created_at",
    [i.id],
  );
  const links = await sql(
    "SELECT * FROM incident_links WHERE a_id=$1 OR b_id=$1",
    [i.id],
  );
  return { ...stripPrivate(i), assignments, notes, links };
});
route("get", "/cad/incidents/:id/events", operators, async (req) => {
  await getIncident(String(req.params.id), req.user);
  const items = (
    await sql(
      "SELECT * FROM incident_events WHERE incident_id=$1 AND sequence>$2 ORDER BY sequence LIMIT 500",
      [req.params.id, Math.max(0, Number(req.query.cursor) || 0)],
    )
  ).map(normalizeEvent);
  return {
    items,
    nextCursor: items.length === 500 ? items.at(-1).sequence : null,
  };
});
route("get", "/cad/incidents/:id/duplicates", operators, async (req) => {
  const i = await getIncident(String(req.params.id), req.user);
  return {
    items: await sql(
      "SELECT public_reference,id,category,status,created_at FROM incidents WHERE agency_id=$1 AND id<>$2 AND category=$3 AND abs(extract(epoch FROM created_at-$4::timestamptz))<3600 AND ST_DWithin(geom,(SELECT geom FROM incidents WHERE id=$2),1000) ORDER BY created_at DESC LIMIT 10",
      [req.user.agency_id, i.id, i.category, i.created_at],
    ),
    suggestionsOnly: true,
  };
});
route("get", "/cad/incidents/:id/candidates", ["dispatcher"], async (req) => ({
  items: await candidates(String(req.params.id), req.user, undefined, true),
}));
for (const action of [
  "triage",
  "ready",
  "cancel",
  "resolve",
  "close",
  "note",
  "link",
  "reassign",
])
  route("post", `/cad/incidents/:id/${action}`, operators, async (req) =>
    perform(req, String(req.params.id), action),
  );
route("post", "/cad/incidents/:id/assignments", ["dispatcher"], async (req) =>
  perform(req, String(req.params.id), "offer"),
);
route("post", "/cad/assignments/:id/withdraw", ["dispatcher"], async (req) => {
  const assignment = (
    await sql(
      "SELECT a.incident_id FROM assignments a JOIN incidents i ON i.id=a.incident_id WHERE a.id=$1 AND i.agency_id=$2",
      [req.params.id, req.user.agency_id],
    )
  )[0];
  if (!assignment) throw new Fault(404, "ASSIGNMENT_NOT_FOUND");
  return perform(req, assignment.incident_id, "withdraw");
});
route("get", "/cad/units", operators, async (req) => ({
  items: await sql(
    `SELECT u.*,ST_X(l.geom::geometry) AS longitude,ST_Y(l.geom::geometry) AS latitude,l.recorded_at,l.precision_m,(l.recorded_at>now()-interval '5 minutes' AND u.status_updated_at>now()-interval '5 minutes') AS fresh FROM units u LEFT JOIN unit_current_locations l ON l.unit_id=u.id WHERE u.agency_id=$1 ORDER BY callsign`,
    [req.user.agency_id],
  ),
}));
route("get", "/cad/network", all, async (req) => {
  const unitFaults = (
    await sql(
      "SELECT stale_locations,unit_unavailable FROM simulation_unit_faults WHERE agency_id=$1",
      [req.user.agency_id],
    )
  )[0];
  const outbox = (
    await sql(
      "SELECT count(*) FILTER(WHERE delivered_at IS NULL)::int AS pending,max(delivered_at) AS last_delivery,max(attempts) AS max_attempts FROM outbox_events o JOIN incidents i ON i.id=o.aggregate_id WHERE i.agency_id=$1",
      [req.user.agency_id],
    )
  )[0];
  return {
    api: "CONNECTED",
    realtimeNotifications: Boolean(app.locals.realtimeReady?.()),
    outbox,
    settings: Object.fromEntries(
      [
        ...(await sql("SELECT * FROM simulation_settings")),
        {
          key: "stale_locations",
          value: unitFaults?.stale_locations ?? false,
        },
        {
          key: "unit_unavailable",
          value: unitFaults?.unit_unavailable ?? false,
        },
      ].map((r) => [r.key, r.value]),
    ),
    serverTime: new Date().toISOString(),
  };
});
async function responderAssignment(req: Request, id: string) {
  const row = (
    await sql(
      `SELECT a.*,a.id AS assignment_id,a.status AS assignment_status,(SELECT demo_name FROM users WHERE id=a.offered_by) AS offered_by_demo_name,${projection} FROM assignments a JOIN incidents i ON i.id=a.incident_id JOIN responder_unit_memberships m ON m.unit_id=a.unit_id WHERE a.id=$1 AND m.user_id=$2 AND m.valid_from<=now() AND (m.valid_to IS NULL OR m.valid_to>now()) AND i.agency_id=$3`,
      [id, req.user.id, req.user.agency_id],
    )
  )[0];
  if (!row) throw new Fault(404, "ASSIGNMENT_NOT_FOUND");
  return stripPrivate(row);
}
route("get", "/responder/assignments", ["responder"], async (req) => ({
  items: (
    await sql(
      `SELECT a.id AS assignment_id,a.status AS assignment_status,a.expires_at,a.unit_id,u.callsign,(SELECT demo_name FROM users WHERE id=a.offered_by) AS offered_by_demo_name,${projection} FROM assignments a JOIN incidents i ON i.id=a.incident_id JOIN units u ON u.id=a.unit_id JOIN responder_unit_memberships m ON m.unit_id=a.unit_id WHERE m.user_id=$1 AND m.valid_from<=now() AND (m.valid_to IS NULL OR m.valid_to>now()) AND i.agency_id=$2 ORDER BY a.offered_at DESC LIMIT 100`,
      [req.user.id, req.user.agency_id],
    )
  ).map(stripPrivate),
}));
route("get", "/responder/assignments/:id", ["responder"], async (req) =>
  responderAssignment(req, String(req.params.id)),
);
for (const action of ["accept", "decline", "en-route", "arrived", "outcome"])
  route(
    "post",
    `/responder/assignments/:id/${action}`,
    ["responder"],
    async (req) => {
      const a = await responderAssignment(req, String(req.params.id));
      return perform(
        Object.assign(req, { assignmentId: a.assignment_id }),
        a.incident_id,
        action,
      );
    },
  );
route("post", "/responder/heartbeat", ["responder"], async (req) => {
  return idempotent(req, req.user.id, "heartbeat", async (db) => {
    await db.query(
      "UPDATE units u SET status_updated_at=now() WHERE u.agency_id=$1 AND EXISTS(SELECT 1 FROM responder_unit_memberships m WHERE m.unit_id=u.id AND m.user_id=$2 AND m.valid_from<=now() AND (m.valid_to IS NULL OR m.valid_to>now()))",
      [req.user.agency_id, req.user.id],
    );
    await db.query(
      "UPDATE unit_current_locations l SET recorded_at=CASE WHEN EXISTS(SELECT 1 FROM simulation_unit_faults f WHERE f.agency_id=$2 AND f.stale_locations) THEN now()-interval '30 minutes' ELSE now() END WHERE EXISTS(SELECT 1 FROM responder_unit_memberships m WHERE m.unit_id=l.unit_id AND m.user_id=$1 AND m.valid_from<=now() AND (m.valid_to IS NULL OR m.valid_to>now()))",
      [req.user.id, req.user.agency_id],
    );
    return { confirmedAt: new Date().toISOString(), simulation: true };
  });
});
route("get", "/responder/profile", ["responder"], async (req) => ({
  user: req.user,
  agency: (
    await sql("SELECT demo_name FROM agencies WHERE id=$1", [
      req.user.agency_id,
    ])
  )[0],
  units: await sql(
    "SELECT u.* FROM units u JOIN responder_unit_memberships m ON m.unit_id=u.id WHERE m.user_id=$1 AND m.valid_from<=now() AND (m.valid_to IS NULL OR m.valid_to>now())",
    [req.user.id],
  ),
}));
route("get", "/responder/sync", ["responder"], async (req) => {
  const cursor = String(req.query.cursor || "1970-01-01T00:00:00.000Z");
  if (!Number.isFinite(Date.parse(cursor)))
    throw new Fault(400, "INVALID_CURSOR");
  const watermark = new Date().toISOString();
  const items = (
    await sql(
      `SELECT e.* FROM incident_events e JOIN incidents i ON i.id=e.incident_id WHERE i.agency_id=$1 AND e.server_occurred_at >= $2 AND EXISTS(SELECT 1 FROM assignments a JOIN responder_unit_memberships m ON m.unit_id=a.unit_id WHERE a.incident_id=i.id AND m.user_id=$3 AND (m.valid_to IS NULL OR m.valid_to>now())) ORDER BY e.server_occurred_at,e.sequence LIMIT 500`,
      [req.user.agency_id, cursor, req.user.id],
    )
  ).map(normalizeEvent);
  return {
    items,
    cursor: items.length === 500 ? items.at(-1).server_occurred_at : watermark,
  };
});
route("get", "/assurance/metrics", ["supervisor"], async (req) => {
  const rows = await sql(
    `SELECT i.id,i.public_reference,i.created_at,i.status,min(e.server_occurred_at) FILTER(WHERE e.event_type='incident.triaged') AS triaged_at,min(e.server_occurred_at) FILTER(WHERE e.event_type='assignment.offered') AS offered_at,min(e.server_occurred_at) FILTER(WHERE e.event_type='assignment.accepted') AS accepted_at,(SELECT a.offered_at FROM assignments a WHERE a.incident_id=i.id AND a.accepted_at IS NOT NULL ORDER BY a.accepted_at,a.id LIMIT 1) AS acknowledged_offer_at,min(e.server_occurred_at) FILTER(WHERE e.metadata->>'status'='ARRIVAL_REPORTED') AS arrived_at FROM incidents i LEFT JOIN incident_events e ON e.incident_id=i.id WHERE i.agency_id=$1 GROUP BY i.id ORDER BY i.created_at DESC`,
    [req.user.agency_id],
  );
  return {
    items: rows,
    definitions: {
      triage: "Server received to human triage",
      offer: "Server received to offered",
      acknowledgement: "Offer to unit acknowledgement",
      arrival:
        "Server received to reported arrival; not verified physical arrival",
    },
    sampleSize: rows.length,
  };
});
route("get", "/assurance/incidents", ["supervisor"], listIncidents);
route("get", "/assurance/incidents/:id/replay", ["supervisor"], async (req) => {
  const i = await getIncident(String(req.params.id), req.user);
  return {
    incident: stripPrivate(i),
    items: (
      await sql(
        "SELECT * FROM incident_events WHERE incident_id=$1 ORDER BY sequence",
        [i.id],
      )
    ).map(normalizeEvent),
    reviews: await sql(
      "SELECT * FROM supervisor_reviews WHERE incident_id=$1 ORDER BY created_at",
      [i.id],
    ),
  };
});
route("get", "/assurance/audit/verify", ["supervisor"], async (req) =>
  verifyAudit(
    req.user,
    req.query.incidentId ? String(req.query.incidentId) : undefined,
  ),
);
route("post", "/assurance/audit/checkpoint", ["supervisor"], async (req) => {
  const { reason } = checkpointInput.parse(req.body);
  return idempotent(req, req.user.id, "checkpoint", async (db) => {
    return createCheckpoint(db, req.user.agency_id, reason, req.user.id);
  });
});
route("get", "/assurance/audit/checkpoints", ["supervisor"], async (req) => ({
  items: (
    await sql(
      "SELECT * FROM audit_checkpoints WHERE scope=$1 ORDER BY checkpoint_at DESC LIMIT 50",
      [req.user.agency_id],
    )
  ).map((row) => {
    let registry;
    try {
      registry = trustedKeys();
    } catch {
      registry = { keys: [] };
    }
    return { ...row, signatureVerification: signatureStatus(row, registry) };
  }),
}));
route(
  "get",
  "/assurance/audit/checkpoints/:id/bundle",
  ["supervisor"],
  async (req, res) => {
    const checkpoint = (
      await sql("SELECT * FROM audit_checkpoints WHERE id=$1 AND scope=$2", [
        req.params.id,
        req.user.agency_id,
      ])
    )[0];
    if (!checkpoint) throw new Fault(404, "CHECKPOINT_NOT_FOUND");
    if (!checkpoint.signed_payload)
      throw new Fault(409, "LEGACY_UNSIGNED_CHECKPOINT");
    const events = (
      await sql(
        'SELECT e.* FROM incident_events e JOIN jsonb_to_recordset($1::jsonb) AS h("incidentId" uuid,sequence int) ON e.incident_id=h."incidentId" AND e.sequence<=h.sequence JOIN incidents i ON i.id=e.incident_id WHERE i.agency_id=$2 ORDER BY e.incident_id,e.sequence',
        [JSON.stringify(checkpoint.signed_payload.heads), req.user.agency_id],
      )
    ).map(normalizeEvent);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="nexus-checkpoint-${checkpoint.id}.json"`,
    );
    return { checkpoint, events, simulation: true };
  },
);
for (const [suffix, action] of [
  ["reviews", "review"],
  ["corrections", "correction"],
])
  route(
    "post",
    `/assurance/incidents/:id/${suffix}`,
    ["supervisor"],
    async (req) => perform(req, String(req.params.id), action),
  );
route("get", "/assurance/reviews", ["supervisor"], async (req) => ({
  items: await sql(
    "SELECT r.*,i.public_reference FROM supervisor_reviews r JOIN incidents i ON i.id=r.incident_id WHERE i.agency_id=$1 ORDER BY r.created_at DESC",
    [req.user.agency_id],
  ),
}));
route("get", "/assurance/reports/export", ["supervisor"], async (req, res) => {
  const data = await listIncidents(req);
  const generated = new Date().toISOString();
  const eventRows = await sql(
    "SELECT incident_id,event_type,metadata,server_occurred_at FROM incident_events WHERE incident_id=ANY($1::uuid[]) ORDER BY server_occurred_at",
    [data.items.map((i: any) => i.id)],
  );
  const safe = data.items.map((i: any) => {
    const events = eventRows.filter((e) => e.incident_id === i.id);
    const at = (type: string) =>
      events.find((e) => e.event_type === type)?.server_occurred_at;
    const seconds = (end: any, start: any = i.created_at) =>
      end && start
        ? Math.max(
            0,
            Math.round(
              (new Date(end).getTime() - new Date(start).getTime()) / 1000,
            ),
          )
        : "";
    return {
      reference: i.public_reference,
      category: i.category,
      status: i.status,
      created_at: new Date(i.created_at).toISOString(),
      closed_at: i.closed_at ? new Date(i.closed_at).toISOString() : "",
      triage_seconds: seconds(at("incident.triaged")),
      offer_seconds: seconds(at("assignment.offered")),
      acknowledgement_seconds: seconds(
        at("assignment.accepted"),
        events.find(
          (e) =>
            e.event_type === "assignment.offered" &&
            e.metadata.assignmentId ===
              events.find(
                (accepted) => accepted.event_type === "assignment.accepted",
              )?.metadata.assignmentId,
        )?.server_occurred_at || null,
      ),
      reported_arrival_seconds: seconds(
        events.find((e) => e.metadata.status === "ARRIVAL_REPORTED")
          ?.server_occurred_at,
      ),
      simulation: en.legal.watermark,
    };
  });
  const reportMetadata = en.assurance.exportMetadata
    .replace("{{generated}}", generated)
    .replace("{{count}}", String(safe.length))
    .replace("{{total}}", String(data.total));
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="nexus-research-simulation.${req.query.format === "pdf" ? "pdf" : "csv"}"`,
  );
  if (req.query.format === "pdf") {
    res.locals.streaming = true;
    res.type("pdf");
    const doc = new PDFDocument({ margin: 45 });
    doc.pipe(res);
    doc.on("pageAdded", () => {
      doc.fontSize(8).text(en.legal.warning);
      doc.moveDown();
    });
    doc.fontSize(18).text(en.common.brand);
    doc.fontSize(12).text(en.legal.warning);
    doc.moveDown().text(reportMetadata);
    for (const i of safe)
      doc
        .moveDown()
        .fontSize(10)
        .text(
          `${i.reference} | ${en.category[i.category as keyof typeof en.category]} | ${en.status[i.status as keyof typeof en.status]} | ${i.created_at}\n${en.assurance.triage}: ${i.triage_seconds ?? en.common.unknown}; ${en.assurance.offer}: ${i.offer_seconds ?? en.common.unknown}; ${en.assurance.ack}: ${i.acknowledgement_seconds ?? en.common.unknown}; ${en.assurance.arrival}: ${i.reported_arrival_seconds ?? en.common.unknown}`,
        );
    doc.end();
    return;
  }
  res.type("text/csv");
  const escape = (value: any) =>
    '"' + String(value).replaceAll('"', '""') + '"';
  res.send(
    '"' +
      en.common.brand +
      " — " +
      en.legal.watermark +
      '"\n' +
      escape(reportMetadata) +
      "\n" +
      [
        "reference,category,status,created_at,closed_at,triage_seconds,offer_seconds,acknowledgement_seconds,reported_arrival_seconds,simulation",
        ...safe.map((row: any) => Object.values(row).map(escape).join(",")),
      ].join("\n"),
  );
});
const demoGuard = (_req: Request) => {
  if (process.env.DEMO_MODE !== "true")
    throw new Fault(403, "SIMULATOR_DISABLED");
};
route("get", "/simulator/scenarios", ["admin"], async (req) => {
  demoGuard(req);
  const query = z
    .object({
      limit: z.coerce.number().int().min(1).max(30).default(6),
      offset: z.coerce.number().int().min(0).max(100000).default(0),
      scenario: z.string().max(80).default(""),
      runStatus: z.enum(["", "active", "completed", "stopped"]).default(""),
    })
    .parse(req.query);
  const where = `FROM scenario_runs r JOIN users u ON u.id=r.started_by JOIN simulation_scenarios s ON s.id=r.scenario_id WHERE u.agency_id=$1 AND ($2='' OR s.slug=$2) AND ($3='' OR ($3='active' AND r.completed_at IS NULL AND r.stopped_at IS NULL) OR ($3='completed' AND r.completed_at IS NOT NULL) OR ($3='stopped' AND r.stopped_at IS NOT NULL))`;
  const values = [req.user.agency_id, query.scenario, query.runStatus];
  return {
    items: await sql("SELECT * FROM simulation_scenarios ORDER BY slug"),
    runs: await sql(
      `SELECT r.* ${where} ORDER BY r.started_at DESC,r.id DESC LIMIT $4 OFFSET $5`,
      [...values, query.limit, query.offset],
    ),
    totalRuns: (await sql(`SELECT count(*)::int AS count ${where}`, values))[0]
      .count,
    runLimit: query.limit,
    runOffset: query.offset,
  };
});
route("get", "/simulator/runs/:id", ["admin"], async (req) => {
  demoGuard(req);
  const id = z.string().uuid().parse(req.params.id);
  const run = (
    await sql(
      "SELECT r.* FROM scenario_runs r JOIN users u ON u.id=r.started_by WHERE r.id=$1 AND u.agency_id=$2",
      [id, req.user.agency_id],
    )
  )[0];
  if (!run) throw new Fault(404, "SCENARIO_RUN_NOT_FOUND");
  return run;
});
route("post", "/simulator/scenarios/:id/run", ["admin"], async (req) => {
  demoGuard(req);
  const body = scenarioInput.parse(req.body);
  return idempotent(req, req.user.id, "scenario:" + req.params.id, async () =>
    runScenario(req, String(req.params.id), body.seed),
  );
});
route("post", "/simulator/scenarios/:id/step", ["admin"], async (req) => {
  demoGuard(req);
  return idempotent(req, req.user.id, "step:" + req.params.id, async () =>
    advanceScenario(req, String(req.params.id)),
  );
});
route("post", "/simulator/faults", ["admin"], async (req) => {
  demoGuard(req);
  const body = faultInput.parse(req.body);
  return idempotent(req, req.user.id, "fault", async (db) => {
    if (body.fault === "stale_locations" || body.fault === "unit_unavailable") {
      // Column name comes only from the strict fault enum, never request text.
      await db.query(
        `INSERT INTO simulation_unit_faults(agency_id,${body.fault}) VALUES($1,$2) ON CONFLICT(agency_id) DO UPDATE SET ${body.fault}=excluded.${body.fault},updated_at=now()`,
        [req.user.agency_id, body.enabled],
      );
    }
    if (body.fault === "stale_locations")
      await db.query(
        "UPDATE unit_current_locations l SET recorded_at=CASE WHEN $2 THEN now()-interval '30 minutes' ELSE now() END FROM units u WHERE u.id=l.unit_id AND u.agency_id=$1",
        [req.user.agency_id, body.enabled],
      );
    else if (body.fault === "unit_unavailable")
      await db.query(
        "UPDATE units SET dispatch_status=CASE WHEN $2 THEN 'OFFLINE' ELSE 'AVAILABLE' END,status_updated_at=now() WHERE agency_id=$1 AND NOT EXISTS(SELECT 1 FROM assignments a WHERE a.unit_id=units.id AND a.status IN ('OFFERED','ACCEPTED','ACTIVE'))",
        [req.user.agency_id, body.enabled],
      );
    else
      await db.query("UPDATE simulation_settings SET value=$2 WHERE key=$1", [
        body.fault,
        JSON.stringify(
          body.fault === "ack_delay_ms"
            ? body.enabled
              ? body.delay_ms || 2000
              : 0
            : body.enabled,
        ),
      ]);
    await db.query(
      "INSERT INTO security_audit_events(actor_id,action,resource_kind,result) VALUES($1,'SIMULATION_FAULT',$2,'APPLIED')",
      [req.user.id, body.fault],
    );
    return { ok: true, fault: body };
  });
});
route("post", "/simulator/reset", ["admin"], async (req) => {
  demoGuard(req);
  resetInput.parse(req.body);
  return idempotent(req, req.user.id, "reset", async (db) => {
    const active = (
      await db.query(
        "SELECT * FROM incidents WHERE agency_id=$1 AND status NOT IN ('CLOSED','CANCELLED') FOR UPDATE",
        [req.user.agency_id],
      )
    ).rows;
    for (const i of active) {
      const updated = (
        await db.query(
          "UPDATE incidents SET status='CANCELLED',version=version+1,updated_at=now() WHERE id=$1 RETURNING *",
          [i.id],
        )
      ).rows[0];
      await appendEvent(
        db,
        updated,
        "simulation.reset",
        req.user,
        "EXPLICIT_SIMULATOR_RESET",
        { status: "CANCELLED" },
        req.correlationId,
      );
    }
    await db.query(
      "UPDATE assignments a SET status='ABORTED',closed_at=now() FROM incidents i WHERE i.id=a.incident_id AND i.agency_id=$1 AND a.status IN ('OFFERED','ACCEPTED','ACTIVE')",
      [req.user.agency_id],
    );
    await db.query(
      "UPDATE units SET dispatch_status='AVAILABLE',status_updated_at=now() WHERE agency_id=$1",
      [req.user.agency_id],
    );
    await db.query(
      "UPDATE unit_current_locations l SET recorded_at=now() FROM units u WHERE u.id=l.unit_id AND u.agency_id=$1",
      [req.user.agency_id],
    );
    await db.query(
      "UPDATE simulation_settings SET value='false' WHERE key IN ('worker_paused','map_unavailable','drop_notifications')",
    );
    await db.query(
      "UPDATE simulation_settings SET value='0' WHERE key='ack_delay_ms'",
    );
    await db.query(
      "UPDATE simulation_unit_faults SET stale_locations=false,unit_unavailable=false,updated_at=now() WHERE agency_id=$1",
      [req.user.agency_id],
    );
    await db.query(
      "UPDATE scenario_runs r SET stopped_at=now(),stop_reason='SIMULATION_RESET' FROM users u WHERE u.id=r.started_by AND u.agency_id=$1 AND r.completed_at IS NULL AND r.stopped_at IS NULL",
      [req.user.agency_id],
    );
    return { ok: true, cancelled: active.length, historyPreserved: true };
  });
});
route("get", "/simulator/settings", ["admin"], async (req) => {
  demoGuard(req);
  return {
    items: await sql("SELECT * FROM simulation_settings"),
    agency: (
      await sql("SELECT * FROM agencies WHERE id=$1", [req.user.agency_id])
    )[0],
  };
});
route("post", "/simulator/settings", ["admin"], async (req) => {
  demoGuard(req);
  const data = settingsInput.parse(req.body);
  return idempotent(req, req.user.id, "settings", async (db) => {
    await db.query(
      "UPDATE simulation_settings SET value=$1 WHERE key='retention_days'",
      [JSON.stringify(data.retention_days)],
    );
    await db.query("UPDATE agencies SET demo_name=$2 WHERE id=$1", [
      req.user.agency_id,
      data.agency_name,
    ]);
    return { ok: true };
  });
});
route("get", "/openapi.json", null, async () => {
  const paths: any = {};
  for (const d of [
    ...definitions,
    { method: "post", path: "/auth/login", roles: null },
  ]) {
    const url = "/api/v1" + d.path.replace(/:([A-Za-z]+)/g, "{$1}");
    paths[url] ||= {};
    const schema = d.path.includes("/auth/login")
      ? "Login"
      : d.path === "/demo/incidents"
        ? "IncidentInput"
        : d.path.endsWith("/feedback")
          ? "Feedback"
          : d.path.endsWith("/run")
            ? "ScenarioInput"
            : d.path === "/simulator/faults"
              ? "FaultInput"
              : d.path === "/simulator/reset"
                ? "ResetInput"
                : d.path === "/simulator/settings"
                  ? "SettingsInput"
                  : d.path === "/assurance/audit/checkpoint"
                    ? "CheckpointInput"
                    : ["/auth/logout", "/responder/heartbeat"].includes(
                          d.path,
                        ) || d.path.endsWith("/step")
                      ? "EmptyInput"
                      : "Command";
    paths[url][d.method] = {
      summary: d.path,
      description: d.roles
        ? "Allowed demo roles: " + d.roles.join(", ")
        : "Fictional public demo endpoint",
      parameters: [...d.path.matchAll(/:([A-Za-z]+)/g)].map((m) => ({
        in: "path",
        name: m[1],
        required: true,
        schema: { type: "string" },
      })),
      ...(d.method === "post"
        ? {
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/" + schema },
                },
              },
            },
          }
        : {}),
      responses: {
        "200": { description: "Authoritative response" },
        "400": { description: "Invalid command" },
        "401": { description: "Authentication or private capability required" },
        "403": { description: "Role or agency denied" },
        "409": { description: "Version, transition, or idempotency conflict" },
      },
    };
  }
  return {
    openapi: "3.0.3",
    info: {
      title: "NEXUS — Response Intelligence",
      version: "1.0.0",
      description: "Independent research simulation only",
    },
    components: {
      schemas: {
        ScenarioInput: zodToJsonSchema(scenarioInput),
        FaultInput: zodToJsonSchema(faultInput),
        ResetInput: zodToJsonSchema(resetInput),
        SettingsInput: zodToJsonSchema(settingsInput),
        CheckpointInput: zodToJsonSchema(checkpointInput),
        EmptyInput: { type: "object", additionalProperties: false },
        IncidentInput: zodToJsonSchema(createIncident),
        Command: zodToJsonSchema(command),
        Login: zodToJsonSchema(login),
        Feedback: zodToJsonSchema(feedback),
      },
    },
    paths,
  };
});
route("get", "/simulator/tamper-demo", ["admin"], async (req) => {
  demoGuard(req);
  const first = (
    await sql(
      "SELECT id FROM incidents WHERE agency_id=$1 ORDER BY created_at DESC LIMIT 1",
      [req.user.agency_id],
    )
  )[0];
  if (!first) return { available: false };
  const events = (
    await sql(
      "SELECT * FROM incident_events WHERE incident_id=$1 ORDER BY sequence",
      [first.id],
    )
  ).map(normalizeEvent);
  const before = verifyChain(events);
  const copy = structuredClone(events);
  copy[0].reason_code = "TAMPERED_TEST_COPY";
  return {
    available: true,
    original: before,
    tamperedCopy: verifyChain(copy),
    sourceUnchanged: true,
  };
});
app.use((req, res) =>
  res.status(404).json({
    code: "NOT_FOUND",
    message: "Route not found",
    correlationId: req.correlationId,
    retryable: false,
  }),
);
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  const validation = err instanceof z.ZodError;
  const status = validation
    ? 400
    : err instanceof Fault
      ? err.status
      : err.code === "23505"
        ? 409
        : err.code === "22P02" || err.code === "22007"
          ? 400
          : err.type === "entity.parse.failed"
            ? 400
            : err.type === "entity.too.large"
              ? 413
              : 500;
  const code = validation
    ? "VALIDATION_ERROR"
    : err instanceof Fault
      ? err.code
      : status === 409
        ? "CONCURRENT_CONFLICT"
        : status === 400
          ? "INVALID_PARAMETER"
          : status === 413
            ? "BODY_TOO_LARGE"
            : "INTERNAL_ERROR";
  if (status === 500)
    console.error("API failure", req.correlationId, err.message);
  res.status(status).json({
    code,
    message: err instanceof Fault ? err.message : code,
    correlationId: req.correlationId,
    retryable: status >= 500,
    details: validation
      ? err.flatten()
      : err instanceof Fault
        ? err.details
        : undefined,
  });
});
