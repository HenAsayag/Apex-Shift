import assert from "node:assert/strict";
import test from "node:test";
import { Track } from "../src/core/track.js";
import { TRACKS, medalFor } from "../src/data/tracks.js";
import { VEHICLES } from "../src/data/vehicles.js";
import { DEFAULT_SETTINGS, formatTime } from "../src/config.js";
import { createRacer, stepPhysics, respawn } from "../src/core/physics.js";
import { aiInput } from "../src/core/ai.js";
import { SaveData } from "../src/core/storage.js";
import { GhostRecorder, sampleGhost } from "../src/core/ghost.js";
const input = { throttle: 1, brake: 0, steer: 0, boost: false, drift: false };
const memory = () => {
  const data = new Map();
  return { getItem: (k) => data.get(k), setItem: (k, v) => data.set(k, v) };
};
test("every circuit has stable orthonormal frames and a continuous seam", () => {
  for (const cfg of TRACKS) {
    const track = new Track(cfg);
    assert.ok(track.length > 1000);
    for (const f of track.frames) {
      assert.ok(Math.abs(f.right.dot(f.forward)) < 0.001);
      assert.ok(Math.abs(f.up.dot(f.forward)) < 0.001);
      assert.ok(Math.abs(f.up.length() - 1) < 0.001);
    }
    assert.ok(
      track.frame(0).pos.distanceTo(track.frame(track.length).pos) < 0.001,
    );
  }
  const space = new Track(TRACKS.find((t) => t.loop));
  assert.ok(
    space.frames.some((f) => f.up.y < -0.9),
    "full inverted loop",
  );
});
test("all AI difficulties can finish every track under bronze with no respawns", () => {
  for (const cfg of TRACKS)
    for (const difficulty of ["easy", "normal", "hard", "expert"]) {
      const track = new Track(cfg),
        r = createRacer({ vehicle: VEHICLES[0], human: false });
      let time = 0;
      while (r.s < track.length && time < 150) {
        stepPhysics(
          r,
          aiInput(r, track, time, difficulty, r, DEFAULT_SETTINGS),
          track,
          1 / 120,
          DEFAULT_SETTINGS,
        );
        time += 1 / 120;
      }
      assert.ok(r.s >= track.length, `${cfg.id} ${difficulty} did not finish`);
      assert.equal(r.respawns, 0);
      assert.ok(
        time < cfg.medals[3],
        `${cfg.id} bronze target not reachable by ${difficulty}: ${time}`,
      );
    }
});
test("accelerating, braking, drifting, boosting and respawning have observable effects", () => {
  const track = new Track(TRACKS[0]),
    r = createRacer({ vehicle: VEHICLES[0] });
  for (let i = 0; i < 180; i++)
    stepPhysics(r, input, track, 1 / 120, DEFAULT_SETTINGS);
  assert.ok(r.speed > 25);
  const speed = r.speed;
  stepPhysics(
    r,
    { ...input, throttle: 0, brake: 1 },
    track,
    0.1,
    DEFAULT_SETTINGS,
  );
  assert.ok(r.speed < speed);
  stepPhysics(r, { ...input, boost: true }, track, 0.1, DEFAULT_SETTINGS);
  assert.ok(r.boost < 100);
  stepPhysics(
    r,
    { ...input, drift: true, steer: 1 },
    track,
    0.1,
    DEFAULT_SETTINGS,
  );
  assert.ok(r.drifting);
  assert.ok(r.lateral > 0);
  r.checkpointS = track.length * 0.25;
  respawn(r);
  assert.equal(r.s, r.checkpointS);
  assert.equal(r.speed, 0);
  assert.equal(r.penalty, 3);
  assert.equal(r.respawns, 1);
});
test("off-track driving in an open jump section triggers a checkpoint respawn", () => {
  const track = new Track(TRACKS[0]),
    r = createRacer({ vehicle: VEHICLES[0] });
  r.s = track.length * 0.19;
  r.lateral = 40;
  for (let i = 0; i < 140; i++)
    stepPhysics(r, { ...input, throttle: 0 }, track, 1 / 120, DEFAULT_SETTINGS);
  assert.equal(r.respawns, 1);
  assert.equal(r.penalty, 3);
  assert.equal(r.lateral, 0);
});
test("physics integration is stable across frame steps", () => {
  const track = new Track(TRACKS[0]);
  const sim = (dt) => {
    const r = createRacer({ vehicle: VEHICLES[0] });
    for (let t = 0; t < 5 - dt / 2; t += dt)
      stepPhysics(r, input, track, dt, DEFAULT_SETTINGS);
    return r;
  };
  const a = sim(1 / 120),
    b = sim(1 / 60);
  assert.ok(Math.abs(a.s - b.s) < 1);
  assert.ok(Math.abs(a.speed - b.speed) < 0.3);
});
test("records persist fastest runs, preserve ghosts, and isolate custom progress", () => {
  const storage = memory(),
    save = new SaveData(storage),
    track = TRACKS[0];
  save.attempt(track.id);
  save.finish(
    track.id,
    { time: 28, medal: "Silver", vehicle: "vanta", date: "2026-09-15" },
    [{ t: 0, s: 0 }],
  );
  save.finish(track.id, { time: 30, medal: "Silver" }, [{ t: 0, s: 50 }]);
  const restored = new SaveData(storage);
  assert.equal(restored.data.records.canyon.best, 28);
  assert.equal(restored.data.records.canyon.ghost[0].s, 0);
  assert.equal(restored.medals, 1);
  save.finish(save.recordKey("canyon", 2), { time: 60, medal: "Gold" }, []);
  assert.equal(save.medals, 1);
  assert.equal(save.data.records.canyon.runs[0].time, 28);
  save.reset();
  assert.equal(save.medals, 0);
});
test("invalid or blocked storage never prevents racing", () => {
  const corrupt = new SaveData({
    getItem: () => "{bad",
    setItem: () => {
      throw new Error("blocked");
    },
  });
  assert.equal(corrupt.medals, 0);
  assert.equal(corrupt.persist(), false);
});
test("ghosts interpolate and stop at the end of the recording", () => {
  const rec = new GhostRecorder(),
    r = createRacer({ vehicle: VEHICLES[0] });
  rec.capture(0, r);
  r.s = 10;
  rec.capture(1, r);
  assert.equal(sampleGhost(rec.samples, 0.5).s, 5);
  assert.equal(sampleGhost(rec.samples, 2), null);
  assert.equal(sampleGhost([], 0), null);
});
test("medals and timer boundaries use exact thresholds", () => {
  const tr = TRACKS[0];
  assert.equal(medalFor(tr.medals[0], tr), "Platinum");
  assert.equal(medalFor(tr.medals[3] + 0.01, tr), null);
  assert.equal(medalFor(tr.medals[1] * 2, tr, 2), "Gold");
  assert.equal(formatTime(61.234), "01:01.234");
  assert.equal(formatTime(null), "—");
});
