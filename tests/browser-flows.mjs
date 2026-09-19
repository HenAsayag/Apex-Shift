import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await page.goto("http://localhost:5187");
await page.waitForFunction(() => window.__game?.state === "menu");
await page.waitForTimeout(1000);
await page.screenshot({ path: "artifacts/home.png" });
await page.locator('[data-action="race"]').first().click();
await page.locator("[data-fullscreen]").click();
await page.waitForFunction(() => __game.state === "racing");
await page.keyboard.down("w");
await page.waitForTimeout(1500);
await page.keyboard.down("d");
await page.keyboard.down("ShiftLeft");
await page.waitForTimeout(250);
assert.ok(await page.evaluate(() => __game.racers[0].drifting));
await page.keyboard.up("d");
await page.keyboard.up("ShiftLeft");
const speed = await page.evaluate(() => __game.racers[0].speed);
await page.keyboard.up("w");
await page.keyboard.down("s");
await page.waitForTimeout(300);
await page.keyboard.up("s");
assert.ok((await page.evaluate(() => __game.racers[0].speed)) < speed);
await page.keyboard.down("w");
await page.keyboard.down("Space");
await page.waitForTimeout(500);
assert.ok((await page.evaluate(() => __game.racers[0].boost)) < 100);
await page.keyboard.up("w");
await page.keyboard.up("Space");
await page.keyboard.press("Escape");
await page.waitForSelector("#pause-menu");
const paused = await page.evaluate(() => __game.raceTime);
await page.waitForTimeout(200);
assert.equal(await page.evaluate(() => __game.raceTime), paused);
await page.locator('[data-action="resume"]').click();
await page.waitForFunction(() => __game.state === "racing");
await page.keyboard.press("r");
await page.waitForFunction(() => __game.racers[0].penalty === 3);
assert.equal(await page.evaluate(() => __game.racers[0].s), 0);
await page.locator('[data-action="pause"]').click();
await page.locator('[data-action="restart"]').click();
await page.waitForFunction(() => __game.state === "countdown");
// Drive a complete race through the same physics and checkpoint loop with the AI input source.
const complete = await page.evaluate(async () => {
  const { aiInput } = await import("/src/core/ai.js");
  __game.state = "racing";
  __game.input.read = () =>
    aiInput(
      __game.racers[0],
      __game.track,
      __game.raceTime,
      "normal",
      __game.racers[0],
      __game.save.data.settings,
    );
  for (let i = 0; i < 120 * 100 && __game.state !== "results"; i++)
    __game.updateRace(1 / 120);
  return {
    state: __game.state,
    time: __game.racers[0].finishTime,
    medal: __game.racers[0].medal,
    saved: __game.save.data.records.canyon,
    cp: __game.racers[0].checkpoint,
  };
});
assert.equal(complete.state, "results");
assert.ok(complete.time > 15 && complete.time < 46);
assert.ok(complete.saved.ghost.length > 100);
assert.equal(complete.cp, 3);
await page.screenshot({ path: "artifacts/results.png" });
console.log(
  "Full race + persistence",
  complete.time,
  complete.medal,
  complete.saved.ghost.length + " ghost samples",
);
await page.reload();
await page.waitForFunction(() => window.__game?.state === "menu");
assert.ok(await page.evaluate(() => __game.save.data.records.canyon.best));
await page.locator('[data-nav="leaderboards"]').click();
await page.locator('[data-ghost="canyon"]').click();
if (!(await page.evaluate(() => !!document.fullscreenElement)))
  await page.locator("[data-fullscreen]").click();
await page.waitForFunction(() => __game.state === "countdown");
assert.ok(await page.evaluate(() => !!__game.world.ghost));
await page.keyboard.press("Escape");
await page.waitForSelector("#pause-menu");
await page.locator('[data-action="quit"]').click();
for (const route of [
  "garage",
  "career",
  "leaderboards",
  "settings",
  "controls",
  "achievements",
  "credits",
  "play",
  "tracks",
]) {
  await page.evaluate((r) => __game.ui.nav(r), route);
  assert.ok((await page.locator("main").innerText()).length > 50);
}
await page.evaluate(() => __game.ui.nav("garage"));
await page.locator('[data-preview="spectre"]').click();
await page.locator('[data-select-vehicle="spectre"]').click();
assert.equal(await page.evaluate(() => __game.vehicle.id), "spectre");
await page.screenshot({ path: "artifacts/garage.png" });
await page.evaluate(() => __game.ui.nav("controls"));
await page.locator('[data-remap="0:accelerate"]').click();
await page.keyboard.press("t");
assert.equal(
  await page.evaluate(() => __game.input.bindings[0].accelerate),
  "KeyT",
);
await page.locator('[data-action="reset-controls"]').click();
await page.evaluate(() => __game.setMode("local"));
await page.locator('[data-option="players"]').selectOption("4");
await page.locator('[data-option="ai"]').selectOption("1");
await page.locator('[data-action="race"]').click();
await page.waitForFunction(() => __game.state === "racing");
for (const key of ["w", "ArrowUp", "i", "Numpad8"])
  await page.keyboard.down(key);
await page.waitForTimeout(900);
for (const key of ["w", "ArrowUp", "i", "Numpad8"]) await page.keyboard.up(key);
const speeds = await page.evaluate(() => __game.racers.map((r) => r.speed));
assert.equal(await page.locator(".player-hud").count(), 4);
assert.ok(speeds.every((s) => s > 5));
await page.screenshot({ path: "artifacts/split-screen.png" });
console.log("Split-screen speeds", speeds);
await page.evaluate(() => __game.quit());
for (const id of [
  "canyon",
  "island",
  "neon",
  "forest",
  "coast",
  "snow",
  "factory",
  "volcano",
  "space",
  "cyber",
]) {
  await page.evaluate((id) => __game.selectTrack(id), id);
  await page.waitForTimeout(80);
}
await page.evaluate(() => {
  __game.selectTrack("space");
  __game.setMode("custom", true);
  __game.options.ai = 0;
});
await page.evaluate(() => __game.startRace());
await page.waitForFunction(() => __game.state === "countdown");
await page.evaluate(() => {
  const g = __game;
  g.racers[0].s = g.track.length * 0.16;
  g.world.cameraReady = false;
  g.ui.updateHUD();
});
await page.waitForTimeout(200);
await page.screenshot({ path: "artifacts/orbital-loop.png" });
await page.evaluate(() => __game.quit());
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(300);
await page.screenshot({ path: "artifacts/mobile-menu.png" });
assert.equal(
  await page.evaluate(() => document.documentElement.scrollWidth),
  390,
);
assert.deepEqual(errors, []);
console.log("Browser checks passed. Console errors:", errors.length);
await browser.close();
