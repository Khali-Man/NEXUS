import { readFileSync, statSync } from "node:fs";
import {
  createPrivateKey,
  createPublicKey,
  createHash,
  sign,
  verify,
  randomUUID,
} from "node:crypto";
import type pg from "pg";
import {
  canonical,
  digest,
  verifyChain,
} from "../../../packages/domain/src/index";
import { Fault, normalizeEvent } from "./db";

export const signingDomain = "NEXUS_AUDIT_CHECKPOINT_V1\0";
export function trustedKeys() {
  return JSON.parse(
    readFileSync(
      process.env.AUDIT_TRUSTED_KEYS_FILE ||
        ".nexus/keys/trusted-public-keys.json",
      "utf8",
    ),
  );
}
export function signatureStatus(row: any, registry: any) {
  if (
    !row.signed_payload &&
    !row.signature &&
    !row.algorithm &&
    row.signer_key_id === "DEMO_UNSIGNED"
  )
    return "LEGACY_UNSIGNED";
  if (!row.signed_payload || !row.signature) return "INVALID_SIGNATURE";
  try {
    const p = row.signed_payload;
    if (registry.version !== 1) return "INVALID_KEY";
    const key = registry.keys.find((k: any) => k.id === p.keyId);
    if (!key) return "UNKNOWN_KEY";
    if (key.status === "revoked") return "REVOKED_KEY";
    if (!["active", "retired"].includes(key.status)) return "UNTRUSTED_KEY";
    const at = Date.parse(p.checkpointAt);
    const notBefore = Date.parse(key.notBefore);
    const notAfter = key.notAfter ? Date.parse(key.notAfter) : Infinity;
    if (
      !Number.isFinite(at) ||
      !Number.isFinite(notBefore) ||
      !(Number.isFinite(notAfter) || notAfter === Infinity) ||
      at < notBefore ||
      at > notAfter
    )
      return "KEY_OUTSIDE_VALIDITY";
    const pub = createPublicKey(key.publicKey);
    if (
      pub.asymmetricKeyType !== "ed25519" ||
      createHash("sha256")
        .update(pub.export({ type: "spki", format: "der" }))
        .digest("hex") !== key.fingerprint
    )
      return "INVALID_KEY";
    // Fingerprint is SHA-256 of raw DER, not the PEM presentation.
    if (
      p.version !== 1 ||
      p.application !== "NEXUS — Response Intelligence" ||
      p.simulation !== true ||
      row.algorithm !== "Ed25519" ||
      p.keyId !== row.signer_key_id ||
      p.checkpointId !== row.id ||
      p.scope !== row.scope ||
      p.checkpointAt !== new Date(row.checkpoint_at).toISOString() ||
      p.rootHash !== row.root_hash ||
      digest(canonical(p.heads)) !== p.rootHash
    )
      return "PAYLOAD_MISMATCH";
    return verify(
      null,
      Buffer.from(signingDomain + canonical(p)),
      pub,
      Buffer.from(row.signature, "base64"),
    )
      ? "SIGNATURE_VALID"
      : "INVALID_SIGNATURE";
  } catch {
    return "INVALID_SIGNATURE";
  }
}
function signer() {
  try {
    const config = JSON.parse(
      readFileSync(
        process.env.AUDIT_SIGNING_CONFIG || ".nexus/keys/signing.json",
        "utf8",
      ),
    );
    if (
      process.platform !== "win32" &&
      statSync(config.privateKeyFile).mode & 0o077
    )
      throw new Error("Private key permissions must be 0600");
    const privateKey = createPrivateKey(readFileSync(config.privateKeyFile));
    const key = trustedKeys().keys.find(
      (k: any) => k.id === config.keyId && k.status === "active",
    );
    if (
      privateKey.asymmetricKeyType !== "ed25519" ||
      !key ||
      !createPublicKey(privateKey).equals(createPublicKey(key.publicKey))
    )
      throw new Error("Signer/trust mismatch");
    return { keyId: config.keyId, privateKey };
  } catch {
    throw new Fault(503, "AUDIT_SIGNING_UNAVAILABLE");
  }
}
export async function createCheckpoint(
  db: pg.PoolClient,
  scope: string,
  reason: string,
  actorId: string | null,
) {
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
    "checkpoint:" + scope,
  ]);
  const signing = signer();
  // One SELECT supplies a consistent MVCC snapshot of the complete scoped event history.
  const rows = (
    await db.query(
      "SELECT e.* FROM incident_events e JOIN incidents i ON i.id=e.incident_id WHERE i.agency_id=$1 ORDER BY e.incident_id,e.sequence",
      [scope],
    )
  ).rows;
  const grouped = new Map<string, any[]>();
  for (const row of rows) {
    if (!grouped.has(row.incident_id)) grouped.set(row.incident_id, []);
    grouped.get(row.incident_id)!.push(normalizeEvent(row));
  }
  const heads = [...grouped].map(([incidentId, events]) => {
    const checked = verifyChain(events);
    if (!checked.valid) throw new Fault(409, "AUDIT_CHAIN_INVALID");
    return { incidentId, sequence: checked.count, eventHash: checked.rootHash };
  });
  const previous = (
    await db.query(
      "SELECT * FROM audit_checkpoints WHERE scope=$1 ORDER BY checkpoint_at DESC,id DESC LIMIT 1",
      [scope],
    )
  ).rows[0];
  const payload = {
    version: 1,
    application: "NEXUS — Response Intelligence",
    simulation: true,
    checkpointId: randomUUID(),
    checkpointAt: new Date(
      Math.max(
        Date.now(),
        previous ? new Date(previous.checkpoint_at).getTime() + 1 : 0,
      ),
    ).toISOString(),
    scope,
    keyId: signing.keyId,
    rootHash: digest(canonical(heads)),
    heads,
    reason,
    actorId,
    previousCheckpointHash: previous?.signed_payload
      ? digest(canonical(previous.signed_payload))
      : null,
  };
  const signature = sign(
    null,
    Buffer.from(signingDomain + canonical(payload)),
    signing.privateKey,
  ).toString("base64");
  const row = (
    await db.query(
      "INSERT INTO audit_checkpoints(id,checkpoint_at,scope,root_hash,signer_key_id,signature,verification_status,signed_payload,algorithm) VALUES($1,$2,$3,$4,$5,$6,'SIGNED_NOT_ANCHORED',$7,'Ed25519') RETURNING *",
      [
        payload.checkpointId,
        payload.checkpointAt,
        scope,
        payload.rootHash,
        payload.keyId,
        signature,
        payload,
      ],
    )
  ).rows[0];
  if (signatureStatus(row, trustedKeys()) !== "SIGNATURE_VALID")
    throw new Fault(503, "AUDIT_SIGNATURE_SELF_CHECK_FAILED");
  return row;
}
