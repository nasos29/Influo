/**
 * Playwright check: opening a public profile on a mobile viewport must stay at scrollY ~ 0
 * (not jumped down to the About / «Σχετικά» tabs). Uses Chromium device emulation.
 *
 * Usage: node scripts/verify-mobile-profile-scroll.mjs [baseUrl] [profilePath]
 * Defaults: http://127.0.0.1:3000 /in/sofia-berneanou
 */
import { chromium, devices } from "playwright";

const base = process.argv[2] || "http://127.0.0.1:3000";
const profilePath = process.argv[3] || "/in/sofia-berneanou";
const url = new URL(profilePath, base).href;

const iPhone = devices["iPhone 13"];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  ...iPhone,
  locale: "el-GR",
});
const page = await context.newPage();

let failed = false;
try {
  const res = await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 });
  if (!res || !res.ok()) {
    throw new Error(`GET ${url} → ${res?.status()}`);
  }

  // Wait for profile shell / About heading to exist (content below the fold).
  await page.waitForSelector("text=Σχετικά", { timeout: 60_000 });

  // Allow any delayed effects (former scrollIntoView was smooth).
  await page.waitForTimeout(1200);

  const scrollY = await page.evaluate(() => window.scrollY || window.pageYOffset || 0);
  const aboutTop = await page.evaluate(() => {
    const h = [...document.querySelectorAll("h2")].find((el) =>
      /Σχετικά|About/i.test(el.textContent || "")
    );
    if (!h) return null;
    return h.getBoundingClientRect().top;
  });

  console.log(JSON.stringify({ url, scrollY, aboutTop, viewport: iPhone.viewport }, null, 2));

  // Top of page: scroll should stay near 0. About heading should be well below the fold.
  if (scrollY > 80) {
    console.error(`FAIL: page scrolled to y=${scrollY} (expected <= 80)`);
    failed = true;
  }
  if (aboutTop != null && aboutTop < 120) {
    console.error(`FAIL: «Σχετικά» is near viewport top (top=${aboutTop}); expected below fold`);
    failed = true;
  }
  if (!failed) {
    console.log("OK: mobile profile opens at top (header/photo), not at About");
  }
} catch (err) {
  console.error(String(err?.stack || err));
  failed = true;
} finally {
  await browser.close();
}

process.exit(failed ? 1 : 0);
