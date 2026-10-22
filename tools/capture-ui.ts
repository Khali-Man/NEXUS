import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

// Unmocked fictional server data. Run against an already started production build.
const label = process.argv[2];
if (!["before", "after"].includes(label))
  throw new Error("Use before or after");
const output = `docs/screenshots/ui-polish/${label}`;
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const captures: object[] = [];
try {
  for (const [name, role, port, path] of [
    ["citizen", "", 5173, "/"],
    ["dispatcher", "dispatcher", 3000, "/cad/live"],
    ["responder", "responder", 5174, "/responder"],
    ["supervisor", "supervisor", 3000, "/assurance"],
    ["administrator", "admin", 3000, "/simulator"],
  ] as const) {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    const base = `http://localhost:${port}`;
    if (role) {
      await page.goto(
        base + (role === "responder" ? "/responder/login" : "/login"),
      );
      await page.getByLabel("Demo username").fill(role);
      await page
        .getByLabel("Password", { exact: true })
        .fill(process.env.DEMO_PASSWORD || "Nexus-Demo-2026!");
      await page.getByRole("button", { name: "Sign in to workspace" }).click();
      await page.waitForURL("**" + (role === "dispatcher" ? "/cad" : path));
    }
    for (const [width, height] of [
      [1440, 900],
      [768, 1024],
      [role === "responder" ? 390 : 375, role === "responder" ? 844 : 812],
    ]) {
      await page.setViewportSize({ width, height });
      await page.goto(base + path);
      await page.locator("h1").first().waitFor();
      if (role === "admin")
        await page.locator(".scenario-card").first().waitFor();
      if (role === "supervisor")
        await page.locator("tbody tr").first().waitFor();
      if (role === "dispatcher") await page.locator(".map-label").waitFor();
      if (role === "responder")
        await page.waitForResponse(
          (r) => r.url().includes("/responder/assignments") && r.ok(),
        );
      await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);
      });
      const file = `${name}-${width}.png`;
      await page.screenshot({
        path: `${output}/${file}`,
        fullPage: true,
        animations: "disabled",
      });
      captures.push({ name, path, width, height, file });
      console.log(`${label}: ${file}`);
    }
    await context.close();
  }
  await writeFile(
    `${output}/manifest.json`,
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], {
          encoding: "utf8",
        }).trim(),
        workingTree: execFileSync("git", ["status", "--porcelain"], {
          encoding: "utf8",
        }).trim()
          ? "modified"
          : "clean",
        data: "Unmocked, fictional local research history; not a production or physical-outcome verification.",
        captures,
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await browser.close();
}
