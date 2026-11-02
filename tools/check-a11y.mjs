// Toetsing van toegankelijkheid en interactie volgens WCAG 2.2 AA.
// Gebruik: node tools/check-a11y.mjs
//
// De controles zijn generiek: de selectors worden uit de pagina afgeleid,
// niet hardcoded. Zo werkt het script in elk project.
//
// Start eerst de lokale server, of geef de live site mee:
//   URL=https://jouw-account.github.io/jouw-repo/ npm run check:a11y
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

  // Meet het contrast van elk zichtbaar tekstelement tegen zijn
  // werkelijke achtergrond, met lagen samengesteld.
  const measureAllText = async (page) =>
    page.evaluate(() => {
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

      const linear = (c) =>
        c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      const lum = (rgb) =>
        0.2126 * linear(rgb[0]) +
        0.7152 * linear(rgb[1]) +
        0.0722 * linear(rgb[2]);
      const over = (top, bottom) => {
        const a = top[3];
        return [
          top[0] * a + bottom[0] * (1 - a),
          top[1] * a + bottom[1] * (1 - a),
          top[2] * a + bottom[2] * (1 - a),
          1,
        ];
      };

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
        for (let i = layers.length - 2; i >= 0; i -= 1) {
          result = over(layers[i], result);
        }
        return result;
      };

      const isVisible = (el) => {
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") return false;
        if (parseFloat(style.opacity) === 0) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };

      const hasOwnText = (el) =>
        [...el.childNodes].some(
          (node) => node.nodeType === 3 && node.textContent.trim().length > 0
        );

      const worst = [];
      const seen = new Set();

      for (const el of document.querySelectorAll(
        "p, h1, h2, h3, h4, h5, h6, li, a, span, label, button, td, th, figcaption, blockquote, dt, dd, legend, summary, option, input, textarea"
      )) {
        if (!hasOwnText(el) || !isVisible(el)) continue;

        const style = getComputedStyle(el);
        const color = toRgba(style.color);
        if (!color) continue;

        const background = backgroundOf(el);
        if (!background) continue;

        const foreground =
          color[3] >= 0.999 ? color.slice(0, 3) : over(color, background).slice(0, 3);
        const l1 = lum(foreground);
        const l2 = lum(background.slice(0, 3));
        const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
        const ratio = (hi + 0.05) / (lo + 0.05);

        const size = parseFloat(style.fontSize);
        const weight = Number(style.fontWeight) || 400;
        const isLarge = size >= 24 || (size >= 18.66 && weight >= 700);
        const minimum = isLarge ? 3 : 4.5;

        const key = `${style.color}|${style.backgroundColor}|${size}|${weight}`;
        if (seen.has(key)) continue;
        seen.add(key);

        if (ratio < minimum) {
          worst.push({
            selector:
              el.tagName.toLowerCase() +
              (el.className && typeof el.className === "string"
                ? "." + el.className.trim().split(/\s+/).join(".")
                : ""),
            ratio: Math.round(ratio * 100) / 100,
            minimum,
            size,
            text: el.textContent.trim().slice(0, 40),
          });
        }
      }

      worst.sort((a, b) => a.ratio - b.ratio);
      return worst.slice(0, 12);
    });

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

    // 2. Precies een h1
    const h1 = await page.locator("h1").count();
    record(`[${label}] precies een h1`, h1 === 1, `${h1} gevonden`);

    // 3. Landmarks
    const landmarks = await page.evaluate(() => ({
      header: document.querySelectorAll("header").length,
      main: document.querySelectorAll("main").length,
      footer: document.querySelectorAll("footer").length,
    }));
    record(
      `[${label}] landmarks`,
      landmarks.main === 1 &&
        landmarks.header === 1 &&
        landmarks.footer === 1,
      JSON.stringify(landmarks)
    );

    // 4. Skip-link
    const skip = await page.evaluate(() => {
      const link = document.querySelector(".skip-link, a[href^='#']:first-of-type");
      if (!link) return false;
      link.focus();
      return document.activeElement === link;
    });
    record(`[${label}] skip-link focusbaar`, skip);

    // 5. Focusindicator zichtbaar
    const focusVisible = await page.evaluate(() => {
      const bad = [];
      for (const el of document.querySelectorAll(
        "a[href], button, input, select, textarea"
      )) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue;
        el.focus();
        const style = getComputedStyle(el);
        const hasRing =
          style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
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

    // 7. Tekstcontrast van elk zichtbaar tekstelement
    const worst = await measureAllText(page);
    record(
      `[${label}] tekstcontrast`,
      worst.length === 0,
      worst
        .map((w) => `${w.selector} ${w.ratio}:1 (min ${w.minimum})`)
        .join(" | ")
    );

    // 8. Doelwit van 24x24 css-pixels (WCAG 2.2 SC 2.5.8)
    const smallTargets = await page.evaluate(() => {
      const visible = [
        ...document.querySelectorAll("a[href], button, input, select, textarea"),
      ].filter((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        if (el.closest(".skip-link")) return false;
        return true;
      });

      const boxes = visible.map((el) => ({ el, r: el.getBoundingClientRect() }));
      const tooSmall = [];

      for (const { el, r } of boxes) {
        if (r.width >= 24 && r.height >= 24) continue;

        // Inline link in een zin: uitzondering.
        const paragraph = el.closest("p");
        if (
          el.tagName === "A" &&
          paragraph &&
          paragraph.textContent.trim() !== el.textContent.trim()
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
      const el = document.querySelector("select");
      const wrapper = el && el.parentElement;
      const chevron =
        wrapper && wrapper.querySelector("svg, .icon, [class*='chevron'], [class*='arrow']");
      if (!el) return null;
      const e = el.getBoundingClientRect();
      if (!chevron) {
        // Zonder eigen pijl moet de browser zijn eigen indicator tonen.
        return { native: true, paddingEnd: parseFloat(getComputedStyle(el).paddingRight) };
      }
      const c = chevron.getBoundingClientRect();
      return {
        native: false,
        paddingEnd: parseFloat(getComputedStyle(el).paddingRight),
        chevronGap: e.right - c.right,
        chevronWidth: c.width,
        overflows: c.right > e.right + 0.5 || c.left < e.left,
      };
    });
    if (select === null) {
      record(`[${label}] selectpijl met ruimte`, true, "geen select op de pagina");
    } else if (select.native) {
      record(
        `[${label}] selectpijl met ruimte`,
        select.paddingEnd >= 24,
        `browserpijl, padding ${select.paddingEnd}`
      );
    } else {
      record(
        `[${label}] selectpijl met ruimte`,
        !select.overflows &&
          select.chevronGap >= 8 &&
          select.paddingEnd >= select.chevronWidth + 8,
        JSON.stringify(select)
      );
    }

    await page.close();
  }

  /* --------------------------------------------------- gereduceerde beweging */
  {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce",
    });
    await page.goto(url, { waitUntil: "networkidle" });

    // Elke oneindige animatie moet bij prefers-reduced-motion stil staan.
    const still = await page.evaluate(() => {
      const problems = [];
      for (const el of document.querySelectorAll("*")) {
        const style = getComputedStyle(el);
        const names = style.animationName.split(",").map((n) => n.trim());
        const durations = style.animationDuration.split(",").map((d) => parseFloat(d));
        const iterations = style.animationIterationCount.split(",").map((n) => n.trim());
        names.forEach((name, index) => {
          if (!name || name === "none") return;
          const duration = durations[index % durations.length] ?? 0;
          const iteration = iterations[index % iterations.length];
          if (iteration !== "infinite") return;
          if (duration > 0.02) {
            problems.push(
              `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]} ${name}`
            );
          }
        });
      }
      return problems;
    });
    record(
      "reduced motion: oneindige animaties staan stil",
      still.length === 0,
      still.slice(0, 6).join(", ")
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
