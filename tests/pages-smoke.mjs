import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const url = process.env.PAGES_URL || "https://henasayag.github.io/Apex-Shift/";
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({
      viewport: mobile
        ? { width: 844, height: 390 }
        : { width: 1440, height: 900 },
      hasTouch: mobile,
      isMobile: mobile,
    });
    const page = await context.newPage(),
      errors = [],
      badResponses = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.status() >= 400) badResponses.push(r.status() + " " + r.url());
    });
    await page.goto(url);
    await page.locator('[data-action="race"]').first().waitFor();
    assert.ok(
      await page.evaluate(
        () =>
          document.querySelector("#world").getContext("webgl2") instanceof
          WebGL2RenderingContext,
      ),
    );
    await page.locator('[data-nav="ghosts"]:visible').click();
    assert.equal(
      await page.locator('[data-action="online-run"]').isDisabled(),
      true,
    );
    assert.match(
      await page.locator("#online-ghost-list").innerText(),
      /require a game server/,
    );
    await page.locator('[data-nav="home"]').first().click();
    await page.locator('[data-action="race"]').first().click();
    await page.locator("[data-fullscreen]").click();
    await page.locator(".player-hud").waitFor();
    assert.match(await page.locator(".hud-lap").innerText(), /1 \/ 3/);
    await page.waitForTimeout(3800);
    if (mobile) {
      const cdp = await context.newCDPSession(page),
        box = await page.locator('[data-drive="boost"]').boundingBox();
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [
          { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 },
        ],
      });
      await page.waitForTimeout(1200);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    } else {
      await page.keyboard.down("w");
      await page.waitForTimeout(1200);
      await page.keyboard.up("w");
    }
    assert.ok(Number(await page.locator(".speed-value").innerText()) > 0);
    assert.match(await page.locator(".ghost-hud").textContent(), /SHADOW MODE/);
    await page.screenshot({
      path: `artifacts/pages-${mobile ? "mobile" : "desktop"}.png`,
    });
    await page.evaluate(() => document.exitFullscreen());
    await page.locator("[data-fullscreen]").waitFor();
    const time = await page.locator(".hud-time").innerText();
    await page.waitForTimeout(150);
    assert.equal(await page.locator(".hud-time").innerText(), time);
    assert.deepEqual(errors, []);
    assert.deepEqual(badResponses, []);
    console.log(
      `${mobile ? "Mobile" : "Desktop"} Pages WebGL race passed at ${url}`,
    );
    await context.close();
  }
} finally {
  await browser.close();
}
