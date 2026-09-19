import {
  mkdir,
  readdir,
  readFile,
  writeFile,
  link,
  unlink,
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { TRACKS } from "../src/data/tracks.js";
import { VEHICLES } from "../src/data/vehicles.js";
import { Track } from "../src/core/track.js";

const idPattern = /^[a-f0-9-]{36}$/;
const lengths = new Map();
export function validateRun(run) {
  if (
    !run ||
    run.version !== 1 ||
    !idPattern.test(run.id) ||
    !TRACKS.some((t) => t.id === run.track) ||
    !VEHICLES.some((v) => v.id === run.vehicle) ||
    typeof run.name !== "string" ||
    !run.name.trim() ||
    run.name.length > 32 ||
    !Number.isFinite(run.time) ||
    run.time <= 0 ||
    run.time > 7200 ||
    !Array.isArray(run.samples) ||
    run.samples.length < 2 ||
    run.samples.length > 90002
  )
    return false;
  let previous = -1;
  for (const s of run.samples) {
    if (
      !s ||
      !["t", "s", "lateral", "height", "heading", "penalty", "respawns"].every(
        (k) => Number.isFinite(s[k]),
      ) ||
      s.t <= previous ||
      s.t < 0 ||
      s.t > 7200 ||
      Math.abs(s.s) > 100000 ||
      Math.abs(s.lateral) > 1000 ||
      Math.abs(s.height) > 1000 ||
      Math.abs(s.heading) > 100 ||
      s.penalty < 0 ||
      s.penalty > 7200 ||
      !Number.isInteger(s.respawns) ||
      s.respawns < 0 ||
      typeof s.jump !== "boolean"
    )
      return false;
    previous = s.t;
  }
  if (!lengths.has(run.track))
    lengths.set(
      run.track,
      new Track(TRACKS.find((t) => t.id === run.track)).length,
    );
  const first = run.samples[0],
    last = run.samples.at(-1);
  return (
    first.t === 0 &&
    first.s === 0 &&
    last.s >= lengths.get(run.track) &&
    last.s <= lengths.get(run.track) + 5 &&
    Math.abs(last.t + last.penalty - run.time) < 0.001
  );
}

export function createGhostService(
  directory = resolve(process.env.GHOST_DATA_DIR || "ghost-data"),
) {
  let indexPromise;
  const index = () =>
    (indexPromise ??= (async () => {
      await mkdir(directory, { recursive: true });
      const entries = new Map();
      for (const file of await readdir(directory)) {
        if (!file.endsWith(".json") || !idPattern.test(file.slice(0, -5)))
          continue;
        try {
          const run = JSON.parse(
            await readFile(resolve(directory, file), "utf8"),
          );
          if (validateRun(run)) {
            const { samples, ...meta } = run;
            entries.set(run.id, meta);
          }
        } catch {
          /* Ignore incomplete or corrupt records. */
        }
      }
      return entries;
    })().catch((error) => {
      indexPromise = undefined;
      throw error;
    }));
  return async (
    req,
    res,
    next = () => {
      res.statusCode = 404;
      res.end();
    },
  ) => {
    const url = new URL(req.url, "http://localhost");
    if (!url.pathname.startsWith("/api/ghosts")) return next();
    const send = (status, body) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(body));
    };
    try {
      const entries = await index();
      if (req.method === "GET" && url.pathname === "/api/ghosts") {
        const q = (url.searchParams.get("q") || "").slice(0, 100).toLowerCase();
        const runs = [...entries.values()]
          .filter(
            (r) =>
              r.track === url.searchParams.get("track") &&
              (!q || r.name.toLowerCase().includes(q) || r.id === q),
          )
          .sort((a, b) => a.time - b.time);
        return send(200, { runs: runs.slice(0, 100), total: runs.length });
      }
      const id = url.pathname.slice("/api/ghosts/".length);
      if (req.method === "GET" && idPattern.test(id)) {
        if (!entries.has(id)) return send(404, { error: "Ghost not found." });
        return send(
          200,
          JSON.parse(await readFile(resolve(directory, id + ".json"), "utf8")),
        );
      }
      if (req.method !== "POST" || url.pathname !== "/api/ghosts")
        return send(404, { error: "Not found." });
      if (
        req.headers.origin &&
        new URL(req.headers.origin).host !== req.headers.host
      )
        return send(403, { error: "Origin not allowed." });
      let size = 0;
      const chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 16000000)
          return send(413, { error: "Replay is too large." });
        chunks.push(chunk);
      }
      let data;
      try {
        data = JSON.parse(Buffer.concat(chunks).toString());
      } catch {
        return send(400, { error: "Invalid JSON." });
      }
      if (!validateRun(data))
        return send(400, { error: "Invalid or incompatible replay." });
      const run = {
        version: 1,
        id: data.id,
        track: data.track,
        vehicle: data.vehicle,
        name: data.name.trim(),
        time: data.time,
        date: new Date().toISOString(),
        samples: data.samples,
      };
      const temp = resolve(directory, randomUUID() + ".tmp");
      try {
        await writeFile(temp, JSON.stringify(run), { flag: "wx" });
        try {
          await link(temp, resolve(directory, run.id + ".json"));
        } catch (error) {
          if (error.code !== "EEXIST") throw error;
        }
      } finally {
        await unlink(temp).catch(() => {});
      }
      const saved = JSON.parse(
        await readFile(resolve(directory, run.id + ".json"), "utf8"),
      );
      const { samples, ...meta } = saved;
      entries.set(saved.id, meta);
      return send(200, meta);
    } catch {
      if (!res.headersSent)
        send(503, { error: "Ghost service unavailable. Try again later." });
    }
  };
}

export function ghostPlugin() {
  const middleware = createGhostService();
  return {
    name: "shared-ghosts",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
