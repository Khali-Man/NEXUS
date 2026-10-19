import { beforeAll, afterAll, it, expect } from "vitest";
import { io as connect, type Socket } from "socket.io-client";
import { randomUUID } from "node:crypto";
import { migrate, seed } from "../tools/database";
import { pool, sql } from "../apps/api/src/db";
import { tick } from "../apps/worker/src/index";
import { digest } from "../packages/domain/src/index";
let runtime: any;
let cookie: string;
const sockets: Socket[] = [];
beforeAll(async () => {
  await migrate();
  await seed();
  process.env.PORT = "4200";
  runtime = await import("../apps/api/src/server");
  await new Promise<void>((resolve) => {
    if (runtime.server.listening) resolve();
    else runtime.server.once("listening", resolve);
  });
  const response = await fetch("http://127.0.0.1:4200/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "dispatcher",
      password: process.env.DEMO_PASSWORD || "Nexus-Demo-2026!",
    }),
  });
  cookie = response.headers.get("set-cookie")!.split(";")[0];
});
afterAll(async () => {
  sockets.forEach((s) => s.disconnect());
  if (runtime) await runtime.stop(false);
  else await pool.end();
});
it("rejects unauthenticated realtime subscriptions", async () => {
  const socket = connect("http://127.0.0.1:4200", {
    transports: ["websocket"],
    reconnection: false,
  });
  sockets.push(socket);
  const error = await new Promise<any>((r) => socket.once("connect_error", r));
  expect(error.message).toBe("AUTHENTICATION_REQUIRED");
});
it("rejects an unapproved websocket origin before subscription", async () => {
  const socket = connect("http://127.0.0.1:4200", {
    extraHeaders: { Cookie: cookie, Origin: "https://unapproved.example" },
    transports: ["websocket"],
    reconnection: false,
  });
  sockets.push(socket);
  expect(
    await new Promise<string>((r) =>
      socket.once("connect_error", (e) => r(e.message)),
    ),
  ).toBe("websocket error");
});
it("revalidates a revoked session before publishing an agency event", async () => {
  const login = await fetch("http://127.0.0.1:4200/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "dispatcher",
      password: process.env.DEMO_PASSWORD || "Nexus-Demo-2026!",
    }),
  });
  const ownCookie = login.headers.get("set-cookie")!.split(";")[0];
  const socket = connect("http://127.0.0.1:4200", {
    extraHeaders: { Cookie: ownCookie },
    transports: ["websocket"],
    reconnection: false,
  });
  sockets.push(socket);
  await new Promise<void>((r, j) => {
    socket.once("system.sync_required", () => r());
    socket.once("connect_error", j);
  });
  const disconnected = new Promise<void>((r) =>
    socket.once("disconnect", () => r()),
  );
  await sql("DELETE FROM sessions WHERE id_digest=$1", [
    digest(ownCookie.split("=")[1]),
  ]);
  const key = randomUUID();
  const created = await fetch("http://127.0.0.1:4200/api/v1/demo/incidents", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": key },
    body: JSON.stringify({
      client_request_id: key,
      simulation: true,
      category: "TRAFFIC",
      description: "Fictional revoked-session test",
      landmark: "Fictional landmark",
      longitude: 4.5557,
      latitude: 7.7738,
    }),
  });
  expect(created.status).toBe(200);
  let count = 100;
  while (count === 100) count = await tick();
  await disconnected;
  expect(socket.connected).toBe(false);
});
it("delivers committed outbox envelopes only to an authorised agency and citizen-safe hints", async () => {
  const key = randomUUID();
  const response = await fetch("http://127.0.0.1:4200/api/v1/demo/incidents", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": key },
    body: JSON.stringify({
      client_request_id: key,
      simulation: true,
      category: "TRAFFIC",
      description: "Fictional realtime integration test",
      landmark: "Fictional Olaiya landmark",
      longitude: 4.5557,
      latitude: 7.7738,
    }),
  });
  const receipt = (await response.json()) as any;
  const incident = (
    await sql("SELECT id FROM incidents WHERE public_reference=$1", [
      receipt.reference,
    ])
  )[0];
  const dispatcher = connect("http://127.0.0.1:4200", {
    extraHeaders: { Cookie: cookie },
    transports: ["websocket"],
    reconnection: false,
  });
  const citizen = connect("http://127.0.0.1:4200", {
    auth: { reference: receipt.reference, receiptToken: receipt.receiptToken },
    transports: ["websocket"],
    reconnection: false,
  });
  sockets.push(dispatcher, citizen);
  await Promise.all([
    new Promise<void>((r, j) => {
      dispatcher.once("connect", r);
      dispatcher.once("connect_error", j);
    }),
    new Promise<void>((r, j) => {
      citizen.once("connect", r);
      citizen.once("connect_error", j);
    }),
  ]);
  const envelope = new Promise<any>((r) =>
    dispatcher.on("event", (event) => {
      if (event.incidentId === incident.id) r(event);
    }),
  );
  const publicHint = new Promise<any>((r) => citizen.once("event", r));
  while (
    (
      await sql(
        "SELECT 1 FROM outbox_events WHERE delivered_at IS NULL AND aggregate_id=$1",
        [incident.id],
      )
    ).length
  )
    await tick();
  const event = await envelope;
  expect(event.simulation).toBe(true);
  expect(event.sequence).toBe(1);
  expect(event.safePayload.status).toBe("RECEIVED");
  const hint = await publicHint;
  expect(hint).toEqual({ type: "system.sync_required", simulation: true });
  expect(JSON.stringify(hint)).not.toContain("incidentId");
});
it("replaces a terminated notification connection and resumes authoritative realtime delivery", async () => {
  const pid = runtime.notifications.backendPid();
  expect(pid).toBeGreaterThan(0);
  await sql("SELECT pg_terminate_backend($1)", [pid]);
  await expect
    .poll(
      () => {
        const current = runtime.notifications.backendPid();
        return current !== null && current !== pid;
      },
      { timeout: 10000 },
    )
    .toBe(true);
  const response = await fetch("http://127.0.0.1:4200/api/v1/health");
  expect(response.ok).toBe(true);
  const socket = connect("http://127.0.0.1:4200", {
    extraHeaders: { Cookie: cookie },
    transports: ["websocket"],
    reconnection: false,
  });
  sockets.push(socket);
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  });
  const key = randomUUID();
  const result = await fetch("http://127.0.0.1:4200/api/v1/demo/incidents", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": key },
    body: JSON.stringify({
      client_request_id: key,
      simulation: true,
      category: "TRAFFIC",
      description: "Fictional event after notification reconnect",
      landmark: "Fictional recovery landmark",
      longitude: 4.556,
      latitude: 7.774,
    }),
  });
  const receipt = (await result.json()) as any;
  const id = (
    await sql("SELECT id FROM incidents WHERE public_reference=$1", [
      receipt.reference,
    ])
  )[0].id;
  const delivered = new Promise<any>((resolve) =>
    socket.on("event", (event) => {
      if (event.incidentId === id) resolve(event);
    }),
  );
  for (let batch = 0; batch < 100; batch++) {
    await tick();
    if (
      !(
        await sql(
          "SELECT 1 FROM outbox_events WHERE aggregate_id=$1 AND delivered_at IS NULL",
          [id],
        )
      ).length
    )
      break;
  }
  expect((await delivered).safePayload.status).toBe("RECEIVED");
});
