import { describe, it, expect } from "vitest";
import {
  measurementSeconds,
  measurementSummary,
} from "../packages/ui/src/measurements";
describe("honest measured intervals", () => {
  const received = "2026-10-20T10:00:00Z";
  it("uses the acknowledged offer, not an earlier declined offer", () => {
    expect(
      measurementSeconds(
        {
          created_at: received,
          offered_at: received,
          acknowledged_offer_at: "2026-10-20T10:04:00Z",
          accepted_at: "2026-10-20T10:04:30Z",
        },
        "accepted_at",
      ),
    ).toBe(30);
    expect(
      measurementSeconds(
        {
          created_at: received,
          offered_at: received,
          accepted_at: "2026-10-20T10:04:30Z",
        },
        "accepted_at",
      ),
    ).toBeNull();
  });
  it("counts gaps and excludes missing, invalid and negative intervals from means", () => {
    expect(
      measurementSummary(
        [
          { created_at: received, triaged_at: "2026-10-20T10:00:00Z" },
          { created_at: received, triaged_at: "2026-10-20T10:01:00Z" },
          { created_at: received, triaged_at: null },
          { created_at: received, triaged_at: "invalid" },
          { created_at: received, triaged_at: "2026-10-20T09:59:59Z" },
        ],
        "triaged_at",
      ),
    ).toEqual({ measured: 2, missing: 3, mean: 30 });
    expect(measurementSummary([], "triaged_at")).toEqual({
      measured: 0,
      missing: 0,
      mean: null,
    });
  });
});
