// Controleert de terugval op de e-mailapp op een echte live-site.
// Gebruik: node tools/check-live.mjs
import { loadPlaywright } from "./browser.mjs";

const url = process.env.URL || "https://jalvdbroek-ship-it.github.io/beijer-elektro/";

const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });

const apiResponses = [];
page.on("response", (response) => {
  if (response.url().includes("/api/")) {
    apiResponses.push(`${response.status()} ${response.url()}`);
  }
});
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

await page.goto(url + "#offerte", { waitUntil: "networkidle" });

await page.fill("#naam", "Familie Jansen");
await page.fill("#telefoon", "0612345678");
await page.fill("#email", "jansen@example.nl");
await page.selectOption("#type", "stoppenkast");
await page.fill(
  "#omschrijving",
  "De stoppenkast in de gang is oud en moet worden vervangen."
);
await page.click("#akkoord");
await page.click("[data-submit]");
await page.waitForTimeout(2500);

const state = await page.evaluate(() => {
  const link = document.querySelector("[data-result-mail]");
  return {
    formHidden: document.getElementById("offerte-form").hidden,
    resultHidden: document.getElementById("form-result").hidden,
    title: document.querySelector("[data-result-title]").textContent.trim(),
    mailVisible: link ? !link.hidden : false,
    mailHref: link ? link.getAttribute("href") : null,
  };
});

const decoded = state.mailHref ? decodeURIComponent(state.mailHref) : "";

const checks = [
  ["geen javascriptfouten", errors.length === 0],
  ["formulier is verborgen", state.formHidden === true],
  ["resultaat is zichtbaar", state.resultHidden === false],
  ["e-mailknop is zichtbaar", state.mailVisible === true],
  ["knop wijst naar info@beijerektro.nl", decoded.includes("info@beijerektro.nl")],
  ["naam staat in de mail", decoded.includes("Familie Jansen")],
  ["omschrijving staat in de mail", decoded.includes("stoppenkast in de gang")],
];

console.log("api-antwoorden:", apiResponses.join(", ") || "(geen)");
console.log("status:", JSON.stringify(state, null, 2));
console.log("mail:\n" + decoded);

await browser.close();

let failed = 0;
checks.forEach(([name, pass]) => {
  if (!pass) failed += 1;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}`);
});
console.log(`\n${checks.length - failed}/${checks.length} geslaagd`);
process.exit(failed ? 1 : 0);
