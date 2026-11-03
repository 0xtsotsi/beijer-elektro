// Maakt de doorstuurpagina's op de oude URL's aan.
// Gebruik: node tools/forwarding/create-forwarding.mjs [--only <repo>] [--dry-run]

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { buildRedirect, buildNotFound, repoPathFor } from "./build-redirect.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(path.join(here, "redirects.json"), "utf8"));
const { oldOwner, newOwner, sites } = config;

const dryRun = process.argv.includes("--dry-run");
const onlyIndex = process.argv.indexOf("--only");
const only = onlyIndex > -1 ? process.argv[onlyIndex + 1] : null;

const WORKFLOW = `name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  deploy:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Houd de documentatie buiten de publicatie
        run: rm -f README.md

      - uses: actions/configure-pages@v5

      - uses: actions/upload-pages-artifact@v3
        with:
          path: .

      - id: deployment
        uses: actions/deploy-pages@v4
`;

function gh(args, { allowFail = false } = {}) {
  try {
    return execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (err) {
    if (allowFail) return null;
    throw new Error(`gh ${args.join(" ")} mislukte:\n${err.stderr || err.message}`);
  }
}

function repoExists(owner, repo) {
  const out = gh(["api", `repos/${owner}/${repo}`], { allowFail: true });
  return out !== null;
}

function putFile(owner, repo, filePath, content, message) {
  const base64 = Buffer.from(content, "utf8").toString("base64");
  gh([
    "api",
    "--method",
    "PUT",
    `repos/${owner}/${repo}/contents/${filePath}`,
    "-f",
    `message=${message}`,
    "-f",
    `content=${base64}`,
    "-f",
    "branch=main",
  ]);
}

function readme(site) {
  const base = `https://${newOwner}.github.io/${site.repo}`;
  const rows = site.pages
    .map((page) => `| \`${repoPathFor(page)}\` | doorstuurpagina voor ${page} |`)
    .join("\n");
  return `# Doorstuurpagina ${site.name}

De website van ${site.name} is verplaatst van \`${oldOwner}\` naar \`${newOwner}\`.
Deze repository staat op de oude eigenaar en stuurt bezoekers door naar de nieuwe locatie.

## De live site

- Oude URL: https://${oldOwner}.github.io/${site.repo}/
- Nieuwe URL: ${base}/

De oude URL blijft werken: de pagina stuurt meteen door naar de nieuwe locatie.

## De site lokaal openen

Open \`index.html\` in de browser. Er is geen build-stap en geen installatie nodig.

## Mapstructuur

| Bestand | Doel |
| --- | --- |
${rows}
| \`404.html\` | doorstuurpagina voor adressen die niet (meer) bestaan |
| \`.github/workflows/pages.yml\` | publiceert deze repository op GitHub Pages |
| \`README.md\` | dit bestand |

## De site online zetten

Elke push naar \`main\` publiceert de repository opnieuw via de workflow in
\`.github/workflows/pages.yml\`.

## Controle

- \`node tools/forwarding/check-contrast.mjs\` meet de kleurcontrasten van de pagina.
- Open de oude URL en controleer dat je op de nieuwe website uitkomt.

## Wat er staat vast

- De bestemming is de GitHub Pages URL van de nieuwe eigenaar, \`${newOwner}\`.
- De pagina verandert niets aan de inhoud van de website zelf.

## Wat je nog moet doen voor live gang

- Niets. De pagina staat live zodra de workflow klaar is.

## Techniek

Statische HTML in de root van de repository, zonder frameworks en zonder build-stap.
`;
}

async function waitForLive(url, expected, timeoutMs = 300000) {
  const started = Date.now();
  let last = "";
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      const body = await res.text();
      if (body.includes(expected)) return { ok: true, status: res.status };
      last = `status ${res.status}, ${body.length} bytes`;
    } catch (err) {
      last = err.message;
    }
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }
  return { ok: false, status: 0, detail: last };
}

async function run() {
  const targets = only ? sites.filter((site) => site.repo === only) : sites;
  if (targets.length === 0) {
    console.error(`Onbekende repo: ${only}`);
    process.exit(1);
  }

  for (const site of targets) {
    const base = `https://${newOwner}.github.io/${site.repo}`;
    const oldUrl = `https://${oldOwner}.github.io/${site.repo}/`;
    console.log(`\n=== ${site.repo} ===`);

    if (repoExists(oldOwner, site.repo)) {
      console.log("  overdracht nog niet afgerond bij de nieuwe eigenaar, overslaan");
      continue;
    }
    if (!repoExists(newOwner, site.repo)) {
      console.log("  website staat niet (meer) bij de nieuwe eigenaar, overslaan");
      continue;
    }
    console.log(`  website staat bij ${newOwner}`);

    if (!repoExists(oldOwner, site.repo)) {
      if (dryRun) {
        console.log(`  zou repository ${oldOwner}/${site.repo} aanmaken`);
      } else {
        gh([
          "api",
          "--method",
          "POST",
          "user/repos",
          "-f",
          `name=${site.repo}`,
          "-f",
          `description=Doorstuurpagina voor ${site.name}, verplaatst naar ${newOwner}.`,
          "-F",
          "private=false",
          "-F",
          "auto_init=true",
          "-F",
          "has_wiki=false",
          "-F",
          "has_projects=false",
        ]);
        console.log(`  repository ${oldOwner}/${site.repo} aangemaakt`);
      }
    }

    const files = [
      {
        path: ".github/workflows/pages.yml",
        content: WORKFLOW,
        message: "Publiceer de doorstuurpagina op GitHub Pages",
      },
      {
        path: "404.html",
        content: buildNotFound({ name: site.name, target: `${base}/` }),
        message: "Doorstuurpagina voor onbekende adressen",
      },
      {
        path: "README.md",
        content: readme(site),
        message: "Beschrijf de doorstuurpagina",
      },
      ...site.pages.map((page) => ({
        path: repoPathFor(page),
        content: buildRedirect({
          name: site.name,
          target: `${base}${page}`,
          description: site.description,
        }),
        message: `Doorstuurpagina voor ${page}`,
      })),
    ];

    for (const file of files) {
      if (dryRun) {
        console.log(`  zou ${file.path} schrijven (${file.content.length} bytes)`);
      } else {
        putFile(oldOwner, site.repo, file.path, file.content, file.message);
        console.log(`  ${file.path} geschreven`);
      }
    }

    if (dryRun) {
      console.log(`  zou GitHub Pages aanzetten op ${oldOwner}/${site.repo}`);
      continue;
    }

    const pages = gh(
      ["api", "--method", "POST", `repos/${oldOwner}/${site.repo}/pages`, "-f", "build_type=workflow"],
      { allowFail: true }
    );
    if (pages) {
      console.log("  GitHub Pages aangezet (workflow)");
    } else {
      gh([
        "api",
        "--method",
        "POST",
        `repos/${oldOwner}/${site.repo}/pages`,
        "-f",
        "source[branch]=main",
        "-f",
        "source[path]=/",
      ]);
      console.log("  GitHub Pages aangezet (branch)");
    }

    const live = await waitForLive(oldUrl, base);
    if (live.ok) {
      console.log(`  live: ${oldUrl} stuurt door naar ${base}`);
    } else {
      console.log(`  LET OP: ${oldUrl} is nog niet live (${live.detail || live.status})`);
    }
  }
}

await run();
