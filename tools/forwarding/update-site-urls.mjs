// Werkt de harde verwijzingen naar de oude eigenaar bij in de verhuiste websites.
// Gebruik: node tools/forwarding/update-site-urls.mjs [--only <repo>] [--dry-run]

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
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

function repoFullName(owner, repo) {
  const out = gh(["api", `repos/${owner}/${repo}`], { allowFail: true });
  if (!out) return null;
  try {
    return JSON.parse(out).full_name;
  } catch {
    return null;
  }
}

function fileSha(owner, repo, filePath) {
  const out = gh(["api", `repos/${owner}/${repo}/contents/${filePath}`], { allowFail: true });
  if (!out) return null;
  try {
    return JSON.parse(out).sha;
  } catch {
    return null;
  }
}

function putFile(owner, repo, filePath, content, message) {
  const payload = {
    message,
    content: Buffer.from(content, "utf8").toString("base64"),
    branch: "main",
  };
  const sha = fileSha(owner, repo, filePath);
  if (sha) payload.sha = sha;
  const tmp = path.join(os.tmpdir(), `gh-payload-${process.pid}-${Date.now()}.json`);
  writeFileSync(tmp, JSON.stringify(payload));
  try {
    gh([
      "api",
      "--method",
      "PUT",
      `repos/${owner}/${repo}/contents/${filePath}`,
      "--input",
      tmp,
    ]);
  } finally {
    rmSync(tmp, { force: true });
  }
}

function rewrite(text, site, newRepo) {
  let updated = text;
  updated = updated
    .split(`${oldOwner}/${site.repo}`)
    .join(`${newOwner}/${newRepo}`);
  if (newRepo !== site.repo) {
    updated = updated.split(`github.io/${site.repo}`).join(`github.io/${newRepo}`);
  }
  return updated.split(oldOwner).join(newOwner);
}

for (const site of sites.filter((item) => !only || item.repo === only)) {
  const owner = newOwner;
  const newRepo = site.newRepo || site.repo;
  console.log(`\n=== ${site.repo} ===`);
  if (repoFullName(owner, newRepo) !== `${owner}/${newRepo}`) {
    console.log("  staat nog niet bij de nieuwe eigenaar, overslaan");
    continue;
  }

  const tree = JSON.parse(
    gh(["api", `repos/${owner}/${newRepo}/git/trees/main?recursive=1`])
  );
  const candidates = tree.tree.filter(
    (item) =>
      item.type === "blob" &&
      item.size < 300000 &&
      !item.path.startsWith("tools/forwarding/") &&
      TEXT_EXT.has(path.extname(item.path).toLowerCase())
  );

  let changed = 0;
  for (const item of candidates) {
    const raw = gh(["api", `repos/${owner}/${newRepo}/contents/${item.path}`], {
      allowFail: true,
    });
    if (!raw) continue;
    const payload = JSON.parse(raw);
    if (payload.content === undefined) continue;
    const text = Buffer.from(payload.content, "base64").toString("utf8");
    if (!text.includes(oldOwner)) continue;

    const updated = rewrite(text, site, newRepo);
    if (updated === text) continue;
    changed += 1;
    if (dryRun) {
      console.log(`  zou ${item.path} bijwerken`);
    } else {
      putFile(
        owner,
        newRepo,
        item.path,
        updated,
        `Werk de verwijzingen naar ${newOwner} bij`
      );
      console.log(`  ${item.path} bijgewerkt`);
    }
  }
  console.log(
    changed === 0
      ? "  geen verwijzingen naar de oude eigenaar gevonden"
      : `  ${changed} bestand(en) bijgewerkt`
  );
}
