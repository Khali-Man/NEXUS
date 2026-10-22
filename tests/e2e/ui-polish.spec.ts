import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  measurementSeconds,
  measurementFields,
} from "../../packages/ui/src/measurements";

async function login(page: Page, role: string, port = 3000) {
  const base = `http://localhost:${port}`;
  await page.goto(
    base + (role === "responder" ? "/responder/login" : "/login"),
  );
  await page.getByLabel("Demo username").fill(role);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.DEMO_PASSWORD || "Nexus-Demo-2026!");
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await page.waitForURL(
    "**/" +
      {
        dispatcher: "cad",
        supervisor: "assurance",
        admin: "simulator",
        responder: "responder",
      }[role],
  );
}
for (const [name, role, port, path] of [
  ["citizen", "", 5173, "/"],
  ["dispatcher", "dispatcher", 3000, "/cad/live"],
  ["responder", "responder", 5174, "/responder"],
  ["supervisor", "supervisor", 3000, "/assurance"],
  ["administrator", "admin", 3000, "/simulator"],
] as const)
  test(`${name} uses accessible desktop, tablet and mobile layouts with reduced motion`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    if (role) await login(page, role, port);
    for (const [width, height] of [
      [1440, 900],
      [768, 1024],
      [390, 844],
      [375, 812],
      [320, 640],
    ]) {
      await page.setViewportSize({ width, height });
      await page.goto(`http://localhost:${port}${path}`);
      await expect(page.locator("h1")).toBeVisible();
      if (role === "dispatcher") {
        await expect(page.locator(".geo-map")).toBeVisible();
        const triage = page
          .locator(".queue-presets")
          .getByRole("button", { name: "Awaiting triage", exact: true });
        await triage.click();
        await expect(triage).toHaveAttribute("aria-pressed", "true");
        await page.locator(".queue-refinements summary").focus();
        await page.keyboard.press("Enter");
        await expect(page.locator(".queue-refinements")).toHaveAttribute(
          "open",
          "",
        );
        await expect(
          page.getByRole("combobox", { name: "Status", exact: true }),
        ).toHaveValue("RECEIVED");
        await page
          .getByRole("button", { name: "Clear filters", exact: true })
          .click();
        await expect(
          page.getByRole("combobox", { name: "Status", exact: true }),
        ).toHaveValue("");
        await expect(page.locator(".incident-card").first()).toBeAttached();
        const cardGeometry = await page
          .locator(".incident-card")
          .evaluateAll((cards) =>
            cards.slice(0, 2).map((card) => {
              const box = card.getBoundingClientRect(),
                heading = card.querySelector("h3")!.getBoundingClientRect();
              return {
                top: box.top,
                bottom: box.bottom,
                height: box.height,
                headingBottom: heading.bottom,
              };
            }),
          );
        expect(cardGeometry[0].height).toBeGreaterThan(100);
        expect(cardGeometry[0].headingBottom).toBeLessThanOrEqual(
          cardGeometry[0].bottom,
        );
        if (cardGeometry[1])
          expect(cardGeometry[1].top).toBeGreaterThanOrEqual(
            cardGeometry[0].bottom,
          );
      }
      if (role === "supervisor")
        await expect(page.locator(".metric-coverage")).toHaveCount(4);
      if (role === "admin")
        await expect(page.locator(".scenario-card")).toHaveCount(4);
      if (role === "admin") {
        const overflows = await page
          .locator(".fault-control")
          .evaluateAll((controls) =>
            controls.flatMap((control) => {
              const parent = control.getBoundingClientRect();
              return Array.from(control.querySelectorAll("button"))
                .filter((button) => {
                  const b = button.getBoundingClientRect();
                  return (
                    b.left < parent.left ||
                    b.right > parent.right ||
                    b.bottom > parent.bottom ||
                    b.height < 44
                  );
                })
                .map((button) => button.textContent);
            }),
          );
        expect(overflows).toEqual([]);
      }
      if (role === "supervisor" && width < 1000) {
        const table = page.locator(".measurement-records .table-scroll");
        await table.focus();
        await page.keyboard.press("ArrowRight");
        await expect
          .poll(() => table.evaluate((e) => e.scrollLeft))
          .toBeGreaterThan(0);
      }
      if (role === "responder") {
        const summary = page.locator(".mission-history summary");
        await summary.focus();
        await page.keyboard.press("Enter");
        await expect(page.locator(".mission-history")).toHaveAttribute(
          "open",
          "",
        );
        await page.evaluate(() =>
          window.scrollTo(0, document.body.scrollHeight),
        );
        const nav = await page.locator(".field-nav").boundingBox();
        const last = page.locator(".mission-history .mission-card").last();
        if (await last.count()) {
          const card = await last.boundingBox();
          expect(card!.y + card!.height).toBeLessThan(nav!.y - 8);
          await last.focus();
          await expect(last).toBeFocused();
        } else {
          const bounds = await summary.boundingBox();
          expect(bounds!.y + bounds!.height).toBeLessThan(nav!.y - 8);
        }
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      await expect(page.locator(".simulation-banner")).toContainText(
        "THIS APPLICATION CANNOT SUMMON HELP",
      );
      if ([1440, 768, 320].includes(width)) {
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        expect(
          results.violations
            .filter((v) => ["serious", "critical"].includes(v.impact || ""))
            .map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
        ).toEqual([]);
      }
      await page.screenshot({
        path: `artifacts/screenshots/polish-${name}-${width}.png`,
        fullPage: true,
        animations: "disabled",
      });
    }
  });

