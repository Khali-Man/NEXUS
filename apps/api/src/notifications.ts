import pg from "pg";
import { connectionString } from "./db";
/** A dedicated LISTEN connection is replaceable; persisted events stay authoritative. */
export async function subscribeToOutbox(
  onMessage: (message: pg.Notification) => void,
  onRecovered: () => void,
) {
  let client: pg.Client | null = null,
    backendPid: number | null = null,
    closing = false,
    connecting = false,
    attempt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  function retry() {
    if (closing || timer) return;
    timer = setTimeout(
      () => {
        timer = undefined;
        void connect(false);
      },
      Math.min(5000, 500 * 2 ** Math.min(attempt++, 4)),
    );
  }
  async function connect(initial: boolean) {
    if (closing || connecting) return;
    connecting = true;
    const next = new pg.Client({
      connectionString,
      application_name: "nexus-realtime-listener",
      connectionTimeoutMillis: 5000,
    });
    client = next;
    function lost() {
      if (client !== next) return;
      client = null;
      backendPid = null;
      void next.end().catch(() => {});
      retry();
    }
    next.on("error", lost);
    next.on("end", lost);
    try {
      await next.connect();
      await next.query("LISTEN nexus_events");
      backendPid = (await next.query("SELECT pg_backend_pid() AS pid")).rows[0]
        .pid;
      if (closing) {
        await next.end();
        return;
      }
      next.on("notification", onMessage);
      attempt = 0;
      onRecovered();
    } catch (error) {
      if (client === next) {
        client = null;
        backendPid = null;
      }
      await next.end().catch(() => {});
      if (initial) throw error;
      retry();
    } finally {
      connecting = false;
    }
  }
  await connect(true);
  return {
    backendPid: () => backendPid,
    async close() {
      closing = true;
      if (timer) clearTimeout(timer);
      const current = client;
      client = null;
      backendPid = null;
      if (current) {
        current.removeAllListeners("notification");
        await current.end().catch(() => {});
      }
    },
  };
}
