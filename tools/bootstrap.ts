import { randomBytes } from "node:crypto";
import {
  existsSync,
  copyFileSync,
  appendFileSync,
  readFileSync,
  chmodSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { ensureAuditKeys } from "./audit-keygen";
if (!existsSync(".env")) copyFileSync(".env.example", ".env");
if (!/^RECEIPT_KEY=.+/m.test(readFileSync(".env", "utf8")))
  appendFileSync(
    ".env",
    "\nRECEIPT_KEY=" + randomBytes(32).toString("hex") + "\n",
  );
if (process.platform !== "win32") chmodSync(".env", 0o600);
ensureAuditKeys();
for (const args of [["db:up"], ["db:migrate"], ["db:seed"]]) {
  if (!process.env.npm_execpath) throw new Error("Run through pnpm setup");
  const p = spawnSync(process.execPath, [process.env.npm_execpath, ...args], {
    stdio: "inherit",
  });
  if (p.error || p.status !== 0) process.exit(p.status || 1);
}
