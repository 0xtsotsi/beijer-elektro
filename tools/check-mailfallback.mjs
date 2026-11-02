// Test de terugval op de e-mailapp: de pagina wordt geserveerd zonder api.
// Gebruik: node tools/check-mailfallback.mjs
import { loadPlaywright } from "./browser.mjs";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const siteDir = join(root);

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

// Statische host: alles wordt geserveerd, maar er is geen api-route.
const server = createServer(async (request, response) => {
  const pathname = decodeURIComponent(
    new URL(request.url, "http://localhost").pathname
  );
  const relative = pathname.replace(/^\/+/, "");
  const file = join(siteDir, relative === "" ? "index.html" : relative);
  try {
    const content = await readFile(file);
    response.writeHead(200, {
      "Content-Type":
        mime[extname(file).toLowerCase()] || "application/octet-stream",
    });
    response.end(content);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

await new Promise((resolve) => server.listen(4200, resolve));

const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });

await page.goto("http://localhost:4200/#offerte", { waitUntil: "networkidle" });

await page.fill("#naam", "Familie Jansen");
await page.fill("#telefoon", "0612345678");
await page.fill("#email", "jansen@example.nl");
await page.selectOption("#type", "stoppenkast");
await page.fill("#omschrijving", "De stoppenkast in de gang is oud en moet worden vervangen.");
await page.click("#akkoord");
await page.click("[data-submit]");
await page.waitForTimeout(1200);

const state = await page.evaluate(() => ({
  formHidden: document.getElementById("offerte-form").hidden,
  resultHidden: document.getElementById("form-result").hidden,
  title: document.querySelector("[data-result-title]").textContent.trim(),
  text: document.querySelector("[data-result-text]").textContent.trim(),
}));

const mailto = await page.evaluate(() => {
  const link = document.querySelector("[data-result-mail]");
  return link && !link.hidden ? link.getAttribute("href") : null;
});

console.log("status:", JSON.stringify(state, null, 2));
console.log("\nmailto:", mailto ? decodeURIComponent(mailto) : "GEEN mailto geopend");

const checks = [
  ["formulier is verborgen", state.formHidden === true],
  ["resultaat is zichtbaar", state.resultHidden === false],
  ["titel noemt de aanvraag", state.title.includes("klaar")],
  ["er is een mailto-link", mailto !== null],
  ["mail gaat naar info@beijerektro.nl", (mailto || "").includes("info@beijerektro.nl")],
  ["naam staat in de mail", decodeURIComponent(mailto || "").includes("Familie Jansen")],
  ["omschrijving staat in de mail", decodeURIComponent(mailto || "").includes("stoppenkast in de gang")],
  ["type klus staat in de mail", decodeURIComponent(mailto || "").includes("Stoppenkast of meterkast")],
  ["spoed staat in de mail", decodeURIComponent(mailto || "").includes("Geen haast")],
];

await browser.close();
server.close();

let failed = 0;
checks.forEach(([name, pass]) => {
  if (!pass) failed += 1;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}`);
});
console.log(`\n${checks.length - failed}/${checks.length} geslaagd`);
process.exit(failed ? 1 : 0);
