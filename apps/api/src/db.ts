import "dotenv/config";
import pg from "pg";
import { AsyncLocalStorage } from "node:async_hooks";
import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  randomUUID,
} from "node:crypto";
import {
  digest,
  eventHash,
  canonical,
} from "../../../packages/domain/src/index";
export const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://nexus:nexus-local-only@127.0.0.1:55432/nexus";
export const pool = new pg.Pool({ connectionString, max: 24 });
// pg destroys dropped idle clients; handling this event keeps the service alive.
pool.on("error", (error: any) =>
  console.error(
    "PostgreSQL idle connection replaced",
    error.code || "CONNECTION_LOST",
  ),
);
const transactionContext = new AsyncLocalStorage<pg.PoolClient>();
export const sql = async (text: string, values: any[] = []) =>
  (await (transactionContext.getStore() || pool).query(text, values)).rows;
export class Fault extends Error {
  constructor(
    public status: number,
    public code: string,
    message = code,
    public details?: any,
  ) {
    super(message);
  }
}
export function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function passwordMatches(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  return timingSafeEqual(
    Buffer.from(hash, "hex"),
    scryptSync(password, salt, 64),
  );
}
export function normalizeEvent(row: any) {
  return {
    ...row,
    client_occurred_at: row.client_occurred_at
      ? new Date(row.client_occurred_at).toISOString()
      : null,
    server_occurred_at: new Date(row.server_occurred_at).toISOString(),
  };
}
export async function appendEvent(
  db: pg.PoolClient,
  incident: any,
  type: string,
  actor: any,
  reason: string,
  metadata: any,
  correlationId: string,
  clientTime?: string,
) {
  const previous = (
    await db.query(
      "SELECT sequence,event_hash FROM incident_events WHERE incident_id=$1 ORDER BY sequence DESC LIMIT 1",
      [incident.id],
    )
  ).rows[0];
  const event = {
    id: randomUUID(),
    incident_id: incident.id,
    sequence: (previous?.sequence || 0) + 1,
    event_type: type,
    actor_type: actor?.role || "citizen",
    actor_id: actor?.id || null,
    aggregate_version: incident.version,
    reason_code: reason,
    metadata: {
      ...metadata,
      origin:
        actor?.role === "responder"
          ? "FIELD_COMMAND"
          : actor?.role === "system"
            ? "SYSTEM_WORKER"
            : actor
              ? "OPERATOR_COMMAND"
              : "CITIZEN_DEMO",
    },
    client_occurred_at: clientTime || null,
    server_occurred_at: new Date().toISOString(),
    correlation_id: correlationId,
    prev_hash: previous?.event_hash || "0".repeat(64),
  };
  const normalized = JSON.parse(JSON.stringify(event));
  const hash = eventHash(normalized);
  const full = { ...normalized, event_hash: hash };
  await db.query(
    `INSERT INTO incident_events(${Object.keys(full).join(",")}) VALUES(${Object.keys(
      full,
    )
      .map((_, i) => "$" + (i + 1))
      .join(",")})`,
    Object.values(full),
  );
  await db.query(
    "INSERT INTO outbox_events(aggregate_id,event_id,topic,payload) VALUES($1,$2,$3,$4)",
    [
      incident.id,
      event.id,
      type,
      {
        eventId: event.id,
        incidentId: incident.id,
        sequence: event.sequence,
        aggregateVersion: incident.version,
        emittedAt: event.server_occurred_at,
        type,
        safePayload: { status: incident.status },
        simulation: true,
      },
    ],
  );
  return full;
}
export async function transaction<T>(fn: (db: pg.PoolClient) => Promise<T>) {
  const existing = transactionContext.getStore();
  if (existing) return fn(existing);
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const value = await transactionContext.run(db, () => fn(db));
    await db.query("COMMIT");
    return value;
  } catch (e) {
    await db.query("ROLLBACK");
    throw e;
  } finally {
    db.release();
  }
}
export async function idempotent(
  req: any,
  scope: string,
  type: string,
  fn: (db: pg.PoolClient) => Promise<any>,
) {
  const key = req.get("Idempotency-Key");
  if (!key || key.length > 128)
    throw new Fault(400, "IDEMPOTENCY_KEY_REQUIRED");
  const fingerprint = digest(canonical({ type, body: req.body }));
  return transaction(async (db) => {
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      scope + ":" + key,
    ]);
    const old = (
      await db.query(
        "SELECT * FROM client_commands WHERE actor_scope=$1 AND idempotency_key=$2",
        [scope, key],
      )
    ).rows[0];
    if (old) {
      if (old.request_fingerprint !== fingerprint)
        throw new Fault(409, "IDEMPOTENCY_KEY_REUSED");
      return old.result_json;
    }
    const result = await fn(db);
    await db.query(
      "INSERT INTO client_commands(idempotency_key,actor_scope,actor_id,request_fingerprint,command_type,result_json) VALUES($1,$2,$3,$4,$5,$6)",
      [key, scope, req.user?.id || null, fingerprint, type, result],
    );
    await db.query(
      "INSERT INTO security_audit_events(actor_id,action,resource_kind,result) VALUES($1,$2,'COMMAND','COMMITTED')",
      [req.user?.id || null, type],
    );
    return result;
  });
}
