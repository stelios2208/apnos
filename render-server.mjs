import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// Support both build output layouts:
//   dist/server/server.js   — old Vinxi/TanStack Start build
//   .output/server/index.mjs — new Nitro-based build
const OLD_ENTRY = join(__dirname, "dist", "server", "server.js");
const NEW_ENTRY = join(__dirname, ".output", "server", "index.mjs");

let serverEntry;
if (existsSync(NEW_ENTRY)) {
  serverEntry = NEW_ENTRY;
  console.log("Using new build output:", NEW_ENTRY);
} else if (existsSync(OLD_ENTRY)) {
  serverEntry = OLD_ENTRY;
  console.log("Using old build output:", OLD_ENTRY);
} else {
  console.error("No server entry found. Expected one of:\n  " + OLD_ENTRY + "\n  " + NEW_ENTRY);
  process.exit(1);
}

const { default: handler } = await import(serverEntry);

const clientDir = existsSync(join(__dirname, ".output", "public"))
  ? join(__dirname, ".output", "public")
  : join(__dirname, "dist", "client");
const port = parseInt(process.env.PORT || "10000", 10);

const MIME = {
  ".js":    "application/javascript; charset=utf-8",
  ".mjs":   "application/javascript; charset=utf-8",
  ".css":   "text/css; charset=utf-8",
  ".html":  "text/html; charset=utf-8",
  ".json":  "application/json; charset=utf-8",
  ".svg":   "image/svg+xml",
  ".png":   "image/png",
  ".jpg":   "image/jpeg",
  ".ico":   "image/x-icon",
  ".txt":   "text/plain; charset=utf-8",
  ".woff":  "font/woff",
  ".woff2": "font/woff2",
};

function serveStatic(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") return false;

  const pathname = new URL(req.url, "http://localhost").pathname;
  const filePath = join(clientDir, pathname);

  if (!filePath.startsWith(clientDir)) return false;
  if (!existsSync(filePath) || !statSync(filePath).isFile()) return false;

  const ext = extname(filePath).toLowerCase();
  const mime = MIME[ext] || "application/octet-stream";
  const isHashed = pathname.startsWith("/assets/");

  res.setHeader("Content-Type", mime);
  res.setHeader("Cache-Control", isHashed ? "public, max-age=31536000, immutable" : "public, max-age=3600");
  res.writeHead(200);
  if (req.method === "HEAD") { res.end(); return true; }
  createReadStream(filePath).pipe(res);
  return true;
}

async function toWebRequest(req) {
  const host = req.headers.host || "localhost";
  const url = new URL(req.url, `http://${host}`);

  const headers = new Headers();
  for (const [key, val] of Object.entries(req.headers)) {
    if (val === undefined) continue;
    if (Array.isArray(val)) val.forEach((v) => headers.append(key, v));
    else headers.set(key, val);
  }

  let body = null;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await new Promise((resolve, reject) => {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => resolve(Buffer.concat(chunks)));
      req.on("error", reject);
    });
    if (body.length === 0) body = null;
  }

  return new Request(url.href, { method: req.method, headers, body });
}

const server = createServer(async (req, res) => {
  try {
    if (serveStatic(req, res)) return;

    const webReq = await toWebRequest(req);
    // Old build: handler = { fetch(req, env, ctx) }
    // New build: handler = function(req, env, ctx)
    const webRes = await (typeof handler === "function"
      ? handler(webReq, {}, {})
      : handler.fetch(webReq, {}, {}));

    const resHeaders = {};
    webRes.headers.forEach((val, key) => { resHeaders[key] = val; });
    res.writeHead(webRes.status, resHeaders);

    const buf = await webRes.arrayBuffer();
    res.end(Buffer.from(buf));
  } catch (err) {
    console.error(err);
    res.writeHead(500);
    res.end("Internal Server Error");
  }
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${port} already in use, retrying in 1s...`);
    setTimeout(() => {
      server.close();
      server.listen(port, "0.0.0.0");
    }, 1000);
  } else {
    console.error("Server error:", err);
    process.exit(1);
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Server listening on http://0.0.0.0:${port}`);
});

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});

process.on("SIGINT", () => {
  server.close(() => process.exit(0));
});
