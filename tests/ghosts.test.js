import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { GhostRecorder, sampleGhost, ghostDelta } from "../src/core/ghost.js";
import { GhostOnline } from "../src/core/ghost-online.js";
import { createGhostService } from "../server/ghost-service.js";
import { Track } from "../src/core/track.js";
import { TRACKS } from "../src/data/tracks.js";

const sample = (t, s, extra = {}) => ({
  t,
  s,
  lateral: 0,
  height: 0,
  heading: 0,
  penalty: 0,
  respawns: 0,
  jump: false,
  ...extra,
});
test("ghost records exact endpoints, interpolates heading and snaps respawns", () => {
  const rec = new GhostRecorder();
  rec.capture(0, sample(0, 0));
  rec.capture(0.02, sample(0, 2), true);
  assert.equal(rec.samples.at(-1).t, 0.02);
  assert.equal(sampleGhost(rec.samples, -1).s, 0);
  const turn = [
    sample(0, 0, { heading: 3.1 }),
    sample(1, 10, { heading: -3.1 }),
  ];
  assert.ok(Math.abs(sampleGhost(turn, 0.5).heading - Math.PI) < 0.01);
  rec.capture(0.03, sample(0, 0, { respawns: 1, penalty: 3 }));
  assert.equal(rec.samples.at(-1).jump, true);
  assert.equal(sampleGhost(rec.samples, 0.025).s, 2);
  assert.equal(sampleGhost(rec.samples, 0.03).s, 0);
  assert.equal(sampleGhost(rec.samples, 0.031), null);
});
test("time gap compares matching distance and includes penalties", () => {
  const samples = [
    sample(0, 0),
    sample(10, 100),
    sample(11, 50, { jump: true, penalty: 3 }),
    sample(20, 150, { penalty: 3 }),
  ];
  assert.equal(ghostDelta(samples, 50, 4), -1);
  assert.equal(ghostDelta(samples, 50, 4, 3), 2);
  assert.equal(ghostDelta(samples, 200, 30), null);
});
test("failed uploads survive reload and retry the same run once", async () => {
  const data = new Map(),
    storage = {
      getItem: (k) => data.get(k),
      setItem: (k, v) => data.set(k, v),
    };
  const failed = new GhostOnline(
    () => {},
    storage,
    async () => {
      throw new Error("offline");
    },
  );
  await failed.enqueue({ id: "retained" });
  assert.equal(failed.pending.length, 1);
  let uploads = 0;
  const restored = new GhostOnline(
    () => {},
    storage,
    async () => {
      uploads++;
      return { ok: true, json: async () => ({}) };
    },
  );
  await restored.flush();
  assert.equal(uploads, 1);
  assert.equal(restored.pending.length, 0);
  assert.equal(new GhostOnline(() => {}, storage).pending.length, 0);
});
test("shared service persists every run, supports search, isolates tracks and rejects bad data", async () => {
  const dir = await mkdtemp(join(tmpdir(), "apex-ghost-test-"));
  let server;
  const start = async () => {
    server = createServer(createGhostService(dir));
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    return `http://127.0.0.1:${server.address().port}/api/ghosts`;
  };
  const stop = () => new Promise((r) => server.close(r));
  try {
    let url = await start();
    const length = new Track(TRACKS[0]).length;
    const run = {
      version: 1,
      id: randomUUID(),
      track: TRACKS[0].id,
      vehicle: "vanta",
      name: "Friend One",
      time: 30,
      samples: [sample(0, 0), sample(30, length)],
    };
    const post = (r) =>
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(r),
      });
    assert.equal((await post(run)).status, 200);
    assert.equal((await post({ ...run, name: "Overwrite" })).status, 200);
    const slower = {
      ...run,
      id: randomUUID(),
      time: 35,
      samples: [sample(0, 0), sample(35, length)],
    };
    assert.equal((await post(slower)).status, 200);
    assert.equal(
      (
        await post({
          ...run,
          id: randomUUID(),
          samples: [sample(1, 0), sample(0, 5)],
        })
      ).status,
      400,
    );
    assert.equal(
      (await post({ ...run, id: randomUUID(), vehicle: "unknown" })).status,
      400,
    );
    let list = await (await fetch(url + "?track=canyon&q=friend")).json();
    assert.equal(list.total, 2);
    assert.equal(list.runs[0].name, "Friend One");
    assert.equal(list.runs[0].samples, undefined);
    assert.equal((await (await fetch(url + "?track=island")).json()).total, 0);
    await stop();
    url = await start();
    const replay = await (await fetch(url + "/" + run.id)).json();
    assert.deepEqual(replay.samples, run.samples);
    assert.equal(
      (await (await fetch(url + "?track=canyon&q=" + slower.id)).json()).total,
      1,
    );
    assert.equal((await fetch(url + "/" + randomUUID())).status, 404);
  } finally {
    if (server?.listening) await stop();
    await rm(dir, { recursive: true, force: true });
  }
});
