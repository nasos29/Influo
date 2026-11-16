import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.resolve(__dirname, "preview.html");
const url = "file:///" + file.replace(/\\/g, "/");
const out = __dirname;

const browser = await chromium.launch();
const shots = [
  { name: "desktop-unseen.png", w: 1280, h: 900, sel: "[data-shot=creator-unseen]" },
  { name: "desktop-seen.png", w: 1280, h: 900, sel: "[data-shot=creator-seen]" },
  { name: "desktop-brand.png", w: 1280, h: 900, sel: "[data-shot=brand-open]" },
  { name: "mobile-unseen.png", w: 390, h: 844, sel: "[data-shot=creator-unseen]" },
  { name: "mobile-seen.png", w: 390, h: 844, sel: "[data-shot=creator-seen]" },
];

for (const s of shots) {
  const page = await browser.newPage({ viewport: { width: s.w, height: s.h } });
  await page.goto(url);
  const el = await page.$(s.sel);
  if (el) await el.screenshot({ path: path.join(out, s.name) });
  else await page.screenshot({ path: path.join(out, s.name), fullPage: true });
  await page.close();
}

const desk = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await desk.goto(url);
await desk.screenshot({ path: path.join(out, "desktop-full.png"), fullPage: true });
await desk.close();

const mob = await browser.newPage({ viewport: { width: 390, height: 844 } });
await mob.goto(url);
await mob.screenshot({ path: path.join(out, "mobile-full.png"), fullPage: true });
await mob.close();

await browser.close();
console.log(fs.readdirSync(out).join("\n"));
