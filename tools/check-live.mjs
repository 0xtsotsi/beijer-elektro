// Draait dezelfde controles tegen een live site.
// Gebruik: node tools/check-live.mjs
//
//   URL=https://jouw-account.github.io/jouw-repo/ npm run check:live
import { loadPlaywright } from "./browser.mjs";

const url = process.env.URL || "http://localhost:4173/";

const results = [];
const record = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  -> " + detail : ""}`);
};

const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });

const apiCalls = [];
page.on("response", (response) => {
  if (response.url().includes("/api/")) {
    apiCalls.push(`${response.status()} ${response.url()}`);
  }
});
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

await page.goto(url, { waitUntil: "networkidle" });

// 1. De pagina laadt zonder fouten.
record("geen javascriptfouten", errors.length === 0, errors.join(" | "));

// 2. De stylesheet en het script komen binnen.
const assets = await page.evaluate(() => ({
  stylesheets: [...document.styleSheets].length,
  scripts: document.querySelectorAll("script[src]").length,
  hasTitle: document.title.length > 10,
}));
record(
  "de pagina heeft stijl en script",
  assets.stylesheets > 0 && assets.scripts > 0 && assets.hasTitle,
  JSON.stringify(assets)
);

// 3. Het formulier werkt op de live site.
const form = await page.locator("form").first();
if ((await form.count()) === 0) {
  record("er staat een formulier op de pagina", false, "geen formulier gevonden");
} else {
  record("er staat een formulier op de pagina", true);

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
  await page.waitForTimeout(2000);

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

  record(
    "het formulier verdwijnt na versturen",
    state.formHidden === true,
    `hidden=${state.formHidden}`
  );
  record("er verschijnt een resultaat", state.resultVisible);

  // Op een statische host bestaat de api-route niet. Dan moet de terugval
  // naar de e-mailapp verschijnen. Op een eigen server werkt de api wel.
  const apiOk = apiCalls.some((call) => call.startsWith("200"));
  if (apiOk) {
    record(
      "de aanvraag is door de api verwerkt",
      true,
      apiCalls.join(", ")
    );
  } else {
    record(
      "de aanvraag komt via de e-mailapp binnen",
      state.mailVisible && (state.mailHref || "").startsWith("mailto:"),
      apiCalls.length
        ? `api gaf ${apiCalls.join(", ")}, dus de terugval moet verschijnen`
        : "geen api-route, dus de terugval moet verschijnen"
    );
  }
}

await browser.close();

const failed = results.filter((result) => !result.pass);
console.log(`\n${results.length - failed.length}/${results.length} geslaagd`);
process.exit(failed.length ? 1 : 0);
