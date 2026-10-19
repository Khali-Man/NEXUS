import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const base = "http://localhost:3000";
async function login(page: any, role: string) {
  await page.goto(base + "/login");
  await page.getByLabel("Demo username").fill(role);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.DEMO_PASSWORD || "Nexus-Demo-2026!");
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await page.waitForURL("**/" + (role === "supervisor" ? "assurance" : "cad"));
}
test("supervisor signs and independently verifies a downloaded covered-history bundle", async ({
  page,
}) => {
  await login(page, "supervisor");
  await page.goto(base + "/assurance/audit");
  await page
    .getByRole("button", { name: "Sign checkpoint", exact: true })
    .click();
  await page
    .getByLabel("Reason / fictional context", { exact: true })
    .fill("Fictional browser signing verification");
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/assurance/audit/checkpoint") &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm action", exact: true })
    .click();
  const created = await (await response).json();
  expect(created.signature).toBeTruthy();
  const row = page.locator("p").filter({ hasText: created.root_hash }).first();
  await expect(row).toContainText(
    "Signature verified against local trust registry",
  );
  const download = page.waitForEvent("download");
  await row.getByRole("link", { name: "Download verification bundle" }).click();
  const file = await download;
  const directory = mkdtempSync(join(tmpdir(), "nexus-browser-signature-"));
  try {
    const bundle = join(directory, "bundle.json"),
      trust = join(directory, "trust.json");
    await file.saveAs(bundle);
    writeFileSync(
      trust,
      readFileSync(
        process.env.AUDIT_TRUSTED_KEYS_FILE ||
          ".nexus/keys/trusted-public-keys.json",
      ),
    );
    const result = spawnSync(
      process.execPath,
      ["tools/verify-checkpoint.mjs", bundle, trust],
      { encoding: "utf8" },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout).history).toBe("VALID");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
test("route UI displays declared provider fixtures and removes the route when estimates fail", async ({
  page,
}) => {
  await login(page, "dispatcher");
  const key = randomUUID();
  const created = await page.request.post(base + "/api/v1/demo/incidents", {
    headers: { "Idempotency-Key": key },
    data: {
      client_request_id: key,
      simulation: true,
      category: "TRAFFIC",
      description: "Fictional route presentation fixture",
      landmark: "Fictional map test",
      longitude: 4.5557,
      latitude: 7.7738,
    },
  });
  expect(created.ok()).toBe(true);
  const reference = (await created.json()).reference;
  const list = await (
    await page.request.get(base + "/api/v1/cad/incidents?q=" + reference)
  ).json();
  const i = list.items[0];
  let available = true;
  const unitId = randomUUID();
  await page.route(
    "**/api/v1/cad/incidents/" + i.id + "/candidates",
    async (route) =>
      route.fulfill({
        json: {
          items: [
            {
              id: unitId,
              callsign: "FICTIONAL ROUTE PRESENTATION TEST",
              eligible: true,
              excluded_reasons: [],
              longitude: 4.553,
              latitude: 7.773,
              distance_m: 400,
              recorded_at: new Date().toISOString(),
              estimate_at: new Date().toISOString(),
              eta_seconds: available ? 180 : null,
              eta_source: available ? "OSRM_OSM_CAR" : "UNAVAILABLE",
              route_distance_m: 1200,
              routing_data_version: "FICTIONAL_UI_FIXTURE",
              route_geometry: available
                ? {
                    type: "LineString",
                    coordinates: [
                      [4.553, 7.773],
                      [4.5557, 7.7738],
                    ],
                  }
                : null,
            },
          ],
        },
      }),
  );
  await page.goto(base + "/cad/dispatch/" + i.id);
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(page.getByText(/Model travel estimate 3 min/)).toBeVisible();
  await page.getByRole("button", { name: "Show estimated road route" }).click();
  await expect(
    page.locator(".incident-content .map-canvas canvas"),
  ).toBeVisible();
  await expect(page.getByText(/FICTIONAL_UI_FIXTURE/)).toBeVisible();
  available = false;
  await page.reload();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(page.getByText(/ETA unavailable/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Show estimated road route" }),
  ).toHaveCount(0);
});
