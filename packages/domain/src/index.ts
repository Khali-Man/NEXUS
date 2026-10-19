import { createHash } from "node:crypto";
export const statuses = [
  "RECEIVED",
  "TRIAGED",
  "WAITING_FOR_UNIT",
  "OFFERED",
  "ACCEPTED",
  "EN_ROUTE_REPORTED",
  "ARRIVAL_REPORTED",
  "RESOLVED",
  "CLOSED",
  "CANCELLED",
] as const;
export type Status = (typeof statuses)[number];
export type Role = "dispatcher" | "responder" | "supervisor" | "admin";
export const edges: Record<Status, Status[]> = {
  RECEIVED: ["TRIAGED", "CANCELLED"],
  TRIAGED: ["WAITING_FOR_UNIT", "CANCELLED"],
  WAITING_FOR_UNIT: ["OFFERED", "CANCELLED"],
  OFFERED: ["ACCEPTED", "WAITING_FOR_UNIT", "CANCELLED"],
  ACCEPTED: ["EN_ROUTE_REPORTED", "WAITING_FOR_UNIT"],
  EN_ROUTE_REPORTED: ["ARRIVAL_REPORTED", "WAITING_FOR_UNIT"],
  ARRIVAL_REPORTED: ["RESOLVED", "WAITING_FOR_UNIT"],
  RESOLVED: ["CLOSED"],
  CLOSED: [],
  CANCELLED: [],
};
export function canTransition(from: Status, to: Status) {
  return edges[from].includes(to);
}
export function canonical(value: any): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  return (
    "{" +
    Object.keys(value)
      .sort()
      .map((k) => JSON.stringify(k) + ":" + canonical(value[k]))
      .join(",") +
    "}"
  );
}
export function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export function eventHash(event: any) {
  const { event_hash: _hash, ...data } = event;
  return digest(canonical(data));
}
export function verifyChain(events: any[]) {
  let previous = "0".repeat(64);
  let seq = 0;
  for (const e of events) {
    if (
      e.prev_hash !== previous ||
      e.sequence !== ++seq ||
      eventHash(e) !== e.event_hash
    )
      return { valid: false, failedSequence: e.sequence, count: events.length };
    previous = e.event_hash;
  }
  return { valid: true, rootHash: previous, count: events.length };
}
export function safeStatus(s: Status) {
  return s;
}
