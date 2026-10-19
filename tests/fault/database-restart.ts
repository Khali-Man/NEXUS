import "dotenv/config";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { io } from "socket.io-client";
const base = "http://127.0.0.1:4000/api/v1";
if (!(await fetch(base + "/health")).ok)
  throw new Error("Start the local simulator before this fault check.");
const began = performance.now();
const restart = spawnSync(
  "docker",
  ["compose", "-f", "infra/docker-compose.yml", "restart", "db"],
  { encoding: "utf8" },
);
if (restart.status !== 0) throw new Error("Local database restart failed.");
let ready = false;
for (let attempt = 0; attempt < 150; attempt++) {
  try {
    if ((await fetch(base + "/health")).ok) {
      ready = true;
      break;
    }
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 100));
}
if (!ready) throw new Error("API did not recover after PostgreSQL restart.");
const response = await fetch(base + "/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    username: "dispatcher",
    password: process.env.DEMO_PASSWORD || "Nexus-Demo-2026!",
  }),
});
if (!response.ok) throw new Error("Database-backed login did not recover.");
const cookie = response.headers.get("set-cookie")!.split(";")[0];
let notificationsReady = false;
for (let attempt = 0; attempt < 150; attempt++) {
  try {
    const state = (await (
      await fetch(base + "/cad/network", { headers: { Cookie: cookie } })
    ).json()) as any;
    if (state.realtimeNotifications) {
      notificationsReady = true;
      break;
    }
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 100));
}
if (!notificationsReady)
  throw new Error("Notification subscriber did not recover.");
const socket = io("http://127.0.0.1:4000", {
  extraHeaders: { Cookie: cookie },
  transports: ["websocket"],
  reconnection: false,
});
const received: any[] = [];
socket.on("event", (event) => received.push(event));
try {
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  });
  const key = randomUUID();
  const created = await fetch(base + "/demo/incidents", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": key },
    body: JSON.stringify({
      client_request_id: key,
      simulation: true,
      category: "TRAFFIC",
      description: "Synthetic database-restart validation; no real people.",
      landmark: "Fictional restart test landmark",
      longitude: 4.556,
      latitude: 7.774,
    }),
  });
  if (!created.ok)
    throw new Error("Command could not commit after database restart.");
  const receipt = (await created.json()) as any;
  const list = (await (
    await fetch(base + "/cad/incidents?q=" + receipt.reference, {
      headers: { Cookie: cookie },
    })
  ).json()) as any;
  const id = list.items[0]?.id;
  for (
    let attempt = 0;
    attempt < 100 && !received.some((e) => e.incidentId === id);
    attempt++
  )
    await new Promise((resolve) => setTimeout(resolve, 100));
  if (
    !received.some(
      (e) => e.incidentId === id && e.safePayload.status === "RECEIVED",
    )
  )
    throw new Error("Worker/realtime did not resume delivery.");
  const result = {
    at: new Date().toISOString(),
    databaseRestarted: true,
    apiRecovered: true,
    sessionRecovered: true,
    commandCommitted: true,
    workerNotificationRecovered: true,
    elapsedMs: performance.now() - began,
  };
  await mkdir("docs/results", { recursive: true });
  await writeFile(
    "docs/results/database-restart.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} finally {
  socket.disconnect();
}
