// Lokale server voor de website van Beijer Elektro.
// Start: node server.js (of: npm start) — geen externe pakketten nodig.
import { createServer } from "node:http";
import { readFile, appendFile, mkdir } from "node:fs/promises";
import { basename, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)));
const dataDir = resolve(root, "data");
const port = Number(process.env.PORT || 4173);

const mimeTypes = Object.freeze({
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
});

// Alleen de website zelf wordt geserveerd, niet de scripts of de documentatie.
const publicRootFiles = new Set(["index.html"]);
const isPublicFile = (relativePath) =>
  publicRootFiles.has(basename(relativePath)) ||
  relativePath.startsWith("assets/");

const rules = {
  naam: (value) =>
    typeof value === "string" && value.trim().length >= 2
      ? ""
      : "Vul uw naam in, minimaal 2 letters.",
  telefoon: (value) =>
    typeof value === "string" && value.replace(/\D/g, "").length >= 6
      ? ""
      : "Vul een telefoonnummer in waar wij u kunnen bellen.",
  email: (value) =>
    typeof value === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())
      ? ""
      : "Vul een geldig e-mailadres in.",
  type: (value) => (typeof value === "string" && value ? "" : "Kies het type klus."),
  omschrijving: (value) =>
    typeof value === "string" && value.trim().length >= 10
      ? ""
      : "Omschrijf kort wat er moet gebeuren, minimaal 10 tekens.",
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function readBody(req, limit = 64 * 1024) {
  return new Promise((resolvePromise, rejectPromise) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        rejectPromise(new Error("body te groot"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolvePromise(Buffer.concat(chunks).toString("utf8")));
    req.on("error", rejectPromise);
  });
}

async function handleOfferte(req, res) {
  let payload;
  try {
    payload = JSON.parse(await readBody(req));
  } catch {
    sendJson(res, 400, { ok: false, error: "De aanvraag kon niet gelezen worden." });
    return;
  }

  // Honeypot: een verborgen veld dat alleen door bots gevuld wordt.
  if (typeof payload.website === "string" && payload.website.trim() !== "") {
    sendJson(res, 200, { ok: true, id: randomUUID() });
    return;
  }

  const errors = {};
  for (const [field, rule] of Object.entries(rules)) {
    const message = rule(payload[field]);
    if (message) errors[field] = message;
  }
  if (!payload.akkoord) {
    errors.akkoord = "Zet dit vinkje aan om uw aanvraag te versturen.";
  }

  if (Object.keys(errors).length > 0) {
    sendJson(res, 400, { ok: false, errors });
    return;
  }

  const entry = {
    id: randomUUID(),
    ontvangen: new Date().toISOString(),
    naam: String(payload.naam).trim(),
    telefoon: String(payload.telefoon).trim(),
    email: String(payload.email).trim(),
    adres: String(payload.adres || "").trim(),
    plaats: String(payload.plaats || "").trim(),
    type: String(payload.type),
    spoed: String(payload.spoed || "geen-haast"),
    omschrijving: String(payload.omschrijving).trim(),
  };

  await mkdir(dataDir, { recursive: true });
  await appendFile(
    resolve(dataDir, "offertes.jsonl"),
    JSON.stringify(entry) + "\n",
    "utf8"
  );

  console.log(
    `[${new Date().toLocaleTimeString("nl-NL")}] Offerteaanvraag ontvangen: ${entry.naam} (${entry.type})`
  );
  sendJson(res, 200, { ok: true, id: entry.id });
}

async function serveStatic(req, res, pathname) {
  const pathSegments = pathname.split("/").filter(Boolean);
  if (pathSegments.some((segment) => segment.startsWith("."))) {
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<!doctype html><title>Niet gevonden</title><p>Niet gevonden</p>");
    return;
  }

  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = resolve(root, relativePath);
  const extension = extname(filePath).toLowerCase();

  const insideRoot =
    filePath === root || filePath.startsWith(`${root}${sep}`);
  if (
    !insideRoot ||
    !mimeTypes[extension] ||
    !isPublicFile(relativePath)
  ) {
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<!doctype html><title>Niet gevonden</title><p>Niet gevonden</p>");
    return;
  }

  try {
    const file = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": mimeTypes[extension],
      "Content-Length": file.length,
      "Cache-Control": "no-store",
    });
    res.end(file);
  } catch {
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    res.end(
      "<!doctype html><html lang=\"nl\"><head><meta charset=\"utf-8\"><title>Niet gevonden</title></head>" +
        "<body style=\"font-family:system-ui;padding:40px\"><h1>Pagina niet gevonden</h1>" +
        "<p><a href=\"/\">Terug naar de homepage</a></p></body></html>"
    );
  }
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "POST" && url.pathname === "/api/offertes") {
    handleOfferte(req, res).catch((error) => {
      console.error("Fout bij verwerken aanvraag:", error);
      sendJson(res, 500, {
        ok: false,
        error: "Het opslaan lukte niet. Probeer het opnieuw of bel ons.",
      });
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, { ok: true, uptime: process.uptime() });
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" });
    res.end("Methode niet toegestaan");
    return;
  }

  serveStatic(req, res, url.pathname).catch((error) => {
    console.error("Fout bij serveer bestand:", error);
    res.writeHead(500).end("Serverfout");
  });
});

server.listen(port, () => {
  console.log(`Beijer Elektro draait op http://localhost:${port}`);
});
