import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { PNG } from "pngjs";
import { waitForScene } from "./helpers/scene.js";
import { easyJungleEntry } from "./helpers/easy-jungle-entry.js";
import { openRecordedApplication } from "./helpers/clock.js";
import {
  canonical,
  digest,
  installEntryRecording,
} from "./helpers/entry-recording.js";
import fixture from "../../reference/expedition-keyboard-jungle-entry.json" with { type: "json" };

test("jungle physical aliases, fresh repeats and source flushes move the actor", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  expect(fixture.expectedEntryCheckpointCount).toBe(1);
  expect(fixture.expectedEntryDOMEventCount).toBe(50);
  expect(fixture.injections).toEqual([]);
  expect(fixture.fittedInputs).toEqual([]);
  expect(digest(await readFile(fixture.parent.path))).toBe(
    fixture.parent.sha256,
  );
  expect(Object.keys(fixture.producerArtifacts)).toHaveLength(5);
  for (const spec of Object.values(fixture.producerArtifacts)) {
    const bytes = await readFile(spec.path);
    expect(bytes.length).toBe(spec.bytes);
    expect(digest(bytes)).toBe(spec.sha256);
  }
  await installEntryRecording(page);
  await openRecordedApplication(page, 1);
  await expect(page.locator("#actions")).toBeVisible();
  const canvas = page.locator("#game"),
    state = () => canvas.getAttribute("data-state").then(JSON.parse);
  async function until(fn, max = 5000) {
    for (let i = 0; i < max; i++) {
      const s = await state();
      if (s?.diagnostic) throw Error(s.diagnostic);
      if (s && fn(s)) return s;
      await page.clock.runFor(8);
    }
    throw Error(
      "Unfinished physical jungle browser sequence " +
        JSON.stringify(await state()),
    );
  }
  async function press(key) {
    await page.keyboard.press(key);
    await page.clock.runFor(100);
  }
  async function afterRead(read) {
    const s = await until(
      (s) => s.scene === "jungle" && s.expeditionKeys.reads > read,
    );
    expect(s.expeditionKeys.reads, "Skipped physical jungle input").toBe(
      read + 1,
    );
    return s;
  }
  await until((s) => s.scene === "title");
  await canvas.focus();
  await press("Space");
  await waitForScene(page, canvas, "difficulty");
  await press("Enter");
  await waitForScene(page, canvas, "office");
  const entered = await easyJungleEntry({ page, canvas, state, until, press });
  expect(await page.evaluate(() => window.entryEvents.length)).toBe(
    fixture.expectedEntryDOMEventCount,
  );
  expect(await page.evaluate(() => performance.now())).toBe(fixture.entryAt);
  expect(digest(canonical(entered))).toBe(fixture.stateSha256);
  const png = PNG.sync.read(
    Buffer.from(
      (await canvas.evaluate((c) => c.toDataURL())).split(",")[1],
      "base64",
    ),
  );
  expect(digest(png.data)).toBe(fixture.pixelsSha256);
  expect(entered.expeditionKeys).toEqual({
    mode: 0,
    reads: 0,
    byte: null,
    flags: Array(128).fill(0),
  });
  const legacy = { ...entered };
  delete legacy.expeditionKeys;
  expect(digest(canonical(legacy))).toBe(fixture.historicalStateSha256);
  const ready = await until((s) => s.expeditionKeys.reads === 2);
  await page.keyboard.down("KeyK");
  const right = await afterRead(ready.expeditionKeys.reads);
  expect(right.expeditionKeys.byte).toBe(3);
  await until((s) => s.expeditionKeys.flags[0x25] === 0);
  await page.keyboard.up("KeyK");
  const neutral = await afterRead(right.expeditionKeys.reads);
  expect(neutral.expeditionKeys.byte).toBe(0);
  expect(neutral.expeditionKeys.flags[0x25]).toBe(0);
  await until((s) => s.jungle.x > ready.jungle.x);
  const before = await state();
  await page.keyboard.down("ArrowRight");
  const made = await afterRead(before.expeditionKeys.reads);
  expect(made.expeditionKeys.byte).toBe(3);
  await until((s) => s.expeditionKeys.flags[0x4d] === 0);
  // A second down on the same physical key emits a real DOM repeat make.
  // No expected state refills a held slot after the source flush.
  await page.keyboard.down("ArrowRight");
  const repeated = await afterRead(made.expeditionKeys.reads);
  expect(repeated.expeditionKeys.byte).toBe(3);
  await page.keyboard.up("ArrowRight");
  await page.locator("#restart").click();
  await until((s) => s.scene === "title");
  expect((await state()).jungle).toBeNull();
  expect(errors).toEqual([]);
  await expect(page.locator("#diagnostic")).toBeHidden();
});
