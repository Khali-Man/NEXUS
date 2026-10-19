import { readFile, readdir } from "node:fs/promises";
import { pool, transaction, passwordHash } from "../apps/api/src/db";
import { scenarios } from "../packages/contracts/src/index";
import { fixtures } from "../packages/simulation/src/index";
import { pathToFileURL } from "node:url";
export async function migrate() {
  await pool.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY,applied_at timestamptz DEFAULT now())",
  );
  for (const name of (await readdir("infra/db/migrations")).sort()) {
    if (
      (
        await pool.query("SELECT 1 FROM schema_migrations WHERE name=$1", [
          name,
        ])
      ).rowCount
    )
      continue;
    await transaction(async (db) => {
      await db.query(await readFile("infra/db/migrations/" + name, "utf8"));
      await db.query("INSERT INTO schema_migrations(name) VALUES($1)", [name]);
    });
    console.log("Migrated", name);
  }
}
export async function seed() {
  await transaction(async (db) => {
    let agency = (
      await db.query(
        "SELECT id FROM agencies WHERE demo_name='Osogbo Research Collective'",
      )
    ).rows[0]?.id;
    if (!agency)
      agency = (
        await db.query(
          "INSERT INTO agencies(demo_name,category) VALUES('Osogbo Research Collective','RESEARCH') RETURNING id",
        )
      ).rows[0].id;
    const password = process.env.DEMO_PASSWORD || "Nexus-Demo-2026!";
    for (const role of ["dispatcher", "responder", "supervisor", "admin"])
      await db.query(
        "INSERT INTO users(username,demo_name,role,agency_id,password_hash) VALUES($1,$2,$3,$4,$5) ON CONFLICT(username) DO NOTHING",
        [role, `Demo ${role}`, role, agency, passwordHash(password)],
      );
    for (const [index, callsign, state, age] of [
      [0, "OSG • 01", "BUSY", 0],
      [1, "OSG • 02", "AVAILABLE", 30],
      [2, "OSG • 03", "AVAILABLE", 0],
      [3, "OSG • 04", "AVAILABLE", 0],
    ] as const) {
      const unit = (
        await db.query(
          "INSERT INTO units(agency_id,callsign,unit_type,capability_tags,dispatch_status) VALUES($1,$2,$3,$4,$5) ON CONFLICT(callsign) DO UPDATE SET callsign=excluded.callsign RETURNING id",
          [
            agency,
            callsign,
            index === 3 ? "MEDICAL" : "PATROL",
            index === 3 ? ["MEDICAL"] : ["TRAFFIC", "PUBLIC_SAFETY", "OTHER"],
            state,
          ],
        )
      ).rows[0];
      await db.query(
        "INSERT INTO unit_current_locations(unit_id,geom,recorded_at) VALUES($1,ST_SetSRID(ST_MakePoint($2,$3),4326)::geography,now()-$4*interval '1 minute') ON CONFLICT(unit_id) DO NOTHING",
        [unit.id, 4.553 + index * 0.003, 7.773 + index * 0.002, age],
      );
      if (index === 2 || index === 3)
        await db.query(
          "INSERT INTO responder_unit_memberships(user_id,unit_id) SELECT id,$1 FROM users WHERE username='responder' ON CONFLICT DO NOTHING",
          [unit.id],
        );
    }
    for (const slug of scenarios)
      await db.query(
        "INSERT INTO simulation_scenarios(slug,title,seed_json,expected_results_json) VALUES($1,$2,$3,$4) ON CONFLICT(slug) DO UPDATE SET title=excluded.title,seed_json=excluded.seed_json,expected_results_json=excluded.expected_results_json",
        [
          slug,
          fixtures[slug].title,
          {
            seed: 2026,
            simulation: true,
            description: fixtures[slug].description,
            steps: fixtures[slug].steps,
          },
          { scenario: slug, assertions: fixtures[slug].goals },
        ],
      );
    for (const [key, value] of Object.entries({
      worker_paused: false,
      map_unavailable: false,
      drop_notifications: false,
      ack_delay_ms: 0,
      retention_days: 7,
    }))
      await db.query(
        "INSERT INTO simulation_settings(key,value) VALUES($1,$2) ON CONFLICT DO NOTHING",
        [key, JSON.stringify(value)],
      );
  });
  console.log("Synthetic accounts, units and nine scenarios seeded.");
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    if (process.argv[2] === "migrate") await migrate();
    else if (process.argv[2] === "seed") await seed();
    else throw new Error("Use migrate or seed");
  } finally {
    await pool.end();
  }
}
