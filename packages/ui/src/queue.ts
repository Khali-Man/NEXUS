export type QueuedCommand = {
  id: string;
  assignmentId: string;
  action: string;
  expected_version: number;
  reason: string;
  client_occurred_at: string;
  state:
    "QUEUED" | "REJECTED_CONFLICT" | "FAILED_RETRYABLE" | "SENT_UNCONFIRMED";
  error?: string;
};
const KEY = "nexus-field-outbox-v1";
export function loadQueue(): QueuedCommand[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}
export function saveQueue(queue: QueuedCommand[]) {
  localStorage.setItem(KEY, JSON.stringify(queue));
  window.dispatchEvent(new Event("nexus-queue"));
}
export function clearQueue() {
  localStorage.removeItem(KEY);
  localStorage.removeItem("nexus-field-identity");
  sessionStorage.removeItem("nexus-sync-cursor");
  window.dispatchEvent(new Event("nexus-queue"));
}
