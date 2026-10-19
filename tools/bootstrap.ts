import { randomBytes } from "node:crypto";
import {
  existsSync,
  copyFileSync,
  appendFileSync,
  readFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
if (!existsSync(".env")) copyFileSync(".env.example", ".env");
if (!/^RECEIPT_KEY=.+/m.test(readFileSync(".env", "utf8")))
  appendFileSync(
    ".env",
    "\nRECEIPT_KEY=" + randomBytes(32).toString("hex") + "\n",
  );
for (const args of [["db:up"], ["db:migrate"], ["db:seed"]]) {
  const p = spawnSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    args,
    { stdio: "inherit" },
  );
  if (p.status) process.exit(p.status);
}
