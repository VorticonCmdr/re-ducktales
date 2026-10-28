import { waitForScene } from "./helpers/scene.js";
import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { openRecordedApplication } from "./helpers/clock.js";
import { easyJungleEntry } from "./helpers/easy-jungle-entry.js";
import {
  installEntryRecording,
  observeRecordedRoute,
  saveRecordedRoute,
} from "./helpers/entry-recording.js";
import inputs from "../../reference/security-jungle-treasure-inputs.json" with { type: "json" };
import accepted from "../../reference/security-jungle-treasure.json" with { type: "json" };
import entry from "../../reference/security-jungle-entry.json" with { type: "json" };

test("keyboard jungle completion awards treasure and prevents duplicate collection", async ({
  page,
}) => {
  test.setTimeout(180000);
  const capture = process.env.DUCKTALES_CAPTURE_JUNGLE_TREASURE;
  if (!capture)
    expect(
      accepted.pending,
      "SETUP: treasure capture requires independent acceptance",
    ).toBe(false);
  const errors = [],
    observations = [];
  let checked = 0;
  page.on("pageerror", (e) => errors.push(e.message));
  await installEntryRecording(page);
  await openRecordedApplication(page, 1);
  await expect(page.locator("#actions")).toBeVisible();
  const canvas = page.locator("#game"),
    state = async () => JSON.parse(await canvas.getAttribute("data-state"));
  async function until(predicate, max = 3000) {
    for (let i = 0; i < max; i++) {
      const s = await state();
      if (s?.diagnostic) throw Error(s.diagnostic);
      if (s && predicate(s)) return s;
      await page.clock.runFor(8);
    }
    throw Error(`unfinished treasure route ${JSON.stringify(await state())}`);
  }
  async function press(key) {
    await page.keyboard.press(key);
    await page.clock.runFor(100);
  }
  async function observe(name) {
    const point = await observeRecordedRoute({
      page,
      state: await state(),
      name,
    });
    observations.push(point);
    if (!capture) {
      const expected = accepted.checkpoints[checked++];
      expect(expected, "Required treasure checkpoint").toBeDefined();
      for (const key of [
        "name",
        "at",
        "eventCount",
        "stateSha256",
        "pixelsSha256",
      ])
        expect(point[key], `Treasure ${name} ${key}`).toEqual(expected[key]);
    }
    return point;
  }
  await until((s) => s.scene === "title");
  await canvas.focus();
  await press("Space");
  await waitForScene(page, canvas, "difficulty");
  await press("Enter");
  await waitForScene(page, canvas, "office");
  await easyJungleEntry({ page, canvas, state, until, press });
  const initial = await observe("entry");
  expect(initial.stateSha256).toBe(entry.entryStateSha256);
  expect(initial.pixelsSha256).toBe(entry.entryPixelsSha256);
  const stream = inputs.inputEvents.flatMap((e) => Array(e.count).fill(e.byte));
  expect(stream.length).toBe(860);
  expect(createHash("sha256").update(Buffer.from(stream)).digest("hex")).toBe(
    inputs.sha256,
  );
  let held = new Set(),
    used = 0;
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
    expect(after.jungle.frames, "Exactly one jungle input frame").toBe(
      before.jungle.frames + 1,
    );
    used++;
    if (used % 40 === 0 || used === stream.length)
      await observe(`input-${used}`);
  }
  for (const key of held) await page.keyboard.up(key);
  const award = await until((s) => s.scene !== "jungle", 1500);
  expect(used).toBe(860);
  expect(award.scene).toBe("expedition-result");
  expect(award.jungle.outcome.code).toBe(1);
  expect(award.expeditionResult.phase).toBe("award");
  expect(award.expeditionResult.value).toBe(1000);
  expect(award.money).toBe(award.jungle.money + 1000);
  expect(award.campaign.day).toBe(initial.state.campaign.day + 1);
  await observe("award");
  await canvas.screenshot({
    path: ".local/browser-results/jungle-treasure-award.png",
  });
  await press("Space");
  const returned = await until((s) => s.scene === "map");
  expect(returned.campaign.playerCollected).toEqual([1]);
  expect(returned.money).toBe(award.money);
  expect(returned.campaign.rivalUnlockMask).toBe(1);
  await observe("returned-map");
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
  ]).toEqual([
    returned.money,
    returned.campaign.day,
    returned.campaign.location,
  ]);
  await observe("collected-notice");
  await press("Space");
  const again = await until((s) => s.scene === "map");
  expect(again.money).toBe(award.money);
  expect(again.campaign.day).toBe(award.campaign.day);
  await observe("complete-map");
  if (capture)
    await saveRecordedRoute({
      page,
      root: capture,
      observations,
      scope:
        "Exploratory complete Easy jungle treasure and duplicate-notice route; not a complete campaign",
    });
  else expect(checked).toBe(accepted.expectedCheckpointCount);
  await expect(page.locator("#diagnostic")).toBeHidden();
  await page.locator("#restart").click();
  await page.clock.runFor(100);
  expect((await state()).scene).toBe("title");
  expect((await state()).jungle).toBeNull();
  expect(errors).toEqual([]);
  if (capture)
    throw Error(
      "EXPLORATORY treasure capture saved; this run is not acceptance",
    );
});
