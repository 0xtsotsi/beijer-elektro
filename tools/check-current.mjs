// Meet de tijdlijn van de stroom: positie van de straal en welke knop oplicht.
// Gebruik: node tools/check-current.mjs
import { loadPlaywright } from "./browser.mjs";

const url = process.env.URL || "http://localhost:4173/";
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 800 } });
await page.goto(url, { waitUntil: "networkidle" });

await page.locator(".current-line").scrollIntoViewIfNeeded();
await page.waitForTimeout(150);

const result = await page.evaluate(async () => {
  const rail = document.querySelector(".current-line__rail");
  const pulse = document.querySelector(".current-line__pulse");
  const nodes = [...document.querySelectorAll(".current-line__node")];

  // Een knop is oplicht als de achtergrond de koperen kleur heeft (L rond 82%),
  // niet de witte standaardkleur (L 100%).
  const isLit = (node) => {
    const color = getComputedStyle(node).backgroundColor;
    const oklab = color.match(/oklab\(([\d.]+)/);
    if (oklab) return parseFloat(oklab[1]) * 100 < 92;
    const oklch = color.match(/oklch\(([\d.]+)%/);
    if (oklch) return parseFloat(oklch[1]) < 92;
    const rgb = color.match(/rgba?\(([^)]+)\)/);
    if (rgb) {
      const [r, g, b] = rgb[1].split(",").map((v) => parseFloat(v));
      const l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      return l < 0.92;
    }
    return false;
  };

  const railBox = rail.getBoundingClientRect();
  const head = () => {
    const box = pulse.getBoundingClientRect();
    return ((box.right - railBox.left) / railBox.width) * 100;
  };

  // Zet alle animaties op hetzelfde startpunt zodat de meting deterministisch is.
  const anims = document.getAnimations();
  anims.forEach((a) => {
    a.pause();
    a.currentTime = 0;
  });
  await new Promise((r) => setTimeout(r, 50));
  anims.forEach((a) => a.play());

  const timeline = [];
  const start = performance.now();
  while (performance.now() - start < 3600) {
    const t = performance.now() - start;
    timeline.push({
      t: Math.round(t),
      head: Math.round(head()),
      lit: nodes.map((n) => (isLit(n) ? 1 : 0)).join(""),
    });
    await new Promise((r) => setTimeout(r, 25));
  }
  return timeline;
});

let last = "";
for (const s of result) {
  if (s.lit !== last) {
    console.log(`t=${String(s.t).padStart(4)}ms  straal=${String(s.head).padStart(4)}%  knopen=${s.lit}`);
    last = s.lit;
  }
}

await browser.close();
