import { chromium } from "@playwright/test";
const browser = await chromium.launch({
  channel: "msedge",
  headless: true,
  args: ["--disable-gpu-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (msg) => {
  if (msg.type() === "error" || msg.type() === "warning")
    errors.push(msg.text());
});
await page.goto("http://localhost:5187");
await page.waitForTimeout(2500);
console.log("initial", await page.locator("h1").innerText());
await page.screenshot({ path: "artifacts/phase1-home.png" });
await page.locator('[data-action="race"]').first().click();
await page.locator("[data-fullscreen]").click();
await page.waitForTimeout(3800);
await page.keyboard.down("w");
await page.waitForTimeout(3000);
await page.keyboard.down("Space");
await page.waitForTimeout(1000);
await page.keyboard.up("Space");
console.log(
  "driving",
  await page.evaluate(() => ({
    state: __game.state,
    s: __game.racers[0].s,
    speed: __game.racers[0].speed,
    boost: __game.racers[0].boost,
    length: __game.track.length,
  })),
);
await page.screenshot({ path: "artifacts/phase1-race.png" });
await page.keyboard.up("w");
await page.keyboard.press("Escape");
console.log("pause", await page.locator("#pause-menu").count());
console.log("errors", JSON.stringify(errors));
await browser.close();
