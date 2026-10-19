import { generateKeyPairSync, createHash } from "node:crypto";
import "dotenv/config";
import {
  mkdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
  renameSync,
} from "node:fs";
import { resolve, dirname } from "node:path";
import { pathToFileURL } from "node:url";

export function ensureAuditKeys(rotate = false) {
  const configPath = resolve(
    process.env.AUDIT_SIGNING_CONFIG || ".nexus/keys/signing.json",
  );
  const trustPath = resolve(
    process.env.AUDIT_TRUSTED_KEYS_FILE ||
      ".nexus/keys/trusted-public-keys.json",
  );
  if (existsSync(configPath) && !rotate) return;
  mkdirSync(dirname(configPath), { recursive: true, mode: 0o700 });
  mkdirSync(dirname(trustPath), { recursive: true, mode: 0o700 });
  const registry = existsSync(trustPath)
    ? JSON.parse(readFileSync(trustPath, "utf8"))
    : { version: 1, keys: [] };
  const now = new Date().toISOString();
  if (existsSync(configPath)) {
    const old = JSON.parse(readFileSync(configPath, "utf8"));
    const entry = registry.keys.find((k: any) => k.id === old.keyId);
    if (!entry)
      throw new Error(
        "Active signing key is absent from trusted registry; refusing rotation",
      );
    entry.status = "retired";
    entry.notAfter = now;
  }
  const pair = generateKeyPairSync("ed25519");
  const publicKey = pair.publicKey
    .export({ type: "spki", format: "pem" })
    .toString();
  const fingerprint = createHash("sha256")
    .update(pair.publicKey.export({ type: "spki", format: "der" }))
    .digest("hex");
  const keyId = "ed25519-" + fingerprint.slice(0, 24);
  const privateKeyFile = resolve(dirname(configPath), keyId + ".pem");
  writeFileSync(
    privateKeyFile,
    pair.privateKey.export({ type: "pkcs8", format: "pem" }),
    { mode: 0o600, flag: "wx" },
  );
  registry.keys.push({
    id: keyId,
    publicKey,
    fingerprint,
    status: "active",
    notBefore: now,
    notAfter: null,
  });
  // Trust is installed before selecting the active signer. Old private files remain for owner-managed archival.
  writeFileSync(trustPath + ".tmp", JSON.stringify(registry, null, 2) + "\n", {
    mode: 0o600,
  });
  renameSync(trustPath + ".tmp", trustPath);
  writeFileSync(
    configPath + ".tmp",
    JSON.stringify({ keyId, privateKeyFile }, null, 2) + "\n",
    { mode: 0o600 },
  );
  renameSync(configPath + ".tmp", configPath);
  console.log(
    "Audit signing key installed:",
    keyId,
    "(private material was not logged)",
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  ensureAuditKeys(process.argv.includes("--rotate"));
