// Test de terugval op de e-mailapp: de pagina wordt geserveerd zonder api.
// Gebruik: node tools/check-mailfallback.mjs
//
// Dit is de situatie op een statische host zoals GitHub Pages, waar de route
// /api/offertes niet bestaat.
import { loadPlaywright } from "./browser.mjs";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
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

const port = 4200;
await new Promise((resolve) => server.listen(port, resolve));

const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });

const results = [];
const record = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  -> " + detail : ""}`);
};

await page.goto(`http://localhost:${port}/`, { waitUntil: "networkidle" });

const form = await page.locator("form").first();
if ((await form.count()) === 0) {
  console.log("FAIL  er staat geen formulier op de pagina");
  await browser.close();
  server.close();
  process.exit(1);
}

// Vul het formulier.
const velden = [
  ["#naam", "Familie Jansen"],
  ["#telefoon", "0612345678"],
  ["#email", "jansen@example.nl"],
  ["#adres", "Dorpsstraat 12"],
  ["#plaats", "Rozenburg"],
  ["#omschrijving", "Dit is een testomschrijving van de offerteaanvraag."],
];
for (const [selector, waarde] of velden) {
  const element = page.locator(selector);
  if ((await element.count()) > 0) await element.fill(waarde);
}
const select = page.locator("form select");
if ((await select.count()) > 0) {
  const waarden = await select.locator("option").evaluateAll((options) =>
    options.map((option) => option.value).filter(Boolean)
  );
  if (waarden.length > 0) await select.selectOption(waarden[0]);
}
const checkbox = page.locator('form input[type="checkbox"]');
if ((await checkbox.count()) > 0) await checkbox.first().check();

await page.locator('form button[type="submit"]').first().click();
await page.waitForTimeout(1500);

const state = await page.evaluate(() => {
  const form = document.querySelector("form");
  const result = document.querySelector(".form-result, [data-result-title]");
  const mailLink = document.querySelector("[data-result-mail]");
  return {
    formHidden: form ? form.hidden : null,
    resultVisible: result ? !result.hidden && result.offsetHeight > 0 : false,
    mailVisible: mailLink ? !mailLink.hidden : false,
    mailHref: mailLink ? mailLink.getAttribute("href") : null,
  };
});

const decoded = state.mailHref ? decodeURIComponent(state.mailHref) : "";

record("het formulier verdwijnt na versturen", state.formHidden === true);
record("er verschijnt een resultaat", state.resultVisible);
record(
  "er verschijnt een mailto-link",
  state.mailVisible && (state.mailHref || "").startsWith("mailto:"),
  state.mailHref ? "mailto aanwezig" : "geen mailto-link"
);
record(
  "de mail bevat de naam",
  decoded.includes("Familie Jansen"),
  decoded.slice(0, 100)
);
record(
  "de mail bevat het e-mailadres van het bedrijf",
  /mailto:[^@]+@/.test(state.mailHref || ""),
  (state.mailHref || "").slice(0, 40)
);

await browser.close();
server.close();

const failed = results.filter((result) => !result.pass);
console.log(`\n${results.length - failed.length}/${results.length} geslaagd`);
process.exit(failed.length ? 1 : 0);
