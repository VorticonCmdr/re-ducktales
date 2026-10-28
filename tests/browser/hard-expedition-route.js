import flightInputs from "../../reference/hard-flight-inputs.json" with { type: "json" };
import { replayFlightInputs } from "./helpers/flight-inputs.js";
import { waitForScene } from "./helpers/scene.js";
import { openRecordedApplication } from "./helpers/clock.js";
import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";

// Shared real-input route. Expected checkpoints never choose the input stream.
export async function runHardExpedition({
  page,
  info,
  manifest,
  inputs,
  negativeMode,
  activity = "jungle",
}) {
  test.setTimeout(180000);
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
  await openRecordedApplication(page, 1);
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
  await until((s) => s.scene === "title" && s.opening?.skipEnabled);
  await canvas.focus();
  await t.press("Space");
  await waitForScene(page, canvas, "difficulty");
  await t.press("ArrowUp");
  await until((s) => s.difficulty === 2);
  await t.press("Enter");
  await waitForScene(page, canvas, "office");
  async function until(predicate, max = 10000) {
    for (let n = 0; n < max; n++) {
      const s = await t.state();
      if (s?.diagnostic) throw Error(s.diagnostic);
      if (s && predicate(s)) return s;
      await page.clock.runFor(8);
    }
    throw Error(
      `Unfinished Hard expedition: ${JSON.stringify(await t.state())}`,
    );
  }
  expect((await t.state()).difficulty).toBe(2);
  await page.locator("#map").click();
  await page.clock.runFor(100);
  await t.point(...inputs.departurePoint);
  await t.press("Space");
  await t.press("ArrowRight");
  await t.press("Space");
  expect((await t.state()).scene).toBe("departure");
  console.log("departure", JSON.stringify((await t.state()).departure));
  // Startup now waits on the original reveal and closing wipe. Their timing is
  // recorded in the external event stream, not fitted to expedition outcomes.
  expect(
    (await page.evaluate(() => performance.now())) - readyTime,
  ).toBeGreaterThan(800);
  const flightTrace = await replayFlightInputs({
    page,
    until,
    profile: flightInputs.profiles[0],
  });
  await writeFile(
    info.outputPath("hard-flight.json"),
    JSON.stringify(flightTrace, null, 2),
  );
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
  expect(entry.scene).toBe(activity);
  expect(entry.briefing.variant).toBe(manifest[activity].variant);
  expect(entry.flight.outcome.code).toBe(1);
  expect(entry.flight.outcome.frames).toBe(manifest.flight.expectedFrames);
  expect(entry.flight.outcome.seed).toBe(manifest.flight.expectedSeed);
  expect(entry[activity].seed).toBe(manifest[activity].entrySeed);
  const route = manifest[activity];
  const stream = inputs[activity].flatMap((e) => Array(e.count).fill(e.byte));
  expect(stream).toHaveLength(route.expectedInputCount);
  expect(route.checkpoints).toHaveLength(route.expectedCheckpointCount);
  if (process.env.DUCKTALES_HARD_NEGATIVE === negativeMode)
    stream[manifest.negativeControl.inputIndex ?? 12] =
      manifest.negativeControl.replacementByte ?? 3;
  let keys = new Set(),
    used = 0,
    checked = 0;
  const expeditionTrace = [];
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
    expect(before.scene).toBe(activity);
    expect(before[activity].frames).toBe(used);
    const after = await until(
      (s) => s.scene !== activity || s[activity].frames > used,
    );
    used++;
    expect(after[activity].frames).toBe(used);
    expeditionTrace.push(after[activity]);
    const expected = route.checkpoints[checked];
    if (expected?.inputCount === used) {
      for (const field of route.comparisonFields)
        expect(
          after[activity][field],
          `Hard ${activity} checkpoint${used} ${field}`,
        ).toEqual(expected.state[field]);
      checked++;
    }
  }
  for (const key of keys) await page.keyboard.up(key);
  expect(used).toBe(route.expectedInputCount);
  expect(checked).toBe(route.expectedCheckpointCount);
  const award = await until((s) => s.scene === "expedition-result");
  expect(award[activity].outcome).toEqual(route.expectedOutcome);
  expect(award[activity].lives).toBe(3);
  expect(award.expeditionResult.value).toBe(route.treasure);
  expect(award.money).toBe(route.expectedCampaignMoney);
  expect(award.campaign.day).toBe(route.expectedCampaignDay);
  await t.canvas.screenshot({
    path: info.outputPath(`hard-${activity}-treasure.png`),
  });
  await writeFile(
    info.outputPath(`hard-${activity}.json`),
    JSON.stringify(expeditionTrace, null, 2),
  );
  await t.press("Space");
  const returned = await until((s) => s.scene === "map");
  expect(returned.campaign.playerCollected).toContain(route.location);
  expect(returned.campaign.rivalUnlockMask).toBe(route.expectedUnlockMask ?? 1);
  expect(returned.money).toBe(route.expectedCampaignMoney);
  await writeFile(
    info.outputPath("hard-return.json"),
    JSON.stringify(returned, null, 2),
  );
  await t.point(212, 131);
  await t.press("Space");
  const bank = await until((s) => s.scene === "bank");
  expect(bank.money).toBe(0);
  expect(bank.campaign.banked).toBe(route.expectedCampaignMoney);
  expect(bank.campaign.day).toBe(manifest.campaign.afterBank.day);
  await page.keyboard.down("Space");
  await until((s) => s.scene !== "bank");
  await page.keyboard.up("Space");
  const deposited = await until((s) => s.scene === "map");
  expect(deposited.campaign.banked).toBe(route.expectedCampaignMoney);
  expect(deposited.campaign.playerCollected).toContain(route.location);
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
  expect(fresh[activity]).toBeNull();
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
}
