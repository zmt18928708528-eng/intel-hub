import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { collectAll } from "./collect.ts";
import type { TrackKind } from "./types.ts";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..", "web");
const port = Number(process.env.PORT ?? 8787);

const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);

    if (url.pathname === "/api/intel") {
      const raw = url.searchParams.get("only");
      const only = raw === "gold" || raw === "gpu" || raw === "macmini" ? (raw as TrackKind) : undefined;
      const data = await collectAll(only);
      res.writeHead(200, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      });
      res.end(JSON.stringify(data));
      return;
    }

    const file = url.pathname === "/" ? "/index.html" : url.pathname;
    const path = join(root, file);
    if (!path.startsWith(root)) {
      res.writeHead(403).end("forbidden");
      return;
    }
    const body = await readFile(path);
    res.writeHead(200, { "content-type": mime[extname(path)] ?? "application/octet-stream" });
    res.end(body);
  } catch (err) {
    const message = (err as Error).message;
    const code = message.includes("ENOENT") ? 404 : 500;
    res.writeHead(code, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: message }));
  }
}).listen(port, () => {
  console.log(`intel-hub http://127.0.0.1:${port}`);
});
