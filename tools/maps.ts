import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  renameSync,
} from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
const directory = resolve(".nexus/maps");
const image =
  "ghcr.io/project-osrm/osrm-backend@sha256:855614a38f464b0558a2ad6eaa7cb8c139f39887da9b38b485ce453c6e6e6124";
mkdirSync(directory, { recursive: true });
const mode = process.argv[2];
const run = (program: string, args: string[]) => {
  const result = spawnSync(program, args, { stdio: "inherit" });
  if (result.error || result.status !== 0)
    throw new Error(program + " failed; no ready dataset was selected");
};
if (mode === "download") {
  // Public roads only. This never sends incident/unit locations or citizen narratives.
  const bbox = "7.65,4.45,7.90,4.70";
  const base = "https://overpass-api.de/api/interpreter";
  const download = (query: string, file: string) =>
    run(process.platform === "win32" ? "curl.exe" : "curl", [
      "--fail",
      "--show-error",
      "--location",
      "--max-time",
      "180",
      "--get",
      "--data-urlencode",
      "data=" + query,
      "--output",
      resolve(directory, file + ".tmp"),
      base,
    ]);
  download(
    `[out:json][timeout:120];way[highway](${bbox});out geom;`,
    "roads.json",
  );
  const data = JSON.parse(
    readFileSync(resolve(directory, "roads.json.tmp"), "utf8"),
  );
  if (data.remark || !data.elements?.length)
    throw new Error("Overpass returned no complete dataset");
  const roads = {
    type: "FeatureCollection",
    features: data.elements
      .filter((e: any) => e.type === "way" && e.geometry?.length > 1)
      .map((e: any) => ({
        type: "Feature",
        id: e.id,
        properties: { highway: e.tags.highway, name: e.tags.name || "" },
        geometry: {
          type: "LineString",
          coordinates: e.geometry.map((p: any) => [p.lon, p.lat]),
        },
      })),
  };
  download(
    `[out:xml][timeout:120];way[highway](${bbox});(._;>;);out body;`,
    "osogbo.osm",
  );
  const xml = readFileSync(resolve(directory, "osogbo.osm.tmp"));
  if (
    !xml.includes(Buffer.from("<node ")) ||
    xml.includes(Buffer.from("<remark>"))
  )
    throw new Error("Incomplete OSM extract");
  renameSync(
    resolve(directory, "osogbo.osm.tmp"),
    resolve(directory, "osogbo.osm"),
  );
  writeFileSync(
    resolve(directory, "osogbo-roads.geojson.tmp"),
    JSON.stringify(roads),
  );
  renameSync(
    resolve(directory, "osogbo-roads.geojson.tmp"),
    resolve(directory, "osogbo-roads.geojson"),
  );
  writeFileSync(
    resolve(directory, "metadata.json"),
    JSON.stringify(
      {
        downloadedAt: new Date().toISOString(),
        osmBaseTimestamp: data.osm3s?.timestamp_osm_base || null,
        source: base,
        bbox,
        license: "ODbL-1.0",
        attribution: "© OpenStreetMap contributors",
        osmSha256: createHash("sha256").update(xml).digest("hex"),
        ways: roads.features.length,
      },
      null,
      2,
    ),
  );
  console.log("Public Osogbo OSM roads installed:", roads.features.length);
} else if (mode === "prepare") {
  if (!existsSync(resolve(directory, "osogbo.osm")))
    throw new Error("Run pnpm maps:download first");
  // Stop only this optional routing service before replacing its graph files.
  run("docker", [
    "compose",
    "-f",
    "infra/docker-compose.yml",
    "--profile",
    "routing",
    "stop",
    "routing",
  ]);
  for (const args of [
    ["osrm-extract", "-p", "/opt/car.lua", "/data/osogbo.osm"],
    ["osrm-partition", "/data/osogbo.osrm"],
    ["osrm-customize", "/data/osogbo.osrm"],
  ])
    run("docker", ["run", "--rm", "-v", directory + ":/data", image, ...args]);
  console.log(
    "OSRM graph prepared; start with pnpm maps:up. Set OSRM_BASE_URL=http://127.0.0.1:5001 and ROUTING_DATA_VERSION to metadata.json's osmSha256.",
  );
} else throw new Error("Use download or prepare");
