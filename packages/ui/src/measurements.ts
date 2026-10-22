export const measurementFields = [
  ["triaged_at", "assurance.triage"],
  ["offered_at", "assurance.offer"],
  ["accepted_at", "assurance.ack"],
  ["arrived_at", "assurance.arrival"],
] as const;

export function measurementSeconds(item: any, field: string): number | null {
  const start =
    field === "accepted_at" ? item.acknowledged_offer_at : item.created_at;
  const end = item[field];
  if (!start || !end) return null;
  const seconds = (Date.parse(end) - Date.parse(start)) / 1000;
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

export function measurementSummary(items: any[], field: string) {
  const values = items
    .map((i) => measurementSeconds(i, field))
    .filter((v): v is number => v !== null);
  return {
    measured: values.length,
    missing: items.length - values.length,
    mean: values.length
      ? values.reduce((a, b) => a + b, 0) / values.length
      : null,
  };
}