test("citizen journey explains confirmation without premature receipt advice", async ({
  page,
}) => {
  await page.goto("http://localhost:5173");
  await expect(
    page.getByText("Keep this private link safe.", { exact: false }),
  ).toHaveCount(0);
  await expect(page.locator(".journey-path li")).toHaveCount(3);
  await expect(
    page.getByText("How the simulation works · no request submitted"),
  ).toBeVisible();
  const how = page.getByRole("button", { name: "How it works" });
  await how.focus();
  await page.keyboard.press("Enter");
  await expect(how).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#journey-explanation")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start simulated request" }),
  ).toBeDisabled();
});

test("supervisor explores real coverage, missing records, timestamps and replay", async ({
  page,
}) => {
  await login(page, "supervisor");
  const response = await page.request.get(
    "http://localhost:3000/api/v1/assurance/metrics",
  );
  expect(response.ok()).toBe(true);
  const sample = await response.json();
  await expect(page.locator(".coverage-heading")).toContainText(
    `${sample.sampleSize} incidents in the agency sample`,
  );
  await expect(page.locator(".evidence-note")).toContainText(
    "No verified arrival",
  );
  if (sample.sampleSize > 10) {
    const first = await page.locator("tbody .reference").first().textContent();
    await page.getByRole("button", { name: "Next page", exact: true }).click();
    await expect(page.locator("tbody .reference").first()).not.toHaveText(
      first!,
    );
  }
  await page.getByLabel("Measurement availability").selectOption("gaps");
  const gaps = sample.items.filter((i: any) =>
    measurementFields.some(([field]) => measurementSeconds(i, field) === null),
  );
  const shown = await page.locator("tbody .reference").allTextContents();
  expect(shown.length).toBeGreaterThan(0);
  expect(
    shown.every((ref) => gaps.some((i: any) => i.public_reference === ref)),
  ).toBe(true);
  await page.getByRole("button", { name: "Server timestamps (Lagos)" }).click();
  await expect(page.locator("tbody tr").first()).toContainText("WAT");
  const measured = sample.items.find((i: any) => i.accepted_at);
  expect(measured).toBeTruthy();
  await page.getByLabel("Measurement availability").selectOption("");
  await page
    .getByRole("textbox", { name: "Find a measured incident" })
    .fill(measured.public_reference);
  await page
    .getByRole("link", { name: measured.public_reference, exact: true })
    .click();
  await expect(page.getByText(/one recorded event per second/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Previous event" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Next event" }).click();
  await expect(page.locator(".replay-index [aria-current=step]")).toHaveCount(
    1,
  );
  await expect(
    page.getByRole("button", { name: "Previous event" }),
  ).toBeEnabled();
  await page.locator(".replay-index button").last().click();
  await expect(page.getByRole("button", { name: "Next event" })).toBeDisabled();
  await page.screenshot({
    path: "artifacts/screenshots/polish-supervisor-replay.png",
    fullPage: true,
    animations: "disabled",
  });
});

test("administrator discovers fixtures, navigates history and reloads persisted unit fault state", async ({
  page,
}) => {
  await login(page, "admin");
  const search = page.getByRole("textbox", { name: "Search scenarios" });
  await search.fill("low network");
  await expect(page.locator(".scenario-card")).toHaveCount(1);
  const checks = page.locator(".scenario-checks summary");
  await checks.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".scenario-goals")).toBeVisible();
  await search.fill("");
  await page.getByRole("button", { name: "Integrity & provenance" }).click();
  await expect(page.locator(".scenario-card")).toHaveCount(2);
  await page.getByRole("button", { name: "All scenarios" }).click();
  await page
    .locator(".catalogue-pagination")
    .getByRole("button", { name: "Next page" })
    .click();
  await expect(page.locator(".catalogue-pagination")).toContainText(
    "Showing 5–8 of 9",
  );
  const history = page.locator(".run-history");
  if (await history.getByRole("button", { name: "Next page" }).isEnabled()) {
    const previous = await history.locator(".reference").first().textContent();
    await history.getByRole("button", { name: "Next page" }).click();
    await expect(history.locator(".reference").first()).not.toHaveText(
      previous!,
    );
  }
  const faults = ["Make unit locations stale", "Mark unreserved units offline"];
  try {
    for (const label of faults) {
      const control = page.locator(".fault-control").filter({ hasText: label });
      await expect(control).toContainText("Disabled");
      await control
        .getByRole("button", { name: "Enable", exact: true })
        .click();
      await expect(control).toContainText("Enabled");
    }
    await page.reload();
    for (const label of faults)
      await expect(
        page.locator(".fault-control").filter({ hasText: label }),
      ).toContainText("Enabled");
    const actual = await (
      await page.request.get("http://localhost:3000/api/v1/cad/network")
    ).json();
    expect(actual.settings).toMatchObject({
      stale_locations: true,
      unit_unavailable: true,
    });
    await page.locator(".fault-laboratory").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: "artifacts/screenshots/polish-administrator-persisted-faults.png",
      animations: "disabled",
    });
    for (const label of faults) {
      const control = page.locator(".fault-control").filter({ hasText: label });
      await control
        .getByRole("button", { name: "Disable", exact: true })
        .click();
      await expect(control).toContainText("Disabled");
    }
  } finally {
    for (const fault of ["stale_locations", "unit_unavailable"])
      await page.request.post("http://localhost:3000/api/v1/simulator/faults", {
        headers: { "Idempotency-Key": crypto.randomUUID() },
        data: { fault, enabled: false },
      });
  }
});
