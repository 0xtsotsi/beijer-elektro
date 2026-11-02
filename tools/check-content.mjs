// Controleert de koppenstructuur, de beoordelingsweergave en de taal van de tekst.
// Gebruik: node tools/check-content.mjs
//
//   URL=https://jouw-account.github.io/jouw-repo/ npm run check:content
import { loadPlaywright } from "./browser.mjs";

const url = process.env.URL || "http://localhost:4173/";

async function run() {
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(url, { waitUntil: "networkidle" });

  const results = [];
  const record = (name, pass, detail) => {
    results.push({ name, pass, detail });
    console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  -> " + detail : ""}`);
  };

  // 1. Koppenstructuur: geen niveau wordt overgeslagen.
  const outline = await page.evaluate(() =>
    [...document.querySelectorAll("h1, h2, h3, h4, h5, h6")].map((heading) => ({
      level: Number(heading.tagName[1]),
      text: heading.textContent.trim().replace(/\s+/g, " "),
    }))
  );

  console.log("Koppenstructuur:");
  const problems = [];
  let previous = 0;
  outline.forEach((heading) => {
    console.log(
      `  ${"  ".repeat(heading.level - 1)}h${heading.level}  ${heading.text}`
    );
    if (previous && heading.level > previous + 1) {
      problems.push(
        `h${previous} wordt gevolgd door h${heading.level} bij "${heading.text}"`
      );
    }
    previous = heading.level;
  });

  record(
    "koppenstructuur sluit aan",
    problems.length === 0,
    problems.join(" | ")
  );
  record(
    "precies een h1",
    outline.filter((h) => h.level === 1).length === 1,
    `${outline.filter((h) => h.level === 1).length} gevonden`
  );

  // 2. Beoordeling: het getoonde gemiddelde moet kloppen met de sterren.
  const rating = await page.evaluate(() => {
    const number = document.querySelector(".review__number");
    const stars = document.querySelector(".review__stars");
    const fill = document.querySelector(".review__stars-fill");
    const base = document.querySelector(".review__stars-base");
    if (!number || !stars || !fill || !base) return null;

    const total = stars.getBoundingClientRect().width;
    const filled = fill.getBoundingClientRect().width;
    return {
      number: number.textContent.trim(),
      percentage: Math.round((filled / total) * 100),
      label: stars.getAttribute("aria-label"),
    };
  });

  if (rating === null) {
    record("beoordeling: geen sterrenweergave gevonden", true, "niet van toepassing");
  } else {
    const expected = Math.round(
      (parseFloat(rating.number.replace(",", ".")) / 5) * 100
    );
    record(
      "beoordeling: sterren komen overeen met het getoonde gemiddelde",
      Math.abs(rating.percentage - expected) <= 2,
      `${rating.number} zou ${expected}% geven, de site toont ${rating.percentage}%`
    );
    record(
      "beoordeling: aria-label noemt de score",
      (rating.label || "").includes(rating.number),
      rating.label || "geen aria-label"
    );
  }

  // 3. Geen em-dash in de zichtbare tekst.
  const emDash = await page.evaluate(() => {
    const text = document.body.innerText;
    const index = text.indexOf("—");
    return index === -1 ? null : text.slice(Math.max(0, index - 40), index + 40);
  });
  record(
    "geen em-dash in de zichtbare tekst",
    emDash === null,
    emDash || ""
  );

  // 4. Geen emoji als interface. Sterretjes en andere dingbats zijn
  //    typografie, geen emoji, dus die vallen buiten de check.
  const emoji = await page.evaluate(() => {
    const text = document.body.innerText;
    const found = text.match(/[\u{1F000}-\u{1FAFF}\u{FE0F}]/gu);
    return found ? found.join(" ") : null;
  });
  record("geen emoji in de zichtbare tekst", emoji === null, emoji || "");

  await browser.close();

  const failed = results.filter((result) => !result.pass);
  console.log(`\n${results.length - failed.length}/${results.length} geslaagd`);
  return failed.length;
}

process.exit((await run()) > 0 ? 1 : 0);
