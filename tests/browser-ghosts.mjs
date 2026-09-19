import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

const directory = await mkdtemp(join(tmpdir(), "apex-browser-ghost-"));
process.env.GHOST_DATA_DIR = directory;
const server = await createServer({
  configLoader: "native",
  server: { port: 5190, strictPort: true },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const first = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await first.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://localhost:5190");
  await page.waitForFunction(() => window.__game?.state === "menu");
  await page.locator('[data-nav="ghosts"]').click();
  await page.getByText("No matching ghosts yet.", { exact: false }).waitFor();
  await page.locator("[data-ghost-name]").fill("Ghost Tester");
  await page.locator("[data-ghost-name]").blur();
  await page.locator('[data-action="online-run"]').click();
  await page.locator("[data-fullscreen]").click();
  await page.waitForFunction(() => __game.state === "countdown");
  const finish = async (page) =>
    page.evaluate(async () => {
      const { aiInput } = await import("/src/core/ai.js");
      const g = __game;
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
      for (let i = 0; i < 120 * 150 && g.state !== "results"; i++)
        g.updateRace(1 / 120);
      return {
        state: g.state,
        time: g.racers[0].finishTime,
        id: g.sharedRun?.id,
        samples: g.recorder.samples,
      };
    });
  const run = await finish(page);
  assert.equal(run.state, "results");
  assert.equal(run.samples[0].t, 0);
  assert.equal(run.samples.at(-1).t, run.time);
  await page.waitForFunction(
    () => __game.online.pending.length === 0 && !__game.online.flushing,
  );
  await page
    .getByText("Shared · Friends can find this run using its ID")
    .waitFor();
  assert.equal(await page.getByLabel("Ghost run ID").inputValue(), run.id);
  await page.locator('[data-action="quit"]').click();
  await page.locator('[data-nav="ghosts"]').click();
  await page.locator("[data-online-ghost]").waitFor();
  await mkdir("artifacts", { recursive: true });
  await page.waitForTimeout(5500);
  await page.screenshot({ path: "artifacts/ghost-mode.png", fullPage: true });
  // The second driver has an independent browser save and discovers the first driver's run.
  const second = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const rival = await second.newPage();
  rival.on("pageerror", (e) => errors.push(e.message));
  await rival.goto("http://localhost:5190");
  await rival.waitForFunction(() => window.__game?.state === "menu");
  await rival.locator('[data-nav="ghosts"]').click();
  await rival.locator("[data-online-ghost]").waitFor();
  await rival.locator("[data-ghost-query]").fill(run.id);
  await rival.locator('[data-action="search-ghosts"]').click();
  await rival.locator(`[data-online-ghost="${run.id}"]`).click();
  await rival.locator("[data-fullscreen]").click();
  await rival.waitForFunction(() => __game.state === "countdown");
  assert.ok(await rival.evaluate(() => !!__game.world.ghost));
  assert.equal(
    await rival.evaluate(() => __game.challenge.name),
    "Ghost Tester",
  );
  await rival.evaluate(() => {
    __game.state = "racing";
    for (let i = 0; i < 120; i++) __game.updateRace(1 / 120);
    __game.ui.updateHUD();
  });
  await rival.waitForTimeout(100);
  assert.ok(await rival.evaluate(() => __game.world.ghost.visible));
  assert.match(await rival.locator(".ghost-delta").innerText(), /AHEAD|BEHIND/);
  await rival.screenshot({ path: "artifacts/ghost-race.png" });
  await rival.evaluate(() => __game.pause());
  const paused = await rival.evaluate(() => __game.raceTime);
  await rival.waitForTimeout(120);
  assert.equal(await rival.evaluate(() => __game.raceTime), paused);
  await rival.evaluate(() => __game.startRace());
  assert.equal(await rival.evaluate(() => __game.raceTime), 0);
  assert.equal(await rival.evaluate(() => __game.challenge.id), run.id);
  // A failed upload is queued, survives reload, and can be retried against the real API.
  await rival.route("**/api/ghosts", (route) =>
    route.request().method() === "POST" ? route.abort() : route.continue(),
  );
  await finish(rival);
  await rival.waitForFunction(
    () => !__game.online.flushing && __game.online.pending.length === 1,
  );
  const queued = await rival.evaluate(() => __game.online.pending[0].id);
  await rival.reload();
  await rival.waitForFunction(() => window.__game?.state === "menu");
  assert.equal(await rival.evaluate(() => __game.online.pending[0].id), queued);
  await rival.unroute("**/api/ghosts");
  await rival.locator('[data-nav="ghosts"]').click();
  await rival.locator('[data-action="retry-ghosts"]').click();
  await rival.waitForFunction(() => __game.online.pending.length === 0);
  await rival.locator("[data-online-ghost]").first().waitFor();
  assert.equal(await rival.locator("[data-online-ghost]").count(), 2);
  await rival.setViewportSize({ width: 390, height: 844 });
  await rival.screenshot({
    path: "artifacts/ghost-mobile.png",
    fullPage: true,
  });
  assert.equal(
    await rival.evaluate(() => document.documentElement.scrollWidth),
    390,
  );
  assert.deepEqual(errors, []);
  console.log(
    "Ghost browser checks passed: two players, replay, pause/restart, queued retry, narrow layout.",
  );
} finally {
  await browser?.close();
  await server.close();
  await rm(directory, { recursive: true, force: true });
}
