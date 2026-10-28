import { waitForScene } from "./helpers/scene.js";
import { test, expect } from "@playwright/test";
import startup from "../../reference/campaign-startup-browser.json" with { type: "json" };
import { nextRandom } from "../../src/game/integer.js";
const route = startup.jungle;

test("keyboard jungle completion awards treasure and prevents duplicate collection", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // Only the external clock and real keyboard adapter are supplied. The8ms
  // display cadence observes every input sample without changing game clocks.
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-01T00:00:01Z"));
  await page.addInitScript(() => {
    window.requestAnimationFrame = (callback) =>
      setTimeout(() => callback(performance.now()), 8);
    window.cancelAnimationFrame = clearTimeout;
  });
  await page.goto("/");
  const canvas = page.locator("#game");
  const state = () => canvas.getAttribute("data-state").then(JSON.parse);
  async function until(predicate, max = 3000) {
    for (let i = 0; i < max; i++) {
      const s = await state();
      if (s?.diagnostic) throw Error(s.diagnostic);
      if (s && predicate(s)) return s;
      await page.clock.runFor(8);
    }
    throw Error(
      `unfinished jungle browser wait:${JSON.stringify(await state())}`,
    );
  }
  async function press(key) {
    await page.keyboard.press(key);
    await page.clock.runFor(100);
  }
  await until((s) => s.scene === "title");
  await canvas.focus();
  await press("Space");
  await waitForScene(page, canvas, "difficulty");
  await press("Enter");
  await waitForScene(page, canvas, "office");
  await page.locator("#map").click();
  await page.clock.runFor(100);
  const bounds = await canvas.boundingBox();
  await canvas.click({
    position: { x: (bounds.width * 64) / 320, y: (bounds.height * 73) / 200 },
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
  const entered = await until((s) => s.scene === "jungle");
  expect(entered.campaign.location).toBe(1);
  expect(entered.campaign.day).toBe(4);
  expect(entered.money).toBe(0);
  expect(entered.briefing.variant).toBe(0);
  expect(entered.briefing.seed).toBe(30127);
  expect(entered.jungle.seed).toBe(44031);
  expect(entered.jungle.frames).toBe(0);
  const stream = route.inputEvents.flatMap((e) => Array(e.count).fill(e.byte));
  expect(stream).toHaveLength(857);
  expect(route.checkpoints).toHaveLength(23);
  let held = new Set(),
    used = 0,
    checked = 0;
  for (const byte of stream) {
    const next = new Set([
      ...(byte & 64 ? ["Space"] : []),
      ...({
        1: ["ArrowUp"],
        3: ["ArrowRight"],
        5: ["ArrowDown"],
        7: ["ArrowLeft"],
      }[byte & 63] ?? []),
    ]);
    for (const key of held) if (!next.has(key)) await page.keyboard.up(key);
    for (const key of next) if (!held.has(key)) await page.keyboard.down(key);
    held = next;
    const before = await state();
    expect(before.scene).toBe("jungle");
    expect(before.jungle.frames).toBe(used);
    const after = await until(
      (s) => s.scene !== "jungle" || s.jungle.frames > before.jungle.frames,
      1500,
    );
    expect(after.jungle.frames).toBe(before.jungle.frames + 1);
    used++;
    const expected = route.checkpoints[checked];
    if (expected?.inputCount === used) {
      for (const field of route.browserComparisonFields)
        expect(
          after.jungle[field],
          `jungle checkpoint${checked} ${field}`,
        ).toEqual(expected.state[field]);
      checked++;
    }
  }
  for (const key of held) await page.keyboard.up(key);
  const awarded = await until((s) => s.scene !== "jungle", 1500);
  expect(used).toBe(857);
  expect(checked).toBe(23);
  expect(awarded.scene).toBe("expedition-result");
  expect(awarded.jungle.outcome.code).toBe(1);
  expect(awarded.jungle.lives).toBe(1);
  expect(awarded.jungle.frames).toBe(857);
  expect(awarded.jungle.presentations).toBe(904);
  expect(awarded.jungle.scroll).toBe(960);
  expect(awarded.jungle.money).toBe(0);
  expect(awarded.jungle.seed).toBe(60975);
  expect(awarded.expeditionResult.phase).toBe("award");
  expect(awarded.expeditionResult.value).toBe(1000);
  expect(awarded.money).toBe(1000);
  expect(awarded.campaign.day).toBe(5);
  await canvas.screenshot({
    path: ".local/browser-results/jungle-treasure-award.png",
  });
  await press("Space");
  const returned = await until((s) => s.scene === "map");
  expect(returned.campaign.playerCollected).toEqual([1]);
  expect(returned.money).toBe(1000);
  expect(returned.campaign.rivalUnlockMask).toBe(1);
  const idleRival = returned.campaign.rival,
    idleSeed = returned.seed;
  await page.clock.runFor(2000);
  expect((await state()).campaign.rival).toEqual(idleRival);
  expect((await state()).seed).toBe(idleSeed);
  await press("Space");
  const collected = await until((s) => s.scene === "visit-notice");
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
    // This dispatch is a rival miss: two RNG draws, with no extra report draw.
    nextRandom(nextRandom(returned.seed)),
  ]);
  await press("Space");
  const again = await until((s) => s.scene === "map");
  expect(again.money).toBe(1000);
  expect(again.campaign.day).toBe(5);
  await expect(page.locator("#diagnostic")).toBeHidden();
  await page.locator("#restart").click();
  await page.clock.runFor(100);
  const restarted = await state();
  expect(restarted.scene).toBe("title");
  expect(restarted.jungle).toBeNull();
  expect(errors).toEqual([]);
});
