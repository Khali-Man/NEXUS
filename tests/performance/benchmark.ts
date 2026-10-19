import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { io } from "socket.io-client";
import pg from "pg";
const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
if (
  !(await admin.query("SELECT 1 FROM pg_database WHERE datname='nexus_bench'"))
    .rowCount
)
  await admin.query("CREATE DATABASE nexus_bench");
await admin.end();
const url = new URL(
  process.env.DATABASE_URL ||
    "postgresql://nexus:nexus-local-only@127.0.0.1:55432/nexus",
);
url.pathname = "/nexus_bench";
process.env.DATABASE_URL = url.href;
process.env.RATE_LIMIT_PER_MINUTE = "50000";
const { migrate, seed } = await import("../../tools/database");
const { sql, pool } = await import("../../apps/api/src/db");
await migrate();
await seed();
const child = spawn("node_modules/.bin/tsx", ["apps/api/src/server.ts"], {
  env: { ...process.env, PORT: "4100" },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverOutput = "";
child.stdout.on("data", (b) => (serverOutput += b.toString()));
child.stderr.on("data", (b) => (serverOutput += b.toString()));
const base = "http://127.0.0.1:4100/api/v1";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function api(path: string, body?: any, cookie = "", key = randomUUID()) {
  const start = performance.now();
  const res = await fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": key,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  return {
    status: res.status,
    data,
    ms: performance.now() - start,
    cookie: res.headers.get("set-cookie")?.split(";")[0] || "",
  };
}
for (let i = 0; i < 100; i++) {
  try {
    if ((await api("/health")).status === 200) break;
  } catch {}
  await sleep(100);
}
const password = process.env.DEMO_PASSWORD || "Nexus-Demo-2026!";
const dispatcher = await api("/auth/login", {
  username: "dispatcher",
  password,
});
const responder = await api("/auth/login", { username: "responder", password });
const agency = dispatcher.data.agency_id;
const baselineHttp = createServer((req, res) => {
  if (req.method === "POST") {
    req.on("data", () => {});
    req.on("end", () => {
      const reference = "BASE-" + randomUUID();
      baseline.emit("incident", { reference, status: "RECEIVED" });
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ reference, status: "RECEIVED" }));
    });
  } else res.end("baseline");
});
const baseline = new Server(baselineHttp);
await new Promise<void>((r) => baselineHttp.listen(4101, "127.0.0.1", r));
const results: any = {
  startedAt: new Date().toISOString(),
  hardware: {
    platform: process.platform,
    node: process.version,
    cpus: (await import("node:os")).availableParallelism(),
    memoryBytes: (await import("node:os")).totalmem(),
  },
  configuration: { dbPool: 24, rateLimitPerMinute: 50000, localOnly: true },
  load: [],
  faults: [],
  limitations: [
    "Local synthetic workload, not production capacity.",
    "Emit-only baseline deliberately has no persistence or replay.",
    "No live routing model or independently verified arrival.",
  ],
};
async function create(seed: number, index: number) {
  const key = randomUUID();
  const body = {
    client_request_id: key,
    simulation: true,
    category: "TRAFFIC",
    description: `Synthetic benchmark seed ${seed} incident ${index}. No real people.`,
    landmark: "Fictional benchmark landmark",
    longitude: 4.5557,
    latitude: 7.7738,
  };
  return { ...(await api("/demo/incidents", body, "", key)), key, body };
}
async function fault(duration: number, seed: number) {
  const r = await create(seed, duration);
  const incident = (
    await sql("SELECT * FROM incidents WHERE public_reference=$1", [
      r.data.reference,
    ])
  )[0];
  let i = (
    await api(
      "/cad/incidents/" + incident.id + "/triage",
      { expected_version: 1, reason: "Synthetic benchmark triage" },
      dispatcher.cookie,
    )
  ).data.incident;
  i = (
    await api(
      "/cad/incidents/" + incident.id + "/ready",
      { expected_version: i.version, reason: "Synthetic benchmark ready" },
      dispatcher.cookie,
    )
  ).data.incident;
  const u = (
    await sql(
      "INSERT INTO units(agency_id,callsign,unit_type,capability_tags,dispatch_status) VALUES($1,$2,'PATROL',ARRAY['TRAFFIC'],'AVAILABLE') RETURNING id",
      [agency, `BENCH-${duration}-${seed}-${randomUUID().slice(0, 4)}`],
    )
  )[0];
  await sql(
    "INSERT INTO unit_current_locations(unit_id,geom) VALUES($1,ST_SetSRID(ST_MakePoint(4.556,7.774),4326)::geography)",
    [u.id],
  );
  await sql(
    "INSERT INTO responder_unit_memberships(user_id,unit_id) SELECT id,$1 FROM users WHERE username='responder'",
    [u.id],
  );
  const offered = await api(
    "/cad/incidents/" + incident.id + "/assignments",
    {
      expected_version: i.version,
      reason: "Synthetic benchmark offer",
      unit_id: u.id,
    },
    dispatcher.cookie,
  );
  i = offered.data.incident;
  const assignment = offered.data.event.metadata.assignmentId;
  const durableSocket = io("http://127.0.0.1:4100", {
    extraHeaders: { Cookie: responder.cookie },
    transports: ["websocket"],
    reconnection: false,
  });
  const ephemeralSocket = io("http://127.0.0.1:4101", {
    transports: ["websocket"],
    reconnection: false,
  });
  let baselineReceived = 0;
  ephemeralSocket.on("incident", (event: any) => {
    if (event.reference === incident.public_reference) baselineReceived++;
  });
  await Promise.all([
    new Promise<void>((r, j) => {
      durableSocket.once("connect", r);
      durableSocket.once("connect_error", j);
    }),
    new Promise<void>((r, j) => {
      ephemeralSocket.once("connect", r);
      ephemeralSocket.once("connect_error", j);
    }),
  ]);
  durableSocket.disconnect();
  ephemeralSocket.disconnect();
  baselineReceived = 0;
  const began = performance.now();
  const cursor = new Date().toISOString();
  baseline.emit("incident", {
    reference: incident.public_reference,
    status: "CANCELLED",
  });
  const cancelled = await api(
    "/cad/incidents/" + incident.id + "/cancel",
    {
      expected_version: i.version,
      reason: "Cancelled while synthetic responder is offline",
    },
    dispatcher.cookie,
  );
  if (cancelled.status !== 200) throw new Error("Cancellation failed");
  await sleep(duration * 1000);
  const recover = performance.now();
  durableSocket.connect();
  ephemeralSocket.connect();
  await Promise.all([
    new Promise<void>((r) => durableSocket.once("connect", r)),
    new Promise<void>((r) => ephemeralSocket.once("connect", r)),
  ]);
  const replay = await api(
    "/responder/sync?cursor=" + encodeURIComponent(cursor),
    undefined,
    responder.cookie,
  );
  const recovered = replay.data.items.filter(
    (e: any) => e.incident_id === incident.id,
  );
  const conflict = await api(
    "/responder/assignments/" + assignment + "/accept",
    {
      expected_version: i.version,
      reason: "Queued offline acknowledgement",
      client_occurred_at: new Date(Date.now() - duration * 1000).toISOString(),
    },
    responder.cookie,
  );
  durableSocket.disconnect();
  ephemeralSocket.disconnect();
  return {
    seed,
    requestedOfflineSeconds: duration,
    measuredOfflineSeconds: (performance.now() - began) / 1000,
    durableRecoveredEvents: recovered.length,
    expectedMissedEvents: 1,
    replayCompleteness: recovered.some(
      (e: any) => e.metadata.status === "CANCELLED",
    )
      ? 1
      : 0,
    baselineRecoveredEvents: baselineReceived,
    staleCommandHttpStatus: conflict.status,
    recoveryMs: performance.now() - recover,
  };
}
try {
  console.log(
    "Starting 15 real-time network outage experiments (15s, 60s, 300s; five seeds).",
  );
  const faultTasks = [15, 60, 300].flatMap((duration) =>
    [1, 2, 3, 4, 5].map((seed) =>
      fault(duration, seed).then((r) => {
        console.log("Fault measured", duration, seed, r.replayCompleteness);
        return r;
      }),
    ),
  );
  for (const concurrency of [100, 500, 1000])
    for (const seed of [1, 2, 3, 4, 5]) {
      const cpu = process.cpuUsage(),
        start = performance.now();
      const requests = await Promise.all(
        Array.from({ length: concurrency }, (_, index) => create(seed, index)),
      );
      const latencies = requests.map((r) => r.ms).sort((a, b) => a - b);
      const failed = requests.filter((r) => r.status !== 200);
      let duplicates = 0;
      for (const r of requests.slice(0, 5)) {
        const retry = await api("/demo/incidents", r.body, "", r.key);
        if (retry.data.reference !== r.data.reference) duplicates++;
      }
      const row = {
        concurrency,
        seed,
        count: requests.length,
        apiErrors: failed.length,
        medianMs: latencies[Math.floor(latencies.length * 0.5)],
        p95Ms: latencies[Math.floor(latencies.length * 0.95)],
        elapsedMs: performance.now() - start,
        duplicateReferenceCount: duplicates,
        parentMemoryBytes: process.memoryUsage().rss,
        parentCpuMicroseconds: process.cpuUsage(cpu),
      };
      const baselineStart = performance.now();
      const baselineRequests = await Promise.all(
        Array.from({ length: concurrency }, async () => {
          const start = performance.now();
          const r = await fetch("http://127.0.0.1:4101", {
            method: "POST",
            body: JSON.stringify({ simulation: true }),
          });
          return {
            ms: performance.now() - start,
            ...((await r.json()) as any),
            status: r.status,
          };
        }),
      );
      const baselineLatencies = baselineRequests
        .map((r) => r.ms)
        .sort((a, b) => a - b);
      Object.assign(row, {
        baseline: {
          medianMs: baselineLatencies[Math.floor(concurrency * 0.5)],
          p95Ms: baselineLatencies[Math.floor(concurrency * 0.95)],
          elapsedMs: performance.now() - baselineStart,
          apiErrors: baselineRequests.filter((r) => r.status !== 200).length,
          persistence: false,
        },
      });
      results.load.push(row);
      console.log("Load measured", JSON.stringify(row));
    }
  results.faults = await Promise.all(faultTasks);
  results.completedAt = new Date().toISOString();
  results.serverOutput = serverOutput;
  await mkdir("artifacts", { recursive: true });
  await writeFile(
    "artifacts/benchmark-results.json",
    JSON.stringify(results, null, 2),
  );
  if (
    results.load.some((r: any) => r.apiErrors || r.duplicateReferenceCount) ||
    results.faults.some(
      (r: any) =>
        r.replayCompleteness !== 1 || r.staleCommandHttpStatus !== 409,
    )
  )
    process.exitCode = 1;
} finally {
  child.kill("SIGTERM");
  baseline.close();
  baselineHttp.close();
  await pool.end();
}
