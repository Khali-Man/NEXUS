import { createServer } from "node:http";
import { Server } from "socket.io";
import { app, sessionFromCookie } from "./app";
import { pool, sql } from "./db";
import { requireReceipt } from "./service";
import { subscribeToOutbox } from "./notifications";
export const server = createServer(app);
export const io = new Server(server, {
  addTrailingSlash: false,
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
    io.to("agency:" + outbox.agency_id).emit("event", outbox.payload);
    const units = await sql(
      "SELECT DISTINCT unit_id FROM assignments WHERE incident_id=$1",
      [outbox.aggregate_id],
    );
    for (const unit of units)
      io.to("unit:" + unit.unit_id).emit("event", outbox.payload);
    io.to("receipt:" + outbox.aggregate_id).emit("event", {
      type: "system.sync_required",
      simulation: true,
    });
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
