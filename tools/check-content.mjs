// Controleert de koppenstructuur en de weergave van de sterrenbeoordeling.
// Gebruik: node tools/check-content.mjs
import { loadPlaywright } from "./browser.mjs";

const url = process.env.URL || "http://localhost:4173/";

async function run() {
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(url, { waitUntil: "networkidle" });

  const outline = await page.evaluate(() =>
    [...document.querySelectorAll("h1, h2, h3")].map((heading) => ({
      level: Number(heading.tagName[1]),
      text: heading.textContent.trim().replace(/\s+/g, " "),
      section:
        heading.closest("section, header, footer, div[id]")?.id || "-",
    }))
  );

  console.log("Koppenstructuur:");
  const problems = [];
  let previous = 0;
  outline.forEach((heading) => {
    console.log(
      `  ${"  ".repeat(heading.level - 1)}h${heading.level}  [${heading.section}] ${heading.text}`
    );
    if (previous && heading.level > previous + 1) {
      problems.push(
        `h${previous} wordt gevolgd door h${heading.level} bij "${heading.text}"`
      );
    }
    previous = heading.level;
  });
  console.log(
    problems.length
      ? "\nHIERARCHIE PROBLEMEN:\n" + problems.join("\n")
      : "\nHiërarchie sluit aan."
  );

  // De sterren moeten de score van 3,7 van de 5 weergeven: 74 procent gevuld.
  const stars = await page.evaluate(() => {
    const wrap = document.querySelector(".review__stars");
    const fill = document.querySelector(".review__stars-fill");
    const base = document.querySelector(".review__stars-base");
    if (!wrap || !fill || !base) return null;
    const total = wrap.getBoundingClientRect().width;
    const filled = fill.getBoundingClientRect().width;
    return {
      total: Math.round(total),
      filled: Math.round(filled),
      percentage: Math.round((filled / total) * 100),
      label: wrap.getAttribute("aria-label"),
      number: document.querySelector(".review__number").textContent.trim(),
      baseVisible: getComputedStyle(base).color,
    };
  });

  console.log("\nBeoordeling:", JSON.stringify(stars, null, 2));

  const expected = Math.round(
    (parseFloat(stars.number.replace(",", ".")) / 5) * 100
  );
  const starsOk = Math.abs(stars.percentage - expected) <= 2;
  console.log(
    `${starsOk ? "PASS" : "FAIL"}  sterren tonen ${stars.percentage}% gevuld, score ${stars.number} zou ${expected}% geven`
  );

  // Alle tekst op de pagina moet zonder em-dash.
  const emDash = await page.evaluate(() => {
    const text = document.body.innerText;
    const index = text.indexOf("—");
    return index === -1 ? null : text.slice(Math.max(0, index - 40), index + 40);
  });
  console.log(
    `${emDash ? "FAIL" : "PASS"}  geen em-dash in de zichtbare tekst${
      emDash ? ": " + emDash : ""
    }`
  );

  await browser.close();
  return starsOk && !emDash && problems.length === 0;
}

process.exit((await run()) ? 0 : 1);
