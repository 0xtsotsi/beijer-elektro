// Werkt de harde verwijzingen naar de oude eigenaar bij in de verhuiste websites.
// Gebruik: node tools/forwarding/update-site-urls.mjs [--only <repo>] [--dry-run]

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(path.join(here, "redirects.json"), "utf8"));
const { oldOwner, newOwner, sites } = config;

const dryRun = process.argv.includes("--dry-run");
const onlyIndex = process.argv.indexOf("--only");
const only = onlyIndex > -1 ? process.argv[onlyIndex + 1] : null;

const TEXT_EXT = new Set([
  ".html",
  ".md",
  ".txt",
  ".xml",
  ".json",
  ".yml",
  ".yaml",
  ".js",
  ".mjs",
  ".css",
  ".astro",
  ".ts",
  ".svg",
]);

function gh(args, { allowFail = false } = {}) {
  try {
    return execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (err) {
    if (allowFail) return null;
    throw new Error(`gh ${args.join(" ")} mislukte:\n${err.stderr || err.message}`);
  }
}

function repoExists(owner, repo) {
  return gh(["api", `repos/${owner}/${repo}`], { allowFail: true }) !== null;
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

for (const site of sites.filter((item) => !only || item.repo === only)) {
  const owner = newOwner;
  console.log(`\n=== ${site.repo} ===`);
  if (!repoExists(owner, site.repo)) {
    console.log("  staat nog niet bij de nieuwe eigenaar, overslaan");
    continue;
  }

  const tree = JSON.parse(
    gh(["api", `repos/${owner}/${site.repo}/git/trees/main?recursive=1`])
  );
  const candidates = tree.tree.filter(
    (item) =>
      item.type === "blob" &&
      item.size < 300000 &&
      TEXT_EXT.has(path.extname(item.path).toLowerCase())
  );

  let changed = 0;
  for (const item of candidates) {
    const raw = gh(["api", `repos/${owner}/${site.repo}/contents/${item.path}`], {
      allowFail: true,
    });
    if (!raw) continue;
    const payload = JSON.parse(raw);
    if (payload.content === undefined) continue;
    const text = Buffer.from(payload.content, "base64").toString("utf8");
    if (!text.includes(oldOwner)) continue;

    const updated = text.split(oldOwner).join(newOwner);
    changed += 1;
    if (dryRun) {
      console.log(`  zou ${item.path} bijwerken`);
    } else {
      putFile(
        owner,
        site.repo,
        item.path,
        updated,
        `Werk de verwijzingen naar ${newOwner} bij`
      );
      console.log(`  ${item.path} bijgewerkt`);
    }
  }
  console.log(changed === 0 ? "  geen verwijzingen naar de oude eigenaar gevonden" : `  ${changed} bestand(en) bijgewerkt`);
}
