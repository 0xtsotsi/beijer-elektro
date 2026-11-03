// Bouwt de doorstuurpagina's voor websites die naar een nieuwe GitHub-eigenaar verhuizen.
// Gebruik: node tools/forwarding/build-redirect.mjs --repo body-action-xl [--path /contact/]

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));

export const TOKENS = {
  paper: "oklch(0.975 0.006 235)",
  surface: "oklch(1 0 0)",
  ink: "oklch(0.27 0.03 245)",
  ink2: "oklch(0.45 0.025 245)",
  line: "oklch(0.63 0.022 235)",
  petrol: "oklch(0.42 0.075 240)",
  petrolDeep: "oklch(0.3 0.055 245)",
  brassInk: "oklch(0.5 0.1 70)",
};

const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%23205272'/%3E%3Cpath d='M8 16h13m0 0-5-5m5 5-5 5' fill='none' stroke='%23ffffff' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";

const esc = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const STYLES = `
    :root {
      --paper: ${TOKENS.paper};
      --surface: ${TOKENS.surface};
      --ink: ${TOKENS.ink};
      --ink-2: ${TOKENS.ink2};
      --line: ${TOKENS.line};
      --petrol: ${TOKENS.petrol};
      --petrol-deep: ${TOKENS.petrolDeep};
      --focus: ${TOKENS.brassInk};
    }

    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    html {
      -webkit-text-size-adjust: 100%;
    }

    body {
      margin: 0;
      min-height: 100svh;
      display: flex;
      background: var(--paper);
      color: var(--ink);
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
        Helvetica, Arial, sans-serif;
      line-height: 1.55;
    }

    main {
      margin: auto;
      width: 100%;
      max-width: 34rem;
      padding: 3rem 1.25rem;
    }

    .label {
      margin: 0 0 0.75rem;
      font-size: 0.8125rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--ink-2);
    }

    h1 {
      margin: 0 0 1rem;
      font-size: clamp(1.5rem, 1.15rem + 1.6vw, 2.125rem);
      line-height: 1.2;
      text-wrap: balance;
    }

    .lead {
      margin: 0 0 1.75rem;
      font-size: 1.0625rem;
      color: var(--ink-2);
    }

    .action {
      margin: 0 0 1.25rem;
    }

    .button {
      display: inline-block;
      padding: 0.875rem 1.375rem;
      border: 2px solid transparent;
      border-radius: 0.5rem;
      background: var(--petrol);
      color: #fff;
      font-weight: 600;
      text-decoration: none;
    }

    .button:hover {
      background: var(--petrol-deep);
    }

    .button:focus-visible {
      outline: 3px solid var(--focus);
      outline-offset: 3px;
    }

    .note {
      margin: 0;
      padding-top: 1.25rem;
      border-top: 1px solid var(--line);
      font-size: 0.9375rem;
      color: var(--ink-2);
      overflow-wrap: anywhere;
    }
`;

export function buildRedirect({ name, target, description }) {
  const safeName = esc(name);
  const safeTarget = esc(target);
  const safeDescription = esc(description);
  const title = `${name} is verplaatst | Nieuwe website`;

  return `<!doctype html>
<html lang="nl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(title)}</title>
    <meta name="description" content="${safeDescription}" />
    <meta name="robots" content="noindex, follow" />
    <meta http-equiv="refresh" content="0; url=${safeTarget}" />
    <link rel="canonical" href="${safeTarget}" />
    <link rel="icon" href="${FAVICON}" />
    <style>${STYLES}    </style>
  </head>
  <body>
    <main>
      <p class="label">Verplaatst</p>
      <h1>De website van ${safeName} staat nu op een nieuwe locatie</h1>
      <p class="lead">
        Je wordt automatisch doorgestuurd. Werkt dat niet, open de website dan
        handmatig.
      </p>
      <p class="action">
        <a class="button" href="${safeTarget}">Open de nieuwe website van ${safeName}</a>
      </p>
      <p class="note">Nieuwe adres: ${safeTarget}</p>
    </main>
  </body>
</html>
`;
}

export function buildNotFound({ name, target }) {
  const safeName = esc(name);
  const safeTarget = esc(target);

  return `<!doctype html>
<html lang="nl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Pagina niet gevonden | ${esc(name)}</title>
    <meta name="robots" content="noindex, follow" />
    <meta http-equiv="refresh" content="0; url=${safeTarget}" />
    <link rel="canonical" href="${safeTarget}" />
    <link rel="icon" href="${FAVICON}" />
    <style>${STYLES}    </style>
  </head>
  <body>
    <main>
      <p class="label">Verplaatst</p>
      <h1>Deze pagina staat niet meer op deze locatie</h1>
      <p class="lead">
        Je wordt doorgestuurd naar de website van ${safeName}. Werkt dat niet,
        open de website dan handmatig.
      </p>
      <p class="action">
        <a class="button" href="${safeTarget}">Open de website van ${safeName}</a>
      </p>
      <p class="note">Nieuwe adres: ${safeTarget}</p>
    </main>
  </body>
</html>
`;
}

export function repoPathFor(page) {
  if (page.endsWith("/")) return `${page.slice(1)}index.html`;
  return page.slice(1);
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const config = JSON.parse(readFileSync(path.join(here, "redirects.json"), "utf8"));
  const repoArg = process.argv.indexOf("--repo");
  const pathArg = process.argv.indexOf("--path");
  const repo = repoArg > -1 ? process.argv[repoArg + 1] : null;
  const page = pathArg > -1 ? process.argv[pathArg + 1] : "/";
  const site = config.sites.find((item) => item.repo === repo);
  if (!site) {
    console.error(`Onbekende repo: ${repo}`);
    process.exit(1);
  }
  const base = `https://${config.newOwner}.github.io/${site.repo}`;
  const target = base + (page === "/" ? "/" : page);
  process.stdout.write(buildRedirect({ name: site.name, target, description: site.description }));
}
