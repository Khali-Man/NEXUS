import { afterAll, it, expect } from "vitest";
import { createServer } from "node:http";
import { roadEstimate } from "../apps/api/src/routing";
const old = process.env.OSRM_BASE_URL;
afterAll(() => {
  if (old === undefined) delete process.env.OSRM_BASE_URL;
  else process.env.OSRM_BASE_URL = old;
});
it("uses longitude-first OSRM roads, preserves provenance and coalesces repeated route lookups", async () => {
  let calls = 0,
    path = "";
  const server = createServer((req, res) => {
    calls++;
    path = req.url!;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        code: "Ok",
        waypoints: [{ distance: 12 }, { distance: 18 }],
        routes: [
          {
            duration: 165.4,
            distance: 1425,
            geometry: {
              type: "LineString",
              coordinates: [
                [4.553, 7.773],
                [4.5557, 7.7738],
              ],
            },
          },
        ],
      }),
    );
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  process.env.OSRM_BASE_URL = `http://127.0.0.1:${(server.address() as any).port}`;
  try {
    const values = await Promise.all(
      Array.from({ length: 8 }, () =>
        roadEstimate([4.553, 7.773], [4.5557, 7.7738]),
      ),
    );
    expect(calls).toBe(1);
    expect(path).toContain("4.553,7.773;4.5557,7.7738");
    expect(values[0]).toMatchObject({
      eta_seconds: 165,
      route_distance_m: 1425,
      eta_source: "OSRM_OSM_CAR",
      traffic_aware: false,
      uncertainty: "MODEL_ESTIMATE_NO_LIVE_TRAFFIC",
    });
    expect(values[0].route_geometry.coordinates).toHaveLength(2);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});
it("returns honest unavailable estimates on no-route, malformed data, excessive snapping, outages and invalid coverage", async () => {
  for (const response of [
    { code: "NoRoute", routes: [] },
    {
      code: "Ok",
      waypoints: [{ distance: 999 }, { distance: 1 }],
      routes: [
        {
          duration: 10,
          distance: 100,
          geometry: {
            type: "LineString",
            coordinates: [
              [4.553, 7.773],
              [4.5557, 7.7738],
            ],
          },
        },
      ],
    },
    {},
  ]) {
    const server = createServer((_req, res) =>
      res.end(JSON.stringify(response)),
    );
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    process.env.OSRM_BASE_URL = `http://127.0.0.1:${(server.address() as any).port}`;
    try {
      expect(
        await roadEstimate([4.553, 7.773], [4.5557, 7.7738]),
      ).toMatchObject({
        eta_seconds: null,
        eta_source: "UNAVAILABLE",
        route_reason: "NO_RELIABLE_ROUTE",
      });
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  }
  process.env.OSRM_BASE_URL = "http://127.0.0.1:1";
  expect(
    (await roadEstimate([4.553, 7.773], [4.5557, 7.7738])).eta_seconds,
  ).toBeNull();
  expect(
    (await roadEstimate([7.773, 4.553], [4.5557, 7.7738])).route_reason,
  ).toBe("OUTSIDE_COVERAGE");
  delete process.env.OSRM_BASE_URL;
  expect(
    (await roadEstimate([4.553, 7.773], [4.5557, 7.7738])).route_reason,
  ).toBe("NOT_CONFIGURED");
});
