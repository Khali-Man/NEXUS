import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
const password = process.env.DEMO_PASSWORD || "Nexus-Demo-2026!";
async function signIn(
  page: Page,
  role: string,
  base = "http://localhost:3000",
) {
  await page.goto(
    base + (role === "responder" ? "/responder/login" : "/login"),
  );
  await page.getByLabel("Demo username").fill(role);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await page.waitForURL(
    role === "supervisor"
      ? "**/assurance"
      : role === "admin"
        ? "**/simulator"
        : role === "responder"
          ? "**/responder"
          : "**/cad",
  );
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
}
test("citizen mobile journey creates a private server-confirmed receipt", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("http://localhost:5173");
  await expect(
    page.getByRole("heading", { name: "Know what happened." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start simulated request" }),
  ).toBeDisabled();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Start simulated request" }).click();
  await page.getByText("Traffic collision", { exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page
    .getByLabel("Fictional scenario", { exact: true })
    .fill("A fictional road collision for browser research. No real people.");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Submit simulated alert" }).click();
  await expect(
    page.getByRole("heading", { name: "Received by simulation server" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "View my private timeline" }).click();
  await expect(
    page.getByText("Received", { exact: true }).first(),
  ).toBeVisible();
  await noOverflow(page);
  await page.screenshot({
    path: "artifacts/screenshots/citizen-tracking-375.png",
    fullPage: true,
  });
});
test("CAD login, live queue, filters, map fallback and unit board work", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, "dispatcher");
  await expect(
    page.getByRole("heading", { name: "A clearer view." }),
  ).toBeVisible();
  await expect(page.locator(".overview-map .connection")).toContainText(
    "Connected",
  );
  await page.screenshot({
    path: "artifacts/screenshots/cad-overview-1440.png",
    fullPage: true,
  });
  await page.goto("http://localhost:3000/cad/live");
  await expect(
    page.getByRole("heading", { name: "INCIDENT QUEUE" }),
  ).toBeVisible();
  await expect(page.locator(".incident-card").first()).toBeVisible();
  await page.locator(".incident-card").first().click();
  await expect(page.locator(".incident-detail .incident-top")).toBeVisible();
  await page
    .getByRole("textbox", { name: "Search incidents" })
    .fill("NO-MATCH-REFERENCE");
  await expect(
    page.getByText("No incidents match these filters."),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Search incidents" }).fill("");
  await noOverflow(page);
  await page.screenshot({
    path: "artifacts/screenshots/cad-live-1440.png",
    fullPage: true,
  });
  await page.goto("http://localhost:3000/cad/units");
  await expect(page.getByRole("heading", { name: "Unit board" })).toBeVisible();
  await expect(page.locator("tbody tr").first()).toBeVisible();
});
test("supervisor audit, replay and redacted exports use server records", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const metricsResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/assurance/metrics") &&
      response.request().method() === "GET",
  );
  await signIn(page, "supervisor");
  const metrics = await metricsResponse;
  expect(metrics.ok()).toBe(true);
  const confirmed = await metrics.json();
  expect(confirmed.sampleSize).toBeGreaterThan(0);
  expect(confirmed.sampleSize).toBe(confirmed.items.length);
  await expect(page.locator("tbody tr")).toHaveCount(confirmed.sampleSize);
  await expect(page.locator("tbody tr").first()).toContainText(
    confirmed.items[0].public_reference,
  );
  await expect(
    page.getByRole("heading", { name: "Accountability, in the details." }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/screenshots/assurance-1440.png",
    fullPage: true,
  });
  await page.goto("http://localhost:3000/assurance/audit");
  await expect(
    page.getByRole("heading", { name: "Audit integrity" }),
  ).toBeVisible();
  await expect(page.getByText("Chain verified").first()).toBeVisible();
  await page.goto("http://localhost:3000/assurance/incidents");
  await page.locator("tbody .reference").first().click();
  await expect(
    page.getByRole("button", { name: "Play recorded sequence" }),
  ).toBeVisible();
  await expect(page.getByText("Event hash", { exact: true })).toBeVisible();
  await page.goto("http://localhost:3000/assurance/reports");
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export CSV" }).click();
  expect((await download).suggestedFilename()).toContain(
    "nexus-research-simulation",
  );
});
test("admin creates deterministic scenario, advances commands and toggles map failure", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, "admin");
  await expect(page.locator(".scenario-card")).toHaveCount(9);
  await page.screenshot({
    path: "artifacts/screenshots/simulator-1440.png",
    fullPage: true,
  });
  const exportDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export fictional scenario seeds and runs" })
    .click();
  const seedExport = await exportDownload;
  const exported = JSON.parse(readFileSync((await seedExport.path())!, "utf8"));
  expect(exported.scenarios).toHaveLength(9);
  expect(exported.simulation).toBe(true);
  expect(JSON.stringify(exported)).not.toMatch(
    /receiptToken|receipt_token_digest/,
  );
  const createdResponse = page.waitForResponse(
    (response) =>
      response
        .url()
        .includes("/api/v1/simulator/scenarios/traffic-osogbo-main/run") &&
      response.request().method() === "POST",
  );
  await page
    .locator(".scenario-card")
    .filter({ hasText: /Traffic.*Osogbo main/i })
    .getByRole("button")
    .click();
  const created = await createdResponse;
  expect(created.ok()).toBe(true);
  const fixture = await created.json();
  const run = page
    .locator(".scenario-run")
    .filter({ hasText: fixture.results_json.reference });
  await expect(run).toBeVisible();
  await run.getByRole("button").click();
  await expect(run).toContainText("1/8");
  const map = page
    .locator(".fault-control")
    .filter({ hasText: "Simulate map unavailable" });
  await map.getByRole("button", { name: "Enable", exact: true }).click();
  await expect(map).toContainText("Enabled");
  await map.getByRole("button", { name: "Disable", exact: true }).click();
  await expect(map).toContainText("Disabled");
});
test("responder displays server missions and durable outbox/profile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, "responder", "http://localhost:5174");
  await expect(
    page.getByRole("heading", { name: "Ready for the next assignment." }),
  ).toBeVisible();
  await noOverflow(page);
  await page.screenshot({
    path: "artifacts/screenshots/responder-390.png",
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Device outbox", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Device outbox" }),
  ).toBeVisible();
  await expect(page.getByText("Your device outbox is clear.")).toBeVisible();
  await page.getByRole("link", { name: "Fictional unit profile" }).click();
  await expect(
    page.getByRole("heading", { name: "Fictional unit profile" }),
  ).toBeVisible();
});
test("citizen keyboard, reduced motion, browser locale fallback and all mobile viewports", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("http://localhost:5173");
  await expect(page.locator("html")).toHaveAttribute("lang", "en-NG");
  for (const [width, height] of [
    [320, 640],
    [375, 812],
    [390, 844],
    [768, 1024],
  ]) {
    await page.setViewportSize({ width, height });
    await noOverflow(page);
    await expect(page.locator(".simulation-banner")).toContainText(
      "THIS APPLICATION CANNOT SUMMON HELP.",
    );
    await page.screenshot({
      path: `artifacts/screenshots/citizen-${width}.png`,
      fullPage: true,
    });
  }
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to main content" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await page.getByRole("checkbox").focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("checkbox")).toBeChecked();
});
test("command layouts fit required desktop and tablet viewports", async ({
  page,
}) => {
  await signIn(page, "dispatcher");
  for (const [width, height] of [
    [1280, 800],
    [1440, 900],
    [1920, 1080],
    [3840, 2160],
    [768, 1024],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("http://localhost:3000/cad/live");
    await expect(
      page.getByRole("heading", { name: "Live operations" }),
    ).toBeVisible();
    await noOverflow(page);
    await page.screenshot({
      path: `artifacts/screenshots/cad-live-${width}.png`,
      fullPage: true,
    });
  }
});
test("offline responder acceptance stays local, reconnects, and completes one integrated lifecycle", async ({
  browser,
}) => {
  const dispatchContext = await browser.newContext(),
    fieldContext = await browser.newContext(),
    citizenContext = await browser.newContext();
  const dispatch = await dispatchContext.newPage(),
    field = await fieldContext.newPage(),
    citizen = await citizenContext.newPage();
  try {
    await signIn(dispatch, "dispatcher");
    const create = await dispatch.request.post(
      "http://localhost:3000/api/v1/demo/incidents",
      {
        headers: { "Idempotency-Key": crypto.randomUUID() },
        data: {
          client_request_id: crypto.randomUUID(),
          simulation: true,
          category: "TRAFFIC",
          description: "Fictional end-to-end offline mission, no real people.",
          landmark: "Fictional Olaiya landmark",
          longitude: 4.5557,
          latitude: 7.7738,
        },
      },
    );
    expect(create.ok()).toBe(true);
    const receipt = await create.json();
    const rows = await (
      await dispatch.request.get(
        "http://localhost:3000/api/v1/cad/incidents?q=" + receipt.reference,
      )
    ).json();
    const incident = rows.items[0];
    await dispatch.goto("http://localhost:3000/cad/incidents/" + incident.id);
    async function confirm(page: Page, label: string, reason: string) {
      await page.getByRole("button", { name: label, exact: true }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("textbox").fill(reason);
      await dialog.getByRole("button", { name: "Confirm action" }).click();
      await expect(dialog).not.toBeVisible();
    }
    await confirm(
      dispatch,
      "Record human triage",
      "Fictional triage with human context",
    );
    await expect(dispatch.locator(".incident-content>.status")).toContainText(
      "Triaged",
    );
    await confirm(
      dispatch,
      "Mark ready for a unit",
      "Fictional unit assistance is appropriate",
    );
    await expect(dispatch.locator(".incident-content>.status")).toContainText(
      "Waiting for a unit",
    );
    await signIn(field, "responder", "http://localhost:5174");
    await dispatch.reload();
    const offer = dispatch
      .locator(".candidate-card")
      .filter({ hasText: "OSG • 03" });
    await expect(
      offer.getByRole("button", { name: "Offer assignment" }),
    ).toBeVisible();
    await offer.getByRole("button", { name: "Offer assignment" }).click();
    const dialog = dispatch.getByRole("dialog");
    await dialog
      .getByRole("textbox")
      .fill("Human-approved fictional assignment");
    await dialog.getByRole("button", { name: "Confirm action" }).click();
    await expect(dialog).not.toBeVisible();
    await field.reload();
    await field
      .locator(".mission-card")
      .filter({ hasText: receipt.reference })
      .click();
    await expect(
      field.getByRole("button", { name: "Accept assignment", exact: true }),
    ).toBeVisible();
    const missionUrl = field.url();
    await field.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await fieldContext.setOffline(true);
    await confirm(
      field,
      "Accept assignment",
      "Acknowledgement queued on offline device",
    );
    await expect(
      field.getByText("Saved on this device — awaiting confirmation").first(),
    ).toBeVisible();
    await field.waitForTimeout(5500);
    await expect(
      field.getByRole("heading", { name: "Traffic collision" }),
    ).toBeVisible();
    const stillOffered = await (
      await dispatch.request.get(
        "http://localhost:3000/api/v1/cad/incidents/" + incident.id,
      )
    ).json();
    expect(stillOffered.status).toBe("OFFERED");
    await field.screenshot({
      path: "artifacts/screenshots/responder-offline-pending.png",
      fullPage: true,
    });
    await field.goto("http://localhost:5174/responder/outbox");
    await expect(
      field.getByRole("heading", { name: "Device outbox" }),
    ).toBeVisible();
    await expect(field.locator(".field-queue")).toHaveCount(1);
    await fieldContext.setOffline(false);
    await field.goto(missionUrl);
    await expect(
      field.getByRole("button", { name: "Report en route", exact: true }),
    ).toBeVisible({ timeout: 20000 });
    await confirm(field, "Report en route", "Fictional travel reported");
    await expect(
      field.getByRole("button", { name: "Report arrival", exact: true }),
    ).toBeVisible();
    await confirm(
      field,
      "Report arrival",
      "Fictional arrival reported after reconnect",
    );
    await expect(
      field.getByRole("button", { name: "Record outcome", exact: true }),
    ).toBeVisible();
    await confirm(field, "Record outcome", "Fictional situation resolved");
    await expect(field.locator(".field-main>.status")).toContainText(
      "Resolved",
    );
    await dispatch.reload();
    await confirm(
      dispatch,
      "Close incident",
      "Reviewed fictional outcome and closed",
    );
    await citizen.goto(
      "http://localhost:5173/demo/track/" +
        receipt.reference +
        "#token=" +
        receipt.receiptToken,
    );
    await expect(citizen.locator(".tracking-state .status")).toHaveText(
      "Closed",
    );
    await expect(citizen.locator(".event-timeline li")).toHaveCount(9);
    await expect(citizen).not.toHaveURL(/token=/);
    await citizen.screenshot({
      path: "artifacts/screenshots/citizen-closed-lifecycle.png",
      fullPage: true,
    });
  } finally {
    await dispatchContext.close();
    await fieldContext.close();
    await citizenContext.close();
  }
});
test("English fallback, denied GPS, local-only position preview, and long-string layouts remain usable", async ({
  browser,
}) => {
  const context = await browser.newContext({
    locale: "fr-FR",
    viewport: { width: 320, height: 640 },
  });
  const page = await context.newPage();
  try {
    const network = await context.newCDPSession(page);
    await network.send("Network.enable");
    await network.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 120,
      downloadThroughput: 200 * 1024,
      uploadThroughput: 100 * 1024,
    });
    await page.goto("http://localhost:5173");
    await expect(page.locator("html")).toHaveAttribute("lang", "en-NG");
    await expect(
      page.getByRole("button", { name: "Start simulated request" }),
    ).toBeVisible();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Start simulated request" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page
      .getByRole("button", { name: "Preview my position on this device" })
      .click();
    await expect(
      page.getByText(
        "Position unavailable or permission declined. Continue with a fictional landmark.",
      ),
    ).toBeVisible();
    await context.grantPermissions(["geolocation"], {
      origin: "http://localhost:5173",
    });
    await context.setGeolocation({ latitude: 51.5, longitude: -0.12 });
    await page
      .getByRole("button", { name: "Preview my position on this device" })
      .click();
    await expect(
      page.getByText(
        "Approximate on-device preview: 51.5, -0.12. The report still uses the fictional landmark.",
      ),
    ).toBeVisible();
    const draft = await page.evaluate(() =>
      JSON.parse(sessionStorage.getItem("nexus-draft") || "{}"),
    );
    expect(draft.latitude).toBeLessThan(8);
    expect(draft.longitude).toBeGreaterThan(4);
    await page.evaluate(() => {
      const h = document.querySelector("h1")!;
      h.textContent = (h.textContent + " ").repeat(3);
    });
    await noOverflow(page);
  } finally {
    await context.close();
  }
});
