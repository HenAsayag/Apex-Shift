import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    screen: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://localhost:5187");
  await page.waitForFunction(() => window.__game?.state === "menu");
  assert.ok(
    await page.evaluate(
      () =>
        __game.world.renderer.getContext() instanceof WebGL2RenderingContext,
    ),
  );
  await page.locator('[data-action="race"]').first().click();
  assert.equal(await page.evaluate(() => __game.state), "menu");
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => __game.racers.length), 0);
  await page.locator("[data-fullscreen]").click();
  await page.waitForFunction(() => __game.state === "racing");
  assert.ok(await page.evaluate(() => !!document.fullscreenElement));
  assert.ok(await page.evaluate(() => __game.shadowEnabled));
  assert.equal(await page.evaluate(() => __game.options.laps), 3);
  assert.match(await page.locator(".hud-lap").innerText(), /1 \/ 3/);
  await page.locator('[data-drive="boost"]').waitFor({ state: "visible" });
  assert.equal(await page.locator("[data-drive]").count(), 4);
  const cdp = await context.newCDPSession(page);
  const point = async (selector, id) => {
    const box = await page.locator(selector).boundingBox();
    assert.ok(box);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2, id };
  };
  const left = await point('[data-drive="left"]', 2),
    right = await point('[data-drive="right"]', 2),
    brake = await point('[data-drive="brake"]', 3),
    boost = await point('[data-drive="boost"]', 3);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [right, boost],
  });
  await page.waitForTimeout(250);
  const input = await page.evaluate(() => __game.input.read(0));
  assert.equal(input.throttle, 1);
  assert.equal(input.steer, -1);
  assert.equal(input.boost, true);
  assert.ok(await page.evaluate(() => __game.racers[0].speed > 0));
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchCancel",
    touchPoints: [],
  });
  assert.equal(await page.evaluate(() => __game.input.read(0).throttle), 1);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [left, brake],
  });
  const braking = await page.evaluate(() => __game.input.read(0));
  assert.equal(braking.throttle, 0);
  assert.equal(braking.drift, true);
  assert.equal(braking.steer, 1);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [right, brake],
  });
  assert.equal(await page.evaluate(() => __game.input.read(0).steer), -1);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchCancel",
    touchPoints: [],
  });
  for (const button of await page.locator("[data-drive]").all()) {
    const box = await button.boundingBox();
    assert.ok(
      box.width >= 44 &&
        box.height >= 44 &&
        box.x >= 0 &&
        box.x + box.width <= 844 &&
        box.y + box.height <= 390,
    );
  }
  await page.screenshot({ path: "artifacts/mobile-driving.png" });
  await page.evaluate(() => document.exitFullscreen());
  await page.locator("[data-fullscreen]").waitFor();
  assert.equal(await page.evaluate(() => __game.state), "paused");
  const paused = await page.evaluate(() => __game.raceTime);
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => __game.raceTime), paused);
  await page.locator("[data-fullscreen]").click();
  await page.waitForFunction(() => __game.state === "racing");
  // Finish a real physics-driven run, then verify main Race always loads its shadow.
  await page.evaluate(async () => {
    const { aiInput } = await import("/src/core/ai.js");
    const g = __game;
    await g.startRace();
    g.state = "racing";
    g.input.read = () =>
      aiInput(
        g.racers[0],
        g.track,
        g.raceTime,
        "normal",
        g.racers[0],
        g.save.data.settings,
      );
    for (let i = 0; i < 18000 && g.state !== "results"; i++)
      g.updateRace(1 / 120);
  });
  assert.equal(await page.evaluate(() => __game.state), "results");
  await page.locator('[data-action="restart"]').click();
  await page.waitForFunction(() => __game.state === "countdown");
  assert.equal(await page.evaluate(() => __game.mode), "quick");
  assert.equal(await page.evaluate(() => __game.options.laps), 3);
  assert.ok(await page.evaluate(() => !!__game.world.ghost));
  await page.evaluate(() => __game.quit());
  await page.evaluate(() => document.exitFullscreen());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "artifacts/mobile-home-portrait.png" });
  await page.locator('[data-nav="ghosts"]:visible').click();
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth),
    390,
  );
  await page.screenshot({ path: "artifacts/mobile-portrait.png" });
  // A browser without the required API must not silently bypass fullscreen.
  await page.evaluate(() => {
    delete __game.input.read;
    document.documentElement.requestFullscreen = undefined;
    __game.ui.nav("home");
  });
  await page.locator('[data-action="race"]').first().click();
  await page.locator("[data-fullscreen]").click();
  assert.match(
    await page.locator(".fullscreen-error").innerText(),
    /could not start/,
  );
  assert.equal(await page.evaluate(() => __game.state), "menu");
  await page.locator("[data-windowed]").click();
  await page.waitForFunction(() => __game.state === "racing");
  await page.waitForFunction(() => __game.racers[0].speed > 0);
  assert.equal(await page.evaluate(() => !!document.fullscreenElement), false);
  assert.equal(await page.evaluate(() => __game.options.laps), 3);
  assert.ok(await page.evaluate(() => __game.racers[0].speed > 0));
  await page.locator('[data-action="pause"]').click();
  await page.locator('[data-action="resume"]').click();
  await page.waitForFunction(() => __game.state === "racing");
  await page.locator('[data-action="pause"]').click();
  await page.locator('[data-action="restart"]').click();
  await page.waitForFunction(() => __game.state === "countdown");
  assert.equal(await page.locator(".fullscreen-gate").count(), 0);
  assert.equal(await page.evaluate(() => !!document.fullscreenElement), false);
  assert.deepEqual(errors, []);
  console.log(
    "Mobile checks passed: WebGL2, fullscreen gating, multitouch, cancel, pause, main Race shadow, portrait, unsupported API.",
  );
} finally {
  await browser.close();
}
