// Controleert de volledige invulflow van het aanvraagformulier, inclusief de
// validatie, de foutstatus en de successtatus.
//
// Gebruik: node tools/check-form.mjs
//
// De selectors komen uit een lijst aan het begin. Pas die aan als je project
// andere namen gebruikt.
import { loadPlaywright } from "./browser.mjs";

const url = process.env.URL || "http://localhost:4173/";

// De velden van het formulier, met een waarde die aan de validatie voldoet.
const VELDEN = [
  { selector: "#naam", waarde: "Familie Jansen" },
  { selector: "#telefoon", waarde: "0612345678" },
  { selector: "#email", waarde: "jansen@example.nl" },
  { selector: "#adres", waarde: "Dorpsstraat 12" },
  { selector: "#plaats", waarde: "Rozenburg" },
];

async function run() {
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

  const results = [];
  const record = (name, pass, detail) => {
    results.push({ name, pass, detail });
    console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  -> " + detail : ""}`);
  };

  await page.goto(url + "#offerte", { waitUntil: "networkidle" });

  const form = await page.locator("form").first();
  const hasForm = (await form.count()) > 0;
  record("er staat een formulier op de pagina", hasForm);
  if (!hasForm) {
    await browser.close();
    return 1;
  }

  // 1. Leeg versturen: de validatie moet ingrijpen.
  await page.locator('form button[type="submit"]').first().click();
  await page.waitForTimeout(400);

  const invalid = await page.evaluate(() => {
    const errors = [...document.querySelectorAll("form [aria-invalid='true']")];
    const status = document.querySelector("[role='status']");
    return {
      count: errors.length,
      status: status ? status.textContent.trim() : "",
      statusVisible: status ? !status.hidden && status.offsetHeight > 0 : false,
      focused: document.activeElement
        ? document.activeElement.name || document.activeElement.tagName
        : "",
    };
  });

  record(
    "leeg versturen geeft veldfouten",
    invalid.count > 0,
    `${invalid.count} velden gemarkeerd`
  );
  record(
    "de foutmelding is zichtbaar en benoemt het aantal",
    invalid.statusVisible && /\d/.test(invalid.status),
    invalid.status
  );
  record(
    "de focus gaat naar het eerste probleem",
    invalid.focused !== "" && invalid.focused !== "BODY",
    `focus staat op ${invalid.focused}`
  );

  // 2. Vul het formulier.
  for (const veld of VELDEN) {
    const element = page.locator(veld.selector);
    if ((await element.count()) === 0) continue;
    await element.fill(veld.waarde);
  }

  const select = page.locator("form select");
  if ((await select.count()) > 0) {
    const waarden = await select.locator("option").evaluateAll((options) =>
      options.map((option) => option.value).filter(Boolean)
    );
    if (waarden.length > 0) await select.selectOption(waarden[0]);
  }

  const textarea = page.locator("form textarea");
  if ((await textarea.count()) > 0) {
    await textarea.fill(
      "Dit is een testomschrijving van de offerteaanvraag, ruim lang genoeg."
    );
  }

  const checkbox = page.locator('form input[type="checkbox"]');
  if ((await checkbox.count()) > 0) await checkbox.first().check();

  // 3. Versturen.
  await page.locator('form button[type="submit"]').first().click();
  await page.waitForTimeout(1500);

  const done = await page.evaluate(() => {
    const form = document.querySelector("form");
    const result = document.querySelector(".form-result, [data-result-title]");
    const mailLink = document.querySelector("[data-result-mail]");
    return {
      formHidden: form ? form.hidden : null,
      resultVisible: result ? !result.hidden && result.offsetHeight > 0 : false,
      title: document.querySelector("[data-result-title]")
        ? document.querySelector("[data-result-title]").textContent.trim()
        : "",
      mailHref: mailLink ? mailLink.getAttribute("href") : null,
      mailVisible: mailLink ? !mailLink.hidden : false,
    };
  });

  record(
    "na versturen is het formulier weg",
    done.formHidden === true,
    `hidden=${done.formHidden}`
  );
  record(
    "na versturen is er een resultaat",
    done.resultVisible,
    done.title
  );

  // 4. Een api-route werkt, of er verschijnt een mailto-link.
  const apiOk = apiCalls.some((call) => call.startsWith("200"));
  if (apiOk) {
    record("de aanvraag is door de api verwerkt", true, apiCalls.join(", "));
  } else {
    record(
      "de aanvraag komt via de e-mailapp binnen",
      done.mailVisible && (done.mailHref || "").startsWith("mailto:"),
      apiCalls.length
        ? `api gaf ${apiCalls.join(", ")}`
        : "geen api-route"
    );
    const decoded = done.mailHref ? decodeURIComponent(done.mailHref) : "";
    record(
      "de mail bevat de ingevulde gegevens",
      decoded.includes("Familie Jansen"),
      decoded.slice(0, 80)
    );
  }

  record("geen javascriptfouten", errors.length === 0, errors.join(" | "));

  await browser.close();

  const failed = results.filter((result) => !result.pass);
  console.log(`\n${results.length - failed.length}/${results.length} geslaagd`);
  return failed.length;
}

process.exit((await run()) > 0 ? 1 : 0);
