# Git preservation and review

At the start of this review, local branch `work` pointed to `70859bd917bc28408aea90a4b71ac06adcbab6c0` (the original two specification uploads). All 99 implementation/configuration/evidence files were untracked. No implementation commit was on main; the owner's observation that README and verification files were absent there was correct.

A new branch, **`review/nexus-integrated-product`**, preserves the work without changing main:

- `44a98ef1cb7dfd6828fb72d9bf414fa0a5c614c3`: preserves the integrated application, specifications, migrations, tests, configuration and prior evidence.
- `b82a1c4`: adds local OSM/OSRM routing, Ed25519 signed checkpoints, independent verification and Windows documentation.
- A subsequent verification commit records the final tests, screenshots and small verification hardening. Read the authoritative latest SHA with `git rev-parse HEAD` or the branch link below; this document avoids claiming its own not-yet-created commit hash.

[Browse the pushed branch](https://github.com/Khali-Man/NEXUS/tree/review/nexus-integrated-product) or [review its comparison with main](https://github.com/Khali-Man/NEXUS/compare/main...review/nexus-integrated-product?expand=1). The comparison is **not an existing pull request**. No force push, merge, existing-branch rewrite or original-specification edit was performed.

The prepared PR description is [PR_DESCRIPTION.md](PR_DESCRIPTION.md). This session attempted:

```sh
gh pr create --repo Khali-Man/NEXUS --base main --head review/nexus-integrated-product --title "Deliver integrated NEXUS research simulation with routing and signed audit checkpoints" --body-file docs/PR_DESCRIPTION.md
```

The cloud egress proxy rejected `POST https://api.github.com/graphql` with **Forbidden**. Git HTTPS read/push works; GitHub API access is separately blocked. No PR number/link was returned, so no PR is claimed. The environment network draft adds `api.github.com`, `overpass-api.de` and `download.geofabrik.de` while preserving the package-manager preset. Review/save/publish those settings, then rerun the command (checking for an existing PR first if another reviewer created one). No new secret was requested: the existing injected authentication must be tested once API access is available.

Secret-pattern/path review excluded private keys, actual `.env`, local map graphs, PostgreSQL volumes, generated dependencies/builds, caches and Playwright traces. The tracked `.env.example` contains only intentionally public fictional local defaults. Five committed screenshots contain fictional accounts/records and visible simulation notices. Pattern scans are useful checks, not a claim of independent secret/security certification.
