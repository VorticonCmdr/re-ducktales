import { expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { recordedDOMInput } from "./recorded-dom-input.js";
// Input-only playback. Model outcomes and observations never select controls.
export async function playJungleInputPlan({ page, state, checkpoint, path }) {
  const manifest = JSON.parse(await readFile(path));
  const bytes = await readFile(manifest.inputs.path).catch(() => {
    throw Error(`SETUP: missing jungle input plan ${manifest.inputs.path}`);
  });
  expect(bytes.length, "Input-plan byte count").toBe(manifest.inputs.bytes);
  expect(
    createHash("sha256").update(bytes).digest("hex"),
    "Input-plan identity",
  ).toBe(manifest.inputs.sha256);
  const plan = JSON.parse(bytes);
  expect(plan.clockOrigin).toBe(1);
  expect(plan.displayMilliseconds).toBe(8);
  expect(plan.events.length).toBeGreaterThan(0);
  expect(plan.events).toHaveLength(manifest.requiredEventCount);
  expect(plan.startAt).toBe(manifest.startAt);
  expect(plan.endAt).toBe(manifest.endAt);
  let time = await page.evaluate(() => performance.now()),
    consumed = 0,
    nextObservation = 80;
  expect(time, "Jungle plan initial external clock").toBe(plan.startAt);
  expect((await state()).scene).toBe("jungle");
  expect((await state()).jungle.frames).toBe(0);
  const held = new Set();
  for (const event of plan.events) {
    expect(Number.isFinite(event.time)).toBe(true);
    expect(event.time).toBeGreaterThanOrEqual(time);
    expect(event.time).toBeLessThanOrEqual(plan.endAt);
    expect(["keydown", "keyup"]).toContain(event.type);
    expect([
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Space",
    ]).toContain(event.key);
    if (event.time > time) await page.clock.runFor(event.time - time);
    time = event.time;
    await recordedDOMInput(page, event);
    consumed++;
    if (event.type === "keydown") held.add(event.key);
    else held.delete(event.key);
    const s = await state();
    expect(s.diagnostic).toBeNull();
    expect(
      ["jungle", "expedition-result"],
      "Unexpected jungle plan scene",
    ).toContain(s.scene);
    if (s.jungle.frames >= nextObservation) {
      await checkpoint(`hard-jungle-input-${s.jungle.frames}`);
      nextObservation += 80;
    }
  }
  expect(consumed).toBe(manifest.requiredEventCount);
  expect(held.size, "Unreleased required jungle controls").toBe(0);
  expect(plan.endAt).toBeGreaterThanOrEqual(time);
  if (plan.endAt > time) await page.clock.runFor(plan.endAt - time);
  const end = await state();
  expect(end.scene, "Complete physical jungle plan").toBe("expedition-result");
  expect(end.jungle.outcome.code, "Actual jungle treasure").toBe(1);
  expect(
    {
      scene: end.scene,
      frames: end.jungle.frames,
      lives: end.jungle.lives,
      pickupMoney: end.jungle.outcome.money,
      campaignMoney: end.money,
      outcome: end.jungle.outcome.code,
      seed: end.jungle.outcome.seed,
    },
    "Carried model outcome after all actual DOM inputs",
  ).toEqual(manifest.modelExpected);
  await checkpoint("hard-jungle-treasure");
  return { consumed, startAt: plan.startAt, endAt: plan.endAt };
}
