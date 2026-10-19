import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { Server } from "socket.io";
import { readFile, writeFile } from "node:fs/promises";
const server = createServer((req, res) => {
  req.on("data", () => {});
  req.on("end", () => {
    const reference = "BASE-" + randomUUID();
    io.emit("incident", { reference, status: "RECEIVED" });
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ reference, status: "RECEIVED" }));
  });
});
const io = new Server(server);
await new Promise<void>((r) => server.listen(4102, "127.0.0.1", r));
const results: any[] = [];
try {
  for (const concurrency of [100, 500, 1000])
    for (const seed of [1, 2, 3, 4, 5]) {
      const start = performance.now();
      const requests = await Promise.all(
        Array.from({ length: concurrency }, async () => {
          const start = performance.now();
          const r = await fetch("http://127.0.0.1:4102", {
            method: "POST",
            body: JSON.stringify({ simulation: true }),
          });
          await r.json();
          return { status: r.status, ms: performance.now() - start };
        }),
      );
      const latencies = requests.map((r) => r.ms).sort((a, b) => a - b);
      results.push({
        concurrency,
        seed,
        medianMs: latencies[Math.floor(concurrency * 0.5)],
        p95Ms: latencies[Math.floor(concurrency * 0.95)],
        elapsedMs: performance.now() - start,
        apiErrors: requests.filter((r) => r.status !== 200).length,
        persistence: false,
      });
    }
  await writeFile(
    "artifacts/baseline-load-results.json",
    JSON.stringify(results, null, 2),
  );
  const report = JSON.parse(
    await readFile("artifacts/benchmark-results.json", "utf8"),
  );
  for (const row of report.load)
    row.baseline = results.find(
      (r) => r.concurrency === row.concurrency && r.seed === row.seed,
    );
  report.limitations.push(
    "Baseline load was remeasured separately after correcting an HTTP-status measurement field collision; outage measurements remain from the comparative run.",
  );
  await writeFile(
    "artifacts/benchmark-results.json",
    JSON.stringify(report, null, 2),
  );
} finally {
  io.close();
  server.close();
}
