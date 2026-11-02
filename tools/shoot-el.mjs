// Maakt een opname van een specifiek element op de pagina.
// Gebruik: node tools/shoot-el.mjs <selector> [naam]
import { loadPlaywright } from "./browser.mjs";

const [selector, name = "el"] = process.argv.slice(2);
const url = process.env.URL || "http://localhost:4173/";
const width = Number(process.env.WIDTH || 1440);
const height = Number(process.env.HEIGHT || 900);

const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height } });
await page.goto(url, { waitUntil: "networkidle" });

const el = page.locator(selector).first();
await el.scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
await el.screenshot({ path: `.gg/screenshots/${name}.png` });
console.log(`.gg/screenshots/${name}.png`);

await browser.close();
