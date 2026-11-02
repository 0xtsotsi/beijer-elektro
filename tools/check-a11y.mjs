// Toetsing van toegankelijkheid en interactie volgens WCAG 2.2 AA.
// Gebruik: node tools/check-a11y.mjs
import { loadPlaywright } from "./browser.mjs";

const url = process.env.URL || "http://localhost:4173/";

async function run() {
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch();
  const results = [];

  const record = (name, pass, detail) => {
    results.push({ name, pass, detail });
    console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  -> " + detail : ""}`);
  };

  // Contrast meten via de browser zelf.
  const measureContrast = async (page, fg, bg) =>
    page.evaluate(
      ([fgSel, bgSel]) => {
        // Converteert elke CSS-kleur (oklch, color-mix, rgb) naar sRGB met alpha.
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        const toRgba = (css) => {
          if (!css) return null;
          ctx.clearRect(0, 0, 1, 1);
          ctx.fillStyle = "#000";
          ctx.fillStyle = css;
          ctx.fillRect(0, 0, 1, 1);
          const d = ctx.getImageData(0, 0, 1, 1).data;
          return [d[0] / 255, d[1] / 255, d[2] / 255, d[3] / 255];
        };
        // sRGB moet eerst naar lineair licht worden omgerekend.
        const linear = (c) =>
          c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        const lum = (rgb) =>
          0.2126 * linear(rgb[0]) +
          0.7152 * linear(rgb[1]) +
          0.0722 * linear(rgb[2]);
        // Legt een doorzichtige laag over een onderliggende kleur.
        const over = (top, bottom) => {
          const a = top[3];
          return [
            top[0] * a + bottom[0] * (1 - a),
            top[1] * a + bottom[1] * (1 - a),
            top[2] * a + bottom[2] * (1 - a),
            1,
          ];
        };

        const fgEl = document.querySelector(fgSel);
        const bgEl = document.querySelector(bgSel);
        if (!fgEl || !bgEl) return null;

        // Zoekt de werkelijke achtergrond door de lagen van binnen naar buiten
        // te leggen totdat er een ondoorzichtige laag is gevonden.
        const backgroundOf = (el) => {
          const layers = [];
          let node = el;
          while (node) {
            const rgba = toRgba(getComputedStyle(node).backgroundColor);
            if (rgba && rgba[3] > 0) {
              layers.push(rgba);
              if (rgba[3] >= 0.999) break;
            }
            node = node.parentElement;
          }
          if (!layers.length) {
            return toRgba(getComputedStyle(document.body).backgroundColor);
          }
          let result = layers[layers.length - 1];
          for (let index = layers.length - 2; index >= 0; index -= 1) {
            result = over(layers[index], result);
          }
          return result;
        };

        const background = backgroundOf(bgEl);
        const foreground = toRgba(getComputedStyle(fgEl).color);
        if (!foreground || !background) return null;

        const fg = foreground[3] >= 0.999 ? foreground.slice(0, 3) : over(foreground, background).slice(0, 3);
        const bg = background.slice(0, 3);

        const l1 = lum(fg);
        const l2 = lum(bg);
        const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
        return (hi + 0.05) / (lo + 0.05);
      },
      [fg, bg]
    );

  /* --------------------------------------------------- bureau + mobiel */
  for (const [label, viewport] of [
    ["desktop", { width: 1440, height: 900 }],
    ["mobiel", { width: 390, height: 844 }],
  ]) {
    const page = await browser.newPage({ viewport });
    await page.goto(url, { waitUntil: "networkidle" });

    // 1. Paginatitel en taal
    const title = await page.title();
    record(
      `[${label}] paginatitel`,
      title.length > 10 && title.length < 70,
      title
    );
    const lang = await page.evaluate(() => document.documentElement.lang);
    record(`[${label}] documenttaal`, lang === "nl", lang);

    // 2. Er is precies een h1
    const h1 = await page.locator("h1").count();
    record(`[${label}] precies een h1`, h1 === 1, `${h1} gevonden`);

    // 3. Landmarks
    const landmarks = await page.evaluate(() => ({
      header: document.querySelectorAll("header").length,
      main: document.querySelectorAll("main").length,
      footer: document.querySelectorAll("footer").length,
      nav: document.querySelectorAll("nav").length,
    }));
    record(
      `[${label}] landmarks`,
      landmarks.main === 1 &&
        landmarks.header === 1 &&
        landmarks.footer === 1,
      JSON.stringify(landmarks)
    );

    // 4. Skip-link werkt
    const skip = await page.evaluate(() => {
      const link = document.querySelector(".skip-link");
      link.focus();
      return document.activeElement === link;
    });
    record(`[${label}] skip-link focusbaar`, skip);

    // 5. Focus zichtbaar op alle zichtbare links en knoppen
    const focusVisible = await page.evaluate(() => {
      const els = [
        ...document.querySelectorAll("a[href], button, input, select, textarea"),
      ];
      const bad = [];
      for (const el of els) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        el.focus();
        const s = getComputedStyle(el);
        const hasRing =
          s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0;
        if (!hasRing) bad.push(el.tagName + "." + el.className);
      }
      return bad;
    });
    record(
      `[${label}] focusindicator zichtbaar`,
      focusVisible.length === 0,
      focusVisible.join(", ")
    );

    // 6. Labels bij invoervelden
    const unlabelled = await page.evaluate(() =>
      [...document.querySelectorAll("input, select, textarea")]
        .filter((el) => el.type !== "hidden")
        .filter((el) => {
          if (el.getAttribute("aria-label") || el.getAttribute("aria-labelledby"))
            return false;
          if (el.id && document.querySelector(`label[for="${el.id}"]`))
            return false;
          return !el.closest("label");
        })
        .map((el) => el.name || el.id || el.tagName)
    );
    record(
      `[${label}] alle velden hebben een label`,
      unlabelled.length === 0,
      unlabelled.join(", ")
    );

    // 7. Tekstcontrast van de hoofdrol
    const pairs = [
      [".hero__lede", ".hero__copy"],
      [".section__lede", ".section__head"],
      [".service__text", ".service"],
      [".card__text", ".card"],
      [".card__list li", ".card"],
      [".step__text", ".step"],
      [".project__text", ".project"],
      [".project__tag", ".project"],
      [".contact__note", ".contact__item"],
      [".nav__list a", ".nav"],
      [".site-footer__line", ".site-footer"],
      [".facts__value", ".facts__item"],
      [".board__key", ".board"],
      [".form-card__legal", ".form-card"],
      [".privacy__text", ".section"],
      [".privacy__note", ".section"],
      [".map__labels text", ".map"],
      [".review__text", ".review__quote"],
      [".review__meta", ".review__score"],
    ];
    for (const [fg, bg] of pairs) {
      const ratio = await measureContrast(page, fg, bg);
      if (ratio === null) {
        record(`[${label}] contrast ${fg}`, false, "element niet gevonden");
        continue;
      }
      record(`[${label}] contrast ${fg}`, ratio >= 4.5, `${ratio.toFixed(2)}:1`);
    }

    // 8. Doelwit van 24x24 css-pixels (WCAG 2.2 SC 2.5.8).
    //    Inline links in een zin zijn uitgezonderd; verborgen velden ook.
    const smallTargets = await page.evaluate(() => {
      const visible = [
        ...document.querySelectorAll("a[href], button, input, select, textarea"),
      ].filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return false;
        if (el.closest(".skip-link")) return false;
        if (el.closest(".field--hidden")) return false;
        return true;
      });

      // Een doelwit is voldoende als het minstens 24x24 is, of als er een cirkel
      // met een diameter van 24px omheen past zonder een ander doelwit te raken
      // (de uitzondering voorafstand in SC 2.5.8).
      const boxes = visible.map((el) => ({ el, r: el.getBoundingClientRect() }));

      const tooSmall = [];
      for (const { el, r } of boxes) {
        if (r.width >= 24 && r.height >= 24) continue;

        // Inline link in een zin: uitzondering.
        const p = el.closest("p");
        if (
          el.tagName === "A" &&
          p &&
          p.textContent.trim() !== el.textContent.trim()
        )
          continue;

        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const overlaps = boxes.some((other) => {
          if (other.el === el) return false;
          const o = other.r;
          const nx = Math.max(o.left, Math.min(cx, o.right));
          const ny = Math.max(o.top, Math.min(cy, o.bottom));
          return Math.hypot(cx - nx, cy - ny) < 12;
        });

        if (!overlaps) continue;

        tooSmall.push(
          `${el.tagName}.${el.className}(${Math.round(r.width)}x${Math.round(
            r.height
          )})`
        );
      }
      return tooSmall;
    });
    record(
      `[${label}] doelwit minstens 24px`,
      smallTargets.length === 0,
      smallTargets.join(", ")
    );

    // 9. Geen horizontale overloop
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth
    );
    record(
      `[${label}] geen horizontale overloop`,
      overflow <= 1,
      `${overflow}px`
    );

    // 10. Select met gereserveerde ruimte voor de pijl
    const select = await page.evaluate(() => {
      const el = document.querySelector(".field__control--select");
      const chevron = document.querySelector(".select__chevron");
      if (!el || !chevron) return null;
      const e = el.getBoundingClientRect();
      const c = chevron.getBoundingClientRect();
      return {
        paddingEnd: parseFloat(getComputedStyle(el).paddingRight),
        chevronGap: e.right - c.right,
        chevronWidth: c.width,
        overflows: c.right > e.right + 0.5 || c.left < e.left,
      };
    });
    record(
      `[${label}] selectpijl met ruimte`,
      select &&
        !select.overflows &&
        select.chevronGap >= 8 &&
        select.paddingEnd >= select.chevronWidth + 8,
      JSON.stringify(select)
    );

    await page.close();
  }

  /* --------------------------------------------------- gereduceerde beweging */
  {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce",
    });
    await page.goto(url, { waitUntil: "networkidle" });
    const durations = await page.evaluate(() =>
      [
        ...document.querySelectorAll(
          ".current-line__pulse, .current-line__node, .board__pulse circle"
        ),
      ].map((el) => getComputedStyle(el).animationDuration)
    );
    record(
      "reduced motion: animaties uitgezet",
      durations.every((d) => parseFloat(d) <= 0.02),
      durations.join(", ")
    );
    await page.close();
  }

  /* --------------------------------------------------- 320px en 200% zoom */
  {
    const page = await browser.newPage({ viewport: { width: 320, height: 700 } });
    await page.goto(url, { waitUntil: "networkidle" });
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth
    );
    record("320px: geen horizontale overloop", overflow <= 1, `${overflow}px`);

    const zoomed = await browser.newPage({
      viewport: { width: 1280, height: 800 },
    });
    await zoomed.goto(url, { waitUntil: "networkidle" });
    // Browsenzoom van 200% op 1280px is hetzelfde als 640px CSS-breedte.
    await zoomed.setViewportSize({ width: 640, height: 800 });
    await zoomed.waitForTimeout(200);
    const zoomOverflow = await zoomed.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth
    );
    record(
      "200% zoom (640px): geen horizontale overloop",
      zoomOverflow <= 1,
      `${zoomOverflow}px`
    );
    await zoomed.close();
    await page.close();
  }

  /* --------------------------------------------------- toetsenbord */
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(url, { waitUntil: "networkidle" });

    const focusable = await page.evaluate(
      () =>
        [...document.querySelectorAll("a[href], button, input, select, textarea")].filter(
          (el) => el.offsetParent !== null || el.classList.contains("skip-link")
        ).length
    );
    record(
      "toetsenbord: aantal focusbare elementen",
      focusable > 20,
      `${focusable}`
    );

    // Menu op mobiel: openen met toetsenbord, sluiten met Escape.
    const mobile = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    await mobile.goto(url, { waitUntil: "networkidle" });
    await mobile.locator("[data-nav-toggle]").focus();
    await mobile.keyboard.press("Enter");
    await mobile.waitForTimeout(200);
    const expanded = await mobile
      .locator("[data-nav-toggle]")
      .getAttribute("aria-expanded");
    record(
      "mobiel menu: opent met toetsenbord",
      expanded === "true",
      `aria-expanded=${expanded}`
    );
    await mobile.keyboard.press("Escape");
    await mobile.waitForTimeout(200);
    const collapsed = await mobile
      .locator("[data-nav-toggle]")
      .getAttribute("aria-expanded");
    const focusReturned = await mobile.evaluate(
      () => document.activeElement === document.querySelector("[data-nav-toggle]")
    );
    record(
      "mobiel menu: Escape sluit en geeft focus terug",
      collapsed === "false" && focusReturned,
      `aria-expanded=${collapsed}, focus terug=${focusReturned}`
    );
    await mobile.close();
    await page.close();
  }

  /* --------------------------------------------------- ontbrekende bestanden */
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const missing = [];
    page.on("response", (response) => {
      if (response.status() === 404 && !response.url().includes("favicon")) {
        missing.push(response.url());
      }
    });
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    record(
      "geen ontbrekende bestanden",
      missing.length === 0,
      missing.join(", ")
    );
    await page.close();
  }

  await browser.close();

  const failed = results.filter((result) => !result.pass);
  console.log(`\n${results.length - failed.length}/${results.length} geslaagd`);
  if (failed.length) {
    console.log("\nMislukt:");
    failed.forEach((entry) => console.log(` - ${entry.name}: ${entry.detail}`));
  }
  return failed.length;
}

process.exit((await run()) > 0 ? 1 : 0);
