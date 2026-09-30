// Alligator — tiny zero-dependency server.
// Serves the static app and mints short-lived Soniox keys so the long-lived
// SONIOX_API_KEY never reaches the browser.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT) || 5173;
const API_KEY = process.env.SONIOX_API_KEY;
const PUBLIC_DIR = join(fileURLToPath(new URL(".", import.meta.url)), "public");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

async function createTemporaryKey() {
  const res = await fetch("https://api.soniox.com/v1/auth/temporary-api-key", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      usage_type: "transcribe_websocket",
      expires_in_seconds: 60,
      single_use: true,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(
      new Error(body.error_message || `Soniox returned ${res.status}`),
      {
        status: res.status,
      },
    );
  }
  return body;
}

function send(res, status, body, type = "application/json") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(
    typeof body === "string" || Buffer.isBuffer(body)
      ? body
      : JSON.stringify(body),
  );
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/api/temporary-key") {
    if (req.method !== "POST")
      return send(res, 405, { error: "Method not allowed" });
    if (!API_KEY)
      return send(res, 500, {
        error: "SONIOX_API_KEY is not set on the server.",
      });
    try {
      return send(res, 200, await createTemporaryKey());
    } catch (err) {
      return send(res, err.status || 502, { error: err.message });
    }
  }

  const path = normalize(url.pathname === "/" ? "/index.html" : url.pathname);
  const file = join(PUBLIC_DIR, path);
  if (!file.startsWith(PUBLIC_DIR))
    return send(res, 403, "Forbidden", "text/plain");
  try {
    const data = await readFile(file);
    send(res, 200, data, TYPES[extname(file)] || "application/octet-stream");
  } catch {
    send(res, 404, "Not found", "text/plain");
  }
});

server.on("error", (err) => {
  if (err.code !== "EADDRINUSE") throw err;
  console.error(
    `Port ${PORT} is already in use (is Alligator already running?).\n` +
      `Stop the other process, or pick another port: PORT=5174 npm start`,
  );
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`Alligator is running at http://localhost:${PORT}`);
  if (!API_KEY)
    console.warn(
      "Warning: SONIOX_API_KEY is not set. Add it to .env and restart.",
    );
});
