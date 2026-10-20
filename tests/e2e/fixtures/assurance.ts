// Visual-test data only. Functional journeys continue to use the real API/database.
// Sixteen stable rows keep the existing populated-table baseline independent of
// how many fictional incidents previous tests left in a developer or CI database.
export const assuranceVisualMetrics = {
  items: Array.from({ length: 16 }, (_, index) => {
    const stage = index % 5;
    const created = Date.parse("2026-10-19T10:00:00.000Z") + index * 60000;
    const at = (seconds: number) =>
      new Date(created + seconds * 1000).toISOString();
    return {
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      public_reference:
        "NXS-" + (index + 1).toString(16).toUpperCase().padStart(10, "0"),
      created_at: at(0),
      status: [
        "RECEIVED",
        "TRIAGED",
        "OFFERED",
        "ACCEPTED",
        "ARRIVAL_REPORTED",
      ][stage],
      triaged_at: stage >= 1 ? at(30) : null,
      offered_at: stage >= 2 ? at(60) : null,
      accepted_at: stage >= 3 ? at(90) : null,
      arrived_at: stage >= 4 ? at(180) : null,
    };
  }),
  definitions: {
    triage: "Server received to human triage",
    offer: "Server received to offered",
    acknowledgement: "Offer to unit acknowledgement",
    arrival:
      "Server received to reported arrival; not verified physical arrival",
  },
  sampleSize: 16,
};
