import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  copyFileSync,
  rmSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { roadEstimate } from "../../apps/api/src/routing";
const directory = mkdtempSync(join(tmpdir(), "nexus-osrm-"));
const name = "nexus-routing-test-" + process.pid;
const image =
  "ghcr.io/project-osrm/osrm-backend@sha256:855614a38f464b0558a2ad6eaa7cb8c139f39887da9b38b485ce453c6e6e6124";
const run = (args: string[]) => {
  const r = spawnSync("docker", args, { encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout || "Docker failed");
  return r.stdout.trim();
};
try {
  copyFileSync(
    "tests/routing/fictional-network.osm",
    join(directory, "fixture.osm"),
  );
  for (const args of [
    ["osrm-extract", "-p", "/opt/car.lua", "/data/fixture.osm"],
    ["osrm-partition", "/data/fixture.osrm"],
    ["osrm-customize", "/data/fixture.osrm"],
  ])
    run(["run", "--rm", "-v", directory + ":/data", image, ...args]);
  run([
    "run",
    "-d",
    "--rm",
    "--name",
    name,
    "-p",
    "127.0.0.1::5000",
    "-v",
    directory + ":/data:ro",
    image,
    "osrm-routed",
    "--algorithm",
    "mld",
    "/data/fixture.osrm",
  ]);
  const port = run(["port", name, "5000/tcp"]).split(":").at(-1)!;
  process.env.OSRM_BASE_URL = "http://127.0.0.1:" + port;
  process.env.ROUTING_DATA_VERSION = "FICTIONAL_ENGINE_TEST_ONLY";
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      if (
        (
          await fetch(
            process.env.OSRM_BASE_URL + "/nearest/v1/driving/4.553,7.773",
          )
        ).ok
      ) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  assert(ready, "OSRM did not become ready");
  const forward = await roadEstimate([4.553, 7.773], [4.556, 7.773]);
  const reverse = await roadEstimate([4.556, 7.773], [4.553, 7.773]);
  assert(forward.eta_seconds > 0);
  assert(
    reverse.route_distance_m > forward.route_distance_m * 2,
    "One-way return must follow the fictional road loop",
  );
  assert.equal(forward.traffic_aware, false);
  run(["stop", name]);
  const offline = await roadEstimate([4.553, 7.774], [4.556, 7.775]);
  assert.equal(offline.eta_seconds, null);
  const results = {
    timestamp: new Date().toISOString(),
    image,
    fixture:
      "fictional-network.osm (original test geometry, not real Osogbo roads)",
    forwardMetres: forward.route_distance_m,
    reverseMetres: reverse.route_distance_m,
    forwardSeconds: forward.eta_seconds,
    oneWayConstraintVerified: true,
    serviceOutageFallbackVerified: true,
    realOsogboDataVerified: false,
  };
  mkdirSync("docs/results", { recursive: true });
  writeFileSync(
    "docs/results/routing-engine.json",
    JSON.stringify(results, null, 2) + "\n",
  );
  console.log(JSON.stringify(results, null, 2));
} finally {
  spawnSync("docker", ["rm", "-f", name], { stdio: "ignore" });
  rmSync(directory, { recursive: true, force: true });
}
