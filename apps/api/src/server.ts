import { createServer } from "node:http";
import { Server } from "socket.io";
import { app, sessionFromCookie } from "./app";
import { pool, sql } from "./db";
import { requireReceipt } from "./service";
import { subscribeToOutbox } from "./notifications";
export const server = createServer(app);
const allowedOrigins = (
  process.env.ALLOWED_ORIGINS ||
  "http://localhost:3000,http://localhost:5173,http://localhost:5174"
).split(",");
export const io = new Server(server, {
  addTrailingSlash: false,
  allowRequest: (req, callback) =>
    callback(
      null,
      !req.headers.origin || allowedOrigins.includes(req.headers.origin),
    ),
  cors: {
    origin: (
      process.env.ALLOWED_ORIGINS ||
      "http://localhost:3000,http://localhost:5173,http://localhost:5174"
    ).split(","),
    credentials: true,
  },
});
io.use(async (socket, next) => {
  try {
    const user = await sessionFromCookie(socket.request.headers.cookie);
    if (user) {
      socket.data.user = user;
      return next();
    }
    const { reference, receiptToken } = socket.handshake.auth;
    const incident = await requireReceipt(reference, receiptToken);
    socket.data.receipt = incident;
    next();
  } catch {
    next(new Error("AUTHENTICATION_REQUIRED"));
  }
});
io.on("connection", async (socket) => {
  try {
    const u = socket.data.user;
    if (u) {
      if (["dispatcher", "supervisor"].includes(u.role))
        socket.join("agency:" + u.agency_id);
      if (u.role === "responder") {
        const units = await sql(
          "SELECT unit_id FROM responder_unit_memberships WHERE user_id=$1 AND valid_from<=now() AND (valid_to IS NULL OR valid_to>now())",
          [u.id],
        );
        units.forEach((row) => socket.join("unit:" + row.unit_id));
      }
    } else socket.join("receipt:" + socket.data.receipt.id);
    socket.emit("system.sync_required", { simulation: true });
    const timer = setInterval(async () => {
      try {
        if (socket.data.user) {
          const current = await sessionFromCookie(
            socket.request.headers.cookie,
          );
          if (!current || current.id !== socket.data.user.id) {
            socket.disconnect(true);
            return;
          }
        } else
          await requireReceipt(
            socket.handshake.auth.reference,
            socket.handshake.auth.receiptToken,
          );
      } catch {
        socket.disconnect(true);
      }
    }, 60000);
    socket.on("disconnect", () => clearInterval(timer));
  } catch {
    socket.disconnect(true);
  }
});
const inFlight = new Set<Promise<void>>();
async function emitAuthorized(
  room: string,
  payload: any,
  agencyId: string,
  unitId?: string,
) {
  for (const socket of await io.in(room).fetchSockets()) {
    try {
      if (socket.data.user) {
        const current = await sessionFromCookie(
          socket.handshake.headers.cookie,
        );
        if (
          !current ||
          current.agency_id !== agencyId ||
          current.role !== socket.data.user.role
        ) {
          socket.disconnect(true);
          continue;
        }
        if (unitId) {
          const membership = await sql(
            "SELECT 1 FROM responder_unit_memberships WHERE user_id=$1 AND unit_id=$2 AND valid_from<=now() AND (valid_to IS NULL OR valid_to>now())",
            [current.id, unitId],
          );
          if (current.role !== "responder" || !membership.length) {
            socket.leave(room);
            continue;
          }
        } else if (!["dispatcher", "supervisor"].includes(current.role)) {
          socket.leave(room);
          continue;
        }
      } else {
        const receipt = await requireReceipt(
          socket.handshake.auth.reference,
          socket.handshake.auth.receiptToken,
        );
        if (room !== "receipt:" + receipt.id) {
          socket.disconnect(true);
          continue;
        }
      }
      socket.emit("event", payload);
    } catch {
      socket.disconnect(true);
    }
  }
}
async function publish(msg: any) {
  try {
    const outbox = (
      await sql(
        "SELECT o.*,i.agency_id FROM outbox_events o JOIN incidents i ON i.id=o.aggregate_id WHERE o.id=$1",
        [msg.payload],
      )
    )[0];
    if (!outbox) return;
    const settings = Object.fromEntries(
      (await sql("SELECT * FROM simulation_settings")).map((r) => [
        r.key,
        r.value,
      ]),
    );
    if (settings.drop_notifications) return;
    await emitAuthorized(
      "agency:" + outbox.agency_id,
      outbox.payload,
      outbox.agency_id,
    );
    const units = await sql(
      "SELECT DISTINCT unit_id FROM assignments WHERE incident_id=$1",
      [outbox.aggregate_id],
    );
    for (const unit of units)
      await emitAuthorized(
        "unit:" + unit.unit_id,
        outbox.payload,
        outbox.agency_id,
        unit.unit_id,
      );
    await emitAuthorized(
      "receipt:" + outbox.aggregate_id,
      {
        type: "system.sync_required",
        simulation: true,
      },
      outbox.agency_id,
    );
  } catch (e) {
    console.error(
      "Realtime notification failed",
      e instanceof Error ? e.message : "unknown",
    );
  }
}
export const notifications = await subscribeToOutbox(
  (msg) => {
    const work = publish(msg);
    inFlight.add(work);
    void work.finally(() => inFlight.delete(work));
  },
  () => io.emit("system.sync_required", { simulation: true }),
);
app.locals.realtimeReady = () => notifications.backendPid() !== null;
const port = Number(process.env.PORT || 4000);
server.listen(port, "0.0.0.0", () =>
  console.log(`NEXUS API listening on ${port}`),
);
let stopping = false;
export async function stop(exit = true) {
  if (stopping) return;
  stopping = true;
  process.removeListener("SIGTERM", onStop);
  process.removeListener("SIGINT", onStop);
  await notifications.close();
  await Promise.allSettled([...inFlight]);
  await new Promise<void>((resolve) => io.close(() => resolve()));
  await pool.end();
  if (exit) process.exit(0);
}
function onStop() {
  void stop();
}
process.on("SIGTERM", onStop);
process.on("SIGINT", onStop);
