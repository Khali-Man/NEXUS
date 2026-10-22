import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { assuranceVisualMetrics } from "./fixtures/assurance";
import {
  visualIncidents,
  visualUnits,
  visualAssignments,
  visualScenarios,
  visualRuns,
  visualNetwork,
} from "./fixtures/workspaces";
const password = process.env.DEMO_PASSWORD || "Nexus-Demo-2026!";
const surfaces = [
  {
    name: "citizen",
    base: "http://localhost:5173",
    path: "/",
    role: null,
    width: 375,
    height: 812,
  },
  {
    name: "command",
    base: "http://localhost:3000",
    path: "/cad/live",
    role: "dispatcher",
    width: 1440,
    height: 900,
  },
  {
    name: "assurance",
    base: "http://localhost:3000",
    path: "/assurance",
    role: "supervisor",
    width: 1440,
    height: 900,
  },
  {
    name: "simulator",
    base: "http://localhost:3000",
    path: "/simulator",
    role: "admin",
    width: 1440,
    height: 900,
  },
  {
    name: "responder",
    base: "http://localhost:5174",
    path: "/responder",
    role: "responder",
    width: 390,
    height: 844,
  },
];
for (const surface of surfaces)
  test(`${surface.name} accessibility and visual contract`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: surface.width,
      height: surface.height,
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    if (surface.role === "dispatcher") {
      await page.route(/\/api\/v1\/cad\/incidents\?/, (route) =>
        route.fulfill({
          json: { items: visualIncidents, total: visualIncidents.length },
        }),
      );
      await page.route("**/api/v1/cad/units", (route) =>
        route.fulfill({ json: { items: visualUnits } }),
      );
    }
    if (["admin", "dispatcher"].includes(surface.role || "")) {
      await page.route("**/api/v1/cad/network", (route) =>
        route.fulfill({ json: visualNetwork }),
      );
      await page.route("**/api/v1/demo/reference-data", (route) =>
        route.fulfill({ json: { mapMode: "CONTEXT_ONLY" } }),
      );
    }
    if (surface.role === "admin")
      await page.route(/\/api\/v1\/simulator\/scenarios(?:\?|$)/, (route) =>
        route.fulfill({
          json: { items: visualScenarios, runs: visualRuns, totalRuns: 2 },
        }),
      );
    if (surface.role === "responder")
      await page.route("**/api/v1/responder/assignments", (route) =>
        route.fulfill({ json: { items: visualAssignments } }),
      );
    if (surface.role === "supervisor") {
      // Pixel comparisons need stable layout inputs, including row count.
      // The product journey separately exercises unmocked metrics/replay/export.
      await page.route("**/api/v1/assurance/metrics", (route) =>
        route.fulfill({ json: assuranceVisualMetrics }),
      );
    }
    if (surface.role) {
      await page.goto(
        surface.base +
          (surface.role === "responder" ? "/responder/login" : "/login"),
      );
      await page.getByLabel("Demo username").fill(surface.role);
      await page.getByLabel("Password", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Sign in to workspace" }).click();
      await page.waitForURL(
        "**" + (surface.role === "dispatcher" ? "/cad" : surface.path),
      );
      if (surface.role === "dispatcher")
        await page.goto(surface.base + surface.path);
    } else await page.goto(surface.base + surface.path);
    await expect(page.locator("h1")).toBeVisible();
    if (surface.role === "supervisor") {
      await expect(page.locator("tbody tr")).toHaveCount(10);
      await expect(page.locator(".stat-card strong")).toHaveText([
        "30 s",
        "60 s",
        "30 s",
        "180 s",
      ]);
      await expect(
        page
          .locator("tbody tr")
          .first()
          .locator("td")
          .filter({ hasText: "Not measured" }),
      ).toHaveCount(4);
      await expect(page.locator(".metric-coverage")).toHaveText([
        "12 of 16 measured",
        "9 of 16 measured",
        "6 of 16 measured",
        "3 of 16 measured",
      ]);
    }
    if (surface.role === "admin") {
      await expect(page.locator(".scenario-card")).toHaveCount(4);
      await expect(page.locator(".selected-run-body")).toContainText(
        "3 of 8 steps recorded",
      );
    }
    if (surface.role === "dispatcher") {
      await expect(page.locator(".location-record")).toHaveCount(4);
      await expect(page.locator(".live-toolbar .connection")).toContainText(
        "Connected",
      );
    }
    if (surface.role === "responder") {
      await expect(page.locator(".active-mission")).toHaveCount(1);
      await expect(page.locator(".active-mission")).toContainText(
        "En route reported",
      );
      await expect(page.locator(".incoming-mission")).toHaveCount(1);
      await expect(page.locator(".responder-header .connection")).toContainText(
        "Connected",
      );
    }
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator("html")).toHaveAttribute("lang", "en-NG");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    const severe = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(
      severe.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
    ).toEqual([]);
    await page.addStyleTag({
      content: ".command-header time { visibility:hidden }",
    });
    await expect(page).toHaveScreenshot(surface.name + "-shell.png", {
      animations: "disabled",
      maxDiffPixelRatio: 0.003,
    });
    expect(errors).toEqual([]);
  });
