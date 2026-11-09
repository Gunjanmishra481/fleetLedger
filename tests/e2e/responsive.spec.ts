// Screenshots + layout checks at the four sizes in docs/DESIGN.md, and one real trip save on a phone.
import { expect, test, type Page } from "@playwright/test";

const VIEWPORTS = [
  { name: "phone-390x844", width: 390, height: 844 },
  { name: "tablet-820x1180", width: 820, height: 1180 },
  { name: "tablet-land-1180x820", width: 1180, height: 820 },
  { name: "pc-1440x900", width: 1440, height: 900 },
];
const M = "2026-09";

async function login(page: Page) {
  // Credentials come from .env (loaded by playwright.config.ts); never hard-code them here.
  const user = process.env.ADMIN_USER;
  const password = process.env.ADMIN_PASSWORD;
  if (!user || !password) throw new Error("Set ADMIN_USER and ADMIN_PASSWORD in .env to run the browser tests");
  await page.goto("/login");
  await page.getByLabel("User").fill(user);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/dashboard/);
}

/** Layout problems: horizontal page scroll and visible tap targets under 44px. */
async function audit(page: Page) {
  return page.evaluate(() => {
    const overflowX = document.documentElement.scrollWidth - window.innerWidth;
    const small: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>("a[href], button, input:not([type=hidden]), select, textarea, [role=radio]")) {
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (!r.width || !r.height || style.visibility === "hidden" || el.closest("[aria-hidden=true]")) continue;
      // Inline text links inside sentences are exempt (WCAG 2.5.8 inline exception).
      if (el.tagName === "A" && style.display === "inline" && el.parentElement?.closest("p")) continue;
      if (r.height < 43.5 || r.width < 43.5) {
        const label = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || el.tagName).trim().slice(0, 40);
        small.push(`${el.tagName.toLowerCase()} "${label}" ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    }
    return { overflowX, small: [...new Set(small)] };
  });
}

for (const vp of VIEWPORTS) {
  test.describe(vp.name, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("pages render without overflow", async ({ page }) => {
      await login(page);
      await page.goto(`/fleet?m=${M}`);
      const trailerHref = await page.locator('a[href^="/trailers/"]').first().getAttribute("href");
      const pages: [string, string][] = [
        ["home", `/dashboard?m=${M}`],
        ["new-trip", `/trips/new?m=${M}`],
        ["trips", `/trips?m=${M}`],
        ["trailer", trailerHref!],
        ["masters", "/masters?tab=drivers"],
        ["masters-rates", "/masters?tab=rates"],
      ];
      const problems: string[] = [];
      for (const [name, url] of pages) {
        await page.goto(url);
        await page.waitForLoadState("networkidle");
        await page.screenshot({ path: `test-results/screens/${vp.name}-${name}.png`, fullPage: true });
        const a = await audit(page);
        if (a.overflowX > 1) problems.push(`${name}: page scrolls sideways by ${a.overflowX}px`);
        if (a.small.length) problems.push(`${name}: small targets: ${a.small.join("; ")}`);
      }
      if (problems.length) console.log(`\n[${vp.name}]\n  ${problems.join("\n  ")}`);
      expect(problems).toEqual([]);
    });
  });
}

test.describe("phone trip entry", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("logs a trip in four steps and offers next actions", async ({ page }) => {
    await login(page);
    await page.goto(`/trips/new?m=${M}`);
    await page.getByRole("button", { name: /^Trailer NL01N3650/ }).click(); // auto-advances on phone
    await expect(page.getByText("Step 2 of 4")).toBeVisible();
    await page.getByRole("button", { name: /Ahmedabad/ }).first().click(); // recent route card
    await expect(page.getByText("Step 3 of 4")).toBeVisible();
    await page.getByRole("radio", { name: "7 cars" }).click();
    await page.getByRole("button", { name: "Next: Check" }).click();
    await expect(page.getByText("Step 4 of 4")).toBeVisible();
    await page.screenshot({ path: "test-results/screens/phone-flow-check.png", fullPage: true });
    await page.getByRole("button", { name: "Looks right — Save" }).first().click();
    await expect(page.getByRole("dialog", { name: "Trip saved" })).toBeVisible();
    await page.screenshot({ path: "test-results/screens/phone-flow-saved.png" });
    await expect(page.getByRole("button", { name: "Same trailer again" })).toBeVisible();
  });
});

test.describe("masters", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("edit a driver, merge drivers and places, change diesel price", async ({ page }) => {
    await login(page);

    // Phone number -> Call button on the driver page.
    await page.goto("/masters?tab=drivers");
    await page.getByRole("button", { name: "Edit driver JAVAHIR" }).click();
    await page.getByLabel("Phone").fill("98765 43210");
    await page.screenshot({ path: "test-results/screens/phone-masters-driver-sheet.png" });
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByRole("button", { name: "Edit driver JAVAHIR" })).toContainText("98765 43210");

    // Merge VISHAL (6 trips) into VIKRAM (8 trips): VIKRAM ends with 14, VISHAL becomes a spelling.
    await page.getByRole("button", { name: "Edit driver VISHAL" }).click();
    await page.getByRole("dialog").getByPlaceholder("Type the correct name").fill("vikram");
    await page.getByRole("dialog").getByRole("button", { name: "Vikram" }).click();
    await page.getByRole("button", { name: "Merge into Vikram" }).click();
    await page.getByRole("button", { name: /Tap again/ }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByRole("button", { name: "Edit driver VIKRAM" })).toContainText("14 trips");
    await expect(page.getByRole("button", { name: "Edit driver VIKRAM" })).toContainText("also VISHAL");
    await expect(page.getByRole("button", { name: "Edit driver VISHAL" })).toHaveCount(0);

    // New place, then merge it into Vadodara.
    await page.goto("/masters?tab=places");
    await page.getByRole("button", { name: "Add place" }).click();
    await page.getByLabel("Name").fill("Vadodra Bypass");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await page.getByRole("button", { name: "Edit VADODRA BYPASS" }).click();
    await page.getByRole("dialog").getByPlaceholder("Type the correct place").fill("vadodara");
    await page.getByRole("dialog").getByRole("button", { name: "Vadodara", exact: true }).click();
    await page.getByRole("button", { name: "Merge into Vadodara" }).click();
    await page.getByRole("button", { name: /Tap again/ }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByRole("button", { name: "Edit VADODARA", exact: true })).toContainText("VADODRA BYPASS");

    // Diesel price from today.
    await page.goto("/masters?tab=diesel");
    await page.getByRole("textbox", { name: /Diesel price per litre/ }).fill("99.10");
    await page.getByRole("button", { name: "Save price" }).click();
    await expect(page.getByText("₹99.10/L")).toBeVisible();
  });
});

test.describe("import with blank cells", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("imports blank rows, flags them on Home, and the flag clears once filled in", async ({ page }) => {
    // October sheet: one complete trip, one with blank trailer and destination, one empty template row.
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("OCT-26");
    ws.addRow(["F", "DATE", "TRAILER NO", "DRIVER", "LR NO", "FROM", "DESTINATION", "NO CAR", "DIESEL", "Rate/ltr", "Diesel Amount", "POD", "Maint", "TRIP", "Total Cost", "Trip Revenue", "Profit/Loss", "REMARK", "DEALER"]);
    const day = new Date(Date.UTC(2026, 9, 5));
    ws.addRow([1, day, "NL01AL1658", "RAJESH", 7001, "OCPL(DETROJ)", "AHMEDABAD", 6, 65, 98.36, null, 300, null, 1000, null, 15871]);
    ws.addRow([2, day, null, "DALBIR", 7002, "OCPL(DETROJ)", null, 7, 65, 98.36, null, 300, null, 1000, null, 15871]);
    ws.addRow([3, null, null, null, null, null, null, null, null, 98.36, null, 300]);
    const file = "test-results/oct-with-blanks.xlsx";
    await wb.xlsx.writeFile(file);

    await login(page);
    await page.goto("/import");
    await page.locator('input[type="file"]').setInputFiles(file);
    await page.getByRole("button", { name: "Preview" }).click();
    await expect(page.getByText(/Will import with missing details/)).toBeVisible();
    await expect(page.getByText(/1 empty row skipped/)).toBeVisible();
    await page.getByRole("button", { name: "Import 2 trips" }).click();
    await expect(page.getByText("Imported 2 trips")).toBeVisible();

    await page.goto("/dashboard?m=2026-10");
    await expect(page.getByText("trip is missing details from the import")).toBeVisible();
    await page.screenshot({ path: "test-results/screens/pc-home-missing-details.png" });
    await page.getByRole("link", { name: "Fill in" }).click();
    await expect(page.getByText("Missing details")).toBeVisible(); // active filter chip
    await page.getByRole("link", { name: /Trip LR 7002/ }).click();
    await expect(page.getByText("Missing: trailer, destination")).toBeVisible();
    await page.screenshot({ path: "test-results/screens/pc-trip-missing-details.png" });

    await page.getByRole("link", { name: "Fill in missing details" }).click();
    await page.getByRole("button", { name: /^Trailer NL01N3650/ }).click();
    await page.getByRole("group", { name: "Destinations" }).getByRole("button", { name: "Ahmedabad", exact: true }).click();
    await page.getByRole("button", { name: "Save changes" }).first().click();
    await page.waitForURL(/\/trips\/\d+\?/);
    await expect(page.getByText(/^Missing:/)).toHaveCount(0);
    await page.goto("/dashboard?m=2026-10");
    await expect(page.getByText("missing details from the import")).toHaveCount(0);
  });
});
