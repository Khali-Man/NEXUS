# Security and privacy boundary

This local research simulator never summons assistance. It stores fictional fixtures, bounded synthetic locations and minimal device commands. No file upload, phone/SMS service, identity records, production secret-management UI or real unit telemetry is implemented.

| Threat                           | Implemented control                                                                                    | Assumption / limitation                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Role escalation / IDOR           | Server role/agency checks and field membership; SQL parameters; no arbitrary socket room joins         | Environment owner protects database access                                                    |
| Duplicate commands / concurrency | Actor/key fingerprint, transaction advisory locks, aggregate/unit row locks and partial unique indexes | Network/client retries retain original key/body                                               |
| Stale field command              | Expected version, live assignment and expiry rechecked; visible conflict queue                         | Client timestamps never prove physical arrival                                                |
| Receipt disclosure               | 256-bit capability, digest at rest, expiry, fragment removed, no referrer/analytics                    | A person holding a link can view its generalised timeline                                     |
| Password/session theft           | Scrypt+salt, HttpOnly/SameSite cookies, expiry, logout, login throttling                               | Use TLS/Secure cookies off loopback; demo credentials are public fictional defaults           |
| CSRF / XSS                       | Strict cookies, exact mutation-origin checks, React escaping, Helmet CSP, bounded JSON, no uploads     | Private deployment must preserve reverse-proxy headers and CSP                                |
| History modification             | Canonical chained SHA-256, append-only trigger, explicit correction lineage, checkpoints               | Unsigned/unanchored; database administrators remain inside trust boundary                     |
| Private data on shared device    | Only minimal field queue, clear on logout; no API caching                                              | Reasons must remain fictional; browser storage is not secure against local account compromise |
| False successful dispatch        | Central state only after API commit, explicit offers versus acceptance, queued/pending messages        | Reported arrival remains an assertion, not geofenced proof                                    |
| Research misuse                  | Persistent warnings, no official branding, no operational integrations                                 | No operational deployment authorisation or production privileged MFA pathway exists           |

No secret values belong in Git, general logs or screenshots. `.env` is ignored. Receipt derivation key rotation must accompany receipt/session invalidation appropriate to the research environment. Revoke sessions by expiry/deletion and change seeded passwords through a controlled administrative database operation; reseeding deliberately does not overwrite existing password hashes.

The application does not claim GDPR/NDPA certification, operational security certification, immutable history against privileged database owners, or independently signed external checkpoints. Real emergency-service use requires separate official governance, privacy assessment, MFA/identity integration, tested infrastructure, and field validation.

Next.js permits its framework inline bootstrap scripts in CSP; the built PWAs use self-only scripts. Both permit inline styles for MapLibre/React styling, block objects/framing and constrain form/base origins. This is a local demonstration policy, not a claim of nonce-enforced strict CSP or independent penetration testing.
