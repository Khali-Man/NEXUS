import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { assuranceVisualMetrics } from "./fixtures/assurance";
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
    path: "/cad",
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
      await page.waitForURL("**" + surface.path);
    } else await page.goto(surface.base + surface.path);
    await expect(page.locator("h1")).toBeVisible();
    if (surface.role === "supervisor") {
      await expect(page.locator("tbody tr")).toHaveCount(16);
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
      content:
        ".command-header time { visibility:hidden } .scenario-run:nth-of-type(n+2), .mission-card:nth-of-type(n+2) {display:none}",
    });
    await expect(page).toHaveScreenshot(surface.name + "-shell.png", {
      animations: "disabled",
      maxDiffPixelRatio: 0.003,
      mask: [
        page.locator(
          ".panel-heading>span,.field-section-heading>span,.queue-heading>span",
        ),
        page.locator(".stat-card strong"),
        page.locator(".reference"),
        page.locator(".table-scroll"),
        page.locator(".readiness-row"),
        page.locator(".geo-map"),
        page.locator(".scenario-run"),
        page.locator(".mission-card"),
      ],
    });
    expect(errors).toEqual([]);
  });
