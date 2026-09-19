import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { createGhostService } from "./ghost-service.js";

const root = resolve("dist");
const ghosts = createGhostService(
  resolve(process.env.GHOST_DATA_DIR || "ghost-data"),
);
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};
createServer((req, res) =>
  ghosts(req, res, async () => {
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405);
      return res.end();
    }
    try {
      const path = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      const file = resolve(root, "." + (path === "/" ? "/index.html" : path));
      if (!file.startsWith(root + sep)) {
        res.writeHead(403);
        return res.end();
      }
      const body = await readFile(file);
      res.writeHead(200, {
        "Content-Type": types[extname(file)] || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(req.method === "HEAD" ? undefined : body);
    } catch {
      res.writeHead(404);
      res.end("Not found. Run npm run build before starting the server.");
    }
  }),
).listen(Number(process.env.PORT || 5187), "0.0.0.0", () =>
  console.log(
    "APEX//SHIFT with shared ghosts: http://localhost:" +
      (process.env.PORT || 5187),
  ),
);
