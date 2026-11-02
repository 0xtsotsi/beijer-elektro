// Scant assets/img/projecten en schrijft manifest.json met de foto's
// die er daadwerkelijk staan. De website toont alleen bestaande foto's.
// Gebruik: node tools/build-photos.mjs
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const photoDir = join(root, "assets", "img", "projecten");
const configPath = join(root, "tools", "photos.config.json");
const manifestPath = join(photoDir, "manifest.json");

const config = JSON.parse(readFileSync(configPath, "utf8"));
const present = existsSync(photoDir) ? readdirSync(photoDir) : [];

// Vaste volgorde volgt de volgorde van het configuratiebestand.
const photos = Object.fromEntries(
  Object.entries(config)
    .filter(([, meta]) => present.includes(meta.file))
    .map(([slug, meta]) => [
      slug,
      { src: `assets/img/projecten/${meta.file}`, alt: meta.alt },
    ])
);

writeFileSync(manifestPath, JSON.stringify(photos, null, 2) + "\n", "utf8");

const found = Object.keys(photos);
console.log(
  found.length
    ? `Manifest bijgewerkt: ${found.length} foto(s) gevonden (${found.join(", ")}).`
    : "Manifest bijgewerkt: geen foto's gevonden, de website toont de illustraties."
);
