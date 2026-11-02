// Reproduceert de volledige invulflow van het offerteformulier.
// Gebruik: node tools/check-form.mjs
import { loadPlaywright } from "./browser.mjs";

const url = process.env.URL || "http://localhost:4173/";
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
const logs = [];
page.on("console", (m) => logs.push(`[console:${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
page.on("requestfailed", (r) => logs.push(`[requestfailed] ${r.url()}`));
page.on("response", (r) => {
  if (r.url().includes("/api/")) logs.push(`[api] ${r.status()} ${r.url()}`);
});

await page.goto(url + "#offerte", { waitUntil: "networkidle" });

const state = () =>
  page.evaluate(() => {
    const form = document.getElementById("offerte-form");
    const cb = document.getElementById("akkoord");
    return {
      checked: cb.checked,
      errorShown: !document.getElementById("akkoord-error").hidden,
      errorText: document.getElementById("akkoord-error").textContent,
      status: document.getElementById("form-status").textContent.trim(),
      formHidden: form.hidden,
      resultHidden: document.getElementById("form-result").hidden,
      naam: form.elements["naam"].value,
      type: form.elements["type"].value,
      omschrijving: form.elements["omschrijving"].value.length,
    };
  });

await page.fill("#naam", "Familie Jansen");
await page.fill("#telefoon", "0612345678");
await page.fill("#email", "jansen@example.nl");
await page.fill("#adres", "Dorpsstraat 12");
await page.fill("#plaats", "Rozenburg");
await page.fill("#omschrijving", "De stoppenkast in de gang is oud en moet worden vervangen.");
await page.selectOption("#type", "stoppenkast");
await page.click("#akkoord");
await page.waitForTimeout(200);
console.log("vóór submit:", JSON.stringify(await state()));

await page.click("[data-submit]");
await page.waitForTimeout(1200);
console.log("na submit: ", JSON.stringify(await state()));

console.log("\n--- gebeurtenissen ---");
console.log(logs.join("\n") || "(geen)");

await browser.close();
