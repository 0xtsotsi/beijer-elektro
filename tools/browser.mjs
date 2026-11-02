// Laadt Playwright, met terugval op de installatie van deze werkomgeving.
// Gebruik: import { loadPlaywright } from "./browser.mjs";
import { existsSync } from "node:fs";
import { join } from "node:path";

const candidates = [];

if (process.env.LOCALAPPDATA) {
  candidates.push(
    join(
      process.env.LOCALAPPDATA,
      "GG Coder",
      "sidecar",
      "node_modules",
      "playwright",
      "index.mjs"
    )
  );
}

export async function loadPlaywright() {
  for (const specifier of ["playwright", "playwright-core"]) {
    try {
      return await import(specifier);
    } catch (error) {
      if (error.code !== "ERR_MODULE_NOT_FOUND") throw error;
    }
  }

  for (const path of candidates) {
    if (existsSync(path)) {
      return import(`file://${path.replace(/\\/g, "/")}`);
    }
  }

  throw new Error(
    "Playwright is niet geinstalleerd. Voer uit: npm install --save-dev playwright && npx playwright install chromium"
  );
}
