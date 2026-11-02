// Test de vangnetregel tegen de voorbeelden die wel en niet moeten matchen.
// Gebruik: node tools/check-rule.mjs
import { readFileSync } from "node:fs";
import { join } from "node:path";

const rulePath = join(
  process.env.HOME || "C:/Users/johnb",
  ".gg",
  "rules",
  "website-standaard-vangnet.md"
);

const raw = readFileSync(rulePath, "utf8");
const frontmatter = raw.match(/^---\n([\s\S]*?)\n---/)[1];

// Zelfde gedrag als de frontmatter-parser van GG Coder.
const unquote = (value) => {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/\\(["\\])/g, "$1");
  }
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'");
  }
  return value;
};

const trigger = unquote(frontmatter.match(/^trigger:\s*(.+)$/m)[1].trim());
const scope = unquote(frontmatter.match(/^scope:\s*(.+)$/m)[1].trim());

const pattern = new RegExp(trigger);
const matches = (text) => {
  pattern.lastIndex = 0;
  return pattern.test(text);
};

console.log("scope:", scope);
console.log("trigger:", trigger.slice(0, 70) + "...");
console.log();

const moetMatchen = [
  "maak een website voor bakkerij de korenbloem",
  "we willen een webshop bouwen voor onze bloemen",
  "maak een site voor ons bedrijf",
  "bouw een homepage voor ons restaurant",
  "ontwerp een nieuwe website",
  "maak een webpagina voor de kapper",
  "maak een landing page voor de zomeractie",
  "graag een website maken voor ons bedrijf",
  "kunt u een website bouwen voor de firma",
  "nieuwe website voor de praktijk",
  "website maken voor de slagerij",
  "maak een website op",
  "maak een webdesign voor de bloemenwinkel",
  "site opzetten voor het restaurant",
  "ik wil een website, net als deze: https://example.nl",
];

const magNietMatchen = [
  "verbeter de website van ons",
  "fix de bug in de css",
  "voeg een contactformulier toe aan de site",
  "maak de pagina sneller",
  "review deze pull request",
  "update de README",
  "wat staat er in de agenda?",
  "refactor de server",
  "schrijf een test voor de api",
];

let fouten = 0;

console.log("MOET matchen:");
moetMatchen.forEach((text) => {
  const hit = matches(text);
  if (!hit) fouten += 1;
  console.log(`${hit ? "  ok  " : "  FOUT"}  ${text}`);
});

console.log();
console.log("MAG NIET matchen:");
magNietMatchen.forEach((text) => {
  const hit = matches(text);
  if (hit) fouten += 1;
  console.log(`${hit ? "  FOUT" : "  ok  "}  ${text}`);
});

console.log();
console.log(fouten ? `${fouten} fout(en)` : "De regel doet precies wat hij moet doen.");
process.exit(fouten ? 1 : 0);
