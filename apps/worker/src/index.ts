import { pool, transaction, sql } from "../../api/src/db";
import { createCheckpoint } from "../../api/src/audit";
import { expireOffers } from "../../api/src/service";
export async function tick() {
  await expireOffers();
  const paused = (
    await sql("SELECT value FROM simulation_settings WHERE key='worker_paused'")
  )[0]?.value;
  if (paused) return 0;
  try {
    await checkpointIfDue();
  } catch {
    console.error(
      "Audit checkpoint unavailable; outbox delivery continues. Check signing configuration and event integrity.",
    );
  }
  return transaction(async (db) => {
    const rows = (
      await db.query(
        "SELECT * FROM outbox_events WHERE delivered_at IS NULL AND next_attempt_at<=now() ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 100",
      )
    ).rows;
    for (const row of rows) {
      try {
        await db.query("SAVEPOINT deliver");
        await db.query("SELECT pg_notify('nexus_events',$1)", [row.id]);
        await db.query(
          "UPDATE outbox_events SET delivered_at=now(),attempts=attempts+1,last_error=NULL WHERE id=$1",
          [row.id],
        );
        await db.query("RELEASE SAVEPOINT deliver");
      } catch {
        await db.query("ROLLBACK TO SAVEPOINT deliver");
        await db.query(
          "UPDATE outbox_events SET attempts=attempts+1,next_attempt_at=now()+LEAST(300,POWER(2,LEAST(attempts,8))) * interval '1 second',last_error='DELIVERY_FAILED' WHERE id=$1",
          [row.id],
        );
      }
    }
    return rows.length;
  });
}
if (
  process.argv[1]?.replaceAll("\\", "/").endsWith("apps/worker/src/index.ts")
) {
  let running = true;
  process.on("SIGTERM", () => {
    running = false;
  });
  process.on("SIGINT", () => {
    running = false;
  });
  console.log("NEXUS durable outbox worker started");
  while (running) {
    try {
      await tick();
    } catch (e) {
      console.error("Worker retry", e instanceof Error ? e.message : "unknown");
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  await pool.end();
}

async function checkpointIfDue() {
  await transaction(async (db) => {
    await db.query(
      "SELECT pg_advisory_xact_lock(hashtext('nexus-scheduled-checkpoint'))",
    );
    const agencies = (
      await db.query(
        "SELECT a.id FROM agencies a WHERE NOT EXISTS(SELECT 1 FROM audit_checkpoints c WHERE c.scope=a.id::text AND c.signed_payload IS NOT NULL AND c.checkpoint_at>now()-interval '15 minutes')",
      )
    ).rows;
    for (const agency of agencies) {
      await createCheckpoint(
        db,
        agency.id,
        "Scheduled research checkpoint",
        null,
      );
    }
  });
}
