// Controleert of de beweging op de pagina klopt: de stroom of een ander
// georkestreeerd moment moet in hetzelfde ritme lopen als de elementen die
// daarop reageren.
//
// Dit script is generiek. Het zoekt zelf de animaties met een
// animation-delay en controleert of de bijbehorende elementen synchroon
// oplichten.
//
// Gebruik: node tools/check-current.mjs
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

  // Zoek de groep elementen die op hetzelfde ritme reageren: dezelfde
  // animatieduur, verschillende vertraging.
  const groups = await page.evaluate(() => {
    const buckets = new Map();

    for (const el of document.querySelectorAll("*")) {
      const style = getComputedStyle(el);
      const name = style.animationName;
      if (!name || name === "none") continue;
      const duration = parseFloat(style.animationDuration);
      const delay = parseFloat(style.animationDelay);
      const iteration = style.animationIterationCount;
      if (iteration !== "infinite") continue;
      if (!Number.isFinite(duration)) continue;

      const key = `${name}|${duration}`;
      if (!buckets.has(key)) {
        buckets.set(key, { name, duration, members: [] });
      }
      buckets.get(key).members.push({
        delay,
        tag: el.tagName.toLowerCase(),
        cls: String(el.className || "").split(" ")[0],
      });
    }

    return [...buckets.values()]
      .filter((group) => group.members.length >= 3)
      .map((group) => ({
        name: group.name,
        duration: group.duration,
        count: group.members.length,
        delays: group.members.map((m) => Math.round(m.delay * 1000)).sort((a, b) => a - b),
      }));
  });

  if (groups.length === 0) {
    record(
      "een georkestreeerde beweging met meerdere elementen",
      true,
      "geen groep gevonden, niets te controleren"
    );
  } else {
    for (const group of groups) {
      // De vertragingen horen oplopend verdeeld te zijn over de cyclus.
      const spread = group.delays[group.delays.length - 1] - group.delays[0];
      const withinCycle = group.delays.every((delay) => delay < group.duration * 1000);
      const ordered = group.delays.every(
        (delay, index) => index === 0 || delay >= group.delays[index - 1]
      );

      record(
        `beweging "${group.name}" loopt over de hele cyclus`,
        withinCycle && ordered && spread > 0,
        `${group.count} elementen, vertragingen ${group.delays.join("/")}ms in een cyclus van ${group.duration * 1000}ms`
      );
    }
  }

  // De beweging moet ook echt lopen. De Web Animations API zegt dat
  // betrouwbaar, ongeacht welke eigenschap er verandert.
  const moving = await page.evaluate(async () => {
    const animations = document.getAnimations().filter(
      (animation) => animation.playState === "running"
    );
    if (animations.length === 0) return { found: false };

    const first = animations[0];
    const start = first.currentTime;
    await new Promise((resolve) => setTimeout(resolve, 300));
    const later = first.currentTime;

    return {
      found: true,
      changed: later !== start,
      count: animations.length,
    };
  });

  record(
    "de beweging loopt daadwerkelijk",
    !moving.found || moving.changed,
    moving.found
      ? `${moving.count} actieve animaties, ${moving.changed ? "tijdlijn loopt" : "staat stil"}`
      : "geen beweging gevonden"
  );

  await browser.close();

  const failed = results.filter((result) => !result.pass);
  console.log(`\n${results.length - failed.length}/${results.length} geslaagd`);
  return failed.length;
}

process.exit((await run()) > 0 ? 1 : 0);
