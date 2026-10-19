# Verifiable research checkpoints

NEXUS uses Ed25519 (Node's maintained cryptographic implementation), SHA-256 event chains, and an explicit versioned signing domain `NEXUS_AUDIT_CHECKPOINT_V1\0`. Manual supervisor and scheduled worker checkpoints use the same code. Signing keys are independent of database credentials and receipt secrets. No real emergency records belong here.

## What is signed

One consistent PostgreSQL SELECT reads the scoped history. Every chain is verified before signing. Sorted incident heads (incident UUID, sequence, event hash) form a canonical SHA-256 root. The signed canonical payload binds product/simulation identity, version, checkpoint UUID, UTC creation time, agency scope, signer ID, root, all heads, actor/reason and previous signed checkpoint payload hash. A per-scope transaction lock serialises checkpoint creation. The signature and payload are inserted atomically; a trigger prohibits checkpoint updates/deletes through ordinary SQL. Legacy rows remain explicitly unsigned.

The database stores public signature metadata, never a private key. Signing fails with `503 AUDIT_SIGNING_UNAVAILABLE` if the key/config is missing, permissions are overly broad on Unix, trust mismatches, or the key is not active. No unsigned replacement is created. The worker reports a signing problem and continues ordinary outbox delivery. An invalid source chain prevents checkpoint creation.

## Key custody and rotation

`pnpm setup` or `pnpm audit:keygen` creates a unique Ed25519 key and public trust registry beneath ignored `.nexus/keys`. Unix directories use 0700 and private files 0600. On Windows apply and inspect ACLs as described in [Windows setup](WINDOWS_11.md). Never commit `.env`, signing config, private PEMs, local datasets or generated dependency trees. Back up keys encrypted under owner-controlled custody; loss prevents future signing but public keys still verify retained bundles.

The generated file signer is appropriate for a private research simulation. For a stronger multi-user deployment, isolate signing into an independently operated service/HSM/KMS supporting Ed25519, apply least-privilege identities, record access and require controlled approval for trust changes. A host administrator who controls both the application and file key can sign fabricated history. Moving keys into a KMS is an operational architecture change, not something this repository pretends to provision.

For planned rotation, stop API/worker and run `pnpm audit:keygen --rotate`. A fresh key ID is derived from its public SPKI DER fingerprint; the registry retains the old public key as `retired` with an issuance cutoff, and selects the new signer. Previously signed bundles remain verifiable within the retained validity window. Old private files are retained deliberately: archive or securely remove them according to your backup policy after verifying the switch. Restart services and distribute the updated **public-only** registry over an authenticated independent channel. Concurrent rotations are unsupported; serialise owner maintenance.

If a key is compromised, mark its registry entry `revoked`; both verifiers reject its signatures, including historical ones. Preserve the old registry for investigation, record the compromise/cutoff externally, rotate, and review affected records. A compromised private key can backdate a claimed timestamp, so validity windows alone cannot establish when an old signature was actually made. An external trusted timestamp/anchor would be required for stronger historical claims.

## Independent verification

Download a covered-history JSON bundle from supervisor → Audit integrity → Download verification bundle. Copy the public registry independently, authenticate its fingerprints with the owner, and run on a separate machine:

```sh
node tools/verify-checkpoint.mjs nexus-checkpoint.json trusted-public-keys.json
```

This verifier imports only Node standard-library modules; it does not call the application, database or its signing/verification functions. It recomputes canonical payload/root, checks the independent key's fingerprint/status/validity, verifies Ed25519, then verifies every event's full canonical hash, previous hash, sequence and signed head. Missing, duplicated, extra, rewritten or truncated covered history fails with exit status 1. Exit 0 reports both signature and history valid. API keys delivered by the same database as a bundle would not establish independent trust; the export intentionally does not nominate its own trusted public key.

`pnpm test` includes separate-process verifier tests against actual authenticated API exports, modified envelopes, invalid signatures, rehashed history, truncation, rotation, unknown/revoked keys, missing-key refusal and append-only storage. The supervisor UI distinguishes current signature verification, legacy unsigned rows and failures. Current full event chains are checked separately; an older signed bundle verifies the prefix it covers, not future events.

## Explicit trust limits

Signatures detect a database rewrite when an attacker lacks the private signing key and the verifier already holds authentic public keys/bundles. A database superuser can bypass SQL triggers; independently retained signatures still expose changes to covered history. No external immutable anchor or trusted timestamp service is configured. Deleting the newest checkpoints, replacing the entire trust registry, or suppressing bundles cannot be detected by a fresh verifier without an independently retained expected checkpoint/reference. Store exported bundles and expected checkpoint IDs/hashes in separate custody for that comparison. The signed previous-checkpoint hash supports that external comparison; a single bundle does not itself prove the entire checkpoint chain is present. A signature never proves an event happened in the physical world.
