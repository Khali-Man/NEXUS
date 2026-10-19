import { spawn, spawnSync } from "node:child_process";
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const production = process.argv.includes("--production");
const commands = [
  ["exec", "tsx", ...(production ? [] : ["watch"]), "apps/api/src/server.ts"],
  ["exec", "tsx", ...(production ? [] : ["watch"]), "apps/worker/src/index.ts"],
  ["--filter", "@nexus/cad-web", production ? "start" : "dev"],
  ["--filter", "@nexus/citizen-pwa", production ? "start" : "dev"],
  ["--filter", "@nexus/responder-pwa", production ? "start" : "dev"],
];
const children = commands.map((args) =>
  spawn(pnpm, args, {
    stdio: "inherit",
    detached: process.platform !== "win32",
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
  }),
);
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  children.forEach((p) => {
    if (!p.pid) return;
    try {
      if (process.platform === "win32")
        spawnSync("taskkill", ["/pid", String(p.pid), "/T", "/F"]);
      else process.kill(-p.pid, "SIGTERM");
    } catch {}
  });
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
children.forEach((p) =>
  p.on("exit", (code) => {
    if (code) {
      stop();
      process.exitCode = code;
    }
  }),
);
