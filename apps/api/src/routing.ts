import { z } from "zod";
const point = z.tuple([
  z.number().min(4.45).max(4.7),
  z.number().min(7.65).max(7.9),
]);
const resultSchema = z.object({
  code: z.literal("Ok"),
  waypoints: z
    .array(z.object({ distance: z.number().nonnegative().max(200) }))
    .length(2),
  routes: z
    .array(
      z.object({
        duration: z.number().positive().max(86400),
        distance: z.number().positive().max(100000),
        geometry: z.object({
          type: z.literal("LineString"),
          coordinates: z.array(point).min(2).max(10000),
        }),
      }),
    )
    .min(1),
});
const cache = new Map<string, { until: number; value: any }>();
const pending = new Map<string, Promise<any>>();
const unavailable = (reason: string) => ({
  eta_seconds: null,
  eta_source: "UNAVAILABLE",
  route_distance_m: null,
  route_geometry: null,
  route_reason: reason,
  estimate_at: new Date().toISOString(),
  traffic_aware: false,
  uncertainty: "UNAVAILABLE",
});
export async function roadEstimate(
  from: [number, number],
  to: [number, number],
) {
  if (!point.safeParse(from).success || !point.safeParse(to).success)
    return unavailable("OUTSIDE_COVERAGE");
  const base = process.env.OSRM_BASE_URL;
  if (!base) return unavailable("NOT_CONFIGURED");
  const dataset =
    process.env.ROUTING_DATA_VERSION || "UNSPECIFIED_OSM_SNAPSHOT";
  const key = base + dataset + JSON.stringify([from, to]);
  const hit = cache.get(key);
  if (hit && hit.until > Date.now()) return hit.value;
  if (pending.has(key)) return pending.get(key);
  const task = (async () => {
    let value;
    try {
      const url = new URL(base);
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password
      )
        throw new Error("Invalid provider URL");
      url.pathname =
        url.pathname.replace(/\/$/, "") +
        "/route/v1/driving/" +
        from.join(",") +
        ";" +
        to.join(",");
      url.search =
        "overview=full&geometries=geojson&steps=false&radiuses=200;200";
      const response = await fetch(url, {
        signal: AbortSignal.timeout(1500),
        redirect: "error",
      });
      if (!response.ok || !response.body)
        throw new Error("Provider unavailable");
      const reader = response.body.getReader();
      let size = 0;
      const chunks = [];
      try {
        while (true) {
          const { done, value: part } = await reader.read();
          if (done) break;
          size += part.length;
          if (size > 512000) throw new Error("Oversized route");
          chunks.push(Buffer.from(part));
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
      const parsed = resultSchema.parse(
        JSON.parse(Buffer.concat(chunks).toString("utf8")),
      );
      const route = parsed.routes[0];
      value = {
        eta_seconds: Math.round(route.duration),
        eta_source: "OSRM_OSM_CAR",
        route_distance_m: Math.round(route.distance),
        route_geometry: route.geometry,
        route_reason: null,
        estimate_at: new Date().toISOString(),
        traffic_aware: false,
        uncertainty: "MODEL_ESTIMATE_NO_LIVE_TRAFFIC",
        routing_data_version: dataset,
        snap_distances_m: parsed.waypoints.map((w) => Math.round(w.distance)),
      };
    } catch {
      value = unavailable("NO_RELIABLE_ROUTE");
    }
    if (cache.size >= 256) cache.delete(cache.keys().next().value!);
    cache.set(key, {
      until: Date.now() + (value.eta_seconds === null ? 10000 : 120000),
      value,
    });
    return value;
  })();
  pending.set(key, task);
  try {
    return await task;
  } finally {
    pending.delete(key);
  }
}
