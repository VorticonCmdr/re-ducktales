import { test, expect } from "@playwright/test";
import startup from "../../reference/campaign-startup-browser.json" with { type: "json" };
import ascent from "../../reference/mountain-ascent.json" with { type: "json" };
import { nextRandom } from "../../src/game/integer.js";
import { readFile } from "node:fs/promises";
import { PNG } from "pngjs";

test("keyboard mountain ascent awards treasure and prevents duplicate collection", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // A controlled 125 Hz display cadence lets the test observe every 70 Hz
  // simulation sample. Only browser time and real keyboard events are supplied;
  // the game, scheduler, resource loader and renderer are unmodified.
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-01T00:00:01Z"));
  await page.addInitScript(() => {
    window.requestAnimationFrame = (callback) =>
      setTimeout(() => callback(performance.now()), 8);
    window.cancelAnimationFrame = clearTimeout;
  });
  await page.goto("/");
  const c = page.locator("#game");
  await c.waitFor({ state: "visible" });
  const state = () => c.getAttribute("data-state").then(JSON.parse);
  for (
    let i = 0;
    i < 100 && (await c.getAttribute("data-scene")) !== "title";
    i++
  )
    await page.clock.runFor(20);
  await c.focus();
  async function press(key) {
    await page.keyboard.press(key);
    await page.clock.runFor(100);
  }
  async function until(predicate, n = 2000) {
    for (let i = 0; i < n; i++) {
      const s = await state();
      if (s.diagnostic) throw Error(s.diagnostic);
      if (predicate(s)) return s;
      await page.clock.runFor(15);
    }
    throw Error("unfinished wait " + JSON.stringify(await state()));
  }
  await press("Space");
  await press("Enter");
  await page.locator("#map").click();
  await page.clock.runFor(100);
  const r = await c.boundingBox();
  await c.click({
    position: { x: (r.width * 36) / 320, y: (r.height * 61) / 200 },
  });
  await page.clock.runFor(100);
  await press("Space");
  await press("ArrowRight");
  await press("Space");
  await page.keyboard.down("Space");
  await until((s) => s.scene === "flight" && s.flight.speed > 4);
  await page.keyboard.down("ArrowDown");
  await until((s) => s.flight.heading > 0);
  await page.keyboard.up("ArrowDown");
  await page.keyboard.up("Space");
  const entered = await until((s) => s.scene === "mountain");
  expect(entered.mountain.lives).toBe(3);
  expect(entered.flight.outcome.status).toBe("crashed");
  expect(entered.campaign.location).toBe(31);
  const route = ascent.inputEvents.flatMap((e) => Array(e.count).fill(e.byte));
  expect(route.length).toBe(764);
  let checkpoints = 0;
  // Feed actual keyboard adapter, advancing the browser clock in 1ms steps.
  // No game state is written. Each sample is held until frames increments once.
  let held = new Set();
  let used = 0;
  const rows = [];
  for (const byte of route) {
    const desired = new Set([
      ...(byte & 64 ? ["Space"] : []),
      ...({
        1: ["ArrowUp"],
        3: ["ArrowRight"],
        5: ["ArrowDown"],
        7: ["ArrowLeft"],
      }[byte & 63] ?? []),
    ]);
    for (const key of held) if (!desired.has(key)) await page.keyboard.up(key);
    for (const key of desired)
      if (!held.has(key)) await page.keyboard.down(key);
    held = desired;
    const before = await state();
    expect(before.scene).toBe("mountain");
    const frame = before.mountain.frames;
    let after;
    for (let i = 0; i < 500; i++) {
      await page.clock.runFor(1);
      after = await state();
      if (after.diagnostic) throw Error(after.diagnostic);
      if (after.scene !== "mountain" || after.mountain.frames > frame) break;
    }
    if (after.mountain.frames !== frame + 1)
      throw Error("sample count mismatch");
    used++;
    if (rows.at(-1) !== after.mountain.row) rows.push(after.mountain.row);
    const checkpoint = ascent.checkpoints[checkpoints];
    if (checkpoint?.inputCount === used) {
      for (const [key, value] of Object.entries(checkpoint))
        if (key !== "inputCount")
          expect(
            after.mountain[key],
            `checkpoint${checkpoints} ${key}`,
          ).toEqual(
            key === "seed"
              ? startup.mountain.checkpointSeeds[checkpoints]
              : value,
          );
      checkpoints++;
    }
  }
  for (const k of held) await page.keyboard.up(k);
  const result = await until((s) => s.scene !== "mountain", 1000);
  expect(used).toBe(764);
  expect(checkpoints).toBe(26);
  expect(result.scene).toBe("expedition-result");
  expect(result.mountain.outcome.code).toBe(1);
  expect(result.mountain.lives).toBe(3);
  expect(result.mountain.frames).toBe(764);
  expect(result.mountain.presentations).toBe(870);
  expect(result.mountain.money).toBe(100);
  expect(result.expeditionResult.phase).toBe("award");
  expect(result.expeditionResult.value).toBe(8000);
  expect(result.money).toBe(8100);
  expect(result.campaign.day).toBe(entered.campaign.day + 1);
  await page.screenshot({
    path: ".local/browser-results/mountain-summit-award.png",
  });
  await press("Space");
  const returned = await until((s) => s.scene === "map");
  expect(returned.campaign.playerCollected).toContain(31);
  expect(returned.money).toBe(8100);
  expect(returned.campaign.rivalUnlockMask).toBe(2);
  await press("Space");
  const report = await state();
  expect(report.scene).toBe("rival-report");
  expect(report.pendingCampaignAction).toEqual({ type: "travel", target: 31 });
  expect(report.campaign.rivalCollected).toContain(report.rivalReport.target);
  expect(report.campaign.rival.location).toBe(returned.campaign.rival.location);
  // Compare portrait pixels against the original report capture, independently
  // of this browser's destination text. Presentation clocks are supplied above.
  const expectedPortrait = PNG.sync.read(
    await readFile(".local/rival-value-report.png"),
  );
  const actualPortrait = PNG.sync.read(
    Buffer.from(
      (await c.evaluate((c) => c.toDataURL())).split(",")[1],
      "base64",
    ),
  );
  for (let y = 0; y < 200; y++)
    expect(
      Buffer.compare(
        actualPortrait.data.subarray(y * 1280, y * 1280 + 128 * 4),
        expectedPortrait.data.subarray(y * 1280, y * 1280 + 128 * 4),
      ),
    ).toBe(0);
  await c.screenshot({
    path: ".local/browser-results/campaign-rival-report.png",
  });
  const collected = await until((s) => s.scene === "visit-notice");
  expect(collected.campaign.rival.location).toBe(report.rivalReport.target);
  expect(collected.visitNotice.reason).toBe("player");
  expect([
    collected.money,
    collected.campaign.day,
    collected.campaign.location,
    collected.seed,
  ]).toEqual([
    returned.money,
    returned.campaign.day,
    returned.campaign.location,
    nextRandom(nextRandom(nextRandom(returned.seed))),
  ]);
  await press("Space");
  await until((s) => s.scene === "map");
  await expect(page.locator("#diagnostic")).toBeHidden();
  await page.locator("#restart").click();
  await page.clock.runFor(100);
  expect((await state()).scene).toBe("title");
  expect((await state()).mountain).toBeNull();
  expect(errors).toEqual([]);
});
