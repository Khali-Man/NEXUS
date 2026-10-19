// Independent verifier: Node's standard library only. No application imports or database access.
import { readFileSync } from "node:fs";
import { createHash, createPublicKey, verify } from "node:crypto";
const canonical = (v) =>
  v === null || typeof v !== "object"
    ? JSON.stringify(v)
    : Array.isArray(v)
      ? "[" + v.map(canonical).join(",") + "]"
      : "{" +
        Object.keys(v)
          .sort()
          .map((k) => JSON.stringify(k) + ":" + canonical(v[k]))
          .join(",") +
        "}";
const sha = (v) => createHash("sha256").update(v).digest("hex");
try {
  const bundle = JSON.parse(readFileSync(process.argv[2], "utf8"));
  // This registry must be obtained independently. A key delivered with a bundle is not a trust anchor.
  const registry = JSON.parse(readFileSync(process.argv[3], "utf8"));
  const c = bundle.checkpoint,
    p = c.signed_payload;
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  assert(registry.version === 1, "Unsupported trust registry version");
  assert(p && c.signature, "Unsigned checkpoint");
  const key = registry.keys.find((k) => k.id === p.keyId);
  assert(
    key && ["active", "retired"].includes(key.status),
    "Unknown or revoked key",
  );
  const pub = createPublicKey(key.publicKey);
  assert(
    pub.asymmetricKeyType === "ed25519" &&
      sha(pub.export({ type: "spki", format: "der" })) === key.fingerprint,
    "Key fingerprint mismatch",
  );
  const time = Date.parse(p.checkpointAt);
  const notBefore = Date.parse(key.notBefore),
    notAfter = key.notAfter ? Date.parse(key.notAfter) : Infinity;
  assert(
    Number.isFinite(time) &&
      Number.isFinite(notBefore) &&
      (Number.isFinite(notAfter) || notAfter === Infinity) &&
      time >= notBefore &&
      time <= notAfter,
    "Key outside validity window",
  );
  assert(
    p.version === 1 &&
      p.application === "NEXUS — Response Intelligence" &&
      p.simulation === true &&
      c.algorithm === "Ed25519",
    "Wrong signing context",
  );
  assert(
    p.checkpointId === c.id &&
      p.scope === c.scope &&
      p.keyId === c.signer_key_id &&
      p.checkpointAt === new Date(c.checkpoint_at).toISOString() &&
      p.rootHash === c.root_hash &&
      sha(canonical(p.heads)) === p.rootHash,
    "Envelope/root mismatch",
  );
  assert(
    verify(
      null,
      Buffer.from("NEXUS_AUDIT_CHECKPOINT_V1\0" + canonical(p)),
      pub,
      Buffer.from(c.signature, "base64"),
    ),
    "Invalid signature",
  );
  assert(
    Array.isArray(bundle.events),
    "History is required for integrity verification",
  );
  assert(
    new Set(p.heads.map((h) => h.incidentId)).size === p.heads.length,
    "Duplicate heads",
  );
  const included = new Set();
  for (const head of p.heads) {
    const events = bundle.events
      .filter((e) => e.incident_id === head.incidentId)
      .sort((a, b) => a.sequence - b.sequence);
    assert(
      events.length === head.sequence && events.length > 0,
      "Truncated history",
    );
    let previous = "0".repeat(64),
      sequence = 0;
    for (const event of events) {
      const { event_hash, ...data } = event;
      assert(
        event.sequence === ++sequence &&
          event.prev_hash === previous &&
          sha(canonical(data)) === event_hash,
        "History hash/sequence mismatch",
      );
      assert(!included.has(event.id), "Duplicate event");
      included.add(event.id);
      previous = event_hash;
    }
    assert(previous === head.eventHash, "History differs from signed head");
  }
  assert(included.size === bundle.events.length, "Unexpected events");
  console.log(
    JSON.stringify({
      signature: "VALID",
      history: "VALID",
      checkpointId: c.id,
      keyId: p.keyId,
      events: included.size,
      externallyAnchored: false,
    }),
  );
} catch (error) {
  console.error("CHECKPOINT_VERIFICATION_FAILED:", error.message);
  process.exitCode = 1;
}
