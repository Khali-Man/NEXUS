import "dotenv/config";
import { spawn, spawnSync } from "node:child_process";
import { writeFile, mkdir } from "node:fs/promises";
const url = new URL(
  process.env.DATABASE_URL ||
    "postgresql://nexus:nexus-local-only@127.0.0.1:55432/nexus",
);
url.pathname = "/nexus_bench";
const child = spawn(
  process.execPath,
  ["node_modules/tsx/dist/cli.mjs", "apps/api/src/server.ts"],
  {
    env: {
      ...process.env,
      DATABASE_URL: url.href,
      PORT: "4100",
      RATE_LIMIT_PER_MINUTE: "50000",
    },
    stdio: "ignore",
    detached: process.platform !== "win32",
  },
);
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await fetch("http://127.0.0.1:4100/api/v1/health")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!ready)
    throw new Error(
      "Benchmark API did not start; run pnpm test:performance first to prepare nexus_bench.",
    );
  const k6 = spawn(
    "docker",
    [
      "run",
      "--rm",
      "--user",
      "0:0",
      "--network",
      "host",
      "-e",
      "RUN_SEED=" + String(Date.now() % 10000000),
      "-v",
      process.cwd() + "/tests/performance:/scripts:ro",
      "grafana/k6@sha256:3ddc8b1a33a2c3d8edc6e99b6a762ae36cba08788463458f5e6a7703e14eb77d",
      "run",
      "/scripts/load.k6.js",
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let output = "";
  k6.stdout.on("data", (b) => {
    output += b.toString();
    process.stdout.write(b);
  });
  k6.stderr.on("data", (b) => {
    output += b.toString();
    process.stderr.write(b);
  });
  const code = await new Promise<number>((resolve) =>
    k6.on("exit", (c) => resolve(c || 0)),
  );
  await mkdir("docs/results", { recursive: true });
  await writeFile("docs/results/k6.txt", output);
  process.exitCode = code;
} finally {
  if (child.pid) {
    try {
      if (process.platform === "win32")
        spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"]);
      else process.kill(-child.pid, "SIGTERM");
    } catch {}
  }
}
