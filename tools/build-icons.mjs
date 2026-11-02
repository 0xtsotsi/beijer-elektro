// Bouwt de inline icon-sprite in public/index.html.
// Gebruik: node tools/build-icons.mjs
//
// Pictogrammen komen uit de Lucide-tekenset (ISC-licentie). Ontbrekende
// bestanden worden opgehaald bij de CDN van het project, zodat een verse
// clone zonder de map .icons/ ook werkt.
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const LUCIDE_VERSION = "0.544.0";
const CDN = `https://cdn.jsdelivr.net/npm/lucide-static@${LUCIDE_VERSION}/icons`;

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const iconDir = join(root, ".icons");
const target = join(root, "public", "index.html");

async function fetchIcon(name) {
  const response = await fetch(`${CDN}/${name}.svg`);
  if (!response.ok) {
    throw new Error(`Pictogram ${name} niet gevonden (${response.status})`);
  }
  return response.text();
}

async function loadIcon(name) {
  const file = join(iconDir, `${name}.svg`);
  if (existsSync(file)) {
    return readFileSync(file, "utf8");
  }
  const svg = await fetchIcon(name);
  mkdirSync(iconDir, { recursive: true });
  writeFileSync(file, svg, "utf8");
  return svg;
}

const html = readFileSync(target, "utf8");
const used = [...new Set([...html.matchAll(/#i-([a-z0-9-]+)/g)].map((m) => m[1]))].sort();

const symbols = [];
for (const name of used) {
  const svg = await loadIcon(name);
  const inner = svg
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/^[\s\S]*?<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "")
    .trim();
  symbols.push(`    <symbol id="i-${name}" viewBox="0 0 24 24">${inner}</symbol>`);
}

const block = `<!-- sprite:start -->\n    <svg class="sprite" aria-hidden="true" focusable="false">\n${symbols.join(
  "\n"
)}\n    </svg>\n    <!-- sprite:end -->`;

const pattern = /<!-- sprite:start -->[\s\S]*?<!-- sprite:end -->/;
if (!pattern.test(html)) {
  console.error("Geen sprite-markers gevonden in public/index.html");
  process.exit(1);
}

const next = html.replace(pattern, () => block);
if (next === html) {
  console.log(`Sprite is al actueel: ${symbols.length} iconen`);
} else {
  writeFileSync(target, next);
  console.log(`Sprite bijgewerkt: ${symbols.length} iconen`);
}

// Verwijdert pictogrammen die niet meer in de pagina voorkomen.
if (existsSync(iconDir)) {
  const current = readdirSync(iconDir).filter((file) => file.endsWith(".svg"));
  const unused = current.filter((file) => !used.includes(file.replace(/\.svg$/, "")));
  unused.forEach((file) => {
    unlinkSync(join(iconDir, file));
  });
  if (unused.length) {
    console.log(`Verwijderd: ${unused.length} ongebruikte pictogrammen`);
  }
}
