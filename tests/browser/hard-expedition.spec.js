import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import manifest from "../../reference/hard-jungle-browser.json" with { type: "json" };
import inputs from "../../reference/hard-expedition-inputs.json" with { type: "json" };

test("Hard race, Bermuda treasure, bank and restart carry real browser state", async ({
  page,
}, info) => {
  test.setTimeout(180000);
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-01T00:00:01Z"));
  await page.addInitScript(() => {
    window.hardExpeditionEvents = [];
    for (const type of ["keydown", "keyup", "pointerdown", "pointerup"])
      document.addEventListener(type, (event) =>
        window.hardExpeditionEvents.push({
          at: performance.now(),
          type,
          code: event.code ?? null,
          target: event.target.closest?.("button,canvas")?.id ?? null,
        }),
      );
    window.requestAnimationFrame = (callback) =>
      setTimeout(() => callback(performance.now()), 8);
    window.cancelAnimationFrame = clearTimeout;
  });
  await page.goto("/");
  await expect(page.locator("#actions")).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Sound (reconstructed)" }),
  ).not.toBeChecked();
  const readyTime = await page.evaluate(() => performance.now());
  const canvas = page.locator("#game"),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const t = {
    canvas,
    errors,
    state: () => canvas.getAttribute("data-state").then(JSON.parse),
    async press(key) {
      await page.keyboard.press(key);
      await page.clock.runFor(100);
    },
    async point(x, y) {
      const r = await canvas.boundingBox();
      await canvas.click({
        position: { x: (r.width * x) / 320, y: (r.height * y) / 200 },
      });
      await page.clock.runFor(100);
    },
  };
  await canvas.focus();
  await t.press("Space");
  await t.press("ArrowUp");
  await t.press("Enter");
  async function until(predicate, max = 10000) {
    for (let n = 0; n < max; n++) {
      const s = await t.state();
      if (s.diagnostic) throw Error(s.diagnostic);
      if (predicate(s)) return s;
      await page.clock.runFor(8);
    }
    throw Error(
      `Unfinished Hard expedition: ${JSON.stringify(await t.state())}`,
    );
  }
  expect((await t.state()).difficulty).toBe(2);
  await page.locator("#map").click();
  await page.clock.runFor(100);
  await t.point(68, 77);
  await t.press("Space");
  await t.press("ArrowRight");
  await t.press("Space");
  expect((await t.state()).scene).toBe("departure");
  console.log("departure", JSON.stringify((await t.state()).departure));
  expect((await page.evaluate(() => performance.now())) - readyTime).toBe(800);
  await page.keyboard.down("Space");
  await until((s) => s.scene === "flight" && s.flight.speed > 4);
  let held = null,
    steps = 0;
  const flightTrace = [];
  for (; steps < 1500; steps++) {
    const s = await t.state(),
      f = s.flight;
    flightTrace.push(f);
    if (s.scene !== "flight" || ["landing", "complete"].includes(f.phase))
      break;
    const desired =
      f.tile > inputs.flight.approachTile
        ? f.y < 135
          ? 15
          : 0
        : f.y > inputs.flight.altitude[1]
          ? inputs.flight.climbHeading
          : f.y < inputs.flight.altitude[0]
            ? 15
            : 0;
    const delta = (desired - f.heading + 16) % 16;
    const next =
      f.speed < 4 || !delta ? null : delta < 8 ? "ArrowDown" : "ArrowUp";
    // Original obstacle routines flush the keyboard matrix. Reapply actual
    // controls at each newly observed action rather than assuming a prior
    // physical hold survived that routine.
    await page.keyboard.up("Space");
    if (held) await page.keyboard.up(held);
    await page.keyboard.down("Space");
    if (next) await page.keyboard.down(next);
    held = next;
    await until(
      (after) =>
        after.scene !== "flight" ||
        after.flight.frames > f.frames ||
        after.flight.phase !== f.phase,
    );
  }
  if (held) await page.keyboard.up(held);
  await page.keyboard.up("Space");
  await writeFile(
    info.outputPath("hard-flight.json"),
    JSON.stringify(flightTrace, null, 2),
  );
  expect(steps).toBeLessThan(1500);
  const entry = await until(
    (s) =>
      !["flight", "crash-repairs", "expedition-briefing"].includes(s.scene),
  );
  console.log("entry", JSON.stringify(entry));
  await writeFile(
    info.outputPath("hard-entry.json"),
    JSON.stringify(entry, null, 2),
  );
  await t.canvas.screenshot({ path: info.outputPath("hard-entry.png") });
  expect(entry.scene).toBe("jungle");
  expect(entry.briefing.variant).toBe(1);
  expect(entry.flight.outcome.code).toBe(1);
  expect(entry.flight.outcome.frames).toBe(manifest.flight.expectedFrames);
  expect(entry.flight.outcome.seed).toBe(manifest.flight.expectedSeed);
  expect(entry.jungle.seed).toBe(manifest.jungle.entrySeed);
  const route = manifest.jungle;
  const stream = inputs.jungle.flatMap((e) => Array(e.count).fill(e.byte));
  expect(stream).toHaveLength(route.expectedInputCount);
  expect(route.checkpoints).toHaveLength(route.expectedCheckpointCount);
  if (process.env.DUCKTALES_HARD_NEGATIVE === "wrong-climb") stream[12] = 3;
  let keys = new Set(),
    used = 0,
    checked = 0;
  const jungleTrace = [];
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
    for (const key of keys) if (!next.has(key)) await page.keyboard.up(key);
    for (const key of next) if (!keys.has(key)) await page.keyboard.down(key);
    keys = next;
    const before = await t.state();
    expect(before.scene).toBe("jungle");
    expect(before.jungle.frames).toBe(used);
    const after = await until(
      (s) => s.scene !== "jungle" || s.jungle.frames > used,
    );
    used++;
    expect(after.jungle.frames).toBe(used);
    jungleTrace.push(after.jungle);
    const expected = route.checkpoints[checked];
    if (expected?.inputCount === used) {
      for (const field of route.comparisonFields)
        expect(
          after.jungle[field],
          `Hard jungle checkpoint${used} ${field}`,
        ).toEqual(expected.state[field]);
      checked++;
    }
  }
  for (const key of keys) await page.keyboard.up(key);
  expect(used).toBe(route.expectedInputCount);
  expect(checked).toBe(route.expectedCheckpointCount);
  const award = await until((s) => s.scene === "expedition-result");
  expect(award.jungle.outcome).toEqual(route.expectedOutcome);
  expect(award.jungle.lives).toBe(3);
  expect(award.expeditionResult.value).toBe(route.treasure);
  expect(award.money).toBe(route.expectedCampaignMoney);
  expect(award.campaign.day).toBe(route.expectedCampaignDay);
  await t.canvas.screenshot({
    path: info.outputPath("hard-jungle-treasure.png"),
  });
  await writeFile(
    info.outputPath("hard-jungle.json"),
    JSON.stringify(jungleTrace, null, 2),
  );
  await t.press("Space");
  const returned = await until((s) => s.scene === "map");
  expect(returned.campaign.playerCollected).toContain(route.location);
  expect(returned.campaign.rivalUnlockMask).toBe(1);
  expect(returned.money).toBe(route.expectedCampaignMoney);
  await writeFile(
    info.outputPath("hard-return.json"),
    JSON.stringify(returned, null, 2),
  );
  await t.point(212, 131);
  await t.press("Space");
  const bank = await until((s) => s.scene === "bank");
  expect(bank.money).toBe(0);
  expect(bank.campaign.banked).toBe(2050);
  expect(bank.campaign.day).toBe(6);
  await page.keyboard.down("Space");
  await until((s) => s.scene !== "bank");
  await page.keyboard.up("Space");
  const deposited = await until((s) => s.scene === "map");
  expect(deposited.campaign.banked).toBe(2050);
  expect(deposited.campaign.playerCollected).toContain(2);
  await writeFile(
    info.outputPath("hard-bank.json"),
    JSON.stringify(deposited, null, 2),
  );
  await page.locator("#restart").click();
  await page.clock.runFor(100);
  const fresh = await until((s) => s.scene === "title");
  expect(fresh.money).toBe(0);
  expect(fresh.campaign.banked).toBe(0);
  expect(fresh.campaign.day).toBe(1);
  expect(fresh.campaign.playerCollected).toEqual([]);
  expect(fresh.jungle).toBeNull();
  expect(fresh.flight).toBeNull();
  const events = await page.evaluate(() => window.hardExpeditionEvents);
  const heldKeys = new Set();
  for (const e of events) {
    if (e.type === "keydown") heldKeys.add(e.code);
    if (e.type === "keyup") heldKeys.delete(e.code);
  }
  expect(events.length).toBeGreaterThan(0);
  expect([...heldKeys]).toEqual([]);
  await writeFile(
    info.outputPath("hard-events.json"),
    JSON.stringify(events, null, 2),
  );
  expect(t.errors).toEqual([]);
  await expect(page.locator("#diagnostic")).toBeHidden();
});
