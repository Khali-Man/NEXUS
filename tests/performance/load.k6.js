import http from "k6/http";
import { check } from "k6";
import exec from "k6/execution";
export const options = {
  scenarios: {
    synthetic: {
      executor: "shared-iterations",
      vus: 100,
      iterations: 500,
      maxDuration: "1m",
    },
  },
  thresholds: { checks: ["rate==1"], http_req_failed: ["rate==0"] },
};
export default function () {
  const id = `00000000-0000-4000-8000-${String(exec.scenario.iterationInTest + Number(__ENV.RUN_SEED || 1) * 100000).padStart(12, "0")}`;
  const response = http.post(
    (__ENV.BASE_URL || "http://127.0.0.1:4100") + "/api/v1/demo/incidents",
    JSON.stringify({
      client_request_id: id,
      simulation: true,
      category: "TRAFFIC",
      description: "Synthetic k6 load scenario. No real people.",
      landmark: "Fictional Olaiya benchmark",
      longitude: 4.5557,
      latitude: 7.7738,
    }),
    { headers: { "Content-Type": "application/json", "Idempotency-Key": id } },
  );
  check(response, {
    "server receipt committed": (r) =>
      r.status === 200 && r.json("status") === "RECEIVED",
    "capability issued": (r) => String(r.json("receiptToken")).length >= 40,
  });
}
