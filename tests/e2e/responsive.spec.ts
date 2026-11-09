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
