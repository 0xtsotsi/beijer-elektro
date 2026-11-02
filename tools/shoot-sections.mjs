// Maakt opnames van losse secties, zodat elk onderdeel apart beoordeeld kan worden.
// Gebruik: node tools/shoot-sections.mjs
import { loadPlaywright } from "./browser.mjs";

const url = process.env.URL || "http://localhost:4173/";
const width = Number(process.env.WIDTH || 1440);
const height = Number(process.env.HEIGHT || 900);
const tag = process.env.TAG || "desktop";

const sections = ["diensten", "werkwijze", "projecten", "beoordeling", "offerte", "contact"];

const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height } });
await page.goto(url, { waitUntil: "networkidle" });

for (const id of sections) {
  const el = page.locator(`#${id}`);
  if ((await el.count()) === 0) {
    console.log(`ontbreekt: #${id}`);
    continue;
  }
  await el.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -90));
  await page.waitForTimeout(500);
  const box = await el.boundingBox();
  await page.screenshot({
    path: `.gg/screenshots/sec-${tag}-${id}.png`,
    clip: {
      x: 0,
      y: Math.max(0, box.y),
      width,
      height: Math.min(height, box.height),
    },
  });
  console.log(`sec-${tag}-${id}.png`);
}

await browser.close();
